"""
routers/terminal.py

MVP remote terminal broker for ClientFlow.

Designet til klienter bag NAT/firewall:
- Klient-agenten opretter selv outbound WSS til backend.
- Browser/frontend opretter WSS til backend.
- Backend broker kommandoer mellem browser og klient.

MVP'en er kommandobaseret, ikke fuld TTY/PTY endnu:
- Browser sender én kommando ad gangen.
- Klient kører kommandoen med /bin/bash -lc.
- stdout/stderr/exit-code returneres til browseren.
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlmodel import Session

from auth import verify_ws_token
from db import engine
from models import Client, User

router = APIRouter(prefix="/terminal", tags=["terminal"])


@dataclass
class ClientConnection:
    client_id: int
    websocket: WebSocket
    user_id: Optional[int]
    connected_at: float = field(default_factory=time.time)
    hostname: Optional[str] = None


@dataclass
class BrowserSession:
    session_id: str
    client_id: int
    websocket: WebSocket
    user_id: Optional[int]
    username: str
    connected_at: float = field(default_factory=time.time)


CLIENTS: dict[int, ClientConnection] = {}
BROWSERS: dict[str, BrowserSession] = {}
LOCK = asyncio.Lock()


async def _send_json(ws: WebSocket, payload: dict[str, Any]) -> None:
    await ws.send_text(json.dumps(payload, ensure_ascii=False))


def _extract_token(websocket: WebSocket) -> Optional[str]:
    token = websocket.query_params.get("token")
    if token:
        return token
    cookie_token = websocket.cookies.get("access_token")
    if cookie_token:
        return cookie_token
    auth_header = websocket.headers.get("authorization") or ""
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:]
    return None


def _get_ws_user(websocket: WebSocket) -> Optional[User]:
    token = _extract_token(websocket)
    if not token:
        return None
    with Session(engine) as session:
        return verify_ws_token(token, session)


def _client_exists_and_accessible(client_id: int, user: User) -> bool:
    with Session(engine) as session:
        client = session.get(Client, client_id)
        if not client:
            return False
        if getattr(user, "is_admin", False):
            return True
        if getattr(user, "role", None) == "bruger":
            return client.status == "approved" and client.school_id == user.school_id
        return False


async def _close_with_reason(websocket: WebSocket, code: int, reason: str) -> None:
    try:
        await websocket.close(code=code, reason=reason[:120])
    except Exception:
        pass


@router.websocket("/client/{client_id}/ws")
async def terminal_client_ws(websocket: WebSocket, client_id: int):
    """Klient-agentens outbound WebSocket."""
    await websocket.accept()

    user = _get_ws_user(websocket)
    if not user or not getattr(user, "is_admin", False):
        await _close_with_reason(websocket, 4403, "Kun admin/superadmin må forbinde terminal-agent")
        return

    if not _client_exists_and_accessible(client_id, user):
        await _close_with_reason(websocket, 4404, "Klient ikke fundet eller ingen adgang")
        return

    async with LOCK:
        old = CLIENTS.get(client_id)
        if old:
            try:
                await old.websocket.close(code=4400, reason="Ny terminal-agent forbandt")
            except Exception:
                pass
        CLIENTS[client_id] = ClientConnection(
            client_id=client_id,
            websocket=websocket,
            user_id=user.id,
        )

    await _send_json(websocket, {"type": "hello", "role": "client", "client_id": client_id})
    await _broadcast_status(client_id)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            msg_type = msg.get("type")
            session_id = msg.get("session_id")

            if msg_type == "hello":
                async with LOCK:
                    conn = CLIENTS.get(client_id)
                    if conn and conn.websocket is websocket:
                        conn.hostname = msg.get("hostname")
                await _broadcast_status(client_id)
                continue

            if session_id:
                async with LOCK:
                    browser = BROWSERS.get(str(session_id))
                if browser:
                    try:
                        await _send_json(browser.websocket, msg)
                    except Exception:
                        pass
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        async with LOCK:
            conn = CLIENTS.get(client_id)
            if conn and conn.websocket is websocket:
                CLIENTS.pop(client_id, None)
        await _broadcast_status(client_id)


@router.websocket("/browser/{client_id}/ws")
async def terminal_browser_ws(websocket: WebSocket, client_id: int):
    """Frontend/browserens terminal WebSocket."""
    await websocket.accept()

    user = _get_ws_user(websocket)
    if not user:
        await _close_with_reason(websocket, 4401, "Ikke logget ind")
        return

    # Remote terminal er bevidst superadmin-only.
    if not getattr(user, "is_superadmin", False):
        await _close_with_reason(websocket, 4403, "Kun superadmin må åbne remote terminal")
        return

    if not _client_exists_and_accessible(client_id, user):
        await _close_with_reason(websocket, 4404, "Klient ikke fundet eller ingen adgang")
        return

    session_id = uuid.uuid4().hex
    browser = BrowserSession(
        session_id=session_id,
        client_id=client_id,
        websocket=websocket,
        user_id=user.id,
        username=user.username,
    )

    async with LOCK:
        BROWSERS[session_id] = browser
        client_conn = CLIENTS.get(client_id)

    await _send_json(websocket, {
        "type": "hello",
        "role": "browser",
        "session_id": session_id,
        "client_id": client_id,
        "client_connected": bool(client_conn),
    })

    if not client_conn:
        await _send_json(websocket, {
            "type": "status",
            "level": "warning",
            "message": "Terminal-agenten er ikke forbundet på klienten endnu.",
        })

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                await _send_json(websocket, {"type": "error", "message": "Ugyldig JSON"})
                continue

            msg_type = msg.get("type")

            if msg_type == "ping":
                await _send_json(websocket, {"type": "pong", "ts": time.time()})
                continue

            if msg_type != "run":
                await _send_json(websocket, {"type": "error", "message": f"Ukendt type: {msg_type}"})
                continue

            command = str(msg.get("command") or "").strip()
            if not command:
                continue
            if len(command) > 4000:
                await _send_json(websocket, {"type": "error", "message": "Kommandoen er for lang"})
                continue

            request_id = uuid.uuid4().hex
            async with LOCK:
                client_conn = CLIENTS.get(client_id)

            if not client_conn:
                await _send_json(websocket, {
                    "type": "error",
                    "message": "Klientens terminal-agent er ikke forbundet.",
                })
                continue

            await _send_json(client_conn.websocket, {
                "type": "run",
                "session_id": session_id,
                "request_id": request_id,
                "command": command,
                "username": user.username,
            })
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await _send_json(websocket, {"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        async with LOCK:
            BROWSERS.pop(session_id, None)


async def _broadcast_status(client_id: int) -> None:
    async with LOCK:
        connected = client_id in CLIENTS
        browsers = [b for b in BROWSERS.values() if b.client_id == client_id]

    for browser in browsers:
        try:
            await _send_json(browser.websocket, {
                "type": "agent_status",
                "client_connected": connected,
            })
        except Exception:
            pass


@router.get("/clients/{client_id}/status")
def terminal_status(client_id: int):
    """Letvægts-status endpoint til debugging."""
    return {"client_id": client_id, "client_connected": client_id in CLIENTS}

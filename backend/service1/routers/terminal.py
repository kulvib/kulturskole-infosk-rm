"""
routers/terminal.py

Remote terminal broker for ClientFlow.

Design:
- Klient-agenten opretter outbound WSS til backend.
- Browser/frontend opretter WSS til backend.
- Backend broker kommandoer mellem browser og klient.

v6.6:
- Understøtter to terminalkanaler pr. klient:
    mode=user   -> almindelig terminal-agent som kiosk-bruger
    mode=admin  -> admin/root-terminal-agent på klienten
- Browser-terminal er fortsat superadmin-only.
- Remote desktop er IKKE ændret og forbliver kiosk-sessionen.
"""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from sqlmodel import Session

from auth import verify_ws_token
from db import engine
from models import Client, User

router = APIRouter(prefix="/terminal", tags=["terminal"])

VALID_TERMINAL_MODES = {"user", "admin"}


@dataclass
class ClientConnection:
    client_id: int
    mode: str
    websocket: WebSocket
    user_id: Optional[int]
    connected_at: float = field(default_factory=time.time)
    hostname: Optional[str] = None


@dataclass
class BrowserSession:
    session_id: str
    client_id: int
    mode: str
    websocket: WebSocket
    user_id: Optional[int]
    username: str
    connected_at: float = field(default_factory=time.time)


# Nøgle: (client_id, mode). Det gør, at user-terminal og admin/root-terminal
# kan være forbundet samtidigt uden at overskrive hinanden.
CLIENTS: dict[tuple[int, str], ClientConnection] = {}
BROWSERS: dict[str, BrowserSession] = {}
LOCK = asyncio.Lock()


def _normalize_mode(mode: str | None) -> str:
    value = (mode or "user").strip().lower()
    if value not in VALID_TERMINAL_MODES:
        return "user"
    return value


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


def _get_ws_user(websocket: WebSocket) -> Optional[User | Client]:
    token = _extract_token(websocket)
    if not token:
        return None
    with Session(engine) as session:
        return verify_ws_token(token, session)


def _client_exists_and_accessible(client_id: int, principal: User | Client) -> bool:
    with Session(engine) as session:
        client = session.get(Client, client_id)
        if not client:
            return False

        # Installeret klient-agent med client-token må kun tilgå sig selv
        # og kun hvis klienten er godkendt.
        if isinstance(principal, Client):
            return principal.id == client_id and client.status == "approved"

        if getattr(principal, "is_admin", False):
            return True

        if getattr(principal, "role", None) == "bruger":
            return client.status == "approved" and client.school_id == principal.school_id

        return False


async def _close_with_reason(websocket: WebSocket, code: int, reason: str) -> None:
    try:
        await websocket.close(code=code, reason=reason[:120])
    except Exception:
        pass


@router.websocket("/client/{client_id}/ws")
async def terminal_client_ws(
    websocket: WebSocket,
    client_id: int,
    mode: str = Query(default="user"),
):
    """Klient-agentens outbound WebSocket.

    mode=user:  normal kiosk-bruger terminal-agent
    mode=admin: root/admin terminal-agent på klienten
    """
    await websocket.accept()
    mode = _normalize_mode(mode)

    principal = _get_ws_user(websocket)
    if not principal:
        await _close_with_reason(websocket, 4401, "Ikke logget ind")
        return

    # Ubuntu-agenten må forbinde med et matchende client-token.
    # Admin-token må også bruges til debugging, men browser-ruten er superadmin-only.
    if isinstance(principal, Client):
        if principal.id != client_id:
            await _close_with_reason(websocket, 4403, "Client-token matcher ikke klient-id")
            return
    elif not getattr(principal, "is_admin", False):
        await _close_with_reason(
            websocket,
            4403,
            "Kun admin/superadmin eller matchende client-token må forbinde terminal-agent",
        )
        return

    if not _client_exists_and_accessible(client_id, principal):
        await _close_with_reason(websocket, 4404, "Klient ikke fundet, ikke godkendt eller ingen adgang")
        return

    key = (client_id, mode)
    async with LOCK:
        old = CLIENTS.get(key)
        if old:
            try:
                await old.websocket.close(code=4400, reason=f"Ny terminal-agent forbandt mode={mode}")
            except Exception:
                pass

        CLIENTS[key] = ClientConnection(
            client_id=client_id,
            mode=mode,
            websocket=websocket,
            user_id=None if isinstance(principal, Client) else principal.id,
        )

    await _send_json(websocket, {"type": "hello", "role": "client", "client_id": client_id, "mode": mode})
    await _broadcast_status(client_id, mode)

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
                    conn = CLIENTS.get(key)
                    if conn and conn.websocket is websocket:
                        conn.hostname = msg.get("hostname")
                await _broadcast_status(client_id, mode)
                continue

            if session_id:
                async with LOCK:
                    browser = BROWSERS.get(str(session_id))
                    # Send kun svar tilbage til browser-sessioner med samme mode.
                    if browser and browser.client_id == client_id and browser.mode == mode:
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
            conn = CLIENTS.get(key)
            if conn and conn.websocket is websocket:
                CLIENTS.pop(key, None)
        await _broadcast_status(client_id, mode)


@router.websocket("/browser/{client_id}/ws")
async def terminal_browser_ws(
    websocket: WebSocket,
    client_id: int,
    mode: str = Query(default="user"),
):
    """Frontend/browserens terminal WebSocket."""
    await websocket.accept()
    mode = _normalize_mode(mode)

    user = _get_ws_user(websocket)
    if not user:
        await _close_with_reason(websocket, 4401, "Ikke logget ind")
        return

    # Remote terminal er bevidst superadmin-only.
    # mode=admin giver root/admin-terminal og må ikke åbnes af almindelige admins.
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
        mode=mode,
        websocket=websocket,
        user_id=user.id,
        username=user.username,
    )

    key = (client_id, mode)
    async with LOCK:
        BROWSERS[session_id] = browser
        client_conn = CLIENTS.get(key)

    await _send_json(
        websocket,
        {
            "type": "hello",
            "role": "browser",
            "session_id": session_id,
            "client_id": client_id,
            "mode": mode,
            "client_connected": bool(client_conn),
        },
    )

    if not client_conn:
        label = "admin/root-terminal-agenten" if mode == "admin" else "terminal-agenten"
        await _send_json(
            websocket,
            {
                "type": "status",
                "level": "warning",
                "message": f"{label} er ikke forbundet på klienten endnu.",
            },
        )

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
                client_conn = CLIENTS.get(key)

            if not client_conn:
                await _send_json(
                    websocket,
                    {"type": "error", "message": "Klientens terminal-agent er ikke forbundet."},
                )
                continue

            await _send_json(
                client_conn.websocket,
                {
                    "type": "run",
                    "session_id": session_id,
                    "request_id": request_id,
                    "command": command,
                    "username": user.username,
                    "mode": mode,
                },
            )
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


async def _broadcast_status(client_id: int, mode: str) -> None:
    key = (client_id, mode)
    async with LOCK:
        connected = key in CLIENTS
        browsers = [b for b in BROWSERS.values() if b.client_id == client_id and b.mode == mode]

    for browser in browsers:
        try:
            await _send_json(
                browser.websocket,
                {"type": "agent_status", "client_connected": connected, "mode": mode},
            )
        except Exception:
            pass


@router.get("/clients/{client_id}/status")
def terminal_status(client_id: int, mode: str = Query(default="user")):
    """Letvægts-status endpoint til debugging."""
    mode = _normalize_mode(mode)
    return {
        "client_id": client_id,
        "mode": mode,
        "client_connected": (client_id, mode) in CLIENTS,
        "connected_modes": sorted([m for (cid, m) in CLIENTS.keys() if cid == client_id]),
    }

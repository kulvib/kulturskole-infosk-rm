"""
routers/remote_desktop.py

ClientFlow remote desktop broker, version 2 MVP.

Arkitektur:
- Klient-agenten opretter selv en outbound WSS-forbindelse til backend.
- Browser/frontend opretter WSS-forbindelse til backend.
- Backend broker frames og input-events mellem browser og klient.

Dette er ikke VNC/RDP. Det er en kontrolleret MVP:
- klient sender JPEG frames
- browser sender mus/tastatur-events
- klient udfører input lokalt via xdotool

Sikkerhed:
- browser-adgang er superadmin-only
- agent-adgang kræver admin/superadmin-token
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlmodel import Session

from auth import verify_ws_token
from db import engine
from models import Client, User

router = APIRouter(prefix="/remote-desktop", tags=["remote-desktop"])


@dataclass
class AgentConnection:
    client_id: int
    websocket: WebSocket
    user_id: Optional[int]
    connected_at: float = field(default_factory=time.time)
    hostname: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None


@dataclass
class BrowserSession:
    session_id: str
    client_id: int
    websocket: WebSocket
    user_id: Optional[int]
    username: str
    connected_at: float = field(default_factory=time.time)


AGENTS: dict[int, AgentConnection] = {}
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


@router.websocket("/agent/{client_id}/ws")
async def remote_desktop_agent_ws(websocket: WebSocket, client_id: int):
    """
    Klient-agentens outbound WebSocket.
    """
    await websocket.accept()

    user = _get_ws_user(websocket)
    if not user or not getattr(user, "is_admin", False):
        await _close_with_reason(websocket, 4403, "Kun admin/superadmin må forbinde remote desktop-agent")
        return

    if not _client_exists_and_accessible(client_id, user):
        await _close_with_reason(websocket, 4404, "Klient ikke fundet eller ingen adgang")
        return

    async with LOCK:
        old = AGENTS.get(client_id)
        if old:
            try:
                await old.websocket.close(code=4400, reason="Ny remote desktop-agent forbandt")
            except Exception:
                pass
        AGENTS[client_id] = AgentConnection(
            client_id=client_id,
            websocket=websocket,
            user_id=user.id,
        )

    await _send_json(websocket, {"type": "hello", "role": "agent", "client_id": client_id})
    await _broadcast_status(client_id)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            msg_type = msg.get("type")
            session_id = str(msg.get("session_id") or "")

            if msg_type == "hello":
                async with LOCK:
                    conn = AGENTS.get(client_id)
                    if conn and conn.websocket is websocket:
                        conn.hostname = msg.get("hostname")
                        if msg.get("width"):
                            conn.width = int(msg.get("width"))
                        if msg.get("height"):
                            conn.height = int(msg.get("height"))
                await _broadcast_status(client_id)
                continue

            if session_id:
                async with LOCK:
                    browser = BROWSERS.get(session_id)
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
            conn = AGENTS.get(client_id)
            if conn and conn.websocket is websocket:
                AGENTS.pop(client_id, None)
        await _broadcast_status(client_id)


@router.websocket("/browser/{client_id}/ws")
async def remote_desktop_browser_ws(websocket: WebSocket, client_id: int):
    """
    Frontend/browserens WebSocket til fjernskrivebord.
    """
    await websocket.accept()

    user = _get_ws_user(websocket)
    if not user:
        await _close_with_reason(websocket, 4401, "Ikke logget ind")
        return

    # Remote desktop giver skærm + input-adgang. Hold den superadmin-only.
    if not getattr(user, "is_superadmin", False):
        await _close_with_reason(websocket, 4403, "Kun superadmin må åbne fjernskrivebord")
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
        agent = AGENTS.get(client_id)

    await _send_json(websocket, {
        "type": "hello",
        "role": "browser",
        "session_id": session_id,
        "client_id": client_id,
        "agent_connected": bool(agent),
        "width": agent.width if agent else None,
        "height": agent.height if agent else None,
    })

    if agent:
        await _send_json(agent.websocket, {
            "type": "browser_connected",
            "session_id": session_id,
            "username": user.username,
        })
    else:
        await _send_json(websocket, {
            "type": "status",
            "level": "warning",
            "message": "Remote desktop-agenten er ikke forbundet på klienten endnu.",
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

            if msg_type not in {
                "start_stream",
                "stop_stream",
                "mouse",
                "key",
                "text",
                "request_frame",
            }:
                await _send_json(websocket, {"type": "error", "message": f"Ukendt type: {msg_type}"})
                continue

            msg["session_id"] = session_id
            msg["username"] = user.username

            async with LOCK:
                agent = AGENTS.get(client_id)

            if not agent:
                await _send_json(websocket, {
                    "type": "error",
                    "message": "Klientens remote desktop-agent er ikke forbundet.",
                })
                continue

            await _send_json(agent.websocket, msg)

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
            agent = AGENTS.get(client_id)

        if agent:
            try:
                await _send_json(agent.websocket, {
                    "type": "stop_stream",
                    "session_id": session_id,
                })
            except Exception:
                pass


async def _broadcast_status(client_id: int) -> None:
    async with LOCK:
        agent = AGENTS.get(client_id)
        browsers = [b for b in BROWSERS.values() if b.client_id == client_id]

    for browser in browsers:
        try:
            await _send_json(browser.websocket, {
                "type": "agent_status",
                "agent_connected": bool(agent),
                "width": agent.width if agent else None,
                "height": agent.height if agent else None,
            })
        except Exception:
            pass


@router.get("/clients/{client_id}/status")
def remote_desktop_status(client_id: int):
    return {
        "client_id": client_id,
        "agent_connected": client_id in AGENTS,
        "browser_sessions": len([b for b in BROWSERS.values() if b.client_id == client_id]),
    }

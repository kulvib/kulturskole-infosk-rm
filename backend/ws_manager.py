import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
connected_websockets = set()

@router.websocket("/ws/clients")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_websockets.add(websocket)
    try:
        while True:
            try:
                # Modtag besked med timeout
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                if data == "ping":
                    await websocket.send_text("pong")
                elif data == "frontend connected!":
                    pass  # Log evt.
                # Håndter evt. flere beskeder
            except asyncio.TimeoutError:
                # Ingen besked modtaget - forbindelsen holdes åben, evt. send ping
                pass
    except WebSocketDisconnect:
        connected_websockets.discard(websocket)

async def notify_clients_updated():
    dead = set()
    for ws in connected_websockets:
        try:
            await ws.send_text("update")
        except Exception:
            dead.add(ws)
    connected_websockets.difference_update(dead)

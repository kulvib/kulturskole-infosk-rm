from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Set

router = APIRouter()
connected_websockets: Set[WebSocket] = set()
MAX_WEBSOCKETS = 50

@router.websocket("/ws/clients")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    if len(connected_websockets) >= MAX_WEBSOCKETS:
        await websocket.close(code=1001, reason="Server overloaded")
        return
    connected_websockets.add(websocket)
    try:
        while True:
            try:
                await websocket.receive_text()
            except Exception:
                await websocket.close()
                break
    except Exception:
        pass
    finally:
        connected_websockets.discard(websocket)

async def notify_clients_updated():
    dead_websockets = set()
    for ws in list(connected_websockets):
        try:
            await ws.send_text("update")
        except Exception:
            dead_websockets.add(ws)
            try:
                await ws.close()
            except Exception:
                pass
    for ws in dead_websockets:
        connected_websockets.discard(ws)

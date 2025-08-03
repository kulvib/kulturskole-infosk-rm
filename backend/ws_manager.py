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
            await asyncio.sleep(10)  # Holder forbindelsen åben
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

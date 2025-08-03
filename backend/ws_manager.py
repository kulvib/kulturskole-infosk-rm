from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
connected_websockets = []

@router.websocket("/ws/clients")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_websockets.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_websockets.remove(websocket)

async def notify_clients_updated():
    for ws in connected_websockets[:]:
        try:
            await ws.send_text("update")
        except Exception:
            connected_websockets.remove(ws)

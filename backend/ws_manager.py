from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
connected_websockets = []

@router.websocket("/ws/clients")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_websockets.append(websocket)
    try:
        while True:
            await websocket.receive_text()  # holder forbindelsen åben
    except WebSocketDisconnect:
        connected_websockets.remove(websocket)

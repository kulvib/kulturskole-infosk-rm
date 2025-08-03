from fastapi import APIRouter, WebSocket

router = APIRouter()

@router.websocket("/ws/clients")
async def websocket_clients(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Echo: {data}")
    except Exception as e:
        print("WebSocket closed:", e)

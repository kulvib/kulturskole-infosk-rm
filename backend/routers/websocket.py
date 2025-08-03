from fastapi import APIRouter, WebSocket

router = APIRouter()

@router.websocket("/ws/clients")
async def websocket_clients(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Venter på besked fra klient (kan også bruge ping/pong eller sende data)
            data = await websocket.receive_text()
            # Echo tilbage
            await websocket.send_text(f"Echo: {data}")
    except Exception as e:
        print("WebSocket closed:", e)

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.broadcaster: WebSocket = None
        self.viewers: List[WebSocket] = []

    async def connect_broadcaster(self, websocket: WebSocket):
        await websocket.accept()
        self.broadcaster = websocket
        await websocket.send_json({"type": "ack", "role": "broadcaster"})

    async def connect_viewer(self, websocket: WebSocket):
        await websocket.accept()
        self.viewers.append(websocket)
        await websocket.send_json({"type": "ack", "role": "viewer"})
        if self.broadcaster:
            await self.broadcaster.send_json({"type": "newViewer"})

    async def disconnect(self, websocket: WebSocket):
        if websocket == self.broadcaster:
            self.broadcaster = None
        if websocket in self.viewers:
            self.viewers.remove(websocket)

    async def relay(self, sender: WebSocket, message: dict):
        # Routing logic
        if sender == self.broadcaster:
            # Broadcaster sender fx 'offer' til viewers
            for v in self.viewers:
                await v.send_json(message)
        elif sender in self.viewers and self.broadcaster:
            # Viewer sender fx 'answer' eller 'ice-candidate' til broadcaster
            await self.broadcaster.send_json(message)

manager = ConnectionManager()

@router.websocket("/ws/livestream")
async def livestream_endpoint(websocket: WebSocket):
    try:
        data = await websocket.receive_json()
        if data.get("type") == "broadcaster":
            await manager.connect_broadcaster(websocket)
        elif data.get("type") == "viewer":
            await manager.connect_viewer(websocket)
        else:
            await websocket.close()
            return

        while True:
            msg = await websocket.receive_json()
            await manager.relay(websocket, msg)
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception:
        await manager.disconnect(websocket)
        try:
            await websocket.close()
        except:
            pass

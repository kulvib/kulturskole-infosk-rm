print("### livestream.py LOADED ###")

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List

router = APIRouter()

class Room:
    def __init__(self):
        self.broadcaster: WebSocket = None
        self.viewers: List[WebSocket] = []

rooms: Dict[str, Room] = {}

@router.websocket("/ws/livestream/{client_id}")
async def livestream_endpoint(websocket: WebSocket, client_id: str):
    print(f"WebSocket-forbindelse forsøgt for client_id={client_id}")
    await websocket.accept()
    if client_id not in rooms:
        rooms[client_id] = Room()
    room = rooms[client_id]
    try:
        data = await websocket.receive_json()
        if data.get("type") == "broadcaster":
            room.broadcaster = websocket
            await websocket.send_json({"type": "ack", "role": "broadcaster"})
        elif data.get("type") == "viewer":
            room.viewers.append(websocket)
            await websocket.send_json({"type": "ack", "role": "viewer"})
            if room.broadcaster:
                await room.broadcaster.send_json({"type": "newViewer"})
        else:
            await websocket.close()
            return

        while True:
            msg = await websocket.receive_json()
            if websocket == room.broadcaster:
                for v in room.viewers:
                    await v.send_json(msg)
            elif websocket in room.viewers and room.broadcaster:
                await room.broadcaster.send_json(msg)
    except WebSocketDisconnect:
        if websocket == room.broadcaster:
            room.broadcaster = None
        if websocket in room.viewers:
            room.viewers.remove(websocket)
    except Exception:
        if websocket == room.broadcaster:
            room.broadcaster = None
        if websocket in room.viewers:
            room.viewers.remove(websocket)
        try:
            await websocket.close()
        except:
            pass

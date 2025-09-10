from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict

router = APIRouter()

class Room:
    def __init__(self):
        self.broadcaster: WebSocket = None
        self.viewers: Dict[str, WebSocket] = {}  # key: viewer_id

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
        # Broadcaster tilmelder sig
        if data.get("type") == "broadcaster":
            room.broadcaster = websocket
            await websocket.send_json({"type": "ack", "role": "broadcaster"})
        # Viewer tilmelder sig
        elif data.get("type") == "newViewer":
            viewer_id = str(data.get("viewer_id"))
            room.viewers[viewer_id] = websocket
            await websocket.send_json({"type": "ack", "role": "viewer", "viewer_id": viewer_id})
            # Giv broadcaster besked om ny viewer
            if room.broadcaster:
                await room.broadcaster.send_json({
                    "type": "newViewer",
                    "viewer_id": viewer_id
                })
        else:
            await websocket.close()
            return

        while True:
            msg = await websocket.receive_json()
            # Broadcaster sender: videresend til korrekt viewer
            if websocket == room.broadcaster:
                viewer_id = msg.get("viewer_id")
                if viewer_id and viewer_id in room.viewers:
                    await room.viewers[viewer_id].send_json(msg)
            # Viewer sender: videresend til broadcaster
            else:
                viewer_id = None
                for vid, ws in room.viewers.items():
                    if ws == websocket:
                        viewer_id = vid
                        break
                if room.broadcaster and viewer_id:
                    msg["viewer_id"] = viewer_id
                    await room.broadcaster.send_json(msg)
    except WebSocketDisconnect:
        # Fjern viewer eller broadcaster ved disconnect
        if websocket == room.broadcaster:
            room.broadcaster = None
        for vid, ws in list(room.viewers.items()):
            if ws == websocket:
                del room.viewers[vid]
    except Exception:
        if websocket == room.broadcaster:
            room.broadcaster = None
        for vid, ws in list(room.viewers.items()):
            if ws == websocket:
                del room.viewers[vid]
        try:
            await websocket.close()
        except:
            pass

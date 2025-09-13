from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from typing import Dict
import os

router = APIRouter()

# --- HLS setup ---
HLS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "hls"))
os.makedirs(HLS_DIR, exist_ok=True)

@router.post("/hls/upload")
async def upload_hls_file(file: UploadFile = File(...)):
    file_location = os.path.join(HLS_DIR, file.filename)
    with open(file_location, "wb") as f:
        content = await file.read()
        f.write(content)
    return {"filename": file.filename}

@router.get("/hls/{filename}")
async def get_hls_file(filename: str):
    file_path = os.path.join(HLS_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

# --- WebRTC signalering ---
class Room:
    def __init__(self):
        self.broadcaster: WebSocket = None
        self.viewers: Dict[str, WebSocket] = {}

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
        print(f"Første besked modtaget fra {client_id}: {data}")
        # Broadcaster tilmelder sig
        if data.get("type") == "broadcaster":
            room.broadcaster = websocket
            print(f"Broadcaster tilsluttet for client_id={client_id}")
            await websocket.send_json({"type": "ack", "role": "broadcaster"})
        # Viewer tilmelder sig
        elif data.get("type") == "newViewer":
            viewer_id = str(data.get("viewer_id"))
            room.viewers[viewer_id] = websocket
            print(f"Viewer {viewer_id} tilsluttet for client_id={client_id}")
            await websocket.send_json({"type": "ack", "role": "viewer", "viewer_id": viewer_id})
            # Giv broadcaster besked om ny viewer
            if room.broadcaster:
                await room.broadcaster.send_json({
                    "type": "newViewer",
                    "viewer_id": viewer_id
                })
            else:
                print(f"Ingen broadcaster tilsluttet for client_id={client_id} (viewer {viewer_id})")
        else:
            print(f"Ukendt type i første besked: {data}")
            await websocket.close()
            return

        while True:
            msg = await websocket.receive_json()
            print(f"Besked modtaget på ws for client_id={client_id}: {msg}")
            # Broadcaster sender: videresend til korrekt viewer
            if websocket == room.broadcaster:
                viewer_id = msg.get("viewer_id")
                if viewer_id and viewer_id in room.viewers:
                    print(f"Videresender besked fra broadcaster til viewer_id={viewer_id}")
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
                    print(f"Videresender besked fra viewer {viewer_id} til broadcaster")
                    await room.broadcaster.send_json(msg)
    except WebSocketDisconnect:
        print(f"WebSocketDisconnect for client_id={client_id}")
        if websocket == room.broadcaster:
            print(f"Broadcaster frakoblet for client_id={client_id}")
            room.broadcaster = None
        for vid, ws in list(room.viewers.items()):
            if ws == websocket:
                print(f"Viewer {vid} frakoblet for client_id={client_id}")
                del room.viewers[vid]
    except Exception as e:
        print(f"Exception i ws for client_id={client_id}: {e}")
        if websocket == room.broadcaster:
            room.broadcaster = None
        for vid, ws in list(room.viewers.items()):
            if ws == websocket:
                del room.viewers[vid]
        try:
            await websocket.close()
        except:
            pass

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException, Form
from typing import Dict
import os

router = APIRouter()

# --- HLS setup ---
HLS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "hls"))
os.makedirs(HLS_DIR, exist_ok=True)

@router.post("/hls/upload")
async def upload_hls_file(
    file: UploadFile = File(...),
    client_id: str = Form(...)
):
    """
    Modtag segment fra en producer og opdater manifest for korrekt client_id.
    Logger filsti og størrelse. Sletter gamle segmenter, så kun de 5 nyeste beholdes.
    """
    client_dir = os.path.join(HLS_DIR, client_id)
    os.makedirs(client_dir, exist_ok=True)
    seg_path = os.path.join(client_dir, file.filename)
    content = await file.read()
    with open(seg_path, "wb") as f:
        f.write(content)
    print(f"[UPLOAD] Segment gemt: {seg_path}, størrelse: {len(content)} bytes")
    update_manifest(client_dir, keep_last_n=5)
    return {"filename": file.filename, "client_id": client_id}

def update_manifest(client_dir, keep_last_n=5):
    # Find og sorter alle segmenter (fx .mp4)
    segments = sorted([f for f in os.listdir(client_dir) if f.endswith(".mp4")])
    # Slet gamle segmenter, hvis der er for mange
    if len(segments) > keep_last_n:
        to_delete = segments[:-keep_last_n]
        for seg in to_delete:
            os.remove(os.path.join(client_dir, seg))
        segments = segments[-keep_last_n:]  # behold kun de nyeste

    # Skriv manifest for de nuværende segmenter
    manifest_path = os.path.join(client_dir, "index.m3u8")
    with open(manifest_path, "w") as m3u:
        m3u.write("#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:5\n#EXT-X-MEDIA-SEQUENCE:0\n")
        for seg in segments:
            m3u.write("#EXTINF:5.0,\n")
            m3u.write(f"{seg}\n")
    print(f"[MANIFEST] Manifest opdateret: {manifest_path} ({len(segments)} segmenter)")

# --- WebRTC signalering (kan beholdes, men ikke relevant for HLS upload) ---
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

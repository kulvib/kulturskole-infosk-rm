from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException, Form, Body
from typing import Dict, List
import os
import traceback

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
    try:
        client_dir = os.path.join(HLS_DIR, client_id)
        os.makedirs(client_dir, exist_ok=True)
        seg_path = os.path.join(client_dir, file.filename)
        content = await file.read()
        with open(seg_path, "wb") as f:
            f.write(content)
        print(f"[UPLOAD] Segment gemt: {seg_path}, størrelse: {len(content)} bytes")
        try:
            update_manifest(client_dir, keep_last_n=5)
        except Exception as em:
            print("[FEJL VED MANIFEST]", em)
            traceback.print_exc()
        return {"filename": file.filename, "client_id": client_id}
    except Exception as e:
        print("[FEJL VED UPLOAD]", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Fejl i upload: {e}")

@router.post("/hls/cleanup")
async def cleanup_hls_files(
    client_id: str = Body(...),
    keep_files: List[str] = Body(...)
):
    """
    Slet alle segmenter for client_id undtagen dem i keep_files.
    """
    try:
        client_dir = os.path.join(HLS_DIR, client_id)
        if not os.path.exists(client_dir):
            return {"deleted": [], "kept": []}
        all_files = [f for f in os.listdir(client_dir) if f.endswith(".mp4")]
        to_delete = [f for f in all_files if f not in keep_files]
        for seg in to_delete:
            os.remove(os.path.join(client_dir, seg))
            print(f"[CLEANUP] Slettede gammelt segment: {seg}")
        # Opdatér manifest så det kun indeholder de ønskede segmenter
        update_manifest(client_dir, keep_last_n=len(keep_files))
        return {"deleted": to_delete, "kept": keep_files}
    except Exception as e:
        print("[FEJL VED CLEANUP]", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Fejl i cleanup: {e}")

def update_manifest(client_dir, keep_last_n=5):
    # Find og sorter alle segmenter (.mp4)
    segments = sorted([f for f in os.listdir(client_dir) if f.endswith(".mp4")])
    print(f"[MANIFEST] Fundne segmenter: {segments}")
    # Slet gamle segmenter, hvis der er for mange
    if len(segments) > keep_last_n:
        to_delete = segments[:-keep_last_n]
        for seg in to_delete:
            os.remove(os.path.join(client_dir, seg))
        segments = segments[-keep_last_n:]  # behold kun de nyeste

    # Udtræk første segmentnummer til EXT-X-MEDIA-SEQUENCE
    def extract_num(filename):
        # Prøv at udtrække tal fra format: segment_00083.mp4 eller fixed_segment_00042.mp4
        import re
        m = re.search(r'(\d+)', filename)
        if m:
            return int(m.group(1))
        print(f"[MANIFEST] Kunne ikke udtrække nummer fra: {filename}")
        return 0

    if segments:
        media_seq = extract_num(segments[0])
    else:
        media_seq = 0

    # Skriv manifest for de nuværende segmenter
    manifest_path = os.path.join(client_dir, "index.m3u8")
    with open(manifest_path, "w") as m3u:
        m3u.write("#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:5\n")
        m3u.write(f"#EXT-X-MEDIA-SEQUENCE:{media_seq}\n")
        for seg in segments:
            m3u.write("#EXTINF:5.0,\n")
            m3u.write(f"{seg}\n")
    print(f"[MANIFEST] Manifest opdateret: {manifest_path} (start={media_seq}, {len(segments)} segmenter)")

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
        traceback.print_exc()
        if websocket == room.broadcaster:
            room.broadcaster = None
        for vid, ws in list(room.viewers.items()):
            if ws == websocket:
                del room.viewers[vid]
        try:
            await websocket.close()
        except:
            pass

import os
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException, Form, Body
from typing import Dict, List
import traceback
import re
from datetime import datetime

# --- Central HLS_DIR-definition her ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICE1_HLS_DIR = os.path.join(BASE_DIR, "..", "service1", "hls")
ROOT_HLS_DIR = os.path.join(BASE_DIR, "..", "hls")
if os.path.isdir(SERVICE1_HLS_DIR):
    HLS_DIR = os.path.abspath(SERVICE1_HLS_DIR)
else:
    HLS_DIR = os.path.abspath(ROOT_HLS_DIR)
os.makedirs(HLS_DIR, exist_ok=True)

router = APIRouter()

def extract_num(filename, prefix="segment_"):
    m = re.match(rf"{re.escape(prefix)}(\d+)\.(mp4|ts)$", filename)
    return int(m.group(1)) if m else -1

def update_manifest(client_dir, keep_n=4, segment_duration=6):
    seg_types = [".ts", ".mp4"]
    for ext in seg_types:
        segs = sorted(
            [f for f in os.listdir(client_dir)
             if f.startswith("segment_") and f.endswith(ext)
             and os.path.getsize(os.path.join(client_dir, f)) > 1000],
            key=lambda f: extract_num(f, "segment_")
        )
        if segs:
            manifest_segs = segs[-keep_n:]
            media_seq = extract_num(manifest_segs[0], "segment_")
            manifest_path = os.path.join(client_dir, "index.m3u8")
            with open(manifest_path, "w", encoding="utf-8", newline="\n") as m3u:
                m3u.write("#EXTM3U\n")
                m3u.write("#EXT-X-VERSION:3\n")
                m3u.write(f"#EXT-X-TARGETDURATION:{segment_duration}\n")
                m3u.write(f"#EXT-X-MEDIA-SEQUENCE:{media_seq}\n")
                for seg in manifest_segs:
                    m3u.write(f"#EXTINF:{segment_duration}.0,\n")
                    m3u.write(f"{seg}\n")
            print(f"[MANIFEST] Opdateret manifest for {client_dir}: {manifest_path} ({media_seq}..{extract_num(manifest_segs[-1], 'segment_')})")
            return
    print(f"[MANIFEST] Ingen segmenter fundet til manifest i {client_dir}")

@router.post("/hls/upload")
async def upload_hls_file(
    file: UploadFile = File(...),
    client_id: str = Form(...)
):
    try:
        allowed_exts = [".ts", ".mp4"]
        if not any(file.filename.endswith(ext) for ext in allowed_exts):
            raise HTTPException(status_code=400, detail="Kun .ts eller .mp4 segmenter understøttes")
        client_dir = os.path.join(HLS_DIR, client_id)
        os.makedirs(client_dir, exist_ok=True)
        seg_path = os.path.join(client_dir, file.filename)
        content = await file.read()
        with open(seg_path, "wb") as f:
            f.write(content)
        print(f"[UPLOAD] Segment gemt: {seg_path}, størrelse: {len(content)} bytes")
        update_manifest(client_dir)
        return {"filename": file.filename, "client_id": client_id}
    except Exception as e:
        print("[FEJL VED UPLOAD]", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Fejl i upload: {e}")

@router.post("/hls/cleanup")
async def cleanup_hls_files(
    client_id: str = Body(...),
    keep_files: List[str] = Body(...),
    keep_n: int = 4,
    segment_duration: int = 6,
):
    try:
        print(f"[SERVER][CLEANUP] Modtog keep_files: {keep_files}")
        client_dir = os.path.join(HLS_DIR, client_id)
        if not os.path.exists(client_dir):
            return {"deleted": [], "kept": []}
        all_files = [f for f in os.listdir(client_dir) if f.startswith("segment_") and (f.endswith(".ts") or f.endswith(".mp4"))]
        to_delete = [f for f in all_files if f not in keep_files]
        for seg in to_delete:
            try:
                os.remove(os.path.join(client_dir, seg))
                print(f"[CLEANUP] Slettede gammelt segment: {seg}")
            except Exception as e:
                print(f"[CLEANUP] Kunne ikke slette {seg}: {e}")

        update_manifest(client_dir, keep_n=keep_n, segment_duration=segment_duration)
        kept = sorted(
            [f for f in os.listdir(client_dir) if f.startswith("segment_") and (f.endswith(".ts") or f.endswith(".mp4"))],
            key=lambda f: extract_num(f, "segment_")
        )
        return {"deleted": to_delete, "kept": kept}
    except Exception as e:
        print("[FEJL VED CLEANUP]", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Fejl i cleanup: {e}")

@router.get("/hls/{client_id}/last-segment-info")
def get_last_segment_info(client_id: str):
    client_dir = os.path.join(HLS_DIR, client_id)
    manifest_path = os.path.join(client_dir, "index.m3u8")
    if not os.path.exists(manifest_path):
        return {"error": "no manifest"}
    with open(manifest_path, "r") as m3u:
        lines = m3u.readlines()
    segment_files = [line.strip() for line in lines if line.strip().startswith("segment_")]
    if not segment_files:
        return {"error": "no segments"}
    last_segment = segment_files[-1]
    seg_path = os.path.join(client_dir, last_segment)
    if not os.path.exists(seg_path):
        return {"error": "segment missing"}
    mtime = os.path.getmtime(seg_path)
    # Lav timestamp uden mikrosekunder
    dt = datetime.utcfromtimestamp(mtime).replace(microsecond=0)
    timestamp_iso = dt.isoformat() + "Z"
    result = {
        "segment": last_segment,
        "timestamp": timestamp_iso,
        "epoch": mtime
    }
    # Debug-print
    # import json; print("[DEBUG][last-segment-info]", json.dumps(result))
    return result

@router.post("/hls/{client_id}/reset")
def reset_hls(client_id: str):
    client_dir = os.path.join(HLS_DIR, client_id)
    print(f"[RESET] Prøver at nulstille {client_dir}")
    if not os.path.exists(client_dir):
        print("[RESET] Mappen findes ikke.")
        return {"message": "already cleaned"}
    for f in os.listdir(client_dir):
        try:
            os.remove(os.path.join(client_dir, f))
        except Exception as e:
            print(f"[RESET] Kunne ikke slette {f}: {e}")
            raise HTTPException(status_code=400, detail=f"Could not delete {f}: {e}")
    print("[RESET] Nulstilling færdig.")
    return {"message": "reset done"}

# --- WebRTC signalering (samme som før) ---
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
        if data.get("type") == "broadcaster":
            room.broadcaster = websocket
            print(f"Broadcaster tilsluttet for client_id={client_id}")
            await websocket.send_json({"type": "ack", "role": "broadcaster"})
        elif data.get("type") == "newViewer":
            viewer_id = str(data.get("viewer_id"))
            room.viewers[viewer_id] = websocket
            print(f"Viewer {viewer_id} tilsluttet for client_id={client_id}")
            await websocket.send_json({"type": "ack", "role": "viewer", "viewer_id": viewer_id})
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
            if websocket == room.broadcaster:
                viewer_id = msg.get("viewer_id")
                if viewer_id and viewer_id in room.viewers:
                    print(f"Videresender besked fra broadcaster til viewer_id={viewer_id}")
                    await room.viewers[viewer_id].send_json(msg)
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

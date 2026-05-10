import os
import re
import traceback
from datetime import datetime, timezone
from typing import Dict, List

from fastapi import (
    APIRouter, WebSocket, WebSocketDisconnect,
    UploadFile, File, HTTPException, Form, Body, Response, Depends, Query
)
from auth import get_current_user, verify_ws_token
from db import get_session
from models import utcnow
from sqlmodel import Session

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICE1_HLS_DIR = os.path.join(BASE_DIR, "..", "service1", "hls")
ROOT_HLS_DIR = os.path.join(BASE_DIR, "..", "hls")
if os.path.isdir(SERVICE1_HLS_DIR):
    HLS_DIR = os.path.abspath(SERVICE1_HLS_DIR)
else:
    HLS_DIR = os.path.abspath(ROOT_HLS_DIR)
os.makedirs(HLS_DIR, exist_ok=True)

router = APIRouter()


def safe_client_dir(client_id: str) -> str:
    """Forhindrer path traversal ved at validere client_id."""
    if not re.match(r'^[a-zA-Z0-9_-]+$', client_id):
        raise HTTPException(status_code=400, detail="Ugyldigt client_id format")
    path = os.path.abspath(os.path.join(HLS_DIR, client_id))
    if not path.startswith(os.path.abspath(HLS_DIR)):
        raise HTTPException(status_code=400, detail="Ugyldigt client_id")
    return path


def extract_num(filename, prefix="segment_"):
    m = re.match(rf"{re.escape(prefix)}(\d+)(?:_([0-9TtZz]+))?\.(mp4|ts)$", filename)
    return int(m.group(1)) if m else -1


def extract_program_date_time(filename):
    m = re.match(r"segment_\d+_([0-9TtZz]+)\.(mp4|ts)$", filename)
    if not m:
        return None
    dt_str = m.group(1).replace("Z", "")
    try:
        return datetime.strptime(dt_str, "%Y%m%dT%H%M%S")
    except Exception:
        return None


def update_manifest(client_dir, keep_n=6, segment_duration=4):
    for ext in [".ts", ".mp4"]:
        segs = sorted(
            [
                f for f in os.listdir(client_dir)
                if f.startswith("segment_") and f.endswith(ext)
                and os.path.getsize(os.path.join(client_dir, f)) > 1000
            ],
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
                    dt = extract_program_date_time(seg)
                    if dt:
                        m3u.write(f"#EXT-X-PROGRAM-DATE-TIME:{dt.isoformat()}Z\n")
                    m3u.write(f"#EXTINF:{segment_duration}.0,\n")
                    m3u.write(f"{seg}\n")
            print(f"[MANIFEST] Opdateret: {manifest_path}")
            return
    print(f"[MANIFEST] Ingen segmenter fundet i {client_dir}")


@router.post("/hls/upload")
async def upload_hls_file(
    file: UploadFile = File(...),
    client_id: str = Form(...),
    user=Depends(get_current_user)
):
    allowed_exts = [".ts", ".mp4"]
    if not any(file.filename.endswith(ext) for ext in allowed_exts):
        raise HTTPException(status_code=400, detail="Kun .ts eller .mp4 segmenter understøttes")
    if not re.match(r'^[a-zA-Z0-9_.-]+$', file.filename):
        raise HTTPException(status_code=400, detail="Ugyldigt filnavn")

    client_dir = safe_client_dir(client_id)
    os.makedirs(client_dir, exist_ok=True)

    MAX_SIZE = 50 * 1024 * 1024
    content = await file.read(MAX_SIZE + 1)
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Filen er for stor (max 50 MB)")

    seg_path = os.path.join(client_dir, file.filename)
    with open(seg_path, "wb") as f:
        f.write(content)

    print(f"[UPLOAD] Segment gemt: {seg_path}, størrelse: {len(content)} bytes")
    update_manifest(client_dir)
    return {"filename": file.filename, "client_id": client_id}


@router.post("/hls/cleanup")
async def cleanup_hls_files(
    client_id: str = Body(...),
    keep_files: List[str] = Body(...),
    keep_n: int = 6,
    segment_duration: int = 4,
    user=Depends(get_current_user)
):
    client_dir = safe_client_dir(client_id)
    if not os.path.exists(client_dir):
        return {"deleted": [], "kept": []}

    all_files = [
        f for f in os.listdir(client_dir)
        if f.startswith("segment_") and (f.endswith(".ts") or f.endswith(".mp4"))
    ]
    to_delete = [f for f in all_files if f not in keep_files]
    for seg in to_delete:
        try:
            os.remove(os.path.join(client_dir, seg))
        except Exception as e:
            print(f"[CLEANUP] Kunne ikke slette {seg}: {e}")

    update_manifest(client_dir, keep_n=keep_n, segment_duration=segment_duration)
    kept = sorted(
        [
            f for f in os.listdir(client_dir)
            if f.startswith("segment_") and (f.endswith(".ts") or f.endswith(".mp4"))
        ],
        key=lambda f: extract_num(f, "segment_")
    )
    return {"deleted": to_delete, "kept": kept}


@router.get("/hls/{client_id}/last-segment-info")
def get_last_segment_info(
    client_id: str,
    response: Response,
    user=Depends(get_current_user)
):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    client_dir = safe_client_dir(client_id)
    manifest_path = os.path.join(client_dir, "index.m3u8")
    if not os.path.exists(manifest_path):
        return {"error": "no manifest", "is_healthy": False}

    with open(manifest_path, "r") as m3u:
        lines = m3u.readlines()

    segment_files = [line.strip() for line in lines if line.strip().startswith("segment_")]
    if not segment_files:
        return {"error": "no segments", "is_healthy": False}

    last_segment = segment_files[-1]
    seg_path = os.path.join(client_dir, last_segment)
    if not os.path.exists(seg_path):
        return {"error": "segment missing", "is_healthy": False}

    dt = extract_program_date_time(last_segment)
    if dt:
        timestamp_iso = dt.isoformat() + "Z"
    else:
        # Ikke-deprecated: brug timezone-aware timestamp
        mtime = os.path.getmtime(seg_path)
        dt = datetime.fromtimestamp(mtime, tz=timezone.utc).replace(tzinfo=None, microsecond=0)
        timestamp_iso = dt.isoformat() + "Z"

    return {
        "segment": last_segment,
        "timestamp": timestamp_iso,
        "epoch": dt.timestamp() if dt else None,
        "segment_count": len(segment_files),
        "is_healthy": True
    }


@router.get("/hls/{client_id}/health")
def health_check(
    client_id: str,
    response: Response,
    user=Depends(get_current_user)
):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    client_dir = safe_client_dir(client_id)
    manifest_path = os.path.join(client_dir, "index.m3u8")
    if not os.path.exists(manifest_path):
        return {"online": False, "has_segments": False, "last_update": None, "message": "Manifest ikke fundet"}

    try:
        files = os.listdir(client_dir)
        has_segments = any(
            f.startswith("segment_") and (f.endswith(".ts") or f.endswith(".mp4"))
            for f in files
        )
        if has_segments:
            mtime = os.path.getmtime(manifest_path)
            last_update = datetime.fromtimestamp(mtime, tz=timezone.utc).replace(tzinfo=None).isoformat() + "Z"
            return {"online": True, "has_segments": True, "last_update": last_update, "message": "Stream er aktiv"}
        return {"online": True, "has_segments": False, "last_update": None, "message": "Manifest eksisterer, men ingen segmenter endnu"}
    except Exception as e:
        return {"online": False, "has_segments": False, "last_update": None, "message": f"Fejl: {str(e)}"}


@router.post("/hls/{client_id}/reset")
def reset_hls(
    client_id: str,
    response: Response,
    user=Depends(get_current_user)
):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    client_dir = safe_client_dir(client_id)

    if not os.path.exists(client_dir):
        return {"message": "already cleaned", "success": True, "timestamp": utcnow().isoformat() + "Z"}

    try:
        for f in os.listdir(client_dir):
            try:
                os.remove(os.path.join(client_dir, f))
            except Exception as e:
                print(f"[RESET] Kunne ikke slette {f}: {e}")
        return {"message": "reset done", "success": True, "timestamp": utcnow().isoformat() + "Z"}
    except Exception as e:
        return {"message": f"reset failed: {e}", "success": False, "timestamp": utcnow().isoformat() + "Z"}


class Room:
    def __init__(self):
        self.broadcaster: WebSocket = None
        self.viewers: Dict[str, WebSocket] = {}


rooms: Dict[str, Room] = {}


@router.websocket("/ws/livestream/{client_id}")
async def livestream_endpoint(
    websocket: WebSocket,
    client_id: str,
    token: str = Query(default=None)
):
    if not re.match(r'^[a-zA-Z0-9_-]+$', client_id):
        await websocket.close(code=1008)
        return

    # Autentificér bruger via JWT-token i query-parameter
    from db import engine
    with Session(engine) as session:
        user = verify_ws_token(token, session)
        if not user:
            await websocket.close(code=4001)
            return

    await websocket.accept()
    if client_id not in rooms:
        rooms[client_id] = Room()
    room = rooms[client_id]

    try:
        data = await websocket.receive_json()

        if data.get("type") == "broadcaster":
            room.broadcaster = websocket
            await websocket.send_json({"type": "ack", "role": "broadcaster"})

        elif data.get("type") == "newViewer":
            viewer_id = str(data.get("viewer_id"))
            room.viewers[viewer_id] = websocket
            await websocket.send_json({"type": "ack", "role": "viewer", "viewer_id": viewer_id})
            if room.broadcaster:
                await room.broadcaster.send_json({"type": "newViewer", "viewer_id": viewer_id})
        else:
            await websocket.close()
            return

        while True:
            msg = await websocket.receive_json()
            if websocket == room.broadcaster:
                viewer_id = msg.get("viewer_id")
                if viewer_id and viewer_id in room.viewers:
                    await room.viewers[viewer_id].send_json(msg)
            else:
                viewer_id = next(
                    (vid for vid, ws in room.viewers.items() if ws == websocket), None
                )
                if room.broadcaster and viewer_id:
                    msg["viewer_id"] = viewer_id
                    await room.broadcaster.send_json(msg)

    except WebSocketDisconnect:
        if websocket == room.broadcaster:
            room.broadcaster = None
        for vid, ws in list(room.viewers.items()):
            if ws == websocket:
                del room.viewers[vid]
    except Exception as e:
        print(f"[WS] Fejl for client_id={client_id}: {e}")
        traceback.print_exc()
        if websocket == room.broadcaster:
            room.broadcaster = None
        for vid, ws in list(room.viewers.items()):
            if ws == websocket:
                del room.viewers[vid]
        try:
            await websocket.close()
        except Exception:
            pass

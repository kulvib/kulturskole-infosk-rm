import os
import re
import time
import traceback
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import (
    APIRouter, WebSocket, WebSocketDisconnect,
    UploadFile, File, HTTPException, Form, Response, Depends, Query
)
from pydantic import BaseModel
from auth import get_current_user, verify_ws_token
from models import utcnow
from sqlmodel import Session

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HLS_DIR  = os.path.abspath(os.path.join(BASE_DIR, "..", "hls"))
os.makedirs(HLS_DIR, exist_ok=True)

router = APIRouter()

MANIFEST_STALE_SECONDS = 30
KEEP_N = 15


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class HlsCleanupRequest(BaseModel):
    client_id: str
    keep_files: List[str]
    segment_duration: int = 6


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def safe_client_dir(client_id: str) -> str:
    if not re.match(r"^[a-zA-Z0-9_-]+$", client_id):
        raise HTTPException(status_code=400, detail="Ugyldigt client_id format")
    path = os.path.abspath(os.path.join(HLS_DIR, client_id))
    if not path.startswith(os.path.abspath(HLS_DIR)):
        raise HTTPException(status_code=400, detail="Ugyldigt client_id")
    return path


def extract_num(filename: str, prefix: str = "segment_") -> int:
    m = re.match(rf"{re.escape(prefix)}(\d+)(?:_[^.]+)?\.(mp4|ts)$", filename)
    return int(m.group(1)) if m else -1


def _normalize_segment_duration(value, default: int = 6, min_v: int = 1, max_v: int = 60) -> int:
    try:
        n = int(value)
        return max(min_v, min(max_v, n))
    except Exception:
        return default


def _parse_captured_at(captured_at_str: Optional[str]) -> Optional[datetime]:
    if not captured_at_str:
        return None
    try:
        s = captured_at_str.strip().replace("Z", "+00:00")
        return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _write_manifest(
    manifest_path: str,
    segments: List[str],
    media_seq: int,
    segment_duration: int,
    client_dir: str = "",
    captured_at_map: Optional[Dict[str, datetime]] = None,
) -> None:
    """
    Skriv HLS-manifest med EXT-X-DISCONTINUITY + EXT-X-PROGRAM-DATE-TIME
    på hvert segment.

    CHROME FIX:
    ffmpeg reset_timestamps=1 nulstiller DTS til 0 ved starten af hvert segment.
    Chrome's MSE forventer monotone DTS-værdier på tværs af segmenter.
    Når segment N+1 starter ved DTS=0 efter segment N sluttede ved DTS≈720000,
    kaster Chrome: "CHUNK_DEMUXER_ERROR_APPEND_FAILED: Parsed buffers not in DTS sequence"

    Fix: tilføj #EXT-X-DISCONTINUITY før hvert segment (undtagen det første).
    Dette signalerer til HLS.js at timestamps nulstilles, og HLS.js kompenserer
    automatisk ved at tilføje en offset — Chrome's MSE ser dermed monotone timestamps.

    Safari og Firefox er ikke påvirkede af dette tag.
    """
    if captured_at_map is None:
        captured_at_map = {}

    with open(manifest_path, "w", encoding="utf-8", newline="\n") as m3u:
        m3u.write("#EXTM3U\n")
        m3u.write("#EXT-X-VERSION:3\n")
        m3u.write(f"#EXT-X-TARGETDURATION:{segment_duration}\n")
        m3u.write(f"#EXT-X-MEDIA-SEQUENCE:{media_seq}\n")
        m3u.write(f"#EXT-X-DISCONTINUITY-SEQUENCE:{media_seq}\n")

        for i, seg in enumerate(segments):
            # CHROME FIX: #EXT-X-DISCONTINUITY før hvert segment (undtagen første)
            # signalerer at DTS nulstilles — HLS.js tilføjer offset automatisk
            if i > 0:
                m3u.write("#EXT-X-DISCONTINUITY\n")

            dt = captured_at_map.get(seg)

            if dt is None and client_dir:
                try:
                    seg_path = os.path.join(client_dir, seg)
                    mtime    = os.path.getmtime(seg_path)
                    dt = datetime.fromtimestamp(mtime - segment_duration, tz=timezone.utc)
                except Exception:
                    pass

            if dt is not None:
                m3u.write(f"#EXT-X-PROGRAM-DATE-TIME:{dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')}\n")

            m3u.write(f"#EXTINF:{segment_duration}.0,\n")
            m3u.write(f"{seg}\n")


# In-memory map: segment_filename → captured_at datetime
_captured_at_store: Dict[str, Dict[str, datetime]] = {}


def _store_captured_at(client_id: str, seg_name: str, dt: datetime) -> None:
    if client_id not in _captured_at_store:
        _captured_at_store[client_id] = {}
    _captured_at_store[client_id][seg_name] = dt
    store = _captured_at_store[client_id]
    if len(store) > 50:
        oldest_keys = sorted(store.keys())[:-50]
        for k in oldest_keys:
            del store[k]


def _get_captured_at_map(client_id: str) -> Dict[str, datetime]:
    return _captured_at_store.get(client_id, {})


def update_manifest(client_dir: str, client_id: str, keep_n: int = KEEP_N, segment_duration: int = 6) -> None:
    segment_duration = _normalize_segment_duration(segment_duration, default=6)

    for ext in [".ts", ".mp4"]:
        segs = sorted(
            [
                f for f in os.listdir(client_dir)
                if f.startswith("segment_") and f.endswith(ext)
                and os.path.getsize(os.path.join(client_dir, f)) > 1000
            ],
            key=lambda f: extract_num(f, "segment_")
        )
        if not segs:
            continue

        manifest_segs = segs[-keep_n:]
        media_seq     = extract_num(manifest_segs[0], "segment_")
        manifest_path = os.path.join(client_dir, "index.m3u8")

        _write_manifest(
            manifest_path, manifest_segs, media_seq, segment_duration,
            client_dir=client_dir,
            captured_at_map=_get_captured_at_map(client_id),
        )
        print(f"[MANIFEST] Opdateret: {manifest_path} ({len(manifest_segs)} seg, duration={segment_duration}s)")
        return

    print(f"[MANIFEST] Ingen segmenter fundet i {client_dir}")


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------
@router.post("/hls/upload")
async def upload_hls_file(
    file: UploadFile = File(...),
    client_id: str = Form(...),
    segment_duration: int = Form(6),
    captured_at: Optional[str] = Form(default=None),
    user=Depends(get_current_user)
):
    allowed_exts = [".ts", ".mp4"]
    if not any(file.filename.endswith(ext) for ext in allowed_exts):
        raise HTTPException(status_code=400, detail="Kun .ts eller .mp4 segmenter understøttes")
    if not re.match(r"^[a-zA-Z0-9_.-]+$", file.filename):
        raise HTTPException(status_code=400, detail="Ugyldigt filnavn")

    segment_duration = _normalize_segment_duration(segment_duration, default=6)
    client_dir       = safe_client_dir(client_id)
    os.makedirs(client_dir, exist_ok=True)

    MAX_SIZE = 50 * 1024 * 1024
    content  = await file.read(MAX_SIZE + 1)
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Filen er for stor (max 50 MB)")

    seg_path = os.path.join(client_dir, file.filename)
    with open(seg_path, "wb") as f:
        f.write(content)

    dt = _parse_captured_at(captured_at)
    if dt is not None:
        _store_captured_at(client_id, file.filename, dt)
    else:
        try:
            mtime = os.path.getmtime(seg_path)
            dt_fallback = datetime.fromtimestamp(mtime - segment_duration, tz=timezone.utc)
            _store_captured_at(client_id, file.filename, dt_fallback)
        except Exception:
            pass

    print(f"[UPLOAD] Gemt: {file.filename} ({len(content)} bytes), client={client_id}, captured_at={captured_at}")
    update_manifest(client_dir, client_id, keep_n=KEEP_N, segment_duration=segment_duration)

    return {"filename": file.filename, "client_id": client_id, "segment_duration": segment_duration}


# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
@router.post("/hls/cleanup")
async def cleanup_hls_files(
    payload: HlsCleanupRequest,
    keep_n: int = KEEP_N,
    user=Depends(get_current_user)
):
    client_id        = payload.client_id
    keep_files       = payload.keep_files
    segment_duration = _normalize_segment_duration(payload.segment_duration, default=6)
    client_dir       = safe_client_dir(client_id)

    if not os.path.exists(client_dir):
        return {"deleted": [], "kept": [], "segment_duration": segment_duration}

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

    kept_sorted = sorted(
        [f for f in keep_files if os.path.exists(os.path.join(client_dir, f))],
        key=lambda f: extract_num(f, "segment_")
    )
    kept_in_manifest = kept_sorted[-keep_n:]

    if kept_in_manifest:
        media_seq     = extract_num(kept_in_manifest[0], "segment_")
        manifest_path = os.path.join(client_dir, "index.m3u8")
        _write_manifest(
            manifest_path, kept_in_manifest, media_seq, segment_duration,
            client_dir=client_dir,
            captured_at_map=_get_captured_at_map(client_id),
        )
        print(f"[CLEANUP] Manifest skrevet med {len(kept_in_manifest)} segmenter.")

    return {"deleted": to_delete, "kept": kept_in_manifest, "segment_duration": segment_duration}


# ---------------------------------------------------------------------------
# Last segment info
# ---------------------------------------------------------------------------
@router.get("/hls/{client_id}/last-segment-info")
def get_last_segment_info(
    client_id: str,
    response: Response,
    user=Depends(get_current_user)
):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"]        = "no-cache"
    response.headers["Expires"]       = "0"

    client_dir    = safe_client_dir(client_id)
    manifest_path = os.path.join(client_dir, "index.m3u8")
    if not os.path.exists(manifest_path):
        return {"error": "no manifest", "is_healthy": False}

    with open(manifest_path, "r", encoding="utf-8") as m3u:
        lines = m3u.readlines()

    segment_files = [line.strip() for line in lines if line.strip().startswith("segment_")]
    if not segment_files:
        return {"error": "no segments", "is_healthy": False}

    last_segment = segment_files[-1]
    seg_path     = os.path.join(client_dir, last_segment)
    if not os.path.exists(seg_path):
        return {"error": "segment missing", "is_healthy": False}

    captured_at_map = _get_captured_at_map(client_id)
    dt = captured_at_map.get(last_segment)
    if dt is not None:
        timestamp_iso = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        epoch         = dt.timestamp()
    else:
        mtime         = os.path.getmtime(seg_path)
        dt_utc        = datetime.fromtimestamp(mtime, tz=timezone.utc)
        timestamp_iso = dt_utc.replace(microsecond=0).isoformat().replace("+00:00", "Z")
        epoch         = mtime

    return {
        "segment":       last_segment,
        "timestamp":     timestamp_iso,
        "epoch":         epoch,
        "segment_count": len(segment_files),
        "is_healthy":    True,
    }


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@router.get("/hls/{client_id}/health")
def health_check(
    client_id: str,
    response: Response,
    user=Depends(get_current_user)
):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"]        = "no-cache"
    response.headers["Expires"]       = "0"

    client_dir    = safe_client_dir(client_id)
    manifest_path = os.path.join(client_dir, "index.m3u8")
    if not os.path.exists(manifest_path):
        return {"online": False, "has_segments": False, "is_stale": False, "last_update": None, "message": "Manifest ikke fundet"}

    try:
        files        = os.listdir(client_dir)
        has_segments = any(
            f.startswith("segment_") and (f.endswith(".ts") or f.endswith(".mp4"))
            for f in files
        )
        if has_segments:
            mtime       = os.path.getmtime(manifest_path)
            last_update = datetime.fromtimestamp(mtime, tz=timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
            age_seconds = time.time() - mtime
            is_stale    = age_seconds > MANIFEST_STALE_SECONDS
            return {
                "online": True, "has_segments": True, "is_stale": is_stale,
                "last_update": last_update,
                "message": "Stream er forældet — klienten svarer ikke" if is_stale else "Stream er aktiv"
            }
        return {"online": True, "has_segments": False, "is_stale": False, "last_update": None, "message": "Ingen segmenter endnu"}
    except Exception as e:
        return {"online": False, "has_segments": False, "is_stale": False, "last_update": None, "message": f"Fejl: {str(e)}"}


# ---------------------------------------------------------------------------
# Reset
# ---------------------------------------------------------------------------
@router.post("/hls/{client_id}/reset")
def reset_hls(client_id: str, response: Response, user=Depends(get_current_user)):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    client_dir = safe_client_dir(client_id)

    if client_id in _captured_at_store:
        del _captured_at_store[client_id]

    if not os.path.exists(client_dir):
        return {"message": "already cleaned", "success": True, "timestamp": utcnow().isoformat() + "Z"}
    try:
        for f in os.listdir(client_dir):
            try: os.remove(os.path.join(client_dir, f))
            except Exception as e: print(f"[RESET] Kunne ikke slette {f}: {e}")
        return {"message": "reset done", "success": True, "timestamp": utcnow().isoformat() + "Z"}
    except Exception as e:
        return {"message": f"reset failed: {e}", "success": False, "timestamp": utcnow().isoformat() + "Z"}


# ---------------------------------------------------------------------------
# WebSocket signalling
# ---------------------------------------------------------------------------
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
    if not re.match(r"^[a-zA-Z0-9_-]+$", client_id):
        await websocket.close(code=1008)
        return

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
                viewer_id = next((vid for vid, ws in room.viewers.items() if ws == websocket), None)
                if room.broadcaster and viewer_id:
                    msg["viewer_id"] = viewer_id
                    await room.broadcaster.send_json(msg)

    except WebSocketDisconnect:
        if websocket == room.broadcaster: room.broadcaster = None
        for vid, ws in list(room.viewers.items()):
            if ws == websocket: del room.viewers[vid]
    except Exception as e:
        print(f"[WS] Fejl for client_id={client_id}: {e}")
        traceback.print_exc()
        if websocket == room.broadcaster: room.broadcaster = None
        for vid, ws in list(room.viewers.items()):
            if ws == websocket: del room.viewers[vid]
        try: await websocket.close()
        except Exception: pass

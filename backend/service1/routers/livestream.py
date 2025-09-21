import os
from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Body, Depends
from typing import List
import traceback
import re
from datetime import datetime
from auth import get_current_user  # Tilføjet authentication

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
    m = re.match(rf"{re.escape(prefix)}(\d+)(?:_([0-9TtZz]+))?\.(mp4|ts)$", filename)
    return int(m.group(1)) if m else -1

def extract_program_date_time(filename):
    m = re.match(r"segment_\d+_([0-9TtZz]+)\.(mp4|ts)$", filename)
    if not m:
        return None
    dt_str = m.group(1).replace("Z", "")
    try:
        dt = datetime.strptime(dt_str, "%Y%m%dT%H%M%S")
        return dt
    except Exception:
        return None

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
                    dt = extract_program_date_time(seg)
                    if dt:
                        m3u.write(f"#EXT-X-PROGRAM-DATE-TIME:{dt.isoformat()}Z\n")
                    m3u.write(f"#EXTINF:{segment_duration}.0,\n")
                    m3u.write(f"{seg}\n")
            print(f"[MANIFEST] Opdateret manifest for {client_dir}: {manifest_path} ({media_seq}..{extract_num(manifest_segs[-1], 'segment_')})")
            return
    print(f"[MANIFEST] Ingen segmenter fundet til manifest i {client_dir}")

@router.post("/hls/upload")
async def upload_hls_file(
    file: UploadFile = File(...),
    client_id: str = Form(...),
    user=Depends(get_current_user)
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
    user=Depends(get_current_user)
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
def get_last_segment_info(client_id: str, user=Depends(get_current_user)):
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
    dt = extract_program_date_time(last_segment)
    if dt:
        timestamp_iso = dt.isoformat() + "Z"
    else:
        mtime = os.path.getmtime(seg_path)
        dt = datetime.utcfromtimestamp(mtime).replace(microsecond=0)
        timestamp_iso = dt.isoformat() + "Z"
    result = {
        "segment": last_segment,
        "timestamp": timestamp_iso,
        "epoch": dt.timestamp() if dt else None
    }
    return result

@router.post("/hls/{client_id}/reset")
def reset_hls(client_id: str, user=Depends(get_current_user)):
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

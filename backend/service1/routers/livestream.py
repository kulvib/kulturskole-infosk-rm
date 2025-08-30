from fastapi import APIRouter, HTTPException, Depends
import subprocess
from db import get_session
from models import Client
from sqlmodel import select

router = APIRouter(
    prefix="/livestream",
    tags=["livestream"],
)

# FFmpeg-processer pr. klient
ffmpeg_processes = {}

# Hvis du gemmer YouTube-streamkey på klienten (fx client.youtube_stream_key)
def get_youtube_url(client):
    # Hvis du har en stream key på klienten, brug den
    if hasattr(client, "youtube_stream_key") and client.youtube_stream_key:
        return f"rtmp://a.rtmp.youtube.com/live2/{client.youtube_stream_key}"
    # Ellers brug en default (ikke anbefalet!)
    return "rtmp://a.rtmp.youtube.com/live2/YOUR_DEFAULT_STREAM_KEY"

@router.post("/start/{client_id}")
async def start_livestream(client_id: int, session=Depends(get_session)):
    client = session.get(Client, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Tjek om allerede aktiv
    if client_id in ffmpeg_processes and ffmpeg_processes[client_id].poll() is None:
        return {"status": "already_started", "active": True}

    # Eksempel: streamer webcam (tilpas efter behov!)
    youtube_url = get_youtube_url(client)
    try:
        proc = subprocess.Popen([
            "ffmpeg",
            "-f", "v4l2",              # Linux webcam. Skift evt. til dshow for Windows!
            "-i", "/dev/video0",       # Tilpas input!
            "-f", "flv",
            youtube_url
        ])
        ffmpeg_processes[client_id] = proc
        return {"status": "started", "active": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not start FFmpeg: {e}")

@router.post("/stop/{client_id}")
async def stop_livestream(client_id: int):
    proc = ffmpeg_processes.get(client_id)
    if proc and proc.poll() is None:
        proc.terminate()
        ffmpeg_processes[client_id] = None
        return {"status": "stopped", "active": False}
    else:
        return {"status": "already_stopped", "active": False}

@router.get("/status/{client_id}")
async def get_livestream_status(client_id: int):
    proc = ffmpeg_processes.get(client_id)
    is_active = proc is not None and proc.poll() is None
    return {"active": is_active}

#!/usr/bin/env python3
"""
livestream.py

Optager skærm og uploader korte HLS-segmenter (.ts) til backend.

Miljøvariabler:
  CLIENTFLOW_BASE_URL
  CLIENTFLOW_USERNAME / CF_USER
  CLIENTFLOW_PASSWORD / CF_PASS
  SEGMENT_LENGTH (sek, default 6)
  MAX_SEGMENTS (default 10)
  WIDTH, HEIGHT, FPS
  LIVESTREAM_TIMEOUT (sek, default 0 = ingen timeout)
"""
from pathlib import Path
import asyncio
import json
import numpy as np
import mss
import cv2
import requests
import time
import os
import sys
import subprocess
import glob
import threading
import signal
import datetime
import traceback
import uuid
from typing import Optional

# aiortc er optional — bruges ikke til HLS-upload
try:
    from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack, RTCIceCandidate
    from av import VideoFrame
    _HAS_AIORTC = True
except Exception:
    _HAS_AIORTC = False


# ---------------------------------------------------------------------------
# Konfig
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
API_DIR = BASE_DIR
API_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = os.environ.get("CLIENTFLOW_BASE_URL", "https://kulturskole-infosk-rm.onrender.com")
USERNAME = os.environ.get("CLIENTFLOW_USERNAME", os.environ.get("CF_USER", "admin"))
PASSWORD = os.environ.get("CLIENTFLOW_PASSWORD", os.environ.get("CF_PASS", "KulVib2025info"))

SEGMENT_LENGTH = int(os.environ.get("SEGMENT_LENGTH", "6"))
MAX_SEGMENTS = int(os.environ.get("MAX_SEGMENTS", "10"))
WIDTH = int(os.environ.get("WIDTH", "1920"))
HEIGHT = int(os.environ.get("HEIGHT", "1080"))
FPS = int(os.environ.get("FPS", "8"))

UPLOAD_PATH = os.environ.get("UPLOAD_PATH", "/api/hls/upload")
CLEANUP_PATH = os.environ.get("CLEANUP_PATH", "/api/hls/cleanup")
TOKEN_PATH = os.environ.get("TOKEN_PATH", "/auth/token")

UPLOAD_URL = BASE_URL.rstrip("/") + UPLOAD_PATH
CLEANUP_URL = BASE_URL.rstrip("/") + CLEANUP_PATH
TOKEN_URL = BASE_URL.rstrip("/") + TOKEN_PATH

CONFIG_PATH = str(API_DIR / "clientflow_config.json")
SEGMENT_DIR = str(API_DIR / "segments")
os.makedirs(SEGMENT_DIR, exist_ok=True)

LIVESTREAM_TIMEOUT = int(os.environ.get("LIVESTREAM_TIMEOUT", "0"))  # 0 = ingen timeout

# Display env
os.environ.setdefault("DISPLAY", ":0")
os.environ.setdefault("XAUTHORITY", "/run/user/1000/gdm/Xauthority")


# ---------------------------------------------------------------------------
# Logging helper
# ---------------------------------------------------------------------------
def _ts() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z"


def log(msg: str, level: str = "INFO") -> None:
    print(f"{_ts()} [{level}] {msg}")
    sys.stdout.flush()


# ---------------------------------------------------------------------------
# Token
# ---------------------------------------------------------------------------
class TokenStore:
    def __init__(self):
        self._lock = threading.Lock()
        self._token: Optional[str] = None
        self._token_time: float = 0
        self._ttl = 60 * 25  # 25 min

    def get(self, force: bool = False) -> Optional[str]:
        with self._lock:
            if not force and self._token and (time.time() - self._token_time) < self._ttl:
                return self._token
        try:
            data = {"username": USERNAME, "password": PASSWORD}
            resp = requests.post(TOKEN_URL, data=data, timeout=10)
            if resp.status_code == 200:
                tok = resp.json().get("access_token")
                if tok:
                    with self._lock:
                        self._token = tok
                        self._token_time = time.time()
                    log("Hentet nyt access_token.")
                    return tok
            log(f"Kunne ikke hente token: {resp.status_code} {resp.text[:200]}", "WARN")
        except Exception as e:
            log(f"Token-fejl: {e}", "WARN")
        return None

    def invalidate(self):
        with self._lock:
            self._token = None
            self._token_time = 0


TOKENS = TokenStore()


def _auth_headers() -> dict:
    tok = TOKENS.get()
    if tok:
        return {"Authorization": f"Bearer {tok}"}
    return {}


# ---------------------------------------------------------------------------
# client_id — læses ved opstart af main(), ikke på import-tid
# ---------------------------------------------------------------------------
def get_client_id_blocking(max_wait: int = 60) -> str:
    deadline = time.time() + max_wait
    last_log = 0
    while True:
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                cid = data.get("id") or data.get("client_id")
                if cid is not None:
                    return str(cid)
        except FileNotFoundError:
            pass
        except Exception as e:
            log(f"Fejl ved læsning af {CONFIG_PATH}: {e}", "WARN")

        if time.time() > deadline:
            log(f"FATAL: client_id ikke tilgængelig efter {max_wait}s.", "ERROR")
            sys.exit(1)

        if time.time() - last_log > 5:
            log(f"Venter på client_id i {CONFIG_PATH}...")
            last_log = time.time()
        time.sleep(1)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def atomic_write_text(path: str, text: str) -> None:
    try:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_name(f"{p.name}.tmp.{os.getpid()}.{uuid.uuid4().hex[:8]}")
        tmp.write_text(text, encoding="utf-8")
        os.replace(str(tmp), str(p))
    except Exception as e:
        log(f"atomic_write_text fejlede for {path}: {e}", "WARN")


def total_cleanup_local_and_server(client_id: str) -> None:
    removed = 0
    for pat in ("segment_*.ts", "index.m3u8", "segment_*.mp4"):
        for f in glob.glob(os.path.join(SEGMENT_DIR, pat)):
            try:
                os.remove(f)
                removed += 1
            except Exception as e:
                log(f"Kunne ikke slette {f}: {e}", "WARN")
    log(f"Lokal cleanup: fjernede {removed} filer.")

    try:
        headers = _auth_headers()
        r = requests.post(
            CLEANUP_URL,
            json={"client_id": client_id, "keep_files": []},
            headers=headers,
            timeout=15,
        )
        if r.status_code == 401:
            TOKENS.invalidate()
            r = requests.post(
                CLEANUP_URL,
                json={"client_id": client_id, "keep_files": []},
                headers=_auth_headers(),
                timeout=15,
            )
        if r.status_code == 200:
            log("Server cleanup OK.")
        else:
            log(f"Server cleanup fejl: {r.status_code} {r.text[:200]}", "WARN")
    except Exception as e:
        log(f"Server cleanup exception: {e}", "WARN")


# ---------------------------------------------------------------------------
# Screen capture — initialiseres i main(), ikke på import-tid
# ---------------------------------------------------------------------------
class ScreenCapture:
    def __init__(self, monitor_index: int = 1):
        self._lock = threading.Lock()
        self.sct = mss.mss()
        monitors = self.sct.monitors
        if monitor_index < 1 or monitor_index >= len(monitors):
            self.monitor = monitors[1] if len(monitors) > 1 else monitors[0]
        else:
            self.monitor = monitors[monitor_index]

    def grab(self):
        with self._lock:
            return np.array(self.sct.grab(self.monitor))


# ---------------------------------------------------------------------------
# Segmenter
# ---------------------------------------------------------------------------
def get_segment_filenames(seq: int, start_time: datetime.datetime):
    ts_time = start_time.strftime("%Y%m%dT%H%M%SZ")
    base = f"segment_{seq:05d}_{ts_time}"
    return f"{base}.mp4", f"{base}.ts"


def extract_num(filename: str) -> int:
    parts = filename.split("_")
    if len(parts) < 2:
        return 0
    try:
        return int(parts[1])
    except Exception:
        return 0


def extract_program_date_time(filename: str):
    parts = filename.split("_")
    if len(parts) < 3:
        return None
    dt_str = parts[2].replace(".ts", "").replace(".mp4", "")
    try:
        return datetime.datetime.strptime(dt_str, "%Y%m%dT%H%M%SZ")
    except Exception:
        return None


def make_index_m3u8(ts_files, target_duration: int = SEGMENT_LENGTH) -> None:
    if not ts_files:
        return
    ts_files_sorted = sorted(ts_files, key=extract_num)
    m3u8_path = os.path.join(SEGMENT_DIR, "index.m3u8")
    lines = [
        "#EXTM3U",
        "#EXT-X-VERSION:3",
        f"#EXT-X-TARGETDURATION:{target_duration}",
        f"#EXT-X-MEDIA-SEQUENCE:{extract_num(ts_files_sorted[0])}",
    ]
    for tsf in ts_files_sorted:
        dt = extract_program_date_time(tsf)
        if dt:
            lines.append(f"#EXT-X-PROGRAM-DATE-TIME:{dt.isoformat()}Z")
        lines.append(f"#EXTINF:{target_duration}.0,")
        lines.append(tsf)
    atomic_write_text(m3u8_path, "\n".join(lines) + "\n")


def cleanup_server_segments(client_id: str, keep_files):
    try:
        headers = _auth_headers()
        r = requests.post(
            CLEANUP_URL,
            json={"client_id": client_id, "keep_files": keep_files, "segment_duration": SEGMENT_LENGTH},
            headers=headers,
            timeout=15,
        )
        if r.status_code == 401:
            TOKENS.invalidate()
            r = requests.post(
                CLEANUP_URL,
                json={"client_id": client_id, "keep_files": keep_files, "segment_duration": SEGMENT_LENGTH},
                headers=_auth_headers(),
                timeout=15,
            )
        if r.status_code != 200:
            log(f"Server-cleanup fejlede ({r.status_code}): {r.text[:200]}", "WARN")
    except Exception as e:
        log(f"cleanup_server_segments fejl: {e}", "WARN")


# ---------------------------------------------------------------------------
# Optagelse + konvertering + upload
# ---------------------------------------------------------------------------
def record_mp4_clip(screen: ScreenCapture, filename: str, segment_length: int = SEGMENT_LENGTH, fps: int = FPS) -> int:
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(filename, fourcc, fps, (WIDTH, HEIGHT))
    if not out.isOpened():
        log(f"VideoWriter kunne ikke åbnes for {filename}", "ERROR")
        return 0

    start = time.time()
    frames_written = 0
    frame_interval = 1.0 / max(fps, 1)
    next_frame_time = start
    try:
        while time.time() - start < segment_length:
            try:
                img = screen.grab()
                if img is None or img.size == 0:
                    log("Tomt frame fra mss!", "WARN")
                    time.sleep(0.05)
                    continue
                frame = cv2.resize(img, (WIDTH, HEIGHT))
                frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
                out.write(frame)
                frames_written += 1
            except Exception as e:
                log(f"Frame-grab fejl: {e}", "WARN")

            next_frame_time += frame_interval
            sleep_for = next_frame_time - time.time()
            if sleep_for > 0:
                time.sleep(sleep_for)
    finally:
        out.release()
    return frames_written


def convert_mp4_to_ts(src: str, ts_dst: str) -> bool:
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-i", src,
        "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-c:v", "libx264", "-preset", "veryfast",
        "-b:v", "1.5M", "-maxrate", "1.5M", "-bufsize", "3M",
        "-c:a", "aac",
        "-shortest",
        "-f", "mpegts",
        ts_dst,
    ]
    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
        if proc.returncode != 0:
            log(f"ffmpeg fejlede (rc={proc.returncode}): {proc.stderr.decode('utf-8', errors='ignore')[:500]}", "ERROR")
            return False
        return True
    except subprocess.TimeoutExpired:
        log(f"ffmpeg timeout for {src}", "ERROR")
        return False
    except FileNotFoundError:
        log("ffmpeg binary ikke fundet — installér ffmpeg!", "ERROR")
        return False
    except Exception as e:
        log(f"ffmpeg exception: {e}", "ERROR")
        return False


def upload_segment(ts_path: str, ts_name: str, client_id: str, max_retries: int = 3) -> bool:
    try:
        size = os.path.getsize(ts_path)
    except Exception:
        size = 0
    log(f"Upload {ts_name} ({size/1024:.1f} KB) -> {UPLOAD_URL}")

    for attempt in range(max_retries):
        try:
            headers = _auth_headers()
            with open(ts_path, "rb") as fh:
                files = {"file": (ts_name, fh, "video/MP2T")}
                data = {"client_id": client_id}
                t0 = time.time()
                r = requests.post(UPLOAD_URL, files=files, data=data, headers=headers, timeout=60)
                elapsed = time.time() - t0
            if r.status_code == 401:
                log("Upload returnerede 401 — fornyer token og prøver igen.", "WARN")
                TOKENS.invalidate()
                continue
            if r.status_code == 200:
                log(f"Upload OK ({elapsed:.2f}s, status={r.status_code})")
                return True
            log(f"Upload fejlede ({r.status_code}): {r.text[:300]}", "WARN")
        except Exception as e:
            log(f"Upload exception: {e}", "WARN")
        if attempt < max_retries - 1:
            time.sleep(2)
    log(f"FATAL: Upload fejlede efter {max_retries} forsøg.", "ERROR")
    return False


# ---------------------------------------------------------------------------
# Asyncio shutdown
# ---------------------------------------------------------------------------
shutdown_event = asyncio.Event()
_main_loop: Optional[asyncio.AbstractEventLoop] = None


def signal_handler(signum, frame):
    log(f"Modtog signal {signum}; starter pæn nedlukning.")
    if _main_loop and _main_loop.is_running():
        try:
            _main_loop.call_soon_threadsafe(shutdown_event.set)
        except Exception as e:
            log(f"Kunne ikke sætte shutdown_event via loop: {e}", "WARN")
    else:
        try:
            shutdown_event.set()
        except Exception:
            pass


def timeout_shutdown():
    log("Timeout nået, livestream lukker ned pænt.")
    if _main_loop and _main_loop.is_running():
        try:
            _main_loop.call_soon_threadsafe(shutdown_event.set)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# HLS uploader (async loop)
# ---------------------------------------------------------------------------
async def hls_uploader(client_id: str, screen: ScreenCapture):
    log("hls_uploader starter")
    seq = 1
    try:
        while not shutdown_event.is_set():
            start_time = datetime.datetime.now(datetime.timezone.utc)
            mp4_filename, ts_filename = get_segment_filenames(seq, start_time)
            mp4_path = os.path.join(SEGMENT_DIR, mp4_filename)
            ts_path = os.path.join(SEGMENT_DIR, ts_filename)

            frames = await asyncio.to_thread(record_mp4_clip, screen, mp4_path, SEGMENT_LENGTH, FPS)
            if frames == 0:
                log(f"Ingen frames optaget for seg {seq} — springer over.", "WARN")
                seq += 1
                try:
                    os.remove(mp4_path)
                except Exception:
                    pass
                continue

            ok = await asyncio.to_thread(convert_mp4_to_ts, mp4_path, ts_path)
            if not ok:
                seq += 1
                try:
                    os.remove(mp4_path)
                except Exception:
                    pass
                continue

            if not os.path.exists(ts_path) or os.path.getsize(ts_path) < 1000:
                log(f"Segment {ts_path} for lille — uploader ikke.", "WARN")
                seq += 1
                try:
                    os.remove(mp4_path)
                    if os.path.exists(ts_path):
                        os.remove(ts_path)
                except Exception:
                    pass
                continue

            uploaded = await asyncio.to_thread(upload_segment, ts_path, ts_filename, client_id)
            if not uploaded:
                seq += 1
                continue

            try:
                all_segs = sorted(
                    [f for f in os.listdir(SEGMENT_DIR)
                     if f.startswith("segment_") and f.endswith(".ts")],
                    key=extract_num,
                )
                keep_segs = all_segs[-MAX_SEGMENTS:]
                make_index_m3u8(keep_segs, target_duration=SEGMENT_LENGTH)
                await asyncio.to_thread(cleanup_server_segments, client_id, keep_segs)
                for to_rm in [f for f in all_segs if f not in keep_segs]:
                    try:
                        os.remove(os.path.join(SEGMENT_DIR, to_rm))
                    except Exception:
                        pass
            except Exception as e:
                log(f"Manifest/cleanup fejl: {e}", "WARN")

            try:
                os.remove(mp4_path)
            except Exception:
                pass

            seq += 1
    except asyncio.CancelledError:
        log("hls_uploader cancelled.")
    except Exception as e:
        log(f"hls_uploader fejl: {e}\n{traceback.format_exc()}", "ERROR")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
async def main():
    global _main_loop
    _main_loop = asyncio.get_running_loop()

    # Hent client_id og initialiser screen capture her — ikke på import-tid
    client_id = get_client_id_blocking(max_wait=60)
    log(f"CLIENT_ID={client_id}")

    try:
        screen = ScreenCapture(monitor_index=1)
    except Exception as e:
        log(f"FATAL: Kunne ikke initialisere ScreenCapture: {e}", "ERROR")
        log("Tjek at DISPLAY og XAUTHORITY er sat korrekt.", "ERROR")
        sys.exit(1)

    # Kør kun HLS-upload (ingen WebRTC)
    hls_task = asyncio.create_task(hls_uploader(client_id, screen), name="hls")
    shutdown_task = asyncio.create_task(shutdown_event.wait(), name="shutdown")

    done, pending = await asyncio.wait(
        {hls_task, shutdown_task},
        return_when=asyncio.FIRST_COMPLETED,
    )

    log("Stopper livestream tasks pænt ...")
    for task in (hls_task,):
        if not task.done():
            task.cancel()
    if not shutdown_task.done():
        shutdown_task.cancel()
    await asyncio.gather(hls_task, shutdown_task, return_exceptions=True)

    log("Kører cleanup før afslutning ...")
    try:
        total_cleanup_local_and_server(client_id)
    except Exception as e:
        log(f"Cleanup-fejl: {e}", "WARN")


if __name__ == "__main__":
    log(f"livestream.py starter ({WIDTH}x{HEIGHT}@{FPS}fps, seg={SEGMENT_LENGTH}s)")

    try:
        total_cleanup_local_and_server(
            json.loads(Path(CONFIG_PATH).read_text(encoding="utf-8")).get("id", "unknown")
        )
    except Exception as e:
        log(f"Initial cleanup-fejl: {e}", "WARN")

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    timer = None
    if LIVESTREAM_TIMEOUT > 0:
        timer = threading.Timer(LIVESTREAM_TIMEOUT, timeout_shutdown)
        timer.daemon = True
        timer.start()
        log(f"Auto-shutdown timer sat til {LIVESTREAM_TIMEOUT}s")

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log("KeyboardInterrupt - pæn nedlukning")
    finally:
        if timer:
            timer.cancel()

    log("livestream.py exit.")
    sys.exit(0)

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
import os

router = APIRouter()

# Dummy rooms (bevares)
DUMMY_ROOMS = [
    {"room_id": "musik1", "name": "Musiklokale 1"},
    {"room_id": "dans2", "name": "Dansesal 2"},
]

@router.get("/api/rooms")
async def get_rooms():
    return DUMMY_ROOMS

# --- HLS upload og serving ---

# Hvor HLS-filerne skal gemmes på serveren
HLS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "hls"))
os.makedirs(HLS_DIR, exist_ok=True)

@router.post("/hls/upload")
async def upload_hls_file(file: UploadFile = File(...)):
    # Gem uploaded fil i HLS_DIR
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
    # Giv filen tilbage (med korrekt content-type automatisk)
    return FileResponse(file_path)

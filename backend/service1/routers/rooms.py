from fastapi import APIRouter

router = APIRouter()

DUMMY_ROOMS = [
    {"room_id": "musik1", "name": "Musiklokale 1"},
    {"room_id": "dans2", "name": "Dansesal 2"},
]

@router.get("/api/rooms")
async def get_rooms():
    return DUMMY_ROOMS

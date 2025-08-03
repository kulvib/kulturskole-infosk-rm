from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter()

# Dummy storage, brug database/fil i produktion!
MARKED_DAYS = {}

@router.post("/calendar/marked-days")
async def save_marked_days(request: Request):
    data = await request.json()
    marked_days = data.get('markedDays')
    if not isinstance(marked_days, dict):
        return JSONResponse(status_code=400, content={'error': 'Bad request'})
    global MARKED_DAYS
    MARKED_DAYS = marked_days
    return {"ok": True}

@router.get("/calendar/marked-days")
async def get_marked_days():
    global MARKED_DAYS
    return {"markedDays": MARKED_DAYS}

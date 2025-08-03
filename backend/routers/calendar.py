from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from backend.models import CalendarMarking
from backend.db import get_session
from sqlalchemy.exc import SQLAlchemyError

router = APIRouter()

@router.post("/calendar/marked-days")
def save_marked_days(data: dict, session=Depends(get_session)):
    marked_days = data.get("markedDays")
    if not isinstance(marked_days, dict):
        raise HTTPException(status_code=400, detail="markedDays mangler eller har forkert format")
    try:
        existing = session.exec(select(CalendarMarking)).first()
        if existing:
            existing.markings = marked_days
            session.add(existing)
        else:
            session.add(CalendarMarking(markings=marked_days))
        session.commit()
        return {"ok": True}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/calendar/marked-days")
def get_marked_days(session=Depends(get_session)):
    existing = session.exec(select(CalendarMarking)).first()
    return {"markedDays": existing.markings if existing else {}}

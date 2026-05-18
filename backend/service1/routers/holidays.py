from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from db import get_session
from models import Holiday
from auth import get_current_user, get_current_admin_user

router = APIRouter()


class HolidayCreate(BaseModel):
    date: str
    description: Optional[str] = None


@router.get("/holidays/", response_model=list[Holiday])
def list_holidays(
    session: Session = Depends(get_session),
    user=Depends(get_current_user)
):
    return session.exec(select(Holiday).order_by(Holiday.date)).all()


@router.post("/holidays/", response_model=Holiday, status_code=201)
def create_holiday(
    holiday: HolidayCreate,
    session: Session = Depends(get_session),
    user=Depends(get_current_user)
):
    # Validér datoformat
    try:
        datetime.fromisoformat(holiday.date)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Ugyldig datoangivelse (brug YYYY-MM-DD)")
    # Normalisér til YYYY-MM-DD
    date_str = holiday.date[:10]
    existing = session.exec(select(Holiday).where(Holiday.date == date_str)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Denne dato er allerede tilføjet som helligdag")
    new_holiday = Holiday(date=date_str, description=holiday.description)
    session.add(new_holiday)
    session.commit()
    session.refresh(new_holiday)
    return new_holiday


@router.delete("/holidays/{holiday_id}", status_code=204)
def delete_holiday(
    holiday_id: int,
    session: Session = Depends(get_session),
    user=Depends(get_current_user)
):
    holiday = session.get(Holiday, holiday_id)
    if not holiday:
        raise HTTPException(status_code=404, detail="Helligdag ikke fundet")
    session.delete(holiday)
    session.commit()

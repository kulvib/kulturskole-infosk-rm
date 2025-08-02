from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from ..models import Holiday
from ..database import get_session

router = APIRouter(prefix="/api/holidays", tags=["holidays"])

@router.get("/", response_model=list[Holiday])
def get_holidays(session: Session = Depends(get_session)):
    return session.exec(select(Holiday)).all()

@router.post("/", response_model=Holiday, status_code=status.HTTP_201_CREATED)
def add_holiday(holiday: Holiday, session: Session = Depends(get_session)):
    session.add(holiday)
    session.commit()
    session.refresh(holiday)
    return holiday

@router.delete("/{holiday_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_holiday(holiday_id: int, session: Session = Depends(get_session)):
    holiday = session.get(Holiday, holiday_id)
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    session.delete(holiday)
    session.commit()

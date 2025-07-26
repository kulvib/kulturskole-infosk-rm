from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from models import Holiday
from database import get_db
from auth import get_current_admin_user
import datetime

router = APIRouter(
    prefix="/holidays",
    tags=["holidays"],
)

@router.get("/")
def list_holidays(db: Session = Depends(get_db), user=Depends(get_current_admin_user)):
    return db.query(Holiday).all()

@router.post("/")
def add_holiday(
    date: str = Body(...), 
    description: str = Body(...), 
    db: Session = Depends(get_db),
    user=Depends(get_current_admin_user)
):
    dt = datetime.datetime.strptime(date, "%Y-%m-%d")
    holiday = Holiday(date=dt, description=description)
    db.add(holiday)
    db.commit()
    return {"msg": "holiday added"}

@router.delete("/{holiday_id}")
def delete_holiday(holiday_id: int, db: Session = Depends(get_db), user=Depends(get_current_admin_user)):
    h = db.query(Holiday).filter(Holiday.id == holiday_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Holiday not found")
    db.delete(h)
    db.commit()
    return {"msg": "holiday deleted"}

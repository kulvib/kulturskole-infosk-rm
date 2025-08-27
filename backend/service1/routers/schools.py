from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from models import InfoSkaerm

router = APIRouter()

@router.get("/infoskaerm")
def get_infoskaerm(skole: str = Query(None), db: Session = Depends(get_db)):
    query = db.query(InfoSkaerm)
    if skole:
        query = query.filter(InfoSkaerm.skole == skole)
    return query.all()

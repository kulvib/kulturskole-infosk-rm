from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from db import get_session
from models import School

router = APIRouter()

@router.get("/schools/", response_model=list[School])
def get_schools(session=Depends(get_session)):
    return session.exec(select(School)).all()

@router.post("/schools/", response_model=School)
def create_school(school: School, session=Depends(get_session)):
    existing = session.exec(select(School).where(School.name == school.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Skolen findes allerede")
    session.add(school)
    session.commit()
    session.refresh(school)
    return school

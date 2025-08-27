from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from db import get_session
from models import School, Client

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

@router.get("/schools/{school_id}/clients/", response_model=list[Client])
def get_clients_for_school(school_id: int, session=Depends(get_session)):
    return session.exec(select(Client).where(Client.school_id == school_id)).all()

@router.delete("/schools/{school_id}/", status_code=204)
def delete_school(school_id: int, session=Depends(get_session)):
    school = session.get(School, school_id)
    if not school:
        raise HTTPException(status_code=404, detail="Skole ikke fundet")
    # Slet alle klienter tilknyttet skolen
    clients = session.exec(select(Client).where(Client.school_id == school_id)).all()
    for client in clients:
        session.delete(client)
    session.delete(school)
    session.commit()
    return

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import select
from db import get_session
from models import School, SchoolCreate, Client, CalendarMarking, User
from pydantic import BaseModel
from typing import Optional
from auth import get_current_user, get_current_admin_user

router = APIRouter()


# FIX: Pydantic-model til opdatering af skoletider.
# Tidligere blev individuelle Body()-parametre brugt, hvilket FastAPI
# ikke parser korrekt fra et JSON-objekt — resulterede i at None blev
# gemt i stedet for de rigtige tider.
class SchoolTimesUpdate(BaseModel):
    weekday_on: Optional[str] = None
    weekday_off: Optional[str] = None
    weekend_on: Optional[str] = None
    weekend_off: Optional[str] = None


class SchoolNameUpdate(BaseModel):
    name: str


@router.get("/schools/", response_model=list[School])
def get_schools(session=Depends(get_session), user=Depends(get_current_user)):
    return session.exec(select(School)).all()


@router.post("/schools/", response_model=School)
def create_school(school: SchoolCreate, session=Depends(get_session), admin=Depends(get_current_admin_user)):
    existing = session.exec(select(School).where(School.name == school.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Skolen findes allerede")
    new_school = School(
        name=school.name,
        weekday_on=school.weekday_on,
        weekday_off=school.weekday_off,
        weekend_on=school.weekend_on,
        weekend_off=school.weekend_off,
    )
    session.add(new_school)
    session.commit()
    session.refresh(new_school)
    return new_school


@router.get("/schools/{school_id}/clients/", response_model=list[Client])
def get_clients_for_school(school_id: int, session=Depends(get_session), user=Depends(get_current_user)):
    return session.exec(select(Client).where(Client.school_id == school_id)).all()


@router.delete("/schools/{school_id}/", status_code=204)
def delete_school(school_id: int, session=Depends(get_session), admin=Depends(get_current_admin_user)):
    school = session.get(School, school_id)
    if not school:
        raise HTTPException(status_code=404, detail="Skole ikke fundet")
    # Slet tilknyttede klienter og deres kalenderdata
    clients = session.exec(select(Client).where(Client.school_id == school_id)).all()
    for client in clients:
        markings = session.exec(
            select(CalendarMarking).where(CalendarMarking.client_id == client.id)
        ).all()
        for marking in markings:
            session.delete(marking)
        session.delete(client)
    # Fjern skole-tilknytning på brugere
    school_users = session.exec(select(User).where(User.school_id == school_id)).all()
    for school_user in school_users:
        school_user.school_id = None
        session.add(school_user)
    session.delete(school)
    session.commit()


# FIX: Bruger nu SchoolTimesUpdate Pydantic-model i stedet for individuelle
# Body()-parametre. FastAPI parser JSON-body korrekt via modellen.
@router.patch("/schools/{school_id}/times", response_model=School)
def update_school_times(
    school_id: int,
    times: SchoolTimesUpdate,
    session=Depends(get_session),
    admin=Depends(get_current_admin_user)
):
    school = session.get(School, school_id)
    if not school:
        raise HTTPException(status_code=404, detail="Skole ikke fundet")
    if times.weekday_on is not None:
        school.weekday_on = times.weekday_on
    if times.weekday_off is not None:
        school.weekday_off = times.weekday_off
    if times.weekend_on is not None:
        school.weekend_on = times.weekend_on
    if times.weekend_off is not None:
        school.weekend_off = times.weekend_off
    session.add(school)
    session.commit()
    session.refresh(school)
    return school


@router.get("/schools/{school_id}/times")
def get_school_times(school_id: int, session=Depends(get_session), user=Depends(get_current_user)):
    school = session.get(School, school_id)
    if not school:
        raise HTTPException(status_code=404, detail="Skole ikke fundet")
    return {
        "weekday": {"onTime": school.weekday_on, "offTime": school.weekday_off},
        "weekend": {"onTime": school.weekend_on, "offTime": school.weekend_off},
    }


@router.patch("/schools/{school_id}/", response_model=School)
def update_school_name(
    school_id: int,
    update: SchoolNameUpdate,
    session=Depends(get_session),
    admin=Depends(get_current_admin_user)
):
    school = session.get(School, school_id)
    if not school:
        raise HTTPException(status_code=404, detail="Skole ikke fundet")
    existing = session.exec(select(School).where(School.name == update.name)).first()
    if existing and existing.id != school_id:
        raise HTTPException(status_code=400, detail="Skolenavnet findes allerede")
    school.name = update.name
    session.add(school)
    session.commit()
    session.refresh(school)
    return school

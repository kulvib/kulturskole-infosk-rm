from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import select
from db import get_session
from models import School, SchoolCreate, Client, CalendarMarking, User, SchoolSeasonTimes
from pydantic import BaseModel
from typing import Optional
from auth import get_current_user, get_current_admin_user

router = APIRouter()


class SchoolTimesUpdate(BaseModel):
    weekday_on: Optional[str] = None
    weekday_off: Optional[str] = None
    weekend_on: Optional[str] = None
    weekend_off: Optional[str] = None


class SchoolNameUpdate(BaseModel):
    name: str


def _require_school_access(user: User, school_id: int):
    """Superadmin har adgang til alle skoler. Admin kun til sin egen skole."""
    if user.is_superadmin:
        return
    if user.is_admin and user.school_id == school_id:
        return
    raise HTTPException(
        status_code=403,
        detail="Du har kun adgang til din egen skoles tider"
    )


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
    clients = session.exec(select(Client).where(Client.school_id == school_id)).all()
    for client in clients:
        markings = session.exec(
            select(CalendarMarking).where(CalendarMarking.client_id == client.id)
        ).all()
        for marking in markings:
            session.delete(marking)
        session.delete(client)
    school_users = session.exec(select(User).where(User.school_id == school_id)).all()
    for school_user in school_users:
        school_user.school_id = None
        session.add(school_user)
    # Slet sæsonbaserede tider for skolen
    season_times_list = session.exec(
        select(SchoolSeasonTimes).where(SchoolSeasonTimes.school_id == school_id)
    ).all()
    for st in season_times_list:
        session.delete(st)
    session.delete(school)
    session.commit()


# Eksisterende endpoint — bevaret for bagudkompatibilitet
@router.patch("/schools/{school_id}/times", response_model=School)
def update_school_times(
    school_id: int,
    times: SchoolTimesUpdate,
    session=Depends(get_session),
    admin=Depends(get_current_admin_user)
):
    _require_school_access(admin, school_id)
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


# Eksisterende endpoint — bevaret for bagudkompatibilitet
@router.get("/schools/{school_id}/times")
def get_school_times(school_id: int, session=Depends(get_session), user=Depends(get_current_user)):
    school = session.get(School, school_id)
    if not school:
        raise HTTPException(status_code=404, detail="Skole ikke fundet")
    return {
        "weekday": {"onTime": school.weekday_on, "offTime": school.weekday_off},
        "weekend": {"onTime": school.weekend_on, "offTime": school.weekend_off},
    }


# NY: Hent sæsonbaserede tider for en skole.
# Falder tilbage til skolens standardtider hvis ingen sæsonspecifik post findes.
@router.get("/schools/{school_id}/season-times/{season}")
def get_school_season_times(
    school_id: int,
    season: int,
    session=Depends(get_session),
    user=Depends(get_current_user)
):
    school = session.get(School, school_id)
    if not school:
        raise HTTPException(status_code=404, detail="Skole ikke fundet")
    season_times = session.exec(
        select(SchoolSeasonTimes).where(
            SchoolSeasonTimes.school_id == school_id,
            SchoolSeasonTimes.season == season
        )
    ).first()
    if season_times:
        return {
            "weekday": {"onTime": season_times.weekday_on, "offTime": season_times.weekday_off},
            "weekend": {"onTime": season_times.weekend_on, "offTime": season_times.weekend_off},
        }
    # Fallback til skolens standardtider
    return {
        "weekday": {"onTime": school.weekday_on or "09:00", "offTime": school.weekday_off or "22:30"},
        "weekend": {"onTime": school.weekend_on or "08:00", "offTime": school.weekend_off or "18:00"},
    }


# NY: Gem sæsonbaserede tider for en skole.
# Superadmin: alle skoler. Admin: kun egen skole.
@router.patch("/schools/{school_id}/season-times/{season}")
def update_school_season_times(
    school_id: int,
    season: int,
    times: SchoolTimesUpdate,
    session=Depends(get_session),
    admin=Depends(get_current_admin_user)
):
    _require_school_access(admin, school_id)
    school = session.get(School, school_id)
    if not school:
        raise HTTPException(status_code=404, detail="Skole ikke fundet")
    season_times = session.exec(
        select(SchoolSeasonTimes).where(
            SchoolSeasonTimes.school_id == school_id,
            SchoolSeasonTimes.season == season
        )
    ).first()
    if not season_times:
        # Opret ny post med skolens standardtider som udgangspunkt
        season_times = SchoolSeasonTimes(
            school_id=school_id,
            season=season,
            weekday_on=school.weekday_on or "09:00",
            weekday_off=school.weekday_off or "22:30",
            weekend_on=school.weekend_on or "08:00",
            weekend_off=school.weekend_off or "18:00",
        )
    if times.weekday_on is not None:
        season_times.weekday_on = times.weekday_on
    if times.weekday_off is not None:
        season_times.weekday_off = times.weekday_off
    if times.weekend_on is not None:
        season_times.weekend_on = times.weekend_on
    if times.weekend_off is not None:
        season_times.weekend_off = times.weekend_off
    session.add(season_times)
    session.commit()
    session.refresh(season_times)
    return {
        "weekday": {"onTime": season_times.weekday_on, "offTime": season_times.weekday_off},
        "weekend": {"onTime": season_times.weekend_on, "offTime": season_times.weekend_off},
        "school_id": school_id,
        "season": season,
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

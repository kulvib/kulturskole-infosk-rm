from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import select
from db import get_session
from models import School, SchoolCreate, Client, CalendarMarking, User, SchoolSeasonTimes
from pydantic import BaseModel
from typing import Optional
from auth import get_current_user, get_current_admin_user
from datetime import date

router = APIRouter()


class SchoolTimesUpdate(BaseModel):
    weekday_on: Optional[str] = None
    weekday_off: Optional[str] = None
    weekend_on: Optional[str] = None
    weekend_off: Optional[str] = None


class SchoolNameUpdate(BaseModel):
    name: str


def _require_school_access(user, school_id: int):
    if user.is_superadmin:
        return
    if user.is_admin and user.school_id == school_id:
        return
    raise HTTPException(status_code=403, detail="Du har kun adgang til din egen skoles tider")


def _validate_season(season: str) -> str:
    parts = season.split("/")
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Ugyldig sæson — brug format '2025/2026'")
    try:
        start, end = int(parts[0]), int(parts[1])
        if end != start + 1:
            raise HTTPException(status_code=400, detail="Slut-år skal være start-år + 1")
    except ValueError:
        raise HTTPException(status_code=400, detail="Ugyldig sæson — brug format '2025/2026'")
    return season


def _get_school_year_dates(season: str):
    """Returnerer alle datoer i skoleåret som date-objekter."""
    start_year = int(season.split("/")[0])
    dates = []
    for month in range(8, 13):
        for day in range(1, 32):
            try:
                dates.append(date(start_year, month, day))
            except ValueError:
                continue
    for month in range(1, 8):
        for day in range(1, 32):
            try:
                dates.append(date(start_year + 1, month, day))
            except ValueError:
                continue
    return dates


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
        for marking in session.exec(select(CalendarMarking).where(CalendarMarking.client_id == client.id)).all():
            session.delete(marking)
        session.delete(client)
    for school_user in session.exec(select(User).where(User.school_id == school_id)).all():
        school_user.school_id = None
        session.add(school_user)
    for st in session.exec(select(SchoolSeasonTimes).where(SchoolSeasonTimes.school_id == school_id)).all():
        session.delete(st)
    session.delete(school)
    session.commit()


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


@router.get("/schools/{school_id}/times")
def get_school_times(school_id: int, session=Depends(get_session), user=Depends(get_current_user)):
    school = session.get(School, school_id)
    if not school:
        raise HTTPException(status_code=404, detail="Skole ikke fundet")
    return {
        "weekday": {"onTime": school.weekday_on, "offTime": school.weekday_off},
        "weekend": {"onTime": school.weekend_on, "offTime": school.weekend_off},
    }


@router.get("/schools/{school_id}/season-times/{season:path}")
def get_school_season_times(
    school_id: int,
    season: str,
    session=Depends(get_session),
    user=Depends(get_current_user)
):
    _validate_season(season)
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
    return {
        "weekday": {"onTime": school.weekday_on or "09:00", "offTime": school.weekday_off or "22:30"},
        "weekend": {"onTime": school.weekend_on or "08:00", "offTime": school.weekend_off or "18:00"},
    }


@router.patch("/schools/{school_id}/season-times/{season:path}")
def update_school_season_times(
    school_id: int,
    season: str,
    times: SchoolTimesUpdate,
    session=Depends(get_session),
    admin=Depends(get_current_admin_user)
):
    _validate_season(season)
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
        season_times = SchoolSeasonTimes(
            school_id=school_id, season=season,
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


@router.post("/schools/{school_id}/apply-season-times/{season:path}")
def apply_season_times_to_clients(
    school_id: int,
    season: str,
    session=Depends(get_session),
    admin=Depends(get_current_admin_user)
):
    """
    Overskriver ALLE dage (både on og off) i calendarmarking for alle klienter
    tilknyttet skolen i den valgte sæson med de sæsonbaserede tider.
    Hverdage (ma-fr) bruger weekday_on/off, weekend (lø-sø) bruger weekend_on/off.
    """
    _validate_season(season)
    _require_school_access(admin, school_id)

    school = session.get(School, school_id)
    if not school:
        raise HTTPException(status_code=404, detail="Skole ikke fundet")

    # Hent sæsonbaserede tider — kræv at de findes
    season_times = session.exec(
        select(SchoolSeasonTimes).where(
            SchoolSeasonTimes.school_id == school_id,
            SchoolSeasonTimes.season == season
        )
    ).first()

    if season_times:
        wd_on  = season_times.weekday_on
        wd_off = season_times.weekday_off
        we_on  = season_times.weekend_on
        we_off = season_times.weekend_off
    else:
        # Fallback til skolens standardtider
        wd_on  = school.weekday_on  or "09:00"
        wd_off = school.weekday_off or "22:30"
        we_on  = school.weekend_on  or "08:00"
        we_off = school.weekend_off or "18:00"

    # Alle datoer i sæsonen
    all_dates = _get_school_year_dates(season)

    # Alle godkendte klienter tilknyttet skolen
    clients = session.exec(
        select(Client).where(
            Client.school_id == school_id,
            Client.status == "approved"
        )
    ).all()

    if not clients:
        raise HTTPException(status_code=404, detail="Ingen godkendte klienter fundet for denne skole")

    updated_clients = []
    for client in clients:
        # Byg komplet markings-dict — ALLE dage sættes til "on" med korrekte tider
        new_markings = {}
        for d in all_dates:
            is_weekend = d.weekday() >= 5  # 5=lørdag, 6=søndag
            if is_weekend:
                new_markings[d.isoformat()] = {
                    "status": "on",
                    "onTime": we_on,
                    "offTime": we_off,
                }
            else:
                new_markings[d.isoformat()] = {
                    "status": "on",
                    "onTime": wd_on,
                    "offTime": wd_off,
                }

        # Opdatér eller opret CalendarMarking
        existing = session.exec(
            select(CalendarMarking).where(
                CalendarMarking.season == season,
                CalendarMarking.client_id == client.id
            )
        ).first()

        if existing:
            existing.markings = new_markings
            session.add(existing)
        else:
            session.add(CalendarMarking(
                season=season,
                client_id=client.id,
                markings=new_markings
            ))

        updated_clients.append(client.id)

    session.commit()

    return {
        "ok": True,
        "school_id": school_id,
        "season": season,
        "updated_clients": updated_clients,
        "total_days": len(all_dates),
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

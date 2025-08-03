from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlmodel import select
from backend.models import CalendarMarking, Client
from backend.db import get_session
from sqlalchemy.exc import SQLAlchemyError
from backend.services.mqtt_publish_schedule import publish_schedule_for_client

router = APIRouter()

@router.post("/calendar/marked-days")
def save_marked_days(
    data: dict = Body(...),
    session=Depends(get_session)
):
    marked_days = data.get("markedDays")
    client_ids = data.get("clients", [])
    season = data.get("season")
    if not isinstance(marked_days, dict):
        raise HTTPException(status_code=400, detail="markedDays mangler eller har forkert format")
    if season is None:
        raise HTTPException(status_code=400, detail="season mangler")
    try:
        for client_id in client_ids:
            existing = session.exec(
                select(CalendarMarking).where(
                    CalendarMarking.season == season,
                    CalendarMarking.client_id == client_id
                )
            ).first()
            if existing:
                existing.markings = marked_days
                session.add(existing)
            else:
                session.add(CalendarMarking(season=season, client_id=client_id, markings=marked_days))
            publish_schedule_for_client(client_id, session)
        session.commit()
        return {"ok": True}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/calendar/marked-days")
def get_marked_days(
    season: int = Query(...),
    client_id: int = Query(...),
    session=Depends(get_session)
):
    existing = session.exec(
        select(CalendarMarking).where(
            CalendarMarking.season == season,
            CalendarMarking.client_id == client_id
        )
    ).first()
    return {"markedDays": existing.markings if existing else {}}

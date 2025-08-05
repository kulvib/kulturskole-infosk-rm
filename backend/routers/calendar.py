from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlmodel import select
from backend.models import CalendarMarking, Client
from backend.db import get_session
from sqlalchemy.exc import SQLAlchemyError
from pydantic import BaseModel, Field
from typing import Dict, List, Any
from datetime import datetime

router = APIRouter()

class MarkedDaysRequest(BaseModel):
    markedDays: Dict[str, Any]  # F.eks. {"2025-08-05": true, "2025-08-06T08:00:00": false}
    clients: List[int]
    season: int

def parse_iso8601_keys(d: Dict[str, Any]) -> Dict[str, Any]:
    """Validerer at nøglerne i markedDays er ISO8601-datoer eller datoer."""
    out = {}
    for k, v in d.items():
        try:
            # Prøv at parse som datetime, hvis muligt
            dt = datetime.fromisoformat(k)
            out[k] = v
        except Exception:
            # Hvis ikke valid datetime, tillad dog string som fallback
            out[k] = v
    return out

@router.post("/calendar/marked-days")
def save_marked_days(
    data: MarkedDaysRequest,
    session=Depends(get_session)
):
    marked_days = parse_iso8601_keys(data.markedDays)
    client_ids = data.clients
    season = data.season
    if not isinstance(marked_days, dict):
        raise HTTPException(status_code=400, detail="markedDays mangler eller har forkert format")
    if season is None:
        raise HTTPException(status_code=400, detail="season mangler")
    try:
        # Hent alle eksisterende CalendarMarkings for de pågældende klienter på én gang
        existing_markings = session.exec(
            select(CalendarMarking)
            .where(CalendarMarking.season == season, CalendarMarking.client_id.in_(client_ids))
        ).all()
        existing_map = {cm.client_id: cm for cm in existing_markings}
        for client_id in client_ids:
            if client_id in existing_map:
                cm = existing_map[client_id]
                cm.markings = marked_days
                session.add(cm)
            else:
                session.add(CalendarMarking(season=season, client_id=client_id, markings=marked_days))
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
    # Returnér markings med ISO8601-nøgler, hvis muligt
    markings = existing.markings if existing else {}
    # Sørg for at alle keys er strings (ISO 8601 hvis muligt)
    formatted_markings = {}
    for k, v in markings.items():
        try:
            dt = datetime.fromisoformat(k)
            formatted_markings[dt.isoformat()] = v
        except Exception:
            formatted_markings[str(k)] = v
    return {"markedDays": formatted_markings}

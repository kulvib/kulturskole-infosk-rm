from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlmodel import select
from backend.models import CalendarMarking, Client
from backend.db import get_session
from sqlalchemy.exc import SQLAlchemyError
from pydantic import BaseModel, Field
from typing import Dict, List, Any
from datetime import datetime

# REST integration
import requests

router = APIRouter()

class MarkedDaysRequest(BaseModel):
    markedDays: Dict[str, Any]  # F.eks. {"2025-08-05": true, "2025-08-06T08:00:00": false}
    clients: List[int]
    season: int

def parse_iso8601_keys(d: Dict[str, Any]) -> Dict[str, Any]:
    out = {}
    for k, v in d.items():
        try:
            dt = datetime.fromisoformat(k)
            out[k] = v
        except Exception:
            out[k] = v
    return out

def publish_schedule_for_client(client: Client, markings: Dict[str, Any]):
    """
    Send kalender til klienten via HTTP REST.
    Klientens endpoint antages at være http://<ip>:8000/api/update_schedule
    """
    # Brug klientens LAN eller WiFi IP-adresse
    client_ip = client.lan_ip_address or client.wifi_ip_address
    if not client_ip:
        print(f"Klient {client.id} har ingen IP-adresse - kan ikke sende kalender")
        return
    url = f"http://{client_ip}:8000/api/update_schedule"
    try:
        resp = requests.post(url, json={"markedDays": markings}, timeout=5)
        resp.raise_for_status()
        print(f"Sendt kalender til klient {client.id} ({url})")
    except Exception as e:
        print(f"Fejl ved send til klient {client.id} ({url}): {e}")

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

        # Efter commit, send kalender til klienterne!
        for client_id in client_ids:
            client = session.exec(select(Client).where(Client.id == client_id)).first()
            if client:
                publish_schedule_for_client(client, marked_days)

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
    markings = existing.markings if existing else {}
    formatted_markings = {}
    for k, v in markings.items():
        try:
            dt = datetime.fromisoformat(k)
            formatted_markings[dt.isoformat()] = v
        except Exception:
            formatted_markings[str(k)] = v
    return {"markedDays": formatted_markings}

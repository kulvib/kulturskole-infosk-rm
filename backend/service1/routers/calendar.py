from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlmodel import select
from models import CalendarMarking, Client
from db import get_session
from sqlalchemy.exc import SQLAlchemyError
from pydantic import BaseModel
from typing import Dict, List, Any
from datetime import datetime, date
import requests

router = APIRouter()

class MarkedDaysRequest(BaseModel):
    markedDays: Dict[str, Dict[str, Any]]
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
    client_ids = data.clients
    season = data.season
    try:
        for client_id in client_ids:
            markings = data.markedDays.get(str(client_id), {})
            markings = parse_iso8601_keys(markings)
            existing = session.exec(
                select(CalendarMarking)
                .where(CalendarMarking.season == season, CalendarMarking.client_id == client_id)
            ).first()
            if existing:
                existing.markings = markings
                session.add(existing)
            else:
                session.add(CalendarMarking(season=season, client_id=client_id, markings=markings))
        session.commit()
        for client_id in client_ids:
            client = session.exec(select(Client).where(Client.id == client_id)).first()
            if client:
                publish_schedule_for_client(client, data.markedDays.get(str(client_id), {}))
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

# NYT ENDPOINT: Liste over de næste 20 sæsoner
@router.get("/calendar/seasons")
def get_seasons_list(count: int = 20):
    """
    Returnerer en liste af sæsoner (id og label), f.eks. [{"id":2025,"label":"2025/2026"}, ...].
    """
    today = date.today()
    # Første sæson: Hvis vi er fra august og frem, starter vi i år, ellers sidste år
    if today.month >= 8:
        first_season = today.year
    else:
        first_season = today.year - 1

    result = []
    for i in range(count):
        season_start = first_season + i
        season_end = season_start + 1
        result.append({
            "id": season_start,
            "label": f"{season_start}/{season_end}"
        })
    return result

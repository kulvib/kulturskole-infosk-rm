from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlmodel import select, delete
from models import CalendarMarking, Client
from db import get_session
from sqlalchemy.exc import SQLAlchemyError
from pydantic import BaseModel
from typing import Dict, List, Any
from datetime import datetime, date
import requests
from auth import get_current_user  # Importér authentication

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
    session=Depends(get_session),
    user=Depends(get_current_user)
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
    session=Depends(get_session),
    user=Depends(get_current_user)
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

@router.get("/calendar/seasons")
def get_seasons_list(
    count: int = 20,
    user=Depends(get_current_user)
):
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

@router.get("/calendar/season")
def get_current_season(
    user=Depends(get_current_user)
):
    """
    Returnerer den aktuelle sæson, hvor sæsonen går fra 1. august til 31. juli året efter.
    Eksempel: Hvis i dag er mellem 1. august 2024 og 31. juli 2025, returneres 2024/2025.
    """
    today = date.today()
    year = today.year
    # Fra august til december gælder sæsonen for dette år til næste år
    if today.month >= 8:  # August til December
        season_start = year
        season_end = year + 1
    else:  # Januar til Juli
        season_start = year - 1
        season_end = year
    return {
        "id": season_start,
        "label": f"{season_start}/{season_end}"
    }

@router.post("/calendar/cleanup-past-seasons")
def cleanup_past_seasons(
    session=Depends(get_session),
    user=Depends(get_current_user)
):
    """
    Slet alle CalendarMarking for den forrige sæson,
    hvis vi er efter 10. august.
    """
    today = date.today()
    # Bestem hvilken sæson der skal slettes
    # Hvis vi er efter 10. august, slettes sidste år
    if today.month > 8 or (today.month == 8 and today.day >= 10):
        season_to_delete = today.year - 1
        session.exec(
            delete(CalendarMarking).where(CalendarMarking.season == season_to_delete)
        )
        session.commit()
        return {"deleted_season": season_to_delete}
    else:
        return {"deleted_season": None, "message": "Ingen sæson slettet - ikke efter 10. august"}

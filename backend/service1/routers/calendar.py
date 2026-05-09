from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select, delete
from models import CalendarMarking, Client
from db import get_session
from sqlalchemy.exc import SQLAlchemyError
from pydantic import BaseModel
from typing import Dict, List, Any
from datetime import datetime, date
import requests
from auth import get_current_user

router = APIRouter()


class MarkedDaysRequest(BaseModel):
    markedDays: Dict[str, Dict[str, Any]]
    clients: List[int]
    season: int


def parse_iso8601_keys(d: Dict[str, Any]) -> Dict[str, Any]:
    out = {}
    for k, v in d.items():
        try:
            datetime.fromisoformat(k)
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
    try:
        for client_id in data.clients:
            markings = parse_iso8601_keys(data.markedDays.get(str(client_id), {}))
            existing = session.exec(
                select(CalendarMarking)
                .where(CalendarMarking.season == data.season, CalendarMarking.client_id == client_id)
            ).first()
            if existing:
                existing.markings = markings
                session.add(existing)
            else:
                session.add(CalendarMarking(season=data.season, client_id=client_id, markings=markings))
        session.commit()
        for client_id in data.clients:
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
    formatted = {}
    for k, v in markings.items():
        try:
            formatted[datetime.fromisoformat(k).isoformat()] = v
        except Exception:
            formatted[str(k)] = v
    return {"markedDays": formatted}


@router.get("/calendar/seasons")
def get_seasons_list(count: int = 20, user=Depends(get_current_user)):
    today = date.today()
    first_season = today.year if today.month >= 8 else today.year - 1
    return [
        {"id": first_season + i, "label": f"{first_season + i}/{first_season + i + 1}"}
        for i in range(count)
    ]


@router.get("/calendar/season")
def get_current_season(user=Depends(get_current_user)):
    today = date.today()
    if today.month >= 8:
        season_start, season_end = today.year, today.year + 1
    else:
        season_start, season_end = today.year - 1, today.year
    return {"id": season_start, "label": f"{season_start}/{season_end}"}


@router.post("/calendar/cleanup-past-seasons")
def cleanup_past_seasons(session=Depends(get_session), user=Depends(get_current_user)):
    today = date.today()
    if today.month > 8 or (today.month == 8 and today.day >= 10):
        season_to_delete = today.year - 1
        session.exec(delete(CalendarMarking).where(CalendarMarking.season == season_to_delete))
        session.commit()
        return {"deleted_season": season_to_delete}
    return {"deleted_season": None, "message": "Ingen sæson slettet - ikke efter 10. august"}

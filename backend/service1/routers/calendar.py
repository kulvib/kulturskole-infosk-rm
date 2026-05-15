from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select, delete
from models import CalendarMarking, Client
from db import get_session
from sqlalchemy.exc import SQLAlchemyError
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
from datetime import datetime, date
import ipaddress
import requests
from auth import get_current_user

router = APIRouter()


class MarkedDaysRequest(BaseModel):
    markedDays: Dict[str, Dict[str, Any]]
    clients: List[int]
    season: int


def parse_iso8601_keys(d: Dict[str, Any]) -> Dict[str, Any]:
    """Filtrerer ordbogen til kun at indeholde gyldige ISO 8601-datanøgler."""
    out = {}
    for k, v in d.items():
        try:
            datetime.fromisoformat(k)
            out[k] = v
        except (ValueError, TypeError):
            pass
    return out


def _is_safe_private_ip(ip_str: str) -> bool:
    """Returnerer True hvis IP-adressen er en privat/loopback-adresse."""
    try:
        addr = ipaddress.ip_address(ip_str)
        return addr.is_private or addr.is_loopback
    except ValueError:
        return False


def publish_schedule_for_client(client: Client, markings: Dict[str, Any]):
    client_ip = client.lan_ip_address or client.wifi_ip_address
    if not client_ip:
        print(f"Klient {client.id} har ingen IP-adresse - kan ikke sende kalender")
        return
    if not _is_safe_private_ip(client_ip):
        print(f"SSRF-advarsel: Klient {client.id} har en offentlig IP ({client_ip}) — afviser")
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
    start_date: Optional[str] = Query(None, description="Filtrer fra dato (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Filtrer til dato (YYYY-MM-DD)"),
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
            # Normaliser altid til "YYYY-MM-DDT00:00:00" format for konsistens
            parsed = datetime.fromisoformat(k)
            iso_key = parsed.strftime("%Y-%m-%dT00:00:00")
            iso_date = iso_key[:10]
            # Filtrér efter start_date og end_date hvis angivet
            if start_date and iso_date < start_date:
                continue
            if end_date and iso_date > end_date:
                continue
            formatted[iso_key] = v
        except Exception:
            formatted[str(k)] = v
    return {"markedDays": formatted}


@router.get("/calendar/seasons")
def get_seasons_list(count: int = 20, user=Depends(get_current_user)):
    today = date.today()
    first_season = today.year if today.month >= 8 else today.year - 1
    start = first_season - 2
    return [
        {"id": start + i, "label": f"{start + i}/{start + i + 1}"}
        for i in range(count + 2)
    ]


@router.get("/calendar/season")
def get_current_season(user=Depends(get_current_user)):
    today = date.today()
    if today.month >= 8:
        season_start, season_end = today.year, today.year + 1
    else:
        season_start, season_end = today.year - 1, today.year
    return {
        "id": season_start,
        "label": f"{season_start}/{season_end}",
        # FIX: Tilføjet start_date og end_date så frontend kan bruge dem til DatePicker-begrænsning
        "start_date": date(season_start, 8, 1).isoformat(),
        "end_date": date(season_end, 7, 31).isoformat(),
    }


@router.post("/calendar/cleanup-past-seasons")
def cleanup_past_seasons(session=Depends(get_session), user=Depends(get_current_user)):
    today = date.today()
    if today.month > 8 or (today.month == 8 and today.day >= 10):
        season_to_delete = today.year - 1
        session.exec(delete(CalendarMarking).where(CalendarMarking.season == season_to_delete))
        session.commit()
        return {"deleted_season": season_to_delete}
    return {"deleted_season": None, "message": "Ingen sæson slettet - ikke efter 10. august"}

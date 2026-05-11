from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import select, delete
from typing import List
from datetime import datetime, timedelta, date, timezone
from db import get_session
from models import Client, ClientCreate, ClientUpdate, CalendarMarking, ChromeAction, School
from auth import get_current_user, get_current_admin_user
from models import utcnow
import os
import glob
import json

router = APIRouter()

# Læs HLS-sti fra miljøvariabel med fornuftig fallback
HLS_BASE_DIR = os.getenv("HLS_BASE_DIR", "/opt/render/project/src/backend/service1/hls")
CHROME_STATUS_PATH = os.getenv("CHROME_STATUS_PATH", "/home/kulturskolenviborg/api/chrome_status.json")

VALID_CLIENT_STATES = {"normal", "sleep", "wakeup", "shutdown", "error"}


def is_online(client: Client) -> bool:
    if client.last_seen is None:
        return False
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    return (now - client.last_seen) < timedelta(minutes=2)


# Public endpoint — kun navn og id på godkendte klienter (ingen sensitiv data)
@router.get("/clients/public")
def get_clients_public(session=Depends(get_session)):
    clients = session.exec(select(Client).where(Client.status == "approved")).all()
    return {
        "clients": [{"id": c.id, "name": c.name} for c in clients]
    }


@router.get("/clients/me", response_model=List[Client])
def get_clients_for_my_school(session=Depends(get_session), user=Depends(get_current_user)):
    if not user.school_id:
        return []
    clients = session.exec(
        select(Client).where(Client.status == "approved", Client.school_id == user.school_id)
    ).all()
    for client in clients:
        client.isOnline = is_online(client)
    clients.sort(key=lambda c: (c.sort_order is None, c.sort_order if c.sort_order is not None else 9999, c.id))
    return clients


@router.get("/clients/", response_model=List[Client])
def get_clients(session=Depends(get_session), user=Depends(get_current_user)):
    clients = session.exec(select(Client)).all()
    for client in clients:
        client.isOnline = is_online(client)
    clients.sort(key=lambda c: (c.sort_order is None, c.sort_order if c.sort_order is not None else 9999, c.id))
    return clients


@router.get("/clients/{id}/", response_model=Client)
def get_client(id: int, session=Depends(get_session), user=Depends(get_current_user)):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.isOnline = is_online(client)
    if getattr(user, "role", None) == "admin":
        return client
    if getattr(user, "role", None) == "bruger":
        if client.status != "approved" or client.school_id != user.school_id:
            raise HTTPException(status_code=403, detail="Du har ikke adgang til denne klient")
        return client
    raise HTTPException(status_code=403, detail="Du har ikke adgang til denne klient")


@router.get("/clients/{id}/chrome-status")
def get_chrome_status(id: int, session=Depends(get_session), user=Depends(get_current_user)):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    last_step = None
    try:
        with open(CHROME_STATUS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            if "steps" in data and len(data["steps"]) > 0:
                last_step = data["steps"][-1]
    except Exception:
        last_step = None
    if last_step:
        return {
            "client_id": client.id,
            "chrome_status": last_step.get("message", "unknown"),
            "chrome_last_updated": last_step.get("timestamp", None),
            "chrome_color": last_step.get("color", None),
            "step": last_step,
            "last_seen": client.last_seen,
            "uptime": client.uptime,
        }
    return {
        "client_id": client.id,
        "chrome_status": getattr(client, "chrome_status", "unknown"),
        "chrome_last_updated": getattr(client, "chrome_last_updated", None),
        "chrome_color": getattr(client, "chrome_color", None),
        "last_seen": client.last_seen,
        "uptime": client.uptime,
    }


@router.put("/clients/{id}/chrome-status")
def update_chrome_status(
    id: int,
    data: dict = Body(...),
    session=Depends(get_session),
    user=Depends(get_current_user)
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.chrome_status = data.get("chrome_status")
    client.chrome_last_updated = utcnow()
    if data.get("chrome_color") is not None:
        client.chrome_color = data.get("chrome_color")
    session.add(client)
    session.commit()
    session.refresh(client)
    return {"ok": True}


@router.put("/clients/{id}/state")
def update_client_state(
    id: int,
    data: dict = Body(...),
    session=Depends(get_session),
    user=Depends(get_current_user)
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    state = data.get("state")
    if not state:
        raise HTTPException(status_code=400, detail="Missing state")
    if state not in VALID_CLIENT_STATES:
        raise HTTPException(
            status_code=400,
            detail=f"Ugyldig state '{state}'. Tilladte værdier: {sorted(VALID_CLIENT_STATES)}"
        )
    client.state = state
    session.add(client)
    session.commit()
    session.refresh(client)
    return {"ok": True, "state": client.state}


@router.get("/clients/{id}/state")
def get_client_state(id: int, session=Depends(get_session), user=Depends(get_current_user)):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"state": client.state}


@router.post("/clients/{id}/chrome-command")
def set_chrome_command(
    id: int,
    data: dict = Body(...),
    session=Depends(get_session),
    user=Depends(get_current_user)
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    action = data.get("action")
    source = data.get("source")

    if action == "livestream_start" and getattr(client.pending_chrome_action, "value", client.pending_chrome_action) == "livestream_start":
        raise HTTPException(status_code=400, detail="Livestream already requested")

    try:
        chrome_action = ChromeAction(action)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Ugyldig action '{action}'")

    client.pending_chrome_action = chrome_action

    if source is not None:
        if not isinstance(source, str):
            raise HTTPException(status_code=400, detail="Ugyldig source-værdi")
        src_lower = source.lower()
        allowed = {"actionbutton", "calendar", "manual", "backend"}
        if src_lower not in allowed:
            raise HTTPException(status_code=400, detail=f"Ugyldig source '{source}'. Tilladte: {sorted(allowed)}")
        client.pending_chrome_action_source = src_lower

    session.add(client)
    session.commit()
    session.refresh(client)
    return {
        "ok": True,
        "pending_chrome_action": client.pending_chrome_action.value,
        "pending_chrome_action_source": getattr(client, "pending_chrome_action_source", None)
    }


@router.get("/clients/{id}/chrome-command")
def get_chrome_command(id: int, session=Depends(get_session), user=Depends(get_current_user)):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return {
        "action": client.pending_chrome_action.value if client.pending_chrome_action else None,
        "source": getattr(client, "pending_chrome_action_source", None)
    }


@router.post("/clients/", response_model=Client)
async def create_client(
    client_in: ClientCreate,
    session=Depends(get_session),
    user=Depends(get_current_user)
):
    client = Client(
        name=client_in.name,
        locality=client_in.locality,
        wifi_ip_address=client_in.wifi_ip_address,
        wifi_mac_address=client_in.wifi_mac_address,
        lan_ip_address=client_in.lan_ip_address,
        lan_mac_address=client_in.lan_mac_address,
        status="pending",
        isOnline=False,
        last_seen=None,
        sort_order=client_in.sort_order,
        kiosk_url=getattr(client_in, "kiosk_url", None),
        ubuntu_version=getattr(client_in, "ubuntu_version", None),
        uptime=getattr(client_in, "uptime", None),
        chrome_status=getattr(client_in, "chrome_status", "unknown"),
        chrome_last_updated=None,
        chrome_color=getattr(client_in, "chrome_color", None),
        pending_reboot=False,
        pending_shutdown=False,
        pending_chrome_action=getattr(client_in, "pending_chrome_action", ChromeAction.NONE),
        pending_chrome_action_source=getattr(client_in, "pending_chrome_action_source", None),
        school_id=getattr(client_in, "school_id", None),
        state=getattr(client_in, "state", "normal"),
        livestream_status="idle",
        livestream_last_segment=None,
        livestream_last_error=None
    )
    session.add(client)
    session.commit()
    session.refresh(client)
    return client


@router.put("/clients/{id}/update", response_model=Client)
async def update_client(
    id: int,
    client_update: ClientUpdate,
    session=Depends(get_session),
    user=Depends(get_current_user)
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    fields = client_update.model_fields_set  # Pydantic v2 (erstatter __fields_set__)

    if client_update.locality is not None:
        client.locality = client_update.locality
    if client_update.sort_order is not None:
        client.sort_order = client_update.sort_order
    if client_update.kiosk_url is not None:
        client.kiosk_url = client_update.kiosk_url
    if client_update.ubuntu_version is not None:
        client.ubuntu_version = client_update.ubuntu_version
    if client_update.uptime is not None:
        client.uptime = client_update.uptime
    if client_update.wifi_ip_address is not None:
        client.wifi_ip_address = client_update.wifi_ip_address
    if client_update.wifi_mac_address is not None:
        client.wifi_mac_address = client_update.wifi_mac_address
    if client_update.lan_ip_address is not None:
        client.lan_ip_address = client_update.lan_ip_address
    if client_update.lan_mac_address is not None:
        client.lan_mac_address = client_update.lan_mac_address
    if client_update.pending_reboot is not None:
        client.pending_reboot = client_update.pending_reboot
    if client_update.pending_shutdown is not None:
        client.pending_shutdown = client_update.pending_shutdown
    if client_update.chrome_status is not None:
        client.chrome_status = client_update.chrome_status
        client.chrome_last_updated = utcnow()
    if client_update.chrome_color is not None:
        client.chrome_color = client_update.chrome_color
    if "pending_chrome_action" in fields:
        val = client_update.pending_chrome_action
        client.pending_chrome_action = ChromeAction.NONE if val is None else ChromeAction(val)
    if "pending_chrome_action_source" in fields:
        src = client_update.pending_chrome_action_source
        client.pending_chrome_action_source = str(src).lower() if src else None
    if client_update.school_id is not None:
        client.school_id = client_update.school_id
    if client_update.state is not None:
        client.state = client_update.state
    if client_update.livestream_status is not None:
        client.livestream_status = client_update.livestream_status
    if client_update.livestream_last_segment is not None:
        client.livestream_last_segment = client_update.livestream_last_segment
    if client_update.livestream_last_error is not None:
        client.livestream_last_error = client_update.livestream_last_error

    session.add(client)
    session.commit()
    session.refresh(client)
    return client


@router.put("/clients/{id}/kiosk_url", response_model=Client)
async def update_kiosk_url(
    id: int,
    data: dict = Body(...),
    session=Depends(get_session),
    user=Depends(get_current_user)
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    kiosk_url = data.get("kiosk_url")
    if not kiosk_url:
        raise HTTPException(status_code=400, detail="Missing kiosk_url")
    client.kiosk_url = kiosk_url
    session.add(client)
    session.commit()
    session.refresh(client)
    return client


def get_school_year_dates(season_start):
    dates = []
    for month in range(8, 13):
        for day in range(1, 32):
            try:
                dates.append(date(season_start, month, day))
            except ValueError:
                continue
    for month in range(1, 8):
        for day in range(1, 32):
            try:
                dates.append(date(season_start + 1, month, day))
            except ValueError:
                continue
    return dates


@router.post("/clients/{id}/approve", response_model=Client)
async def approve_client(
    id: int,
    data: dict = Body(None),
    session=Depends(get_session),
    user=Depends(get_current_admin_user)
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.status = "approved"
    max_sort_order = session.exec(
        select(Client.sort_order)
        .where(Client.status == "approved", Client.sort_order != None)
        .order_by(Client.sort_order.desc())
    ).first()
    client.sort_order = (max_sort_order or 0) + 1
    if data and "school_id" in data:
        client.school_id = data["school_id"]
    session.add(client)
    session.commit()
    session.refresh(client)

    school = session.get(School, client.school_id) if client.school_id else None
    today = date.today()
    season_start = today.year if today.month >= 8 else today.year - 1
    school_year_dates = get_school_year_dates(season_start)
    markings = {}

    def_wd_on = getattr(school, "weekday_on", "09:00") if school else "09:00"
    def_wd_off = getattr(school, "weekday_off", "22:30") if school else "22:30"
    def_we_on = getattr(school, "weekend_on", "08:00") if school else "08:00"
    def_we_off = getattr(school, "weekend_off", "18:00") if school else "18:00"

    for d in school_year_dates:
        if d.weekday() < 5:
            markings[d.isoformat()] = {"status": "on", "onTime": def_wd_on, "offTime": def_wd_off}
        else:
            markings[d.isoformat()] = {"status": "on", "onTime": def_we_on, "offTime": def_we_off}

    existing = session.exec(
        select(CalendarMarking)
        .where(CalendarMarking.season == season_start, CalendarMarking.client_id == client.id)
    ).first()
    if not existing:
        session.add(CalendarMarking(season=season_start, client_id=client.id, markings=markings))
        session.commit()

    return client


@router.post("/clients/{id}/heartbeat", response_model=Client)
def client_heartbeat(id: int, session=Depends(get_session), user=Depends(get_current_user)):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.last_seen = utcnow()
    session.add(client)
    session.commit()
    session.refresh(client)
    return client


@router.delete("/clients/{id}/remove")
async def remove_client(id: int, session=Depends(get_session), user=Depends(get_current_admin_user)):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    session.exec(delete(CalendarMarking).where(CalendarMarking.client_id == client.id))
    session.delete(client)
    session.commit()
    return {"ok": True}


@router.get("/clients/{id}/stream")
def client_stream(id: int, session=Depends(get_session), user=Depends(get_current_user)):
    return {"stream_url": f"/mjpeg/{id}"}


@router.get("/clients/{id}/terminal")
def client_terminal(id: int, session=Depends(get_session), user=Depends(get_current_user)):
    return {"terminal_url": f"/terminal/{id}"}


@router.get("/clients/{id}/remote-desktop")
def client_remote_desktop(id: int, session=Depends(get_session), user=Depends(get_current_user)):
    return {"remote_desktop_url": f"/remote-desktop/{id}"}


@router.post("/clients/{client_id}/reset-hls")
def reset_hls(client_id: int, user=Depends(get_current_user)):
    hls_dir = os.path.join(HLS_BASE_DIR, str(client_id))
    if not os.path.exists(hls_dir):
        raise HTTPException(status_code=404, detail="HLS directory not found for client")
    deleted, errors = [], []
    for f in glob.glob(os.path.join(hls_dir, "*")):
        try:
            os.remove(f)
            deleted.append(os.path.basename(f))
        except Exception as e:
            errors.append({"file": os.path.basename(f), "error": str(e)})
    return {"status": "ok", "deleted_files": deleted, "errors": errors}


@router.post("/clients/{client_id}/stop-hls")
def stop_hls(client_id: int, user=Depends(get_current_user)):
    hls_dir = os.path.join(HLS_BASE_DIR, str(client_id))
    if not os.path.exists(hls_dir):
        return {"status": "ok", "deleted_files": [], "errors": ["HLS directory not found"]}
    deleted, errors = [], []
    for f in glob.glob(os.path.join(hls_dir, "*")):
        try:
            os.remove(f)
            deleted.append(os.path.basename(f))
        except Exception as e:
            errors.append({"file": os.path.basename(f), "error": str(e)})
    return {"status": "ok", "deleted_files": deleted, "errors": errors}

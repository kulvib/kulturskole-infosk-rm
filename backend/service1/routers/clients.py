from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import select, delete
from typing import List
from datetime import datetime, timedelta, date, timezone
from db import get_session
from models import Client, ClientCreate, ClientUpdate, CalendarMarking, ChromeAction, School, SchoolSeasonTimes
from auth import get_current_user, get_current_admin_user
from models import utcnow
import os
import glob
import json

router = APIRouter()

HLS_BASE_DIR = os.getenv("HLS_BASE_DIR", "/opt/render/project/src/backend/service1/hls")

VALID_CLIENT_STATES = {"normal", "sleeping", "wakeup", "shutdown", "error", "updating"}
VALID_PENDING_CHROME_ACTION_SOURCES = {"actionbutton", "calendar"}

BLOCKING_ACTIONS = {"start", "stop", "sleep", "wakeup", "reboot", "shutdown"}


def normalize_client_state(value: str) -> str:
    normalized = str(value).lower()
    if normalized == "sleep":
        return "sleeping"
    return normalized


def is_online(client: Client) -> bool:
    if client.last_seen is None:
        return False
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    return (now - client.last_seen) < timedelta(seconds=15)


@router.get("/clients/public")
def get_clients_public(session=Depends(get_session)):
    clients = session.exec(select(Client).where(Client.status == "approved")).all()
    return {"clients": [{"id": c.id, "name": c.name} for c in clients]}


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
    if getattr(user, "is_admin", False):
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

    # FIX: Læser nu chrome_step fra database i stedet for at åbne
    # chrome_status.json som kun findes på klient-maskinen (ikke på Render).
    # Klienten pusher chrome_step via /update eller /chrome-status PUT.
    step_obj = None
    if client.chrome_step:
        step_obj = {
            "step": client.chrome_step,
            "timestamp": client.chrome_last_updated.isoformat() + "Z" if client.chrome_last_updated else None,
        }

    return {
        "client_id": client.id,
        "chrome_status": client.chrome_status or "unknown",
        "chrome_last_updated": client.chrome_last_updated,
        "chrome_color": client.chrome_color,
        "step": step_obj,
        "last_seen": client.last_seen,
        "uptime": client.uptime,
    }


@router.put("/clients/{id}/chrome-status")
def update_chrome_status(
    id: int,
    data: dict = Body(...),
    session=Depends(get_session),
    user=Depends(get_current_user),
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if data.get("chrome_status") is not None:
        client.chrome_status = data.get("chrome_status")
    if data.get("chrome_color") is not None:
        client.chrome_color = data.get("chrome_color")
    # FIX: gem chrome_step fra klient så /chrome-status GET kan returnere det
    if data.get("chrome_step") is not None:
        client.chrome_step = data.get("chrome_step")
    client.chrome_last_updated = utcnow()
    session.add(client)
    session.commit()
    session.refresh(client)
    return {"ok": True}


@router.put("/clients/{id}/state")
def update_client_state(id: int, data: dict = Body(...), session=Depends(get_session), user=Depends(get_current_user)):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    state = data.get("state")
    if not state:
        raise HTTPException(status_code=400, detail="Missing state")
    state = normalize_client_state(state)
    if state not in VALID_CLIENT_STATES:
        raise HTTPException(status_code=400, detail=f"Ugyldig state '{state}'. Tilladte: {sorted(VALID_CLIENT_STATES)}")
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
    user=Depends(get_current_user),
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    action = data.get("action")
    source = data.get("source")

    current_pca = getattr(client.pending_chrome_action, "value", None) or str(
        client.pending_chrome_action or "none"
    )

    if (
        action in BLOCKING_ACTIONS
        and current_pca in BLOCKING_ACTIONS
        and current_pca != action
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                f"Handling '{current_pca}' er allerede igang — "
                f"vent til klienten har fuldført den, før du sender '{action}'"
            ),
        )

    if action in BLOCKING_ACTIONS and current_pca == action:
        raise HTTPException(
            status_code=409,
            detail=f"Handling '{action}' er allerede igang på klienten",
        )

    if (
        action == "livestream_start"
        and current_pca == "livestream_start"
    ):
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
        if src_lower not in VALID_PENDING_CHROME_ACTION_SOURCES:
            raise HTTPException(
                status_code=400,
                detail=f"Ugyldig source '{source}'. Tilladte: {sorted(VALID_PENDING_CHROME_ACTION_SOURCES)}",
            )
        client.pending_chrome_action_source = src_lower

    session.add(client)
    session.commit()
    session.refresh(client)
    return {
        "ok": True,
        "pending_chrome_action": client.pending_chrome_action.value,
        "pending_chrome_action_source": getattr(client, "pending_chrome_action_source", None),
    }


@router.get("/clients/{id}/chrome-command")
def get_chrome_command(id: int, session=Depends(get_session), user=Depends(get_current_user)):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return {
        "action": client.pending_chrome_action.value if client.pending_chrome_action else None,
        "source": getattr(client, "pending_chrome_action_source", None),
    }


@router.post("/clients/{id}/os-update")
async def trigger_os_update(
    id: int,
    session=Depends(get_session),
    user=Depends(get_current_admin_user),
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if not is_online(client):
        raise HTTPException(status_code=400, detail="Klienten er offline — kan ikke starte opdatering")
    if client.state == "updating":
        raise HTTPException(status_code=400, detail="Klienten er allerede ved at opdatere")
    client.pending_chrome_action = ChromeAction.OS_UPDATE
    client.pending_os_update = True
    client.state = "updating"
    session.add(client)
    session.commit()
    session.refresh(client)
    return {
        "ok": True,
        "message": f"OS-opdatering bestilt for klient {id}",
        "pending_chrome_action": client.pending_chrome_action.value,
        "pending_os_update": client.pending_os_update,
        "state": client.state,
    }


@router.get("/clients/{id}/ubuntu-updates")
def get_ubuntu_updates(id: int, session=Depends(get_session), user=Depends(get_current_user)):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return {
        "client_id": client.id,
        "ubuntu_updates_available": client.ubuntu_updates_available or 0,
        "pending_os_update": client.pending_os_update or False,
        "ubuntu_version": client.ubuntu_version,
    }


@router.post("/clients/", response_model=Client)
async def create_client(client_in: ClientCreate, session=Depends(get_session), user=Depends(get_current_user)):
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
        chrome_step=getattr(client_in, "chrome_step", None),
        pending_reboot=False,
        pending_shutdown=False,
        pending_chrome_action=getattr(client_in, "pending_chrome_action", ChromeAction.NONE),
        pending_chrome_action_source=getattr(client_in, "pending_chrome_action_source", None),
        school_id=getattr(client_in, "school_id", None),
        state=getattr(client_in, "state", "normal"),
        livestream_status="idle",
        livestream_last_segment=None,
        livestream_last_error=None,
        ubuntu_updates_available=getattr(client_in, "ubuntu_updates_available", 0),
        pending_os_update=getattr(client_in, "pending_os_update", False),
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
    user=Depends(get_current_user),
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    fields = client_update.model_fields_set
    if "locality" in fields: client.locality = client_update.locality
    if "sort_order" in fields: client.sort_order = client_update.sort_order
    if "kiosk_url" in fields: client.kiosk_url = client_update.kiosk_url
    if "ubuntu_version" in fields: client.ubuntu_version = client_update.ubuntu_version
    if "uptime" in fields: client.uptime = client_update.uptime
    if "wifi_ip_address" in fields: client.wifi_ip_address = client_update.wifi_ip_address
    if "wifi_mac_address" in fields: client.wifi_mac_address = client_update.wifi_mac_address
    if "lan_ip_address" in fields: client.lan_ip_address = client_update.lan_ip_address
    if "lan_mac_address" in fields: client.lan_mac_address = client_update.lan_mac_address
    if "chrome_status" in fields: client.chrome_status = client_update.chrome_status
    if "chrome_color" in fields: client.chrome_color = client_update.chrome_color
    # FIX: gem chrome_step i DB så /chrome-status GET kan returnere det korrekt
    if "chrome_step" in fields: client.chrome_step = client_update.chrome_step
    if "chrome_last_updated" in fields:
        client.chrome_last_updated = client_update.chrome_last_updated
    elif "chrome_status" in fields or "chrome_step" in fields:
        client.chrome_last_updated = utcnow()
    if "last_seen" in fields: client.last_seen = client_update.last_seen
    if "created_at" in fields: client.created_at = client_update.created_at
    if "pending_reboot" in fields: client.pending_reboot = client_update.pending_reboot
    if "pending_shutdown" in fields: client.pending_shutdown = client_update.pending_shutdown
    if "pending_chrome_action" in fields:
        val = client_update.pending_chrome_action
        client.pending_chrome_action = ChromeAction.NONE if val is None else ChromeAction(val)
    if "pending_chrome_action_source" in fields:
        src = client_update.pending_chrome_action_source
        if src is None:
            client.pending_chrome_action_source = None
        else:
            src_lower = str(src).lower()
            if src_lower not in VALID_PENDING_CHROME_ACTION_SOURCES:
                raise HTTPException(status_code=400, detail=f"Ugyldig source '{src}'")
            client.pending_chrome_action_source = src_lower
    if "school_id" in fields: client.school_id = client_update.school_id
    if "state" in fields:
        state = client_update.state
        if state is None:
            client.state = None
        else:
            state_lower = normalize_client_state(state)
            if state_lower not in VALID_CLIENT_STATES:
                raise HTTPException(status_code=400, detail=f"Ugyldig state '{state}'")
            client.state = state_lower
    if "livestream_status" in fields: client.livestream_status = client_update.livestream_status
    if "livestream_last_segment" in fields: client.livestream_last_segment = client_update.livestream_last_segment
    if "livestream_last_error" in fields: client.livestream_last_error = client_update.livestream_last_error
    if "ubuntu_updates_available" in fields: client.ubuntu_updates_available = client_update.ubuntu_updates_available
    if "pending_os_update" in fields: client.pending_os_update = client_update.pending_os_update
    session.add(client)
    session.commit()
    session.refresh(client)
    return client


@router.put("/clients/{id}/kiosk_url", response_model=Client)
async def update_kiosk_url(
    id: int,
    data: dict = Body(...),
    session=Depends(get_session),
    user=Depends(get_current_user),
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


def get_school_year_dates(season_start: int):
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
    user=Depends(get_current_admin_user),
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

    today = date.today()
    season_start = today.year if today.month >= 8 else today.year - 1
    season_str = f"{season_start}/{season_start + 1}"

    school = session.get(School, client.school_id) if client.school_id else None
    season_times = None
    if school:
        season_times = session.exec(
            select(SchoolSeasonTimes).where(
                SchoolSeasonTimes.school_id == school.id,
                SchoolSeasonTimes.season == season_str,
            )
        ).first()

    if season_times:
        def_wd_on  = season_times.weekday_on
        def_wd_off = season_times.weekday_off
        def_we_on  = season_times.weekend_on
        def_we_off = season_times.weekend_off
    elif school:
        def_wd_on  = getattr(school, "weekday_on",  "09:00") or "09:00"
        def_wd_off = getattr(school, "weekday_off", "22:30") or "22:30"
        def_we_on  = getattr(school, "weekend_on",  "08:00") or "08:00"
        def_we_off = getattr(school, "weekend_off", "18:00") or "18:00"
    else:
        def_wd_on, def_wd_off = "09:00", "22:30"
        def_we_on, def_we_off = "08:00", "18:00"

    school_year_dates = get_school_year_dates(season_start)
    markings = {}
    for d in school_year_dates:
        if d.weekday() < 5:
            markings[d.isoformat()] = {"status": "on", "onTime": def_wd_on, "offTime": def_wd_off}
        else:
            markings[d.isoformat()] = {"status": "on", "onTime": def_we_on, "offTime": def_we_off}

    existing = session.exec(
        select(CalendarMarking).where(
            CalendarMarking.season == season_str,
            CalendarMarking.client_id == client.id,
        )
    ).first()
    if not existing:
        session.add(CalendarMarking(season=season_str, client_id=client.id, markings=markings))
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

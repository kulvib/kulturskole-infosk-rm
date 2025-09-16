from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import select, delete
from typing import List
from datetime import datetime, timedelta
from db import get_session
from models import Client, ClientCreate, ClientUpdate, CalendarMarking, ChromeAction
from auth import get_current_admin_user

router = APIRouter()

# Public endpoint: Liste af godkendte klienter
@router.get("/clients/public")
def get_clients_public(session=Depends(get_session)):
    clients = session.exec(select(Client).where(Client.status == "approved")).all()
    return {
        "clients": [{"id": c.id, "name": c.name} for c in clients]
    }

# Admin: Liste af alle klienter
@router.get("/clients/", response_model=List[Client])
def get_clients(session=Depends(get_session), user=Depends(get_current_admin_user)):
    clients = session.exec(select(Client)).all()
    now = datetime.utcnow()
    for client in clients:
        client.isOnline = (
            client.last_seen is not None and (now - client.last_seen) < timedelta(minutes=2)
        )
    clients.sort(key=lambda c: (c.sort_order is None, c.sort_order if c.sort_order is not None else 9999, c.id))
    return clients

# Admin: Hent én klient
@router.get("/clients/{id}/", response_model=Client)
def get_client(id: int, session=Depends(get_session), user=Depends(get_current_admin_user)):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    now = datetime.utcnow()
    client.isOnline = (
        client.last_seen is not None and (now - client.last_seen) < timedelta(minutes=2)
    )
    return client

# Chrome-status (til frontend visning)
@router.get("/clients/{id}/chrome-status")
def get_chrome_status(
    id: int,
    session=Depends(get_session),
    user=Depends(get_current_admin_user)
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return {
        "client_id": client.id,
        "chrome_status": getattr(client, "chrome_status", "unknown"),
        "chrome_last_updated": getattr(client, "chrome_last_updated", None),
        "chrome_color": getattr(client, "chrome_color", None)
    }

# Opdater chrome-status
@router.put("/clients/{id}/chrome-status")
def update_chrome_status(
    id: int,
    data: dict = Body(...),
    session=Depends(get_session)
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    status = data.get("chrome_status")
    color = data.get("chrome_color")
    client.chrome_status = status
    client.chrome_last_updated = datetime.utcnow()
    if color is not None:
        client.chrome_color = color
    session.add(client)
    session.commit()
    session.refresh(client)
    return {"ok": True}

# Klienten sender sin aktuelle state (uafhængigt af kommandoer)
@router.put("/clients/{id}/state")
def update_client_state(
    id: int,
    data: dict = Body(...),
    session=Depends(get_session)
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    state = data.get("state")
    if not state:
        raise HTTPException(status_code=400, detail="Missing state")
    client.state = state
    session.add(client)
    session.commit()
    session.refresh(client)
    return {"ok": True, "state": client.state}

# Hent klientens aktuelle state
@router.get("/clients/{id}/state")
def get_client_state(
    id: int,
    session=Depends(get_session)
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"state": client.state}

# Backend/frontend sender kommando (fx fra knap)
@router.post("/clients/{id}/chrome-command")
def set_chrome_command(
    id: int,
    data: dict = Body(...),
    session=Depends(get_session),
    user=Depends(get_current_admin_user)
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    action = data.get("action")
    if action == "livestream_start" and client.pending_chrome_action == "livestream_start":
        raise HTTPException(status_code=400, detail="Livestream already requested")
    try:
        chrome_action = ChromeAction(action)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid action '{action}'")
    client.pending_chrome_action = chrome_action
    session.add(client)
    session.commit()
    session.refresh(client)
    return {"ok": True, "pending_chrome_action": client.pending_chrome_action.value}

# Klienten henter aktuel kommando
@router.get("/clients/{id}/chrome-command")
def get_chrome_command(
    id: int,
    session=Depends(get_session)
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"action": client.pending_chrome_action.value if client.pending_chrome_action else None}

# Opret ny klient
@router.post("/clients/", response_model=Client)
async def create_client(
    client_in: ClientCreate,
    session=Depends(get_session),
    user=Depends(get_current_admin_user)
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

# Opdater klient
@router.put("/clients/{id}/update", response_model=Client)
async def update_client(
    id: int,
    client_update: ClientUpdate,
    session=Depends(get_session),
    user=Depends(get_current_admin_user)
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
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
        client.chrome_last_updated = datetime.utcnow()
    if getattr(client_update, "chrome_color", None) is not None:
        client.chrome_color = client_update.chrome_color
    if "pending_chrome_action" in client_update.__fields_set__:
        val = getattr(client_update, "pending_chrome_action")
        if val is None:
            client.pending_chrome_action = ChromeAction.NONE
        else:
            try:
                client.pending_chrome_action = ChromeAction(val)
            except (ValueError, TypeError):
                pass
    if getattr(client_update, "school_id", None) is not None:
        client.school_id = client_update.school_id
    if getattr(client_update, "state", None) is not None:
        client.state = client_update.state
    if getattr(client_update, "livestream_status", None) is not None:
        client.livestream_status = client_update.livestream_status
    if getattr(client_update, "livestream_last_segment", None) is not None:
        client.livestream_last_segment = client_update.livestream_last_segment
    if getattr(client_update, "livestream_last_error", None) is not None:
        client.livestream_last_error = client_update.livestream_last_error
    session.add(client)
    session.commit()
    session.refresh(client)
    return client

# Opdater kiosk_url
@router.put("/clients/{id}/kiosk_url", response_model=Client)
async def update_kiosk_url(
    id: int,
    data: dict = Body(...),
    session=Depends(get_session),
    user=Depends(get_current_admin_user)
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

# Godkend klient
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
    return client

# Heartbeat fra klient
@router.post("/clients/{id}/heartbeat", response_model=Client)
def client_heartbeat(
    id: int,
    session=Depends(get_session)
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.last_seen = datetime.utcnow()
    session.add(client)
    session.commit()
    session.refresh(client)
    return client

# Slet klient + kalendermarkeringer
@router.delete("/clients/{id}/remove")
async def remove_client(id: int, session=Depends(get_session), user=Depends(get_current_admin_user)):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    session.exec(
        delete(CalendarMarking).where(CalendarMarking.client_id == client.id)
    )
    session.commit()
    session.delete(client)
    session.commit()
    return {"ok": True}

# Streaming, terminal og remote desktop endpoints (til integration)
@router.get("/clients/{id}/stream")
def client_stream(id: int, session=Depends(get_session), user=Depends(get_current_admin_user)):
    return {"stream_url": f"/mjpeg/{id}"}

@router.get("/clients/{id}/terminal")
def client_terminal(id: int, session=Depends(get_session), user=Depends(get_current_admin_user)):
    return {"terminal_url": f"/terminal/{id}"}

@router.get("/clients/{id}/remote-desktop")
def client_remote_desktop(id: int, session=Depends(get_session), user=Depends(get_current_admin_user)):
    return {"remote_desktop_url": f"/remote-desktop/{id}"}

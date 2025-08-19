from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import select, delete
from typing import List
from datetime import datetime, timedelta
from db import get_session
from models import Client, ClientCreate, ClientUpdate, CalendarMarking
from auth import get_current_admin_user

router = APIRouter()

@router.get("/clients/public")
def get_clients_public(session=Depends(get_session)):
    clients = session.exec(select(Client).where(Client.status == "approved")).all()
    return {
        "clients": [{"id": c.id, "name": c.name} for c in clients]
    }

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
        "chrome_last_updated": getattr(client, "chrome_last_updated", None)
    }

@router.put("/clients/{id}/chrome-status")
def update_chrome_status(
    id: int,
    data: dict = Body(...),  # fx {"chrome_status": "running"}
    session=Depends(get_session)
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    status = data.get("chrome_status")
    if status not in ["running", "stopped", "unknown"]:
        raise HTTPException(status_code=400, detail="Invalid chrome_status")
    client.chrome_status = status
    client.chrome_last_updated = datetime.utcnow()
    session.add(client)
    session.commit()
    session.refresh(client)
    return {"ok": True}

@router.post("/clients/{id}/chrome-control")
def chrome_control(
    id: int,
    data: dict = Body(...),  # fx {"action": "start"} eller {"action": "stop"}
    session=Depends(get_session),
    user=Depends(get_current_admin_user)
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    action = data.get("action")
    if action not in ["start", "stop"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    # push_client_command(client.id, f"chrome:{action}")
    return {"ok": True, "action": action}

@router.post("/clients/{id}/restart")
def restart_client(
    id: int,
    session=Depends(get_session),
    user=Depends(get_current_admin_user)
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    # push_client_command(client.id, "restart")
    return {"ok": True, "action": "restart"}

@router.post("/clients/{id}/shutdown")
def shutdown_client(
    id: int,
    session=Depends(get_session),
    user=Depends(get_current_admin_user)
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    # push_client_command(client.id, "shutdown")
    return {"ok": True, "action": "shutdown"}

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
        chrome_status="unknown",
        chrome_last_updated=None,
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

    session.add(client)
    session.commit()
    session.refresh(client)
    return client

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

@router.post("/clients/{id}/action")
def client_action(
    id: int,
    data: dict = Body(...),
    session=Depends(get_session),
    user=Depends(get_current_admin_user)
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    action = data.get("action")
    if not action:
        raise HTTPException(status_code=400, detail="Missing action")
    # push_client_command(client.id, action)
    return {"ok": True, "action": action}

@router.post("/clients/{id}/approve", response_model=Client)
async def approve_client(id: int, session=Depends(get_session), user=Depends(get_current_admin_user)):
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
    session.add(client)
    session.commit()
    session.refresh(client)
    return client

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

@router.get("/clients/{id}/stream")
def client_stream(id: int, session=Depends(get_session), user=Depends(get_current_admin_user)):
    return {"stream_url": f"/mjpeg/{id}"}

@router.get("/clients/{id}/terminal")
def client_terminal(id: int, session=Depends(get_session), user=Depends(get_current_admin_user)):
    return {"terminal_url": f"/terminal/{id}"}

@router.get("/clients/{id}/remote-desktop")
def client_remote_desktop(id: int, session=Depends(get_session), user=Depends(get_current_admin_user)):
    return {"remote_desktop_url": f"/remote-desktop/{id}"}

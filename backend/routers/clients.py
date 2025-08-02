from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import select
from typing import List
from datetime import datetime, timedelta
from ..db import get_session
from ..models import Client, ClientCreate, ClientUpdate
from ..auth import get_current_admin_user
from ..services.mqtt_service import push_client_command
from ..ws_manager import notify_clients_updated  # <--- importér fra ws_manager

router = APIRouter()

@router.get("/clients/", response_model=List[Client])
def get_clients(session=Depends(get_session), user=Depends(get_current_admin_user)):
    clients = session.exec(select(Client)).all()
    now = datetime.utcnow()
    for client in clients:
        client.isOnline = (
            client.last_seen is not None and (now - client.last_seen) < timedelta(minutes=2)
        )
    clients.sort(key=lambda c: (c.sort_order is None, c.sort_order if c.sort_order is not None else 9999, c.name))
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

@router.post("/clients/", response_model=Client)
async def create_client(
    client_in: ClientCreate,
    session=Depends(get_session),
    user=Depends(get_current_admin_user)
):
    client = Client(
        name=client_in.name,
        unique_id=client_in.unique_id,
        locality=client_in.locality,
        ip_address=client_in.ip_address,
        mac_address=client_in.mac_address,
        status="pending",
        isOnline=False,
        last_seen=None,
        sort_order=client_in.sort_order,
    )
    session.add(client)
    session.commit()
    session.refresh(client)
    await notify_clients_updated()  # <-- notify!
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
    session.add(client)
    session.commit()
    session.refresh(client)
    await notify_clients_updated()  # <-- notify!
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
    push_client_command(client.unique_id, "set-kiosk-url", {"url": kiosk_url})
    session.add(client)
    session.commit()
    session.refresh(client)
    await notify_clients_updated()  # <-- notify!
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
    push_client_command(client.unique_id, action)
    return {"ok": True, "action": action}

@router.post("/clients/{id}/approve", response_model=Client)
async def approve_client(id: int, session=Depends(get_session), user=Depends(get_current_admin_user)):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.status = "approved"
    # Sæt sort_order til max sort_order blandt godkendte klienter + 1
    max_sort_order = session.exec(
        select(Client.sort_order)
        .where(Client.status == "approved", Client.sort_order != None)
        .order_by(Client.sort_order.desc())
    ).first()
    client.sort_order = (max_sort_order or 0) + 1
    session.add(client)
    session.commit()
    session.refresh(client)
    await notify_clients_updated()  # <-- notify!
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
    session.delete(client)
    session.commit()
    await notify_clients_updated()  # <-- notify!
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

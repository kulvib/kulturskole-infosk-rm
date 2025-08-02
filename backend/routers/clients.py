from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from typing import List
from datetime import datetime, timedelta
from ..db import get_session
from ..models import Client, ClientCreate, ClientUpdate
from ..auth import get_current_admin_user

router = APIRouter()

@router.get("/clients/", response_model=List[Client])
def get_clients(session=Depends(get_session), user=Depends(get_current_admin_user)):
    clients = session.exec(select(Client)).all()
    now = datetime.utcnow()
    for client in clients:
        # Online hvis heartbeat (last_seen) er under 2 minutter gammel
        client.isOnline = (
            client.last_seen is not None and (now - client.last_seen) < timedelta(minutes=2)
        )
    # Sorter efter sort_order (laveste først), derefter navn
    clients.sort(key=lambda c: (c.sort_order is None, c.sort_order if c.sort_order is not None else 9999, c.name))
    return clients

@router.post("/clients/", response_model=Client)
def create_client(
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
        sort_order=client_in.sort_order,  # NYT FELT
    )
    session.add(client)
    session.commit()
    session.refresh(client)
    return client

@router.put("/clients/{id}/update", response_model=Client)
def update_client(
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
    session.add(client)
    session.commit()
    session.refresh(client)
    return client

@router.post("/clients/{id}/approve", response_model=Client)
def approve_client(id: int, session=Depends(get_session), user=Depends(get_current_admin_user)):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.status = "approved"
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
def remove_client(id: int, session=Depends(get_session), user=Depends(get_current_admin_user)):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    session.delete(client)
    session.commit()
    return {"ok": True}

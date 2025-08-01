from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from ..db import get_session
from ..models import Client
from typing import List
from ..auth import get_current_admin_user
from pydantic import BaseModel

router = APIRouter()

class ClientCreate(BaseModel):
    name: str
    unique_id: str
    locality: str
    ip_address: str
    mac_address: str

class ClientUpdate(BaseModel):
    locality: str

@router.get("/clients/", response_model=List[Client])
def get_clients(session=Depends(get_session), user=Depends(get_current_admin_user)):
    return session.exec(select(Client)).all()

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
    client.locality = client_update.locality
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

@router.delete("/clients/{id}/remove")
def remove_client(id: int, session=Depends(get_session), user=Depends(get_current_admin_user)):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    session.delete(client)
    session.commit()
    return {"ok": True}

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from db import get_session
from models import Client
from typing import List, Optional
from auth import get_current_admin_user

router = APIRouter()

@router.get("/clients/", response_model=List[Client])
def get_clients(session=Depends(get_session), user=Depends(get_current_admin_user)):
    return session.exec(select(Client)).all()

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

@router.post("/clients/{id}/remove")
def remove_client(id: int, session=Depends(get_session), user=Depends(get_current_admin_user)):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    session.delete(client)
    session.commit()
    return {"ok": True}

@router.post("/clients/{id}/update", response_model=Client)
def update_client(id: int, locality: str, session=Depends(get_session), user=Depends(get_current_admin_user)):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.locality = locality
    session.add(client)
    session.commit()
    session.refresh(client)
    return client

@router.post("/clients/", response_model=Client)
def create_client(
    name: Optional[str] = None,
    unique_id: Optional[str] = None,
    locality: Optional[str] = None,
    ip_address: Optional[str] = None,
    mac_address: Optional[str] = None,
    session=Depends(get_session),
    user=Depends(get_current_admin_user)
):
    client = Client(
        name=name,
        unique_id=unique_id,
        locality=locality,
        ip_address=ip_address,
        mac_address=mac_address,
        status="pending",
        isOnline=False,
    )
    session.add(client)
    session.commit()
    session.refresh(client)
    return client

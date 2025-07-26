from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from models import Client
from database import get_db
from auth import get_current_admin_user
import datetime

router = APIRouter(
    prefix="/api/clients",
    tags=["clients"],
)

@router.get("/")
def list_clients(db: Session = Depends(get_db), user=Depends(get_current_admin_user)):
    return db.query(Client).all()

@router.post("/register")
def register_client(
    unique_id: str = Body(...), 
    sw_version: str = Body(...), 
    ip: str = Body(...), 
    mac: str = Body(...), 
    db: Session = Depends(get_db)
):
    client = db.query(Client).filter(Client.unique_id == unique_id).first()
    if client:
        client.last_seen = datetime.datetime.utcnow()
        client.ip_address = ip
        client.sw_version = sw_version
        client.mac_address = mac
        db.commit()
        return {"msg": "updated"}
    client = Client(
        unique_id=unique_id,
        sw_version=sw_version,
        ip_address=ip,
        mac_address=mac,
        last_seen=datetime.datetime.utcnow(),
        status="pending"
    )
    db.add(client)
    db.commit()
    return {"msg": "registered"}

@router.post("/{client_id}/heartbeat")
def client_heartbeat(
    client_id: int, 
    method: str = Body(...), 
    db: Session = Depends(get_db)
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.last_seen = datetime.datetime.utcnow()
    client.is_online = True
    db.commit()
    return {"msg": "heartbeat received"}

@router.post("/{client_id}/approve")
def approve_client(client_id: int, db: Session = Depends(get_db), user=Depends(get_current_admin_user)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.status = "approved"
    db.commit()
    return {"msg": "client approved"}

@router.post("/{client_id}/remove")
def remove_client(client_id: int, db: Session = Depends(get_db), user=Depends(get_current_admin_user)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.status = "removed"
    db.commit()
    return {"msg": "client removed"}

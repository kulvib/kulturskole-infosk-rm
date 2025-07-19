from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from models import Client  # Din SQLAlchemy-model
from database import get_db  # Din dependency til DB-session

router = APIRouter(
    prefix="/api/clients",
    tags=["clients"],
)

@router.patch("/{client_id}/approve")
def approve_client(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if client.status != "pending":
        raise HTTPException(status_code=400, detail="Client is not pending")
    client.status = "approved"
    db.commit()
    db.refresh(client)
    return {"success": True, "id": client.id, "status": client.status}

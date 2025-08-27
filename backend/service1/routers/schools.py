from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select
from db import get_session
from models import Client

router = APIRouter()

@router.get("/clients")
def get_clients_by_school(school: str = Query(None), session: Session = Depends(get_session)):
    query = select(Client)
    if school:
        query = query.where(Client.school == school)
    clients = session.exec(query).all()
    return clients

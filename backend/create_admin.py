from fastapi import APIRouter, HTTPException
from sqlmodel import Session
from backend.models import User  # Ret til korrekt import
from backend.auth import get_password_hash  # Ret til korrekt import
from backend.database import engine  # Ret til korrekt import

router = APIRouter()

@router.post("/create-admin")
def create_admin():
    with Session(engine) as session:
        user = session.query(User).filter(User.username == "admin").first()
        if user:
            raise HTTPException(status_code=400, detail="Admin already exists")
        admin = User(
            username="admin",
            hashed_password=get_password_hash("admin123"),
            role="admin",
            is_active=True
        )
        session.add(admin)
        session.commit()
        return {"msg": "Admin created"}

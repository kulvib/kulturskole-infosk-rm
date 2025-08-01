from fastapi import APIRouter, HTTPException
from sqlmodel import Session
from backend.models import User    # Ret denne import til hvor din User-model ligger
from backend.auth import get_password_hash  # Ret denne import til hvor din hash-funktion ligger
from backend.database import engine         # Ret denne import til hvor din engine ligger

router = APIRouter()

@router.post("/create-admin")
def create_admin():
    with Session(engine) as session:
        user = session.exec(
            User.select().where(User.username == "admin")
        ).first()
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

from fastapi import APIRouter, HTTPException, Depends
from passlib.context import CryptContext
from sqlmodel import Session, select
from .models import User
from .db import engine

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def authenticate_user(username: str, password: str):
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        if not user or not verify_password(password, user.hashed_password):
            return False
        return user

@router.post("/login")
def login(username: str, password: str):
    user = authenticate_user(username, password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    # Her kan du returnere et JWT-token eller lignende
    return {"message": "Login successful", "username": user.username, "role": user.role}

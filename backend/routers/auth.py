from fastapi import APIRouter, Depends, HTTPException, status, Form
from sqlalchemy.orm import Session
from models import AdminUser
from database import get_db
from auth import authenticate_user, create_access_token

router = APIRouter(
    prefix="/api",
    tags=["auth"],
)

@router.post("/login")
def login(
    username: str = Form(...), 
    password: str = Form(...), 
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, username, password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

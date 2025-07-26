from fastapi import APIRouter, Depends, HTTPException, status, Form
from sqlalchemy.orm import Session
from backend.models import AdminUser
from backend.database import get_db
from backend.auth import authenticate_user, create_access_token, get_password_hash

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

# MIDLOERTIDIGT ENDPOINT TIL ADMIN OPRETTELSE (slet når admin er oprettet)
@router.post("/create-admin")
def create_admin(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    if db.query(AdminUser).filter(AdminUser.username == username).first():
        raise HTTPException(status_code=400, detail="Bruger eksisterer allerede")
    user = AdminUser(username=username, hashed_password=get_password_hash(password))
    db.add(user)
    db.commit()
    return {"msg": "Admin user created"}

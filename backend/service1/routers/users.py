from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional
from models import User
from db import get_session
from auth import get_current_admin_user, get_password_hash

router = APIRouter()

# Hent alle brugere (kun admin)
@router.get("/users/", response_model=List[User])
def list_users(session: Session = Depends(get_session), admin=Depends(get_current_admin_user)):
    return session.exec(select(User)).all()

# Opret ny bruger (kun admin)
@router.post("/users/", response_model=User, status_code=201)
def create_user(
    username: str,
    password: str,
    role: str = "elev",
    is_active: bool = True,
    session: Session = Depends(get_session),
    admin=Depends(get_current_admin_user)
):
    if session.exec(select(User).where(User.username == username)).first():
        raise HTTPException(status_code=400, detail="Brugernavn findes allerede")
    user = User(
        username=username,
        hashed_password=get_password_hash(password),
        role=role,
        is_active=is_active
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

# Opdater bruger (fx rolle eller aktivering/deaktivering)
@router.patch("/users/{user_id}", response_model=User)
def update_user(
    user_id: int,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    password: Optional[str] = None,
    session: Session = Depends(get_session),
    admin=Depends(get_current_admin_user)
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Bruger ikke fundet")
    if role:
        user.role = role
    if is_active is not None:
        user.is_active = is_active
    if password:
        user.hashed_password = get_password_hash(password)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

# Slet bruger (kun admin)
@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    session: Session = Depends(get_session),
    admin=Depends(get_current_admin_user)
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Bruger ikke fundet")
    session.delete(user)
    session.commit()

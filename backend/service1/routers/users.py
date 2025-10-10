from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel
from models import User
from db import get_session
from auth import get_current_admin_user, get_password_hash

router = APIRouter()

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "elev"
    is_active: bool = True
    school_id: Optional[int] = None
    full_name: Optional[str] = None
    remarks: Optional[str] = None
    email: str  # <-- NYT felt, obligatorisk!

class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    school_id: Optional[int] = None
    full_name: Optional[str] = None
    remarks: Optional[str] = None
    email: Optional[str] = None  # <-- NYT felt!

# GET /api/users/ -- Hent alle brugere (kun admin)
@router.get("/users/", response_model=List[User])
def list_users(session: Session = Depends(get_session), admin=Depends(get_current_admin_user)):
    """
    Returnerer en liste over alle brugere i databasen.
    Endpointet er beskyttet, så kun brugere med admin-rolle kan få adgang.
    """
    return session.exec(select(User)).all()

# POST /api/users/ -- Opret ny bruger (kun admin)
@router.post("/users/", response_model=User, status_code=201)
def create_user(
    user: UserCreate,
    session: Session = Depends(get_session),
    admin=Depends(get_current_admin_user)
):
    """
    Opretter en ny bruger med angivet brugernavn, kodeord og rolle.
    Endpointet er beskyttet, så kun admin kan oprette brugere.
    """
    if session.exec(select(User).where(User.username == user.username)).first():
        raise HTTPException(status_code=400, detail="Brugernavn findes allerede")
    user_obj = User(
        username=user.username,
        hashed_password=get_password_hash(user.password),
        role=user.role,
        is_active=user.is_active,
        school_id=user.school_id,
        full_name=user.full_name,
        remarks=user.remarks,
        email=user.email                # <-- NYT felt!
    )
    session.add(user_obj)
    session.commit()
    session.refresh(user_obj)
    return user_obj

# PATCH /api/users/{user_id} -- Opdater brugerinfo (kun admin)
@router.patch("/users/{user_id}", response_model=User)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    session: Session = Depends(get_session),
    admin=Depends(get_current_admin_user)
):
    """
    Opdaterer en brugers rolle, status, kodeord eller navn.
    Endpointet er beskyttet, så kun admin kan ændre brugere.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Bruger ikke fundet")
    if user_update.role is not None:
        user.role = user_update.role
    if user_update.is_active is not None:
        user.is_active = user_update.is_active
    if user_update.password:
        user.hashed_password = get_password_hash(user_update.password)
    if user_update.school_id is not None:
        user.school_id = user_update.school_id
    if user_update.full_name is not None:
        user.full_name = user_update.full_name
    if user_update.remarks is not None:
        user.remarks = user_update.remarks
    if user_update.email is not None:
        user.email = user_update.email          # <-- NYT felt!
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

# DELETE /api/users/{user_id} -- Slet bruger (kun admin)
@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    session: Session = Depends(get_session),
    admin=Depends(get_current_admin_user)
):
    """
    Sletter en bruger fra databasen.
    Endpointet er beskyttet, så kun admin kan slette brugere.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Bruger ikke fundet")
    session.delete(user)
    session.commit()

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from typing import List, Optional
from pydantic import BaseModel, field_validator
from models import User
from db import get_session
from auth import get_current_admin_user, get_current_user, get_password_hash, validate_password_strength

router = APIRouter()


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "elev"
    is_active: bool = True
    school_id: Optional[int] = None
    full_name: Optional[str] = None
    remarks: Optional[str] = None
    email: str

    @field_validator("username")
    @classmethod
    def username_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("Brugernavn må ikke være tomt")
        if len(v.strip()) < 3:
            raise ValueError("Brugernavn skal være mindst 3 tegn")
        return v.strip()

    @field_validator("email")
    @classmethod
    def email_basic_check(cls, v):
        if not v or "@" not in v:
            raise ValueError("Ugyldig e-mailadresse")
        return v.strip().lower()

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v):
        allowed = {"admin", "elev", "bruger"}
        if v not in allowed:
            raise ValueError(f"Rolle skal være én af: {', '.join(sorted(allowed))}")
        return v


class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    must_change_password: Optional[bool] = None
    school_id: Optional[int] = None
    full_name: Optional[str] = None
    remarks: Optional[str] = None
    email: Optional[str] = None

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v):
        if v is None:
            return v
        allowed = {"admin", "elev", "bruger"}
        if v not in allowed:
            raise ValueError(f"Rolle skal være én af: {', '.join(sorted(allowed))}")
        return v

    @field_validator("email")
    @classmethod
    def email_basic_check(cls, v):
        if v is None:
            return v
        if "@" not in v:
            raise ValueError("Ugyldig e-mailadresse")
        return v.strip().lower()


@router.get("/users/", response_model=List[User])
def list_users(
    session: Session = Depends(get_session),
    admin=Depends(get_current_admin_user)
):
    return session.exec(select(User)).all()


@router.post("/users/", response_model=User, status_code=201)
def create_user(
    user: UserCreate,
    session: Session = Depends(get_session),
    admin=Depends(get_current_admin_user)
):
    validate_password_strength(user.password)
    if session.exec(select(User).where(User.username == user.username)).first():
        raise HTTPException(status_code=400, detail="Brugernavnet er allerede i brug")
    user_obj = User(
        username=user.username,
        hashed_password=get_password_hash(user.password),
        role=user.role,
        is_active=user.is_active,
        school_id=user.school_id,
        full_name=user.full_name,
        remarks=user.remarks,
        email=user.email,
    )
    session.add(user_obj)
    session.commit()
    session.refresh(user_obj)
    return user_obj


@router.patch("/users/{user_id}", response_model=User)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Bruger ikke fundet")
    is_admin = getattr(current_user, "role", None) in {"admin", "superadmin"}
    is_self = current_user.id == user_id
    if not is_self and not is_admin:
        raise HTTPException(status_code=403, detail="Du har ikke adgang til at opdatere denne bruger")
    if is_self and not is_admin:
        non_self_fields = (
            user_update.role is not None
            or user_update.is_active is not None
            or user_update.school_id is not None
            or user_update.full_name is not None
            or user_update.remarks is not None
            or user_update.email is not None
        )
        if non_self_fields:
            raise HTTPException(status_code=403, detail="Du må kun ændre dit eget kodeord")
    if user_update.password is not None:
        validate_password_strength(user_update.password)
        user.hashed_password = get_password_hash(user_update.password)
        if is_self:
            user.must_change_password = False
    if user_update.must_change_password is not None:
        if is_self and not is_admin and user_update.must_change_password:
            raise HTTPException(status_code=403, detail="Du må ikke sætte must_change_password til true")
        user.must_change_password = user_update.must_change_password
    if is_self and not is_admin:
        session.add(user)
        session.commit()
        session.refresh(user)
        return user
    # Beskyt mod at fjerne den eneste aktive administrator
    if user_update.role is not None and user_update.role != "admin" and user.role == "admin":
        active_admins = session.exec(
            select(User).where(User.role == "admin", User.is_active == True)
        ).all()
        if len(active_admins) <= 1:
            raise HTTPException(
                status_code=400,
                detail="Kan ikke ændre rollen på den eneste aktive administrator"
            )
    if user_update.role is not None:
        user.role = user_update.role
    if user_update.is_active is not None:
        # Beskyt mod at deaktivere den eneste aktive admin
        if not user_update.is_active and user.role == "admin":
            active_admins = session.exec(
                select(User).where(User.role == "admin", User.is_active == True)
            ).all()
            if len(active_admins) <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Kan ikke deaktivere den eneste aktive administrator"
                )
        user.is_active = user_update.is_active
    if user_update.school_id is not None:
        user.school_id = user_update.school_id
    if user_update.full_name is not None:
        user.full_name = user_update.full_name
    if user_update.remarks is not None:
        user.remarks = user_update.remarks
    if user_update.email is not None:
        user.email = user_update.email
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


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

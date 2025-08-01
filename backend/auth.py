from fastapi import APIRouter, HTTPException, Depends, status
from sqlmodel import Session, select
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import Optional
from .db import get_session
from .models import User

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")

class Token(BaseModel):
    access_token: str
    token_type: str

class UserOut(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def authenticate_user(username: str, password: str, session: Session):
    user = session.exec(select(User).where(User.username == username)).first()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user

@router.post("/token", response_model=Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session)
):
    user = authenticate_user(form_data.username, form_data.password, session)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Her skal du generere et JWT-token og returnere
    token = "FAKETOKEN"
    return {"access_token": token, "token_type": "bearer"}

def get_current_admin_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session)
):
    # Dummy lookup, indsæt evt. JWT-dekoder her
    user = session.exec(select(User).where(User.username == "admin")).first()
    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return user

import os
import re
import time
import threading
from collections import defaultdict
from fastapi import APIRouter, HTTPException, Depends, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from sqlmodel import Session, select
from typing import Optional
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from dotenv import load_dotenv

from db import get_session
from models import User

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY or len(SECRET_KEY) < 32:
    raise RuntimeError(
        "SECRET_KEY mangler eller er for kort (minimum 32 tegn). "
        "Sæt SECRET_KEY i din .env-fil."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Kodeordskrav — samme grænse som main.py
MIN_PASSWORD_LENGTH = 12
PASSWORD_REGEX = re.compile(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$')

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/token")


# ---------------------------------------------------------------------------
# Simpel in-memory rate limiter til login-endpoint
# Maks 10 forsøg per IP per 60 sekunder
# ---------------------------------------------------------------------------
_rate_lock = threading.Lock()
_login_attempts: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_MAX = 10
RATE_LIMIT_WINDOW = 60  # sekunder


def _check_rate_limit(ip: str):
    now = time.time()
    with _rate_lock:
        attempts = _login_attempts[ip]
        # Fjern gamle forsøg uden for vinduet
        _login_attempts[ip] = [t for t in attempts if now - t < RATE_LIMIT_WINDOW]
        if len(_login_attempts[ip]) >= RATE_LIMIT_MAX:
            raise HTTPException(
                status_code=429,
                detail=f"For mange loginforsøg. Prøv igen om {RATE_LIMIT_WINDOW} sekunder."
            )
        _login_attempts[ip].append(now)


def _clear_rate_limit(ip: str):
    """Nulstil tæller ved succesfuldt login."""
    with _rate_lock:
        _login_attempts.pop(ip, None)


# ---------------------------------------------------------------------------

def validate_password_strength(password: str):
    """Kaster HTTPException hvis kodeordet ikke opfylder kravene."""
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Kodeord skal være mindst {MIN_PASSWORD_LENGTH} tegn langt."
        )
    if not PASSWORD_REGEX.match(password):
        raise HTTPException(
            status_code=400,
            detail="Kodeord skal indeholde mindst ét stort bogstav, ét lille bogstav og ét tal."
        )


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def authenticate_user(username: str, password: str, session: Session):
    user = session.exec(select(User).where(User.username == username)).first()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


@router.post("/token")
def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session)
):
    # Rate limiting baseret på klientens IP
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    user = authenticate_user(form_data.username, form_data.password, session)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Forkert brugernavn eller kodeord",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Brugerkontoen er deaktiveret"
        )

    _clear_rate_limit(client_ip)

    access_token = create_access_token(data={
        "sub": user.username,
        "role": getattr(user, "role", "admin")
    })
    user_data = {
        "username": user.username,
        "role": getattr(user, "role", "admin"),
        "full_name": user.full_name,
        "remarks": user.remarks,
        "school_id": user.school_id,
        "email": user.email,
    }
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_data
    }


def get_current_admin_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Kunne ikke validere legitimationsoplysninger",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None or role is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = session.exec(select(User).where(User.username == username)).first()
    if not user or not user.is_active:
        raise credentials_exception
    if getattr(user, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="Kun administratorer har adgang")
    return user


def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Kunne ikke validere legitimationsoplysninger",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = session.exec(select(User).where(User.username == username)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=403, detail="Inaktiv eller ukendt bruger")
    return user

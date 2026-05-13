import os
import re
import time
import threading
from collections import defaultdict
from fastapi import APIRouter, HTTPException, Depends, Request, Response, status
from fastapi.security import OAuth2, OAuth2PasswordRequestForm
from fastapi.openapi.models import OAuthFlows as OAuthFlowsModel
from passlib.context import CryptContext
from sqlmodel import Session, select
from typing import Optional
import jwt
from jwt.exceptions import InvalidTokenError
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
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
IS_PRODUCTION = os.getenv("ENVIRONMENT", "production") == "production"

from datetime import datetime, timedelta, timezone

# ---------------------------------------------------------------------------
# OAuth2-skema: accepterer token fra både Authorization-header og cookie.
# Bevarer bagudkompatibilitet med eksterne klienter (Raspberry Pi) der bruger
# Authorization: Bearer <token>, mens browsere bruger HttpOnly-cookie.
# ---------------------------------------------------------------------------
class OAuth2PasswordBearerOrCookie(OAuth2):
    def __init__(self, tokenUrl: str, auto_error: bool = True):
        flows = OAuthFlowsModel(password={"tokenUrl": tokenUrl, "scopes": {}})
        super().__init__(flows=flows, auto_error=auto_error)
        self.auto_error = auto_error

    async def __call__(self, request: Request) -> Optional[str]:
        # Prøv Authorization-header først (bruges af eksterne klienter)
        authorization = request.headers.get("Authorization")
        if authorization and authorization.lower().startswith("bearer "):
            return authorization[7:]
        # Prøv derefter HttpOnly-cookie (bruges af browser-frontend)
        token = request.cookies.get("access_token")
        if token:
            return token
        if self.auto_error:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return None


# Kodeordskrav — skal holdes synkroniseret med frontend PASSWORD_REGEX
MIN_PASSWORD_LENGTH = 8
PASSWORD_REGEX = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$")

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearerOrCookie(tokenUrl="auth/token")


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
    if not PASSWORD_REGEX.match(password):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Kodeord skal være mindst {MIN_PASSWORD_LENGTH} tegn langt og indeholde "
                "mindst ét stort bogstav, ét lille bogstav og ét tal."
            )
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


def _set_auth_cookie(response: Response, access_token: str):
    """Sætter HttpOnly-cookie med adgangstoken. SameSite=None;Secure i produktion."""
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="none" if IS_PRODUCTION else "lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


@router.post("/token")
def login_for_access_token(
    response: Response,
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
        "role": getattr(user, "role", "bruger"),
    })
    _set_auth_cookie(response, access_token)

    user_data = {
        "id": user.id,
        "username": user.username,
        "role": getattr(user, "role", "bruger"),
        "full_name": user.full_name,
        "remarks": user.remarks,
        "school_id": user.school_id,
        "email": user.email,
        "must_change_password": user.must_change_password,
    }
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_data
    }


@router.post("/logout")
def logout(response: Response):
    """Sletter adgangstoken-cookie ved logout."""
    response.delete_cookie(
        key="access_token",
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="none" if IS_PRODUCTION else "lax",
        path="/",
    )
    return {"ok": True}


@router.get("/me")
def get_me(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session)
):
    """Returnerer den aktuelle brugers oplysninger. Bruges af ProtectedRoute til session-validering."""
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
    except InvalidTokenError:
        raise credentials_exception
    user = session.exec(select(User).where(User.username == username)).first()
    if not user or not user.is_active:
        raise credentials_exception
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "full_name": user.full_name,
        "email": user.email,
        "school_id": user.school_id,
        "must_change_password": user.must_change_password,
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
    except InvalidTokenError:
        raise credentials_exception

    user = session.exec(select(User).where(User.username == username)).first()
    if not user or not user.is_active:
        raise credentials_exception
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Kun administratorer har adgang")
    return user


def get_current_superadmin_user(
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
    except InvalidTokenError:
        raise credentials_exception

    user = session.exec(select(User).where(User.username == username)).first()
    if not user or not user.is_active:
        raise credentials_exception
    if not user.is_superadmin:
        raise HTTPException(status_code=403, detail="Kun superadministratorer har adgang")
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
    except InvalidTokenError:
        raise credentials_exception

    user = session.exec(select(User).where(User.username == username)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=403, detail="Inaktiv eller ukendt bruger")
    return user


def require_admin(user: User):
    """Kaster 403 hvis brugeren ikke er admin eller superadmin."""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Kun administratorer har adgang")
    return user


def require_superadmin(user: User):
    """Kaster 403 hvis brugeren ikke er superadmin."""
    if not user.is_superadmin:
        raise HTTPException(status_code=403, detail="Kun superadministratorer har adgang")
    return user


def verify_ws_token(token: str, session: Session) -> Optional[User]:
    """Validerer en JWT-token til WebSocket-forbindelser. Returnerer User eller None."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            return None
    except InvalidTokenError:
        return None
    user = session.exec(select(User).where(User.username == username)).first()
    if not user or not user.is_active:
        return None
    return user

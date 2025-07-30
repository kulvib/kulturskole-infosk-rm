import os
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
from pydantic import BaseModel

SECRET_KEY = os.environ.get("SECRET_KEY", "supersecretkey")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
# Hash for password "admin123" (skift til din egen!)
ADMIN_PASSWORD_HASH = os.environ.get("ADMIN_PASSWORD_HASH", "$2b$12$F9o4B5y7d8iXJIV5aQ4xHeHo4F6A9s2rYSB1E9P2bM6YVq/8X8k2K")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()

router = APIRouter()

class Token(BaseModel):
    access_token: str
    token_type: str

class LoginRequest(BaseModel):
    username: str
    password: str

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_admin_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username != ADMIN_USERNAME:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    return username

@router.post("/login", response_model=Token)
def login(form: LoginRequest):
    if form.username != ADMIN_USERNAME:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    if not verify_password(form.password, ADMIN_PASSWORD_HASH):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    token = create_access_token({"sub": ADMIN_USERNAME})
    return {"access_token": token, "token_type": "bearer"}

from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from typing import Optional
from datetime import datetime, timedelta

# === Konfiguration ===
SECRET_KEY = "your-super-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 uge

# Demo bruger (skift til database i produktion)
fake_users_db = {
    "admin": {
        "username": "admin",
        "full_name": "Admin User",
        "hashed_password": "$2b$12$wHjXx3y4Pty8xq4r5BzF3u1VjClpQFjHSy3HfS8w4J5ZcIj1Bv8uW",  # password: admin123
        "disabled": False,
    }
}

# Demo klient-liste (typisk hentet fra database)
fake_clients = {
    "client1": {
        "id": "client1",
        "display_name": "Foyer",
        "status": "online",
        "ip": "192.168.1.11",
        "version": "1.0",
        "last_seen": "2025-07-18T09:12:00",
        "uptime": 234561,
        "web_url": "https://dr.dk",
    },
    "client2": {
        "id": "client2",
        "display_name": "Kantine",
        "status": "offline",
        "ip": "192.168.1.12",
        "version": "1.0",
        "last_seen": "2025-07-18T07:02:00",
        "uptime": 0,
        "web_url": "https://tv2.dk",
    },
}

# === Auth setup ===
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/token")


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_user(db, username: str):
    user = db.get(username)
    if user:
        return user
    return None


def authenticate_user(db, username: str, password: str):
    user = get_user(db, username)
    if not user or not verify_password(password, user["hashed_password"]):
        return False
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Kun adgang med gyldigt login.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user(fake_users_db, username)
    if user is None:
        raise credentials_exception
    return user


# === FastAPI app ===
app = FastAPI(
    title="Kulturskole Infoskaerm Backend",
    description="Backend API til styring af infoskærm-klienter.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json"
)

# CORS (tillad din Vercel frontend)
origins = [
    "http://localhost:5173",
    "https://din-vercel-app-url.vercel.app",  # Udskift med din Vercel URL
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === Endpoints ===

@app.get("/api/", tags=["root"])
def root():
    return {"message": "Kulturskole Infoskaerm backend kører!"}


@app.post("/api/token", tags=["auth"])
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(fake_users_db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Forkert brugernavn eller adgangskode",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": user["username"]},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/clients", tags=["clients"])
async def get_clients(current_user: dict = Depends(get_current_user)):
    return list(fake_clients.values())


@app.get("/api/clients/{client_id}", tags=["clients"])
async def get_client(client_id: str, current_user: dict = Depends(get_current_user)):
    client = fake_clients.get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Klient ikke fundet")
    return client


@app.post("/api/clients/{client_id}/set_display_name", tags=["clients"])
async def set_display_name(client_id: str, display_name: str, current_user: dict = Depends(get_current_user)):
    client = fake_clients.get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Klient ikke fundet")
    client["display_name"] = display_name
    return {"status": "ok", "display_name": display_name}


@app.post("/api/clients/{client_id}/set_web_url", tags=["clients"])
async def set_web_url(client_id: str, web_url: str, current_user: dict = Depends(get_current_user)):
    client = fake_clients.get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Klient ikke fundet")
    client["web_url"] = web_url
    return {"status": "ok", "web_url": web_url}


@app.post("/api/clients/{client_id}/command", tags=["clients"])
async def send_command(client_id: str, command: str, current_user: dict = Depends(get_current_user)):
    client = fake_clients.get(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Klient ikke fundet")
    # Her skal du implementere logik for at sende kommandoen til klienten.
    return {"status": "ok", "command": command}


# Eksempel på "is_closed" endpoint
@app.get("/api/is_closed", tags=["info"])
def is_closed(date: Optional[str] = None):
    # Dummy-implementering (tilføj evt. helligdags-tjek senere)
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")
    if date.endswith("-12-25"):
        return {"closed": True, "reason": "Juleferie"}
    return {"closed": False}

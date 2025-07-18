import os
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta

# === KONFIGURATION ===
SECRET_KEY = os.environ.get("SECRET_KEY", "super-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

# Demo-brugere (admin/admin123)
fake_users_db = {
    "admin": {
        "username": "admin",
        "full_name": "Admin User",
        "hashed_password": "$2b$12$wHjXx3y4Pty8xq4r5BzF3u1VjClpQFjHSy3HfS8w4J5ZcIj1Bv8uW",  # password: admin123
        "disabled": False,
    }
}

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/token")

# Klient-data
STATIC_NAMES = [f"Kulturskolen Viborg_info{i}" for i in range(1, 11)]
clients: Dict[str, Dict[str, Any]] = {}
commands: Dict[str, List[Dict[str, Any]]] = {}
heartbeats: Dict[str, datetime] = {}
client_names: Dict[str, str] = {}
client_urls: Dict[str, str] = {}
ws_connections: Dict[str, WebSocket] = {}

custom_holidays: List[str] = []  # ISO datoer fx "2025-12-25"
custom_weeks_off: List[int] = [7, 42]
full_july = True
api_holidays: List[str] = []

# === AUTH ===
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

# === CORS ===
app = FastAPI(
    title="Kulturskole Infoskærm Backend",
    description="Styring af klienter, ferieplan, realtime status, kommandoer mm.",
    version="1.0.0"
)
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://din-vercel-app-url.vercel.app"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === API ENDPOINTS ===

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
    res = []
    for i in range(1, 11):
        cid = f"info{i}"
        res.append({
            "id": cid,
            "static_name": STATIC_NAMES[i-1],
            "custom_name": client_names.get(cid, ""),
            "status": "online" if (cid in heartbeats and (datetime.utcnow() - heartbeats[cid]).total_seconds() < 30) else "offline",
            "last_seen": heartbeats.get(cid).isoformat() if cid in heartbeats else None,
            "web_url": client_urls.get(cid, "https://www.kulturskolenviborg.dk/infoskaerm1")
        })
    return res

@app.get("/api/clients/{client_id}", tags=["clients"])
async def get_client(client_id: str, current_user: dict = Depends(get_current_user)):
    data = clients.get(client_id, {})
    return {
        "id": client_id,
        "static_name": STATIC_NAMES[int(client_id.replace("info",""))-1] if client_id.startswith("info") else client_id,
        "custom_name": client_names.get(client_id, ""),
        "status": "online" if (client_id in heartbeats and (datetime.utcnow() - heartbeats[client_id]).total_seconds() < 30) else "offline",
        "last_seen": heartbeats.get(client_id).isoformat() if client_id in heartbeats else None,
        "web_url": client_urls.get(client_id, "https://www.kulturskolenviborg.dk/infoskaerm1"),
        "clientdata": data
    }

@app.post("/api/clients/{client_id}/set_custom_name", tags=["clients"])
async def set_custom_name(client_id: str, name: str, current_user: dict = Depends(get_current_user)):
    client_names[client_id] = name
    return {"status": "ok", "custom_name": name}

@app.post("/api/clients/{client_id}/set_web_url", tags=["clients"])
async def set_web_url(client_id: str, web_url: str, current_user: dict = Depends(get_current_user)):
    client_urls[client_id] = web_url
    return {"status": "ok", "web_url": web_url}

@app.post("/api/clients/{client_id}/command", tags=["clients"])
async def send_command(client_id: str, command: str, current_user: dict = Depends(get_current_user)):
    if client_id not in commands:
        commands[client_id] = []
    commands[client_id].append({"timestamp": datetime.utcnow().isoformat(), "command": command})
    return {"status": "ok"}

@app.get("/api/clients/{client_id}/commands", tags=["clients"])
async def get_commands(client_id: str):
    cmdlist = commands.get(client_id, [])
    commands[client_id] = []
    return cmdlist

@app.post("/api/clients/{client_id}/heartbeat", tags=["clients"])
async def heartbeat(client_id: str, body: Dict = {}):
    heartbeats[client_id] = datetime.utcnow()
    clients[client_id] = body or {}
    return {"status": "ok"}

@app.get("/api/holidays", tags=["holidays"])
async def get_holidays(current_user: dict = Depends(get_current_user)):
    return {
        "custom_holidays": custom_holidays,
        "custom_weeks_off": custom_weeks_off,
        "full_july": full_july,
        "api_holidays": api_holidays
    }

@app.post("/api/holidays", tags=["holidays"])
async def set_holidays(data: Dict, current_user: dict = Depends(get_current_user)):
    global custom_holidays, custom_weeks_off, full_july
    custom_holidays = data.get("custom_holidays", [])
    custom_weeks_off = data.get("custom_weeks_off", [])
    full_july = data.get("full_july", True)
    return {"status": "ok"}

@app.post("/api/holidays/apiupdate", tags=["holidays"])
async def update_api_holidays(data: Dict, current_user: dict = Depends(get_current_user)):
    global api_holidays
    api_holidays = data.get("api_holidays", [])
    return {"status": "ok"}

@app.websocket("/ws/shell/{client_id}")
async def websocket_shell(websocket: WebSocket, client_id: str):
    await websocket.accept()
    ws_connections[client_id] = websocket
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Du sendte til shell på {client_id}: {data}")
    except WebSocketDisconnect:
        ws_connections.pop(client_id, None)

@app.websocket("/ws/stream/{client_id}")
async def websocket_stream(websocket: WebSocket, client_id: str):
    await websocket.accept()
    try:
        while True:
            await websocket.send_text(f"streamdata fra {client_id}")
    except WebSocketDisconnect:
        pass

@app.get("/api/", tags=["root"])
def root():
    return {"message": "Kulturskole Infoskaerm backend kører!"}

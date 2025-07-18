from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from datetime import datetime, timedelta
import uuid
import json

# --- Settings ---
SECRET_KEY = "supersecretkey"   # Skift til noget sikkert i produktion!
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60*8

# --- Models ---
class User(BaseModel):
    username: str
    full_name: str = ""
    disabled: bool = False

class UserInDB(User):
    hashed_password: str

class Client(BaseModel):
    id: str
    display_name: str
    ip: str = ""
    last_seen: datetime = None
    status: str = "offline"
    version: str = ""
    uptime: int = 0
    live_command: str = ""
    web_url: str = "https://www.kulturskolenviborg.dk/infoskaerm1"

class Heartbeat(BaseModel):
    id: str
    ip: str = ""
    version: str = ""
    uptime: int = 0

class Holiday(BaseModel):
    date: str      # "YYYY-MM-DD"
    localName: str
    name: str

# --- Demo users (kan udvides til database) ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
users_db = {
    "admin": {
        "username": "admin",
        "full_name": "System Admin",
        "hashed_password": pwd_context.hash("admin123"),
        "disabled": False,
    }
}

# --- Klienter (in-memory, kan udvides til database) ---
clients = {}
for i in range(1, 11):
    cid = f"Kulturskolen Viborg_info{i}"
    clients[cid] = Client(id=cid, display_name=cid)

# --- Holidays (kan indlæses fra/til fil) ---
HOLIDAYS_FILE = "holidays.json"
def load_holidays():
    try:
        with open(HOLIDAYS_FILE, "r") as f:
            return json.load(f)
    except:
        return []
def save_holidays(holidays):
    with open(HOLIDAYS_FILE, "w") as f:
        json.dump(holidays, f, indent=2, ensure_ascii=False)

holidays = load_holidays()

# --- App setup ---
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Juster til produktion!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# --- Auth helpers ---
def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def get_user(db, username: str):
    if username in db:
        user_dict = db[username]
        return UserInDB(**user_dict)
    return None

def authenticate_user(username: str, password: str):
    user = get_user(users_db, username)
    if not user or not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user(users_db, username)
    if user is None:
        raise credentials_exception
    return user

# --- Endpoints ---
@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Forkert brugernavn eller adgangskode")
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.get("/clients", response_model=list[Client])
async def get_clients(current_user: User = Depends(get_current_user)):
    return list(clients.values())

@app.get("/clients/{client_id}", response_model=Client)
async def get_client(client_id: str, current_user: User = Depends(get_current_user)):
    if client_id not in clients:
        raise HTTPException(status_code=404, detail="Klient ikke fundet")
    return clients[client_id]

@app.post("/heartbeat")
async def heartbeat(hb: Heartbeat):
    client = clients.get(hb.id)
    if not client:
        return JSONResponse(status_code=404, content={"message": "Klient ikke fundet"})
    client.last_seen = datetime.utcnow()
    client.ip = hb.ip
    client.status = "online"
    client.version = hb.version
    client.uptime = hb.uptime
    return {"status": "ok"}

@app.post("/clients/{client_id}/command")
async def client_command(client_id: str, command: str, current_user: User = Depends(get_current_user)):
    if client_id not in clients:
        raise HTTPException(status_code=404, detail="Klient ikke fundet")
    clients[client_id].live_command = command
    return {"command": command, "set": True}

@app.get("/clients/{client_id}/command")
async def get_command(client_id: str):
    command = clients[client_id].live_command if client_id in clients else ""
    # Slet kommandoen efter afhentning, så den kun køres én gang
    clients[client_id].live_command = ""
    return {"command": command}

@app.get("/holidays")
async def get_holidays():
    return holidays

@app.post("/holidays")
async def update_holidays(new_holidays: list[Holiday], current_user: User = Depends(get_current_user)):
    global holidays
    holidays = [h.dict() for h in new_holidays]
    save_holidays(holidays)
    return {"status": "updated", "count": len(holidays)}

@app.post("/clients/{client_id}/set_display_name")
async def set_display_name(client_id: str, display_name: str, current_user: User = Depends(get_current_user)):
    if client_id not in clients:
        raise HTTPException(status_code=404, detail="Klient ikke fundet")
    clients[client_id].display_name = display_name
    return {"status": "updated", "display_name": display_name}

@app.post("/clients/{client_id}/set_web_url")
async def set_web_url(client_id: str, web_url: str, current_user: User = Depends(get_current_user)):
    if client_id not in clients:
        raise HTTPException(status_code=404, detail="Klient ikke fundet")
    clients[client_id].web_url = web_url
    return {"status": "updated", "web_url": web_url}

@app.get("/")
async def root():
    return {"message": "Kulturskole Infoskaerm backend kører!"}

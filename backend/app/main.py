from fastapi import FastAPI, HTTPException, Depends, status, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
from jose import JWTError, jwt

# ----------- FAST API-NØGLE TIL KLIENT-AUTOMATION -----------
API_KEY = "KulVib2025info"  # Sæt din egen nøgle!

# SECRET til JWT - SKIFT DETTE I PRODUKTION!
SECRET_KEY = "supersecretkey123"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Dummy brugere (skift til database i produktion)
fake_users_db = {
    "admin": {
        "username": "admin",
        "full_name": "Admin User",
        "hashed_password": "KulVib2025info",  # IKKE sikkert! Brug hash i produktion!
        "disabled": False,
    }
}

# ---------- Pydantic models ----------
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class User(BaseModel):
    username: str
    full_name: Optional[str] = None
    disabled: Optional[bool] = None

class UserInDB(User):
    hashed_password: str

class Client(BaseModel):
    id: str
    name: str
    display_name: Optional[str]
    web_addr: Optional[str]
    ip: Optional[str]
    version: Optional[str]
    last_seen: Optional[str]
    uptime: Optional[str]
    online: bool
    status: Optional[str] = "pending"  # 'pending' eller 'approved'

class ClientUpdate(BaseModel):
    display_name: Optional[str] = None
    web_addr: Optional[str] = None

class ClientStatus(BaseModel):
    ip: Optional[str]
    version: Optional[str]
    last_seen: Optional[str]
    uptime: Optional[str]
    online: Optional[bool]

class ClientApprove(BaseModel):
    display_name: Optional[str]

class ClientAction(BaseModel):
    action: str

# ---------- Generér 15 klienter (kan være tom til start) ----------
def generate_clients(n=0):
    return [
        {
            "id": f"client{i+1}",
            "name": f"client{i+1}",
            "display_name": f"Storskærm {i+1}",
            "web_addr": f"https://example.com/client{i+1}",
            "ip": f"192.168.1.{10+i}",
            "version": f"1.0.{i}",
            "last_seen": "2025-07-19 10:00:00",
            "uptime": f"{i+1} dage, {i*2} timer",
            "online": i % 2 == 0,
            "status": "approved"
        }
        for i in range(n)
    ]

fake_clients_db = generate_clients(0)  # Starter tom!

# ---------- Auth helpers ----------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/token")

def verify_password(plain_password, hashed_password):
    return plain_password == hashed_password

def get_user(db, username: str):
    if username in db:
        user_dict = db[username]
        return UserInDB(**user_dict)
    return None

def authenticate_user(db, username: str, password: str):
    user = get_user(db, username)
    if not user or not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = get_user(fake_users_db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# ---------- FastAPI app ----------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # I produktion: Sæt din frontend-url her!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Auth endpoints ----------
@app.post("/api/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(fake_users_db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}

# ---------- KLIENT-ENDPOINTS: JWT (ADMIN/FRONTEND) ----------
@app.get("/api/clients", response_model=List[Client])
async def get_clients(current_user: User = Depends(get_current_active_user)):
    return fake_clients_db

@app.get("/api/clients/{client_id}", response_model=Client)
async def get_client(client_id: str, current_user: User = Depends(get_current_active_user)):
    client = next((c for c in fake_clients_db if c["id"] == client_id), None)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client

@app.patch("/api/clients/{client_id}", response_model=Client)
async def update_client(client_id: str, update: ClientUpdate, current_user: User = Depends(get_current_active_user)):
    client = next((c for c in fake_clients_db if c["id"] == client_id), None)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if update.display_name is not None:
        client["display_name"] = update.display_name
    if update.web_addr is not None:
        client["web_addr"] = update.web_addr
    return client

@app.post("/api/clients/{client_id}/action")
async def client_action(client_id: str, action: ClientAction, current_user: User = Depends(get_current_active_user)):
    valid_actions = ["start", "restart", "shutdown", "browser_shutdown"]
    if action.action not in valid_actions:
        raise HTTPException(status_code=400, detail="Invalid action")
    # Her kan du sætte rigtig handling ind
    return {"msg": f"Action '{action.action}' executed for client {client_id}"}

# ---------- KLIENT-ENDPOINTS: FAST API-NØGLE TIL AUTO-REGISTRERING (ingen JWT) ----------
@app.post("/api/clients", response_model=Client)
async def client_auto_register(client: Client, x_api_key: str = Header(None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    # Tjek om klienten allerede findes
    exists = next((c for c in fake_clients_db if c["id"] == client.id), None)
    if exists:
        return exists
    # Opret ny klient med status 'pending'
    client_dict = client.dict()
    client_dict["status"] = "pending"
    fake_clients_db.append(client_dict)
    return client_dict

@app.patch("/api/clients/{client_id}/status", response_model=Client)
async def client_update_status(client_id: str, status: ClientStatus, x_api_key: str = Header(None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    client = next((c for c in fake_clients_db if c["id"] == client_id), None)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    for field, value in status.dict(exclude_unset=True).items():
        client[field] = value
    return client

@app.get("/api/clients/{client_id}/status", response_model=Client)
async def client_get_status(client_id: str, x_api_key: str = Header(None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    client = next((c for c in fake_clients_db if c["id"] == client_id), None)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client

@app.patch("/api/clients/{client_id}/approve", response_model=Client)
async def approve_client(client_id: str, approval: ClientApprove, current_user: User = Depends(get_current_active_user)):
    client = next((c for c in fake_clients_db if c["id"] == client_id), None)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if client["status"] == "approved":
        raise HTTPException(status_code=400, detail="Client is already approved")
    client["status"] = "approved"
    if approval.display_name is not None:
        client["display_name"] = approval.display_name
    return client

# ---------- Dummy endpoints ----------
@app.get("/api/protected")
async def protected_route(current_user: User = Depends(get_current_active_user)):
    return {"msg": f"Hello, {current_user.username}!"}

@app.post("/api/testhash")
async def test_hash(password: str):
    return {"hash": password + "_hashed"}

@app.post("/api/genhash")
async def gen_hash(password: str):
    return {"hash": password + "_genhashed"}

@app.get("/")
def read_root():
    return {"msg": "Infoskærm backend kører!"}

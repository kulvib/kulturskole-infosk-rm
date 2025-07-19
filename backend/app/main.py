from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
from jose import JWTError, jwt

# SECRET til JWT - SKIFT DETTE I PRODUKTION!
SECRET_KEY = "supersecretkey123"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Dummy brugere (skift til database i produktion)
fake_users_db = {
    "admin": {
        "username": "admin",
        "full_name": "Admin User",
        "hashed_password": "admin",  # IKKE sikkert! Brug hash i produktion!
        "disabled": False,
    }
}

# Dummy klienter (skift til database i produktion)
fake_clients_db = [
    {
        "id": "client1",
        "name": "client1",
        "display_name": "Storskærm 1",
        "web_addr": "https://example.com",
        "ip": "192.168.1.10",
        "version": "1.0.0",
        "last_seen": "2025-07-19 10:00:00",
        "uptime": "2 dage, 3 timer",
        "online": True
    },
    {
        "id": "client2",
        "name": "client2",
        "display_name": "Storskærm 2",
        "web_addr": "https://example.org",
        "ip": "192.168.1.11",
        "version": "1.0.1",
        "last_seen": "2025-07-19 09:50:00",
        "uptime": "1 dag, 22 timer",
        "online": False
    }
]

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

class ClientUpdate(BaseModel):
    display_name: Optional[str] = None
    web_addr: Optional[str] = None

class ClientAction(BaseModel):
    action: str

# ---------- Auth helpers ----------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/token")

def verify_password(plain_password, hashed_password):
    # Dummy check -- i produktion: brug hashing!
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

# Cross-origin (så du kan tilgå fra din frontend)
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

# ---------- Klient endpoints ----------
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

# ---------- Dummy endpoints fra din gamle /docs ----------
@app.get("/api/protected")
async def protected_route(current_user: User = Depends(get_current_active_user)):
    return {"msg": f"Hello, {current_user.username}!"}

@app.post("/api/testhash")
async def test_hash(password: str):
    return {"hash": password + "_hashed"}

@app.post("/api/genhash")
async def gen_hash(password: str):
    return {"hash": password + "_genhashed"}

# ---------- Root endpoint ----------
@app.get("/")
def read_root():
    return {"msg": "Infoskærm backend kører!"}

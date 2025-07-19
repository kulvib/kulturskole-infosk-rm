from fastapi import FastAPI, HTTPException, Depends, status, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from typing import List
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app import models, schemas, auth

API_KEY = "KulVib2025info"

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------- AUTH ENDPOINTS ----------
@app.post("/api/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = auth.authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(
        data={"username": user["username"]}
    )
    return {"access_token": access_token, "token_type": "bearer"}

# ---------- KLIENT-ENDPOINTS: JWT (ADMIN/FRONTEND) ----------
@app.get("/api/clients", response_model=List[schemas.ClientOut])
def get_clients(
    db: Session = Depends(get_db),
    current_user: dict = Depends(auth.get_current_user)
):
    return db.query(models.Client).all()

@app.get("/api/clients/{client_id}", response_model=schemas.ClientOut)
def get_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(auth.get_current_user)
):
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client

@app.patch("/api/clients/{client_id}", response_model=schemas.ClientOut)
def update_client(
    client_id: str,
    update: schemas.ClientUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(auth.get_current_user)
):
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if update.display_name is not None:
        client.display_name = update.display_name
    if update.web_addr is not None:
        client.web_addr = update.web_addr
    db.commit()
    db.refresh(client)
    return client

@app.delete("/api/clients/{client_id}")
def delete_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(auth.get_current_user)
):
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    db.delete(client)
    db.commit()
    return {"ok": True}

# ---------- KLIENT-ENDPOINTS: FAST API-NØGLE TIL AUTO-REGISTRERING (ingen JWT) ----------
@app.post("/api/clients", response_model=schemas.ClientOut)
def client_auto_register(
    client: schemas.ClientCreate,
    x_api_key: str = Header(None),
    db: Session = Depends(get_db)
):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    exists = db.query(models.Client).filter(models.Client.id == client.id).first()
    if exists:
        return exists
    db_client = models.Client(**client.dict())
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client

@app.patch("/api/clients/{client_id}/status", response_model=schemas.ClientOut)
def client_update_status(
    client_id: str,
    status: schemas.ClientStatus,
    x_api_key: str = Header(None),
    db: Session = Depends(get_db)
):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    for field, value in status.dict(exclude_unset=True).items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client

@app.get("/api/clients/{client_id}/status", response_model=schemas.ClientOut)
def client_get_status(
    client_id: str,
    x_api_key: str = Header(None),
    db: Session = Depends(get_db)
):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client

@app.patch("/api/clients/{client_id}/approve", response_model=schemas.ClientOut)
def approve_client(
    client_id: str,
    approval: schemas.ClientApprove,
    db: Session = Depends(get_db),
    current_user: dict = Depends(auth.get_current_user)
):
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if client.status == "approved":
        raise HTTPException(status_code=400, detail="Client is already approved")
    client.status = "approved"
    if approval.display_name is not None:
        client.display_name = approval.display_name
    db.commit()
    db.refresh(client)
    return client

# ---------- Dummy endpoints ----------
@app.get("/api/protected")
def protected_route(current_user: dict = Depends(auth.get_current_user)):
    return {"msg": f"Hello, {current_user['username']}!"}

@app.post("/api/testhash")
def test_hash(password: str):
    from app.auth import pwd_context
    return {"hash": pwd_context.hash(password)}

@app.post("/api/genhash")
def gen_hash(password: str):
    from app.auth import pwd_context
    return {"hash": pwd_context.hash(password)}

@app.get("/")
def read_root():
    return {"msg": "Infoskærm backend kører!"}

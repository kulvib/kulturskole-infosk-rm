from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.auth import authenticate_user, create_access_token, get_current_user, fake_users_db, pwd_context
from . import models, schemas
from .database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)
router = APIRouter()

# ---- AUTH ENDPOINTS ----

class PasswordTest(BaseModel):
    password: str

@router.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Forkert brugernavn eller adgangskode"
        )
    access_token = create_access_token(data={"username": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/protected")
def protected_route(current_user: dict = Depends(get_current_user)):
    return {"msg": f"Du er logget ind som {current_user['username']}"}

@router.post("/testhash")
def test_hash(payload: PasswordTest):
    hashed = fake_users_db["admin"]["hashed_password"]
    result = pwd_context.verify(payload.password, hashed)
    return {"password": payload.password, "hashed": hashed, "result": result}

@router.post("/genhash")
def gen_hash(payload: PasswordTest):
    hashval = pwd_context.hash(payload.password)
    return {"password": payload.password, "hash": hashval}

# ---- DATABASE/CLIENT ENDPOINTS ----

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/clients", response_model=list[schemas.ClientOut])
def read_clients(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    return db.query(models.Client).all()

@router.post("/clients", response_model=schemas.ClientOut)
def create_client(client: schemas.ClientCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    db_client = models.Client(**client.dict())
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client

@router.get("/clients/{client_id}", response_model=schemas.ClientOut)
def read_client(client_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return client

@router.delete("/clients/{client_id}")
def delete_client(client_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    db.delete(client)
    db.commit()
    return {"ok": True}

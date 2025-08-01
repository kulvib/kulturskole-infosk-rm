from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .routers import clients
from .auth import router as auth_router, get_password_hash
from .db import create_db_and_tables, engine
from dotenv import load_dotenv
from sqlmodel import Session, select
from .models import User

load_dotenv()

app = FastAPI(
    title="Kulturskole Infoskaerm Backend",
    version="1.0.0"
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Sæt evt. din frontend-url
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clients.router, prefix="/api")
app.include_router(auth_router)

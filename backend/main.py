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

# --- MIDLERTIDIG ENDPOINT: Opret admin-bruger ---
admin_router = APIRouter()

@admin_router.post("/create-admin")
def create_admin():
    with Session(engine) as session:
        user = session.exec(
            select(User).where(User.username == "admin")
        ).first()
        if user:
            raise HTTPException(status_code=400, detail="Admin already exists")
        admin = User(
            username="admin",
            hashed_password=get_password_hash("KulVib2025info"),
            role="admin",
            is_active=True
        )
        session.add(admin)
        session.commit()
        return {"msg": "Admin created"}

app.include_router(admin_router)
# --- SLET ovenstående når admin er oprettet! ---

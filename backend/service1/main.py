print("### main.py starter ###")

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from sqlmodel import Session, select

print("### main.py: Pre-router-import ###")

from routers import clients, calendar, meta, schools, users, livestream

print("### main.py: livestream importeret ###")

from auth import router as auth_router, get_password_hash
from db import create_db_and_tables, engine
from models import User

print("### main.py: Efter alle imports ###")

load_dotenv()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "meget_sikkert_fallback_kodeord")

app = FastAPI(
    title="Kulturskole Infoskaerm Backend",
    version="1.0.0"
)

def ensure_admin_user():
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == "admin")).first()
        if not user:
            admin = User(
                username="admin",
                hashed_password=get_password_hash(ADMIN_PASSWORD),
                role="admin",
                is_active=True
            )
            session.add(admin)
            session.commit()
            print("Admin user created by startup script")
        else:
            print("Admin user already exists")

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    ensure_admin_user()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://infoskaerm-frontend.netlify.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- STATIC MOUNT TIL HLS ---
HLS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "hls"))
os.makedirs(HLS_DIR, exist_ok=True)
app.mount("/hls", StaticFiles(directory=HLS_DIR), name="hls")
print(f"### main.py: Static mount for HLS på {HLS_DIR} ###")

# Routers
app.include_router(clients.router, prefix="/api")
app.include_router(schools.router, prefix="/api")
app.include_router(auth_router, prefix="/auth")
app.include_router(calendar.router, prefix="/api")
app.include_router(meta.router, prefix="/api")
app.include_router(users.router, prefix="/api")
# VIGTIGT: livestream-router får prefix /api for at UNDGÅ konflikt med static mount på /hls
app.include_router(livestream.router, prefix="/api")

# Root route to avoid 404
@app.get("/")
def read_root():
    return {"message": "Kulturskole Infoskaerm Backend is running"}

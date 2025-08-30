import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from sqlmodel import Session, select

from routers import clients, calendar, meta, schools, users
from auth import router as auth_router, get_password_hash
from db import create_db_and_tables, engine
from models import User

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

app.include_router(clients.router, prefix="/api")
app.include_router(schools.router, prefix="/api")
app.include_router(auth_router, prefix="/auth")
app.include_router(calendar.router, prefix="/api")
app.include_router(meta.router, prefix="/api")
app.include_router(users.router, prefix="/api")

# --- WebSocket livestream endpoint ---
websocket_clients = []

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    websocket_clients.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Broadcast data til alle andre connected clients
            for client in websocket_clients:
                if client != websocket:
                    await client.send_text(data)
    except WebSocketDisconnect:
        websocket_clients.remove(websocket)

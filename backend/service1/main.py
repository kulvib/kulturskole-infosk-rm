import os
import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from dotenv import load_dotenv

from routers import clients, calendar, meta, schools, users, livestream
from auth import router as auth_router, get_password_hash
from db import create_db_and_tables, engine
from models import User, Client

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
app.include_router(livestream.router, prefix="/api")

# --- WebSocket livestream endpoint med database-klient-ID routing ---

# Streamende klienter: client_id → websocket
client_streams = {}       # { id: websocket }
viewers = {}              # { websocket: client_id_to_watch }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        # Første besked fra klient og viewer er JSON med type og client_id
        msg = await websocket.receive_text()
        data = json.loads(msg)
        if data["type"] == "register":
            # Klient streamer billeder, bruger database-ID
            client_id = int(data["client_id"])
            # Valider at klient-ID findes i DB og er godkendt
            with Session(engine) as session:
                client = session.get(Client, client_id)
                if not client or client.status != "approved":
                    await websocket.close()
                    return
            client_streams[client_id] = websocket
            print(f"Streamer registreret med klient ID {client_id}")
            while True:
                img_data = await websocket.receive_text()  # base64 image
                # Broadcast billedet til alle viewers, der kigger på denne client_id
                for ws, watch_id in viewers.items():
                    if watch_id == client_id:
                        try:
                            await ws.send_text(img_data)
                        except Exception:
                            pass  # ignore broken viewers
        elif data["type"] == "watch":
            # Viewer vil se stream fra klient-ID
            watch_id = int(data["client_id"])
            viewers[websocket] = watch_id
            print(f"Viewer kigger på klient {watch_id}")
            while True:
                await asyncio.sleep(1)  # Hold forbindelsen åben
        else:
            await websocket.close()
    except WebSocketDisconnect:
        # Fjern fra streams og viewers
        to_remove = []
        for cid, ws in client_streams.items():
            if ws == websocket:
                to_remove.append(cid)
        for cid in to_remove:
            client_streams.pop(cid)
        viewers.pop(websocket, None)
        print("WebSocket connection closed.")

# REST endpoint: Vis kun godkendte klienter til frontend dropdown (samme som /clients/public)
@app.get("/api/clients/livestream")
def get_livestream_clients():
    with Session(engine) as session:
        clients = session.exec(select(Client).where(Client.status == "approved")).all()
        return {
            "clients": [{"id": c.id, "name": c.name} for c in clients]
        }

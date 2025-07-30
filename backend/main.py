from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import clients
from .auth import router as auth_router
from .db import create_db_and_tables
from dotenv import load_dotenv

load_dotenv()  # Læs .env hvis den findes

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

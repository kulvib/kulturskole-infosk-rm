from fastapi import FastAPI
from backend.routers import auth, clients, holidays
from backend.database import init_db

# Init DB on app startup
init_db()

app = FastAPI(
    title="Kulturskole Infoskaerm Backend",
    version="1.0.0"
)

app.include_router(auth.router)
app.include_router(clients.router)
app.include_router(holidays.router)

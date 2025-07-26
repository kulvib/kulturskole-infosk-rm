from fastapi import FastAPI
from routers import clients, holidays
from auth import router as auth_router

app = FastAPI(
    title="Kulturskole Infoskaerm Backend",
    version="1.0.0"
)

app.include_router(auth_router)
app.include_router(clients.router)
app.include_router(holidays.router)

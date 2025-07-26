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

from database import init_db, get_db
from models import AdminUser
from auth import get_password_hash

@app.on_event("startup")
def setup_admin():
    init_db()
    with next(get_db()) as db:
        if not db.query(AdminUser).filter_by(username="admin").first():
            u = AdminUser(username="admin", hashed_password=get_password_hash("KulVib2025info"))
            db.add(u)
            db.commit()

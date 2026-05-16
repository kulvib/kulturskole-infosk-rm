print("### main.py starter ###")

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from sqlmodel import Session, select, text
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from starlette.staticfiles import StaticFiles

load_dotenv()

print("### main.py: Pre-router-import ###")

from routers import clients
from routers import calendar
from routers import meta
from routers import schools
from routers import users
from routers import livestream
from routers.remote_desktop import router as remote_desktop_router
from routers.terminal import router as terminal_router
from routers import holidays
from routers.livestream import HLS_DIR

print("### main.py: livestream importeret ###")

from auth import router as auth_router, get_password_hash
from db import create_db_and_tables, engine
from models import User

print("### main.py: Efter alle imports ###")

ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv(
        "ALLOWED_ORIGINS",
        "https://infoskaerm-frontend.onrender.com"
    ).split(",")
]


def migrate_legacy_user_roles():
    with Session(engine) as session:
        users = session.exec(
            select(User).where(User.role.in_(["admin", "elev"]))
        ).all()
        changed = 0
        for user in users:
            if user.role == "admin":
                user.role = "superadmin"
                changed += 1
            elif user.role == "elev":
                user.role = "bruger"
                changed += 1
            session.add(user)
        if changed:
            session.commit()
            print(f"Rollemigration: {changed} brugere migreret")
        else:
            print("Rollemigration: ingen forældede roller fundet")


def migrate_add_chrome_step():
    """
    Tilføj chrome_step kolonne til client-tabellen hvis den ikke allerede eksisterer.
    chrome_step gemmer det seneste step-navn fra klienten (fx "countdown", "start_chrome")
    så frontend kan bruge det til lock-logik uden at læse klientens lokale fil.
    """
    with Session(engine) as session:
        try:
            session.exec(text("ALTER TABLE client ADD COLUMN chrome_step VARCHAR"))
            session.commit()
            print("Migration: chrome_step kolonne tilføjet til client-tabel")
        except Exception:
            # Kolonnen eksisterer allerede — det er forventet ved genstart
            pass


def ensure_admin_user():
    with Session(engine) as session:
        admin_user_exists = session.exec(
            select(User).where(User.role.in_(["admin", "superadmin"]), User.is_active)
        ).first()
        if not admin_user_exists:
            admin_password = os.getenv("ADMIN_PASSWORD", "")
            if not admin_password or len(admin_password) < 12:
                raise RuntimeError(
                    "ADMIN_PASSWORD mangler eller er for svagt. "
                    "Sæt ADMIN_PASSWORD (min. 12 tegn) i Environment på Render."
                )
            admin_username = os.getenv("ADMIN_USERNAME", "admin").strip() or "admin"
            admin = User(
                username=admin_username,
                hashed_password=get_password_hash(admin_password),
                role="superadmin",
                is_active=True,
                email=os.getenv("ADMIN_EMAIL", "admin@example.com"),
                must_change_password=True,
            )
            session.add(admin)
            session.commit()
            print("Superadmin-bruger oprettet ved opstart")
        else:
            print("Aktiv admin/superadmin findes allerede — ADMIN_* env ignoreres")


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    migrate_legacy_user_roles()
    migrate_add_chrome_step()
    ensure_admin_user()
    yield


app = FastAPI(
    title="Kulturskole Infoskaerm Backend",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if os.getenv("ENVIRONMENT") == "production" else "/docs",
    redoc_url=None if os.getenv("ENVIRONMENT") == "production" else "/redoc",
    openapi_url=None if os.getenv("ENVIRONMENT") == "production" else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


class HLSCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.url.path.startswith("/hls/"):
            origin = request.headers.get("origin", "")
            allowed_origin = origin if origin in ALLOWED_ORIGINS else (ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*")

            if request.method == "OPTIONS":
                return Response(
                    status_code=204,
                    headers={
                        "Access-Control-Allow-Origin":  allowed_origin,
                        "Access-Control-Allow-Methods": "GET, OPTIONS, HEAD",
                        "Access-Control-Allow-Headers": "Authorization, Content-Type, Range",
                        "Access-Control-Allow-Credentials": "true",
                        "Access-Control-Max-Age":       "86400",
                    }
                )

            response = await call_next(request)
            response.headers["Access-Control-Allow-Origin"]      = allowed_origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"]     = "GET, OPTIONS, HEAD"
            response.headers["Access-Control-Allow-Headers"]     = "Authorization, Content-Type, Range"

            if request.url.path.endswith(".m3u8"):
                response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
                response.headers["Pragma"]        = "no-cache"
                response.headers["Expires"]       = "0"
            else:
                response.headers["Cache-Control"] = "public, max-age=30, must-revalidate"

            return response

        return await call_next(request)


app.add_middleware(HLSCORSMiddleware)


class CustomStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if path.endswith('.m3u8'):
            response.headers["Content-Type"] = "application/vnd.apple.mpegurl"
        elif path.endswith('.ts'):
            response.headers["Content-Type"] = "video/mp2t"
        elif path.endswith('.mp4'):
            response.headers["Content-Type"] = "video/mp4"
        return response


app.mount("/hls", CustomStaticFiles(directory=HLS_DIR), name="hls")
print(f"### main.py: Static mount for HLS på {HLS_DIR} ###")

app.include_router(clients.router,    prefix="/api")
app.include_router(schools.router,    prefix="/api")
app.include_router(auth_router,       prefix="/auth")
app.include_router(calendar.router,   prefix="/api")
app.include_router(meta.router,       prefix="/api")
app.include_router(users.router,      prefix="/api")
app.include_router(livestream.router, prefix="/api")
app.include_router(remote_desktop_router, prefix="/api")
app.include_router(terminal_router,        prefix="/api")
app.include_router(holidays.router,   prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/db")
def health_db():
    try:
        with Session(engine) as session:
            session.exec(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as exc:
        print(f"Database health check fejlede: {exc}")
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "detail": "Databasen svarer ikke"},
        )


@app.get("/")
def read_root():
    return {"message": "Kulturskole Infoskaerm Backend kører"}


@app.get("/ping")
def ping():
    return {"message": "pong"}

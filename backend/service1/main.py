print("### main.py starter ###")

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from sqlmodel import Session, select
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.staticfiles import StaticFiles

load_dotenv()

# Valider kritiske miljøvariabler ved opstart
_SECRET_KEY = os.getenv("SECRET_KEY", "")
if not _SECRET_KEY or len(_SECRET_KEY) < 32:
    raise RuntimeError("SECRET_KEY mangler eller er for kort. Sæt SECRET_KEY (min. 32 tegn) i .env")

_ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
if not _ADMIN_PASSWORD or len(_ADMIN_PASSWORD) < 12:
    raise RuntimeError("ADMIN_PASSWORD mangler eller er for svagt. Sæt ADMIN_PASSWORD (min. 12 tegn) i .env")

print("### main.py: Pre-router-import ###")

from routers import clients
from routers import calendar
from routers import meta
from routers import schools
from routers import users
from routers import livestream
from routers.livestream import HLS_DIR

print("### main.py: livestream importeret ###")

from auth import router as auth_router, get_password_hash
from db import create_db_and_tables, engine
from models import User

print("### main.py: Efter alle imports ###")

ADMIN_PASSWORD = _ADMIN_PASSWORD
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "https://infoskaerm-frontend.netlify.app"
).split(",")

app = FastAPI(
    title="Kulturskole Infoskaerm Backend",
    version="1.0.0",
    # Deaktiver den offentlige /docs og /redoc i produktion
    docs_url=None if os.getenv("ENVIRONMENT") == "production" else "/docs",
    redoc_url=None if os.getenv("ENVIRONMENT") == "production" else "/redoc",
    openapi_url=None if os.getenv("ENVIRONMENT") == "production" else "/openapi.json",
)


def ensure_admin_user():
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == "admin")).first()
        if not user:
            admin = User(
                username="admin",
                hashed_password=get_password_hash(ADMIN_PASSWORD),
                role="admin",
                is_active=True,
                email=os.getenv("ADMIN_EMAIL", "admin@example.com"),  # Fra .env
            )
            session.add(admin)
            session.commit()
            print("Admin-bruger oprettet ved opstart")
        else:
            print("Admin-bruger eksisterer allerede")


@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    ensure_admin_user()


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# HLS middleware – begrænset CORS (ikke wildcard for alle routes)
class HLSCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/hls/"):
            origin = request.headers.get("origin", "")
            # Tillad kun kendte origins for HLS
            allowed = [o.strip() for o in ALLOWED_ORIGINS]
            if origin in allowed or not origin:
                response.headers["Access-Control-Allow-Origin"] = origin or "*"
            response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS, HEAD"
            response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type"
            if request.url.path.endswith(".m3u8"):
                response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
                response.headers["Pragma"] = "no-cache"
                response.headers["Expires"] = "0"
            else:
                response.headers["Cache-Control"] = "public, max-age=30, must-revalidate"
        return response


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

# Routers
app.include_router(clients.router, prefix="/api")
app.include_router(schools.router, prefix="/api")
app.include_router(auth_router, prefix="/auth")
app.include_router(calendar.router, prefix="/api")
app.include_router(meta.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(livestream.router, prefix="/api")


@app.get("/")
def read_root():
    return {"message": "Kulturskole Infoskaerm Backend kører"}


@app.get("/ping")
def ping():
    return {"message": "pong"}

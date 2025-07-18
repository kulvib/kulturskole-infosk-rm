from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app import endpoints

app = FastAPI()

# CORS: Tillad Vercel-frontend og lokal udvikling
origins = [
    "http://localhost:5173",
    "https://kulturskole-infoskaerm-frontend.vercel.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(endpoints.router, prefix="/api")

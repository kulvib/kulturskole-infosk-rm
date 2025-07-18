from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.endpoints import router

app = FastAPI()

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

@app.get("/")
def root():
    return {"msg": "Backend is running"}

app.include_router(router, prefix="/api")

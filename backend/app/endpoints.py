from fastapi import APIRouter, Depends, HTTPException
from . import schemas, crud, auth

router = APIRouter()

@router.get("/ping")
def ping():
    return {"msg": "pong"}

# Eksempel på beskyttet endpoint
@router.get("/secure-data")
def secure_data(user=Depends(auth.get_current_user)):
    return {"user": user, "message": "Dette er beskyttede data."}

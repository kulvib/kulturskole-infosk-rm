from fastapi import APIRouter, HTTPException
from typing import Dict

router = APIRouter(
    prefix="/livestream",
    tags=["livestream"],
)

# Intern status for om livestream er aktiv (brug evt. database eller cache i produktion)
livestream_status: Dict[str, bool] = {"active": False}

@router.post("/start")
async def start_livestream():
    livestream_status["active"] = True
    return {"status": "started"}

@router.post("/stop")
async def stop_livestream():
    livestream_status["active"] = False
    return {"status": "stopped"}

@router.get("/status")
async def get_livestream_status():
    return {"active": livestream_status["active"]}

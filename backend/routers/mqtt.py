from fastapi import APIRouter
from ..services.mqtt_service import send_message

router = APIRouter()

@router.post("/publish")
def publish_mqtt(message: str):
    send_message(message)
    return {"status": "sent", "message": message}

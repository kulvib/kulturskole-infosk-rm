from fastapi import APIRouter, Body
from sqlmodel import Session, select
from ..db import engine
from ..models import MqttMessage
from ..services.mqtt_service import send_message

router = APIRouter()

@router.post("/publish", status_code=201)
def publish_mqtt(message: str = Body(..., embed=True)) -> dict:
    send_message(message)
    return {"status": "sent", "message": message}

@router.get("/messages")
def get_mqtt_messages() -> list:
    with Session(engine) as session:
        messages = session.exec(select(MqttMessage).order_by(MqttMessage.id.desc())).all()
        return messages

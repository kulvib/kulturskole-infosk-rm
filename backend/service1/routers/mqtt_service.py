import logging
import paho.mqtt.client as mqtt
from sqlmodel import Session
from db import engine
from models import MqttMessage
from datetime import datetime

MQTT_BROKER = "test.mosquitto.org"
MQTT_PORT = 1883
MQTT_TOPIC = "test/topic"

logger = logging.getLogger("mqtt_service")
client = mqtt.Client(client_id="backend_service")

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("Connected to Mosquitto broker!")
        client.subscribe(MQTT_TOPIC)
    else:
        logger.error(f"Failed to connect to Mosquitto. Return code: {rc}")

def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode()
    except Exception as e:
        payload = str(msg.payload)
        logger.warning(f"Fejl ved decoding af payload: {e}")
    topic = msg.topic
    logger.info(f"Modtaget besked på {topic}: {payload}")
    try:
        with Session(engine) as session:
            mqtt_msg = MqttMessage(
                topic=topic,
                payload=payload,
                timestamp=datetime.utcnow()
            )
            session.add(mqtt_msg)
            session.commit()
    except Exception as db_error:
        logger.error(f"Fejl ved gemning af MQTT-besked i DB: {db_error}")

client.on_connect = on_connect
client.on_message = on_message

def connect():
    logger.info("Starter MQTT-forbindelse til Mosquitto...")
    try:
        client.connect(MQTT_BROKER, MQTT_PORT)
        client.loop_start()
    except Exception as e:
        logger.error(f"Fejl ved connection til broker: {e}")

def send_message(message: str, topic: str = MQTT_TOPIC):
    try:
        client.publish(topic, message)
        logger.info(f"Sendt besked til {topic}: {message}")
    except Exception as e:
        logger.error(f"Fejl ved sending af besked: {e}")

def push_client_command(command: str, topic: str = MQTT_TOPIC):
    send_message(command, topic)

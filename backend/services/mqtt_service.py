import paho.mqtt.client as mqtt
from sqlmodel import Session
from ..db import engine
from ..models import MqttMessage
from datetime import datetime

# Konfiguration
MQTT_BROKER = "test.mosquitto.org"
MQTT_PORT = 1883
MQTT_TOPIC = "test/topic"

client = mqtt.Client()

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected to Mosquitto broker!")
        client.subscribe(MQTT_TOPIC)
    else:
        print(f"Failed to connect to Mosquitto. Return code: {rc}")

def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode()
    except Exception as e:
        payload = str(msg.payload)
        print(f"Fejl ved decoding af payload: {e}")
    topic = msg.topic
    print(f"Modtaget besked på {topic}: {payload}")

    # Gem beskeden i databasen
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
        print(f"Fejl ved gemning af MQTT-besked i DB: {db_error}")

client.on_connect = on_connect
client.on_message = on_message

def connect():
    """Starter MQTT-forbindelse og lytter på beskeder."""
    print("Starter MQTT-forbindelse til Mosquitto...")
    try:
        client.connect(MQTT_BROKER, MQTT_PORT)
        client.loop_start()
    except Exception as e:
        print(f"Fejl ved connection til broker: {e}")

def send_message(message, topic=MQTT_TOPIC):
    """Sender besked til MQTT-topic."""
    try:
        client.publish(topic, message)
        print(f"Sendt besked til {topic}: {message}")
    except Exception as e:
        print(f"Fejl ved sending af besked: {e}")

def push_client_command(command: str, topic: str = MQTT_TOPIC):
    """Ekstra: sender en kommando til klient via MQTT."""
    send_message(command, topic)

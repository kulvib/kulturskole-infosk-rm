import paho.mqtt.client as mqtt
import json

MQTT_BROKER = "localhost"   # Ret til din MQTT broker IP/host
MQTT_PORT = 1883

client = mqtt.Client()

def connect():
    client.connect(MQTT_BROKER, MQTT_PORT)

def push_client_command(client_id, action, data=None):
    topic = f"client/{client_id}/command"
    payload = {"action": action}
    if data:
        payload.update(data)
    client.publish(topic, json.dumps(payload))

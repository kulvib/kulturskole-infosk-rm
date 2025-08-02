import paho.mqtt.client as mqtt
import json
import ssl
import os

MQTT_BROKER = "1e5fd0288c8b4cbaa4a919bd6dd47575.s1.eu.hivemq.cloud"
MQTT_PORT = 8883
MQTT_USERNAME = "admin"
MQTT_PASSWORD = "KulVib2025info"

CA_CERT_PATH = os.path.join(os.path.dirname(__file__), "hivemq-root-ca.pem")

client = mqtt.Client()

def connect():
    client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
    client.tls_set(ca_certs=CA_CERT_PATH, cert_reqs=ssl.CERT_REQUIRED)
    try:
        client.connect(MQTT_BROKER, MQTT_PORT)
        print("Connected to HiveMQ Cloud broker with secure TLS!")
    except Exception as e:
        print(f"MQTT: Could not connect to broker: {e}")

def push_client_command(client_id, action, data=None):
    topic = f"client/{client_id}/command"
    payload = {"action": action}
    if data:
        payload.update(data)
    client.publish(topic, json.dumps(payload))

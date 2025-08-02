import paho.mqtt.client as mqtt
import json
import ssl
import os

# HiveMQ Cloud broker information
MQTT_BROKER = "1e5fd0288c8b4cbaa4a919bd6dd47575.s1.eu.hivemq.cloud"
MQTT_PORT = 8883
MQTT_USERNAME = "admin"
MQTT_PASSWORD = "KulVib2025info"

# Path to CA certificate
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

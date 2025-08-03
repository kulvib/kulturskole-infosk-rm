import paho.mqtt.publish as publish
import json

def push_command(client_id, command, payload=None):
    topic = f"client/{client_id}/commands"
    msg = json.dumps({"command": command, "payload": payload})
    publish.single(topic, msg, hostname="localhost")

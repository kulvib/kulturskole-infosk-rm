import paho.mqtt.client as mqtt
import json
import subprocess

def on_message(client, userdata, msg):
    schedule = json.loads(msg.payload)
    for time_str, action in schedule:
        # Planlæg handlinger med fx APScheduler eller cron
        pass

client = mqtt.Client()
client.on_message = on_message
client.connect("localhost")
client.subscribe(f"schedule/1")
client.loop_forever()

import paho.mqtt.publish as publish
import json

def publish_schedule(client_id, schedule):
    topic = f"schedule/{client_id}"
    msg = json.dumps(schedule)
    publish.single(topic, msg, hostname="localhost")

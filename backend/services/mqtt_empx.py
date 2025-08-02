import paho.mqtt.client as mqtt
import ssl
import os
import time

MQTT_BROKER = "broker.emqx.cloud"  # eller din custom EMQX Cloud endpoint
MQTT_PORT = 8883
MQTT_USER = "DIT_EMQX_BRUGERNAVN"
MQTT_PASS = "DIT_EMQX_PASSWORD"

client = mqtt.Client()
client.username_pw_set(MQTT_USER, MQTT_PASS)
client.tls_set()  # EMQX Cloud bruger standard certifikat, ingen fil nødvendig

def on_connect(client, userdata, flags, rc):
    print("Connected!", rc)
    client.subscribe("test/topic")

def on_message(client, userdata, msg):
    print(f"Modtaget: {msg.payload.decode()}")

client.on_connect = on_connect
client.on_message = on_message

client.connect(MQTT_BROKER, MQTT_PORT)
client.loop_start()
client.publish("test/topic", "Hej fra EMQX backend!")

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    client.loop_stop()
    client.disconnect()

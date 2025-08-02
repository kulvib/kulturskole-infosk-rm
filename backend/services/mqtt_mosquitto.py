import paho.mqtt.client as mqtt
import time

MQTT_BROKER = "test.mosquitto.org"
MQTT_PORT = 1883

client = mqtt.Client()

def on_connect(client, userdata, flags, rc):
    print("Connected!", rc)
    client.subscribe("test/topic")

def on_message(client, userdata, msg):
    print(f"Modtaget: {msg.payload.decode()}")

client.on_connect = on_connect
client.on_message = on_message

client.connect(MQTT_BROKER, MQTT_PORT)
client.loop_start()
client.publish("test/topic", "Hej fra Mosquitto backend!")

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    client.loop_stop()
    client.disconnect()

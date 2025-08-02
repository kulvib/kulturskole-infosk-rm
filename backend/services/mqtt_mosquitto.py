import paho.mqtt.client as mqtt

MQTT_BROKER = "test.mosquitto.org"
MQTT_PORT = 1883
MQTT_TOPIC = "test/topic"

client = mqtt.Client()

def on_connect(client, userdata, flags, rc):
    print("Connected to Mosquitto!", rc)
    client.subscribe(MQTT_TOPIC)

def on_message(client, userdata, msg):
    print(f"Modtaget besked på {msg.topic}: {msg.payload.decode()}")

client.on_connect = on_connect
client.on_message = on_message

def connect():
    print("Starter MQTT-forbindelse til Mosquitto...")
    client.connect(MQTT_BROKER, MQTT_PORT)
    client.loop_start()
    client.publish(MQTT_TOPIC, "Hej fra FastAPI backend!")  # Du kan fjerne denne linje, hvis du ikke vil sende ved opstart

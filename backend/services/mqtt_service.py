import paho.mqtt.client as mqtt
import ssl
import os

# Broker settings
MQTT_BROKER = "mqtt.flespi.io"
MQTT_PORT = 8883  # Secure, production-ready
MQTT_TOKEN = "dit_64_byte_flespi_token_her"  # Erstat med dit fulde token
CA_CERT_PATH = os.path.join(os.path.dirname(__file__), "flespi-ca.pem")  # Hent fra https://flespi.io/public/certs/CA.pem

client = mqtt.Client(protocol=mqtt.MQTTv5)  # Bruger MQTT 5.0

def connect(clean_session=True, session_expiry=0):
    # Standard authentication: username=token, password=""
    client.username_pw_set(MQTT_TOKEN, password="")

    # TLS/SSL setup
    client.tls_set(ca_certs=CA_CERT_PATH, cert_reqs=ssl.CERT_REQUIRED)
    client.tls_insecure_set(False)  # Kræv ægte CA

    # Session management (MQTT 5.0)
    connect_properties = None
    if not clean_session or session_expiry > 0:
        from paho.mqtt.properties import Properties
        from paho.mqtt.packettypes import PacketTypes
        connect_properties = Properties(PacketTypes.CONNECT)
        if session_expiry > 0:
            connect_properties.SessionExpiryInterval = session_expiry

    try:
        client.connect(
            MQTT_BROKER,
            MQTT_PORT,
            clean_start=clean_session,
            properties=connect_properties
        )
        print("Connected to Flespi MQTT broker with TLS!")
    except Exception as e:
        print(f"MQTT: Could not connect to broker: {e}")

def push_client_command(client_id, action, data=None, qos=1):
    topic = f"client/{client_id}/command"
    payload = {"action": action}
    if data:
        payload.update(data)
    client.publish(topic, json.dumps(payload), qos=qos)

# Eksempelbrug:
if __name__ == "__main__":
    connect(clean_session=True, session_expiry=0)  # Clean session, ingen session lagring
    push_client_command("testclient", "say_hello", data={"message": "hello flespi"}, qos=1)

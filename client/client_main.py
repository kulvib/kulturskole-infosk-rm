import paho.mqtt.client as mqtt
import subprocess
import json

CLIENT_ID = "123"  # sæt unikt id pr. klient
BROKER_IP = "DIN_SERVER_IP" # fx "192.168.1.2"

def on_message(client, userdata, msg):
    data = json.loads(msg.payload.decode())
    command = data["command"]
    if command == "start_chrome":
        subprocess.Popen([
            "google-chrome", "--kiosk",
            "--disable-popup-blocking",
            "--disable-infobars",
            "--user-data-dir=/tmp/chrome_profile",
            "http://kulturskolenviborg.dk"
        ])
    elif command == "shutdown_chrome":
        subprocess.call(["pkill", "chrome"])
    elif command == "refresh_chrome":
        subprocess.call(["pkill", "-SIGHUP", "chrome"])
    elif command == "shutdown":
        subprocess.call(["shutdown", "-h", "now"])

client = mqtt.Client()
client.connect(BROKER_IP)
client.subscribe(f"client/{CLIENT_ID}/commands")
client.on_message = on_message
client.loop_forever()

import json
import subprocess
from datetime import datetime, timedelta
import threading
import paho.mqtt.client as mqtt

CLIENT_UNIQUE_ID = "klient123"  # Sæt til unikt ID for klienten
MQTT_HOST = "localhost"

def run_action(action):
    print(f"Running action: {action}")
    if action == "power_on":
        pass  # evt. væk fra suspend
    elif action.startswith("start_chrome_kiosk"):
        url = action.split(":", 1)[1]
        subprocess.Popen([
            "chromium-browser", "--kiosk", "--noerrdialogs", "--disable-infobars", "--incognito", url
        ])
    elif action == "kill_chrome":
        subprocess.run(["pkill", "-f", "chromium"])
    elif action == "reboot":
        subprocess.run(["sudo", "reboot"])
    elif action == "power_off":
        subprocess.run(["sudo", "poweroff"])

def schedule_task(run_time, action):
    now = datetime.now()
    target = now.replace(hour=run_time.hour, minute=run_time.minute, second=0, microsecond=0)
    if target < now:
        target += timedelta(days=1)
    delay = (target - now).total_seconds()
    print(f"Scheduling action '{action}' at {target} (in {delay:.1f} seconds)")
    threading.Timer(delay, run_action, args=[action]).start()

def on_message(client, userdata, msg):
    print(f"Received MQTT schedule: {msg.payload}")
    try:
        schedule = json.loads(msg.payload)
        for time_str, action in schedule:
            hour, minute = map(int, time_str.split(":"))
            run_time = datetime.now().replace(hour=hour, minute=minute, second=0, microsecond=0)
            schedule_task(run_time, action)
    except Exception as e:
        print("Error in schedule:", e)

def main():
    mqttc = mqtt.Client()
    mqttc.on_message = on_message
    mqttc.connect(MQTT_HOST)
    mqttc.subscribe(f"schedule/{CLIENT_UNIQUE_ID}")
    mqttc.loop_forever()

if __name__ == "__main__":
    main()

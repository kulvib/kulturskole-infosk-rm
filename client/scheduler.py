import requests
import subprocess
import time
from datetime import datetime

CLIENT_ID = 1  # Sæt det rigtige ID!
BACKEND_URL = f"https://din-backend/api/client/{CLIENT_ID}/schedule"

def run_action(action):
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

def main():
    resp = requests.get(BACKEND_URL)
    schedule = resp.json().get("schedule", [])
    now = datetime.now()
    for time_str, action in schedule:
        action_time = datetime.strptime(time_str, "%H:%M").replace(
            year=now.year, month=now.month, day=now.day)
        wait_seconds = (action_time - now).total_seconds()
        if wait_seconds > 0:
            time.sleep(wait_seconds)
        run_action(action)

if __name__ == "__main__":
    main()

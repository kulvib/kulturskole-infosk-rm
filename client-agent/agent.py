import asyncio
import websockets
import requests
import jwt
import os
import subprocess
import time
import json
import schedule
import psutil
from datetime import datetime, timedelta
from dateutil import tz

# Konfiguration
SERVER_URL = "https://YOUR-WEBSERVER-URL"
UNIQUE_ID = "Kulturskolen Viborg_info1"  # eller _info2, osv.
HEARTBEAT_INTERVAL = 10  # sekunder
BROWSER_URL = "https://www.kulturskolenviborg.dk/infoskaerm1"
CHROME_PATH = "/usr/bin/google-chrome"
JWT_TOKEN = "din_jwt_token"

def get_local_time():
    return datetime.now(tz=tz.tzlocal())

def start_chrome_kiosk(url):
    subprocess.Popen([
        CHROME_PATH,
        "--noerrdialogs",
        "--kiosk",
        "--disable-infobars",
        "--disable-session-crashed-bubble",
        "--disable-features=TranslateUI",
        "--disable-popup-blocking",
        "--incognito",
        "--disk-cache-dir=/dev/null",
        "--start-fullscreen",
        "--autoplay-policy=no-user-gesture-required",
        url
    ])

def kill_chrome():
    subprocess.call(["pkill", "-f", "chrome"])

def refresh_chrome():
    # Brug xdotool til at sende F5 til aktivt chrome-vindue
    os.system("xdotool search --onlyvisible --class chrome windowactivate key F5")

def clear_chrome_cache():
    # Luk chrome, slet cache, genstart
    kill_chrome()
    cache_dir = os.path.expanduser('~/.cache/google-chrome/')
    if os.path.exists(cache_dir):
        subprocess.call(["rm", "-rf", cache_dir])
    start_chrome_kiosk(BROWSER_URL)

def update_system():
    subprocess.call(["sudo", "apt-get", "update"])
    subprocess.call(["sudo", "apt-get", "-y", "upgrade"])
    subprocess.call(["sudo", "fwupdmgr", "get-updates"])
    subprocess.call(["sudo", "fwupdmgr", "update"])

def reboot():
    subprocess.call(["sudo", "reboot"])

def shutdown():
    subprocess.call(["sudo", "shutdown", "now"])

def set_bios_time():
    # Sikre systemet bruger lokal tid
    subprocess.call(["timedatectl", "set-local-rtc", "1"])
    subprocess.call(["timedatectl", "set-timezone", "Europe/Copenhagen"])  # Danmark

def is_holiday():
    # Hent helligdage fra server
    try:
        r = requests.get(f"{SERVER_URL}/api/holidays?year={get_local_time().year}", headers={"Authorization": f"Bearer {JWT_TOKEN}"})
        holidays = r.json().get("holidays", [])
        today = get_local_time().date().isoformat()
        return today in holidays
    except:
        return False

def heartbeat():
    # Send heartbeat til server
    try:
        ip = requests.get('https://api.ipify.org').text
    except:
        ip = "unknown"
    data = {
        "unique_id": UNIQUE_ID,
        "ip": ip,
        "status": "online",
        "uptime": time.time() - psutil.boot_time(),
        "timestamp": get_local_time().isoformat()
    }
    try:
        requests.post(f"{SERVER_URL}/api/heartbeat", json=data, headers={"Authorization": f"Bearer {JWT_TOKEN}"})
    except Exception as e:
        print("Heartbeat error:", e)

def schedule_tasks():
    # Man-fre
    for day in range(0, 5):
        schedule.every().day.at("08:20").do(startup_sequence)
        schedule.every().day.at("08:30").do(lambda: start_chrome_kiosk(BROWSER_URL))
        schedule.every().day.at("13:30").do(kill_chrome)
        schedule.every().day.at("13:31").do(reboot)
        schedule.every().day.at("13:40").do(lambda: start_chrome_kiosk(BROWSER_URL))
        schedule.every().day.at("22:30").do(kill_chrome)
        schedule.every().day.at("22:32").do(shutdown)
    # Lør-søn
    for day in range(5, 7):
        schedule.every().day.at("08:20").do(startup_sequence)
        schedule.every().day.at("08:30").do(lambda: start_chrome_kiosk(BROWSER_URL))
        schedule.every().day.at("13:30").do(kill_chrome)
        schedule.every().day.at("13:31").do(reboot)
        schedule.every().day.at("13:40").do(lambda: start_chrome_kiosk(BROWSER_URL))
        schedule.every().day.at("18:00").do(kill_chrome)
        schedule.every().day.at("18:02").do(shutdown)
    # Opdateringer hver fredag
    schedule.every().friday.at("08:45").do(update_system)
    # Refresh hver 15. minut
    schedule.every(15).minutes.do(lambda: (clear_chrome_cache(), refresh_chrome()))
    # Heartbeat
    schedule.every(HEARTBEAT_INTERVAL).seconds.do(heartbeat)

def startup_sequence():
    set_bios_time()
    start_chrome_kiosk(BROWSER_URL)

async def websocket_listener():
    while True:
        try:
            async with websockets.connect(f"wss://YOUR-WEBSERVER-URL/ws/{UNIQUE_ID}") as ws:
                await ws.send(json.dumps({"type": "register", "id": UNIQUE_ID}))
                async for message in ws:
                    cmd = json.loads(message)
                    if cmd["action"] == "shutdown":
                        shutdown()
                    elif cmd["action"] == "reboot":
                        reboot()
                    elif cmd["action"] == "start_browser":
                        start_chrome_kiosk(BROWSER_URL)
                    elif cmd["action"] == "kill_browser":
                        kill_chrome()
        except Exception as e:
            print("WebSocket failed, fallback HTTP. Error:", e)
            await asyncio.sleep(10)

def main():
    set_bios_time()
    schedule_tasks()
    loop = asyncio.get_event_loop()
    loop.create_task(websocket_listener())
    while True:
        if not is_holiday():
            schedule.run_pending()
        else:
            kill_chrome()
        time.sleep(1)

if __name__ == "__main__":
    main()

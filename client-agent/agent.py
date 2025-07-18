import os
import time
import requests
import subprocess
from datetime import datetime

SERVER_URL = "https://<din-webserver>/api"
CLIENT_ID = "Kulturskolen Viborg_info1"

def send_heartbeat():
    try:
        requests.post(f"{SERVER_URL}/heartbeat", json={"id": CLIENT_ID})
    except Exception as e:
        print("Heartbeat fejlede:", e)

def main_loop():
    while True:
        send_heartbeat()
        # Her indsætter du logik for at styre browser, reboot/shutdown osv.
        time.sleep(10)

if __name__ == "__main__":
    main_loop()

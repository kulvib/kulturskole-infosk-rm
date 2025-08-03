import schedule
import time
import subprocess

def start_chrome():
    subprocess.Popen(["google-chrome", "--kiosk", "http://kulturskolenviborg.dk"])

def shutdown_chrome():
    subprocess.call(["pkill", "chrome"])

def shutdown_client():
    subprocess.call(["shutdown", "-h", "now"])

schedule.every().monday.at("08:05").do(start_chrome)
schedule.every().monday.at("15:55").do(shutdown_chrome)
schedule.every().monday.at("16:00").do(shutdown_client)

while True:
    schedule.run_pending()
    time.sleep(1)

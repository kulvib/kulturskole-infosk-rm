import schedule
import subprocess
import time

def update_all():
    subprocess.call(["sudo", "apt", "update"])
    subprocess.call(["sudo", "apt", "upgrade", "-y"])

schedule.every().friday.at("08:45").do(update_all)

while True:
    schedule.run_pending()
    time.sleep(60)

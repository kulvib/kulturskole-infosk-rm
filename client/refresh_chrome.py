import time
import subprocess

while True:
    time.sleep(900)  # 15 min
    subprocess.call(["pkill", "-SIGHUP", "chrome"])

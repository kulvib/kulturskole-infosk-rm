import json
import paho.mqtt.publish as publish
from datetime import datetime
from sqlmodel import select, Session
from backend.models import Client, CalendarMarking

def get_schedule_for_day(marked, weekday, kiosk_url):
    if marked != "on":
        return []
    if weekday < 5:  # Mandag-fredag
        return [
            ("08:20", "power_on"),
            ("08:30", f"start_chrome_kiosk:{kiosk_url}"),
            ("13:30", "kill_chrome"),
            ("13:32", "reboot"),
            ("13:40", f"start_chrome_kiosk:{kiosk_url}"),
            ("22:30", "kill_chrome"),
            ("22:32", "power_off"),
        ]
    else:  # Lørdag-søndag
        return [
            ("08:20", "power_on"),
            ("08:30", f"start_chrome_kiosk:{kiosk_url}"),
            ("13:30", "kill_chrome"),
            ("13:32", "reboot"),
            ("13:40", f"start_chrome_kiosk:{kiosk_url}"),
            ("18:00", "kill_chrome"),
            ("18:02", "power_off"),
        ]

def publish_schedule_for_client(client_id, session: Session, mqtt_host="localhost"):
    today = datetime.now()
    date_str = today.strftime("%Y-%m-%d")
    weekday = today.weekday()
    client = session.exec(select(Client).where(Client.id == client_id)).first()
    kiosk_url = getattr(client, "kiosk_url", None)
    calmark = session.exec(select(CalendarMarking).where(CalendarMarking.markings.has_key(date_str))).first()
    marked = calmark.markings.get(date_str, None) if calmark else None
    schedule = get_schedule_for_day(marked, weekday, kiosk_url)
    topic = f"schedule/{client.unique_id}"
    message = json.dumps(schedule)
    publish.single(topic, message, hostname=mqtt_host)

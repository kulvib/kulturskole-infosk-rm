from fastapi import APIRouter, Depends
from datetime import datetime
from sqlmodel import Session, select
from ..models import Client, CalendarMarking

router = APIRouter()

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

@router.get("/client/{client_id}/schedule")
def get_client_schedule(client_id: int, session: Session = Depends()):
    today = datetime.now()
    date_str = today.strftime("%Y-%m-%d")
    weekday = today.weekday()  # 0=Mon ... 6=Sun
    client = session.exec(select(Client).where(Client.id == client_id)).first()
    kiosk_url = client.kiosk_url if client else None
    marking = session.exec(select(CalendarMarking).where(CalendarMarking.markings.has_key(date_str))).first()
    marked = marking.markings.get(date_str, None) if marking else None
    schedule = get_schedule_for_day(marked, weekday, kiosk_url)
    return {"schedule": schedule}

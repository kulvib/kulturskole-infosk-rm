from sqlmodel import SQLModel, Field, Column, JSON
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from enum import Enum


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class ChromeAction(str, Enum):
    START = "start"
    STOP = "stop"
    RESTART = "restart"
    SHUTDOWN = "shutdown"
    SLEEP = "sleep"
    WAKEUP = "wakeup"
    NONE = "none"
    LIVESTREAM_START = "livestream_start"
    LIVESTREAM_STOP = "livestream_stop"
    OS_UPDATE = "os_update"


class School(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    weekday_on: Optional[str] = Field(default="09:00")
    weekday_off: Optional[str] = Field(default="22:30")
    weekend_on: Optional[str] = Field(default="08:00")
    weekend_off: Optional[str] = Field(default="18:00")


class SchoolSeasonTimes(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    school_id: int = Field(foreign_key="school.id", index=True)
    season: str = Field(index=True)
    weekday_on: str = Field(default="09:00")
    weekday_off: str = Field(default="22:30")
    weekend_on: str = Field(default="08:00")
    weekend_off: str = Field(default="18:00")


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str
    hashed_password: str
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
    role: str = "bruger"
    is_active: bool = True
    must_change_password: bool = True
    school_id: Optional[int] = Field(default=None, foreign_key="school.id")
    full_name: Optional[str] = None
    remarks: Optional[str] = None
    email: str

    @property
    def is_admin(self):
        return self.role in ("admin", "superadmin")

    @property
    def is_superadmin(self):
        return self.role == "superadmin"


class ClientBase(SQLModel):
    name: str
    locality: Optional[str] = None
    wifi_ip_address: Optional[str] = None
    wifi_mac_address: Optional[str] = None
    lan_ip_address: Optional[str] = None
    lan_mac_address: Optional[str] = None


class Client(ClientBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    status: Optional[str] = "pending"
    isOnline: Optional[bool] = False
    last_seen: Optional[datetime] = None
    sort_order: Optional[int] = Field(default=None, index=True)
    kiosk_url: Optional[str] = None
    ubuntu_version: Optional[str] = None
    uptime: Optional[str] = None
    created_at: Optional[datetime] = Field(default_factory=utcnow, nullable=False)
    chrome_status: Optional[str] = "unknown"
    chrome_last_updated: Optional[datetime] = None
    pending_reboot: Optional[bool] = False
    pending_shutdown: Optional[bool] = False
    chrome_color: Optional[str] = None
    pending_chrome_action: Optional[ChromeAction] = Field(default=ChromeAction.NONE)
    pending_chrome_action_source: Optional[str] = None
    school_id: Optional[int] = Field(default=None, foreign_key="school.id")
    state: Optional[str] = Field(default="normal")
    livestream_status: Optional[str] = "idle"
    livestream_last_segment: Optional[datetime] = None
    livestream_last_error: Optional[str] = None
    ubuntu_updates_available: Optional[int] = Field(default=0)
    pending_os_update: Optional[bool] = Field(default=False)


class ClientCreate(ClientBase):
    sort_order: Optional[int] = None
    kiosk_url: Optional[str] = None
    ubuntu_version: Optional[str] = None
    uptime: Optional[str] = None
    wifi_ip_address: Optional[str] = None
    wifi_mac_address: Optional[str] = None
    lan_ip_address: Optional[str] = None
    lan_mac_address: Optional[str] = None
    chrome_status: Optional[str] = None
    chrome_color: Optional[str] = None
    pending_chrome_action: Optional[ChromeAction] = ChromeAction.NONE
    pending_chrome_action_source: Optional[str] = None
    school_id: Optional[int] = None
    state: Optional[str] = Field(default="normal")
    ubuntu_updates_available: Optional[int] = 0
    pending_os_update: Optional[bool] = False


class ClientUpdate(SQLModel):
    locality: Optional[str] = None
    sort_order: Optional[int] = None
    kiosk_url: Optional[str] = None
    ubuntu_version: Optional[str] = None
    uptime: Optional[str] = None
    wifi_ip_address: Optional[str] = None
    wifi_mac_address: Optional[str] = None
    lan_ip_address: Optional[str] = None
    lan_mac_address: Optional[str] = None
    pending_reboot: Optional[bool] = None
    pending_shutdown: Optional[bool] = None
    chrome_status: Optional[str] = None
    chrome_last_updated: Optional[datetime] = None
    chrome_color: Optional[str] = None
    last_seen: Optional[datetime] = None
    created_at: Optional[datetime] = None
    pending_chrome_action: Optional[ChromeAction] = None
    pending_chrome_action_source: Optional[str] = None
    school_id: Optional[int] = None
    state: Optional[str] = None
    livestream_status: Optional[str] = None
    livestream_last_segment: Optional[datetime] = None
    livestream_last_error: Optional[str] = None
    ubuntu_updates_available: Optional[int] = None
    pending_os_update: Optional[bool] = None


class CalendarMarking(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    season: str = Field(index=True)
    client_id: int = Field(index=True)
    markings: Dict[str, Any] = Field(sa_column=Column(JSON))


class Holiday(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: str = Field(index=True)
    description: Optional[str] = None


class SchoolCreate(SQLModel):
    name: str
    weekday_on: Optional[str] = Field(default="09:00")
    weekday_off: Optional[str] = Field(default="22:30")
    weekend_on: Optional[str] = Field(default="08:00")
    weekend_off: Optional[str] = Field(default="18:00")

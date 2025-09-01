from sqlmodel import SQLModel, Field, Column, JSON
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

# Enum til Chrome kommandoer/handlinger
class ChromeAction(str, Enum):
    START = "start"
    STOP = "stop"
    RESTART = "restart"
    SHUTDOWN = "shutdown"
    NONE = "none"

# Skole-tabellen (reference for client.school_id)
class School(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)

# Bruger-tabellen (admin, m.fl.)
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str
    hashed_password: str
    role: str = "admin"
    is_active: bool = True

# Fælles base for klient (bruges til oprettelse og opdatering)
class ClientBase(SQLModel):
    name: str
    locality: Optional[str] = None
    wifi_ip_address: Optional[str] = None
    wifi_mac_address: Optional[str] = None
    lan_ip_address: Optional[str] = None
    lan_mac_address: Optional[str] = None

# Klient-tabellen (hovedmodel)
class Client(ClientBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    status: Optional[str] = "pending"
    isOnline: Optional[bool] = False
    last_seen: Optional[datetime] = None
    sort_order: Optional[int] = Field(default=None, index=True)
    kiosk_url: Optional[str] = None
    ubuntu_version: Optional[str] = None
    uptime: Optional[str] = None
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow, nullable=False)
    chrome_status: Optional[str] = "unknown"
    chrome_last_updated: Optional[datetime] = None
    pending_reboot: Optional[bool] = False
    pending_shutdown: Optional[bool] = False
    chrome_color: Optional[str] = None
    pending_chrome_action: Optional[ChromeAction] = Field(default=ChromeAction.NONE)
    school_id: Optional[int] = Field(default=None, foreign_key="school.id")
    state: Optional[str] = Field(
        default="normal",
        description="Driftstilstand: normal, sleep, wakeup, shutdown, error"
    )

# Til oprettelse af klient
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
    school_id: Optional[int] = None
    state: Optional[str] = Field(default="normal")

# Til opdatering af klient
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
    pending_chrome_action: Optional[ChromeAction] = None
    school_id: Optional[int] = None
    state: Optional[str] = None

# Kalendermarkering (fx ferie/vinter/sommer for klienten)
class CalendarMarking(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    season: int = Field(index=True)
    client_id: int = Field(index=True)
    markings: Dict[str, Any] = Field(sa_column=Column(JSON))

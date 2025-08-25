from sqlmodel import SQLModel, Field, Column, JSON
from typing import Optional, Dict, Any
from datetime import datetime

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str
    hashed_password: str
    role: str = "admin"
    is_active: bool = True

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
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow, nullable=False)
    chrome_status: Optional[str] = "unknown"  # 'running', 'stopped', 'unknown'
    chrome_last_updated: Optional[datetime] = None
    pending_reboot: Optional[bool] = False
    pending_shutdown: Optional[bool] = False
    chrome_color: Optional[str] = None
    pending_chrome_action: Optional[str] = None  # <-- NYT FELT! Kommando fra backend

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
    pending_chrome_action: Optional[str] = None  # <-- NYT FELT FOR CREATE

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
    pending_chrome_action: Optional[str] = None  # <-- NYT FELT!

class CalendarMarking(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    season: int = Field(index=True)
    client_id: int = Field(index=True)
    markings: Dict[str, Any] = Field(sa_column=Column(JSON))

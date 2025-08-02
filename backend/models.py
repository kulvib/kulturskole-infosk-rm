from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str
    hashed_password: str
    role: str = "admin"
    is_active: bool = True

class ClientBase(SQLModel):
    name: str
    unique_id: str
    locality: str
    ip_address: str
    mac_address: str

class Client(ClientBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    status: str = "pending"
    isOnline: bool = False
    last_seen: Optional[datetime] = None
    sort_order: Optional[int] = Field(default=None, index=True)
    kiosk_url: Optional[str] = None
    ubuntu_version: Optional[str] = None
    uptime: Optional[str] = None

class ClientCreate(ClientBase):
    sort_order: Optional[int] = None

class ClientUpdate(SQLModel):
    locality: Optional[str] = None
    sort_order: Optional[int] = None
    kiosk_url: Optional[str] = None
    ubuntu_version: Optional[str] = None
    uptime: Optional[str] = None

class MqttMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    topic: str
    payload: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Holiday(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: str
    description: str

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
    sort_order: Optional[int] = Field(default=None, index=True)  # <-- NYT FELT

class ClientCreate(ClientBase):
    sort_order: Optional[int] = None   # <-- Mulighed for at sætte ved oprettelse

class ClientUpdate(SQLModel):
    locality: Optional[str] = None
    sort_order: Optional[int] = None   # <-- Mulighed for at opdatere sort_order

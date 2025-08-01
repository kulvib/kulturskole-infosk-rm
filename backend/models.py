from typing import Optional
from sqlmodel import SQLModel, Field

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

class ClientCreate(ClientBase):
    pass

class ClientUpdate(SQLModel):
    locality: Optional[str] = None

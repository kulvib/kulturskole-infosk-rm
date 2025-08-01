from sqlmodel import SQLModel, Field
from typing import Optional

class Client(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: Optional[str]
    unique_id: Optional[str]
    locality: Optional[str]
    status: str = "pending"
    ip_address: Optional[str]
    mac_address: Optional[str]
    isOnline: Optional[bool] = False

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str
    hashed_password: str
    role: str = "user"
    is_active: bool = True

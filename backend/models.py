from sqlmodel import SQLModel, Field
from typing import Optional

class Client(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: Optional[str]
    unique_id: Optional[str]
    locality: Optional[str]
    status: str = "pending"       # "pending" eller "approved"
    ip_address: Optional[str]
    mac_address: Optional[str]
    isOnline: Optional[bool] = False

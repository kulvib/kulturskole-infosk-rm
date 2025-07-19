from pydantic import BaseModel
from typing import Optional

class ClientBase(BaseModel):
    id: str
    name: str
    display_name: Optional[str] = None
    web_addr: Optional[str] = None
    ip: Optional[str] = None
    version: Optional[str] = None
    last_seen: Optional[str] = None
    uptime: Optional[str] = None
    online: Optional[bool] = False
    status: Optional[str] = "pending"

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    display_name: Optional[str] = None
    web_addr: Optional[str] = None

class ClientStatus(BaseModel):
    ip: Optional[str]
    version: Optional[str]
    last_seen: Optional[str]
    uptime: Optional[str]
    online: Optional[bool]

class ClientApprove(BaseModel):
    display_name: Optional[str]

class ClientAction(BaseModel):
    action: str

class ClientOut(ClientBase):
    class Config:
        orm_mode = True

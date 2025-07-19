from pydantic import BaseModel

class ClientBase(BaseModel):
    id: str
    name: str
    display_name: str
    web_addr: str

class ClientCreate(ClientBase):
    pass

class ClientOut(ClientBase):
    class Config:
        orm_mode = True

from sqlalchemy import Column, String
from .database import Base

class Client(Base):
    __tablename__ = "clients"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    display_name = Column(String, index=True)
    web_addr = Column(String)

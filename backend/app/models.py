from sqlalchemy import Column, String, Boolean
from .database import Base

class Client(Base):
    __tablename__ = "clients"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    display_name = Column(String)
    web_addr = Column(String)
    ip = Column(String, nullable=True)
    version = Column(String, nullable=True)
    last_seen = Column(String, nullable=True)
    uptime = Column(String, nullable=True)
    online = Column(Boolean, default=False)
    status = Column(String, default="pending")  # 'pending' eller 'approved'

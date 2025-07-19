from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Client(Base):
    __tablename__ = "clients"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    display_name = Column(String, nullable=True)
    web_addr = Column(String, nullable=True)
    ip = Column(String, nullable=True)
    version = Column(String, nullable=True)
    last_seen = Column(String, nullable=True)
    uptime = Column(String, nullable=True)
    online = Column(Boolean, default=False)
    status = Column(String, default="pending")

    actions = relationship("Action", back_populates="client")

class Action(Base):
    __tablename__ = "actions"
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(String, ForeignKey("clients.id"))
    action = Column(String, nullable=False)
    parameters = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    executed = Column(Boolean, default=False)
    executed_at = Column(DateTime, nullable=True)

    client = relationship("Client", back_populates="actions")

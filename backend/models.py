from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base
import datetime

Base = declarative_base()

class AdminUser(Base):
    __tablename__ = 'admin_users'
    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)

class Client(Base):
    __tablename__ = 'clients'
    id = Column(Integer, primary_key=True)
    unique_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, default="")
    location = Column(String, default="")
    status = Column(String, default="pending")
    last_seen = Column(DateTime)
    ip_address = Column(String, default="")
    sw_version = Column(String, default="")
    mac_address = Column(String, default="")
    uptime = Column(Integer, default=0)
    kiosk_url = Column(String, default="")
    is_online = Column(Boolean, default=False)

class Heartbeat(Base):
    __tablename__ = 'heartbeats'
    id = Column(Integer, primary_key=True)
    client_id = Column(Integer, ForeignKey('clients.id'))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    method = Column(String)

class Holiday(Base):
    __tablename__ = 'holidays'
    id = Column(Integer, primary_key=True)
    date = Column(DateTime, unique=True, nullable=False)
    description = Column(String, default="")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.models import Base

DATABASE_URL = "sqlite:///./infoskaerm.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Init DB when this module is imported
init_db()

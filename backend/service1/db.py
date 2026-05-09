from sqlmodel import SQLModel, create_engine, Session
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///database.db")

# echo=False i produktion - undgår at printe SQL + data i logs
engine = create_engine(
    DATABASE_URL,
    echo=os.getenv("ENVIRONMENT") != "production"
)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

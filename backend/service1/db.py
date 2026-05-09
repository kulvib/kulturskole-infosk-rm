from sqlmodel import SQLModel, create_engine, Session
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///database.db")

# echo=True kun i udvikling — aldrig i produktion (printer SQL + data i logs)
_echo = os.getenv("ENVIRONMENT", "production") != "production"

engine = create_engine(DATABASE_URL, echo=_echo)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session

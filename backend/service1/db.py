from sqlmodel import SQLModel, create_engine, Session
import os
import sys
import warnings
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///database.db")

# Advar ved SQLite med flere workers — ikke trådsikkert under samtidige skrivninger
if DATABASE_URL.startswith("sqlite"):
    # Detekter --workers argument (fx fra uvicorn)
    try:
        workers_arg = sys.argv[sys.argv.index("--workers") + 1] if "--workers" in sys.argv else "1"
        num_workers = int(workers_arg)
    except (ValueError, IndexError):
        num_workers = 1
    if num_workers > 1:
        warnings.warn(
            "ADVARSEL: SQLite er ikke sikkert med flere workers (--workers > 1). "
            "Brug DATABASE_URL til en PostgreSQL-database i produktion.",
            RuntimeWarning,
            stacklevel=2,
        )

# echo=True kun i udvikling — aldrig i produktion (printer SQL + data i logs)
_echo = os.getenv("ENVIRONMENT", "production") != "production"

engine = create_engine(DATABASE_URL, echo=_echo)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session

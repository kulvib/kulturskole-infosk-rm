from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import inspect, text
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
    with engine.begin() as conn:
        inspector = inspect(conn)
        try:
            user_columns = {column["name"] for column in inspector.get_columns("user")}
        except Exception:
            user_columns = set()
        if "must_change_password" not in user_columns:
            if engine.dialect.name == "postgresql":
                conn.execute(
                    text('ALTER TABLE "user" ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE')
                )
            else:
                conn.execute(
                    text("ALTER TABLE user ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT 0")
                )


def get_session():
    with Session(engine) as session:
        yield session

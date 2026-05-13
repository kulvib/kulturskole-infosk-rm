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
        if "created_at" not in user_columns:
            # NB: Eksisterende rækker får migrationstidspunktet som created_at.
            # Historisk oprettelsestid findes ikke i legacy-skemaet; dette er
            # acceptabelt, da feltet bruges til visning og ikke revisionsspor.
            if engine.dialect.name == "postgresql":
                conn.execute(
                    text('ALTER TABLE "user" ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT NOW()')
                )
            else:
                conn.execute(
                    text("ALTER TABLE user ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")
                )

        try:
            client_columns = {column["name"] for column in inspector.get_columns("client")}
        except Exception:
            client_columns = set()
        if "state" not in client_columns:
            conn.execute(text("ALTER TABLE client ADD COLUMN state TEXT DEFAULT 'normal'"))
        if "pending_chrome_action_source" not in client_columns:
            conn.execute(text("ALTER TABLE client ADD COLUMN pending_chrome_action_source TEXT"))
        if "livestream_status" not in client_columns:
            conn.execute(text("ALTER TABLE client ADD COLUMN livestream_status TEXT DEFAULT 'idle'"))
        if "livestream_last_segment" not in client_columns:
            conn.execute(text("ALTER TABLE client ADD COLUMN livestream_last_segment TIMESTAMP"))
        if "livestream_last_error" not in client_columns:
            conn.execute(text("ALTER TABLE client ADD COLUMN livestream_last_error TEXT"))


def get_session():
    with Session(engine) as session:
        yield session

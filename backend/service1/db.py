from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import inspect, text
import os
import sys
import warnings
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///database.db")

if DATABASE_URL.startswith("sqlite"):
    try:
        workers_arg = sys.argv[sys.argv.index("--workers") + 1] if "--workers" in sys.argv else "1"
        num_workers = int(workers_arg)
    except (ValueError, IndexError):
        num_workers = 1
    if num_workers > 1:
        warnings.warn(
            "ADVARSEL: SQLite er ikke sikkert med flere workers. "
            "Brug PostgreSQL i produktion.",
            RuntimeWarning, stacklevel=2,
        )

_echo = os.getenv("ENVIRONMENT", "production") != "production"
engine = create_engine(DATABASE_URL, echo=_echo)


def _migrate_seasons_to_string(conn):
    """
    Migrerer season-kolonner fra integer (2025) til string-format ('2025/2026').
    Kører sikkert hvis migrationen allerede er udført.
    """
    dialect = engine.dialect.name

    for table in ["calendarmarking", "schoolseasontimes"]:
        try:
            if dialect == "postgresql":
                # Tjek om kolonnen stadig er integer-type
                result = conn.execute(text("""
                    SELECT data_type FROM information_schema.columns
                    WHERE table_name = :tbl AND column_name = 'season'
                """), {"tbl": table}).fetchone()

                if result and result[0] in ("integer", "bigint", "smallint"):
                    # Konvertér kolonnetype og værdier i ét step
                    conn.execute(text(f"""
                        ALTER TABLE {table}
                        ALTER COLUMN season TYPE VARCHAR
                        USING (season::text || '/' || (season + 1)::text)
                    """))
                    print(f"[DB] Migreret {table}.season int→string (PostgreSQL)")

            else:
                # SQLite — tjek om der er værdier uden '/'
                result = conn.execute(text(
                    f"SELECT COUNT(*) FROM {table} "
                    f"WHERE CAST(season AS TEXT) NOT LIKE '%/%'"
                )).fetchone()

                if result and result[0] > 0:
                    conn.execute(text(f"""
                        UPDATE {table}
                        SET season =
                            CAST(CAST(season AS INTEGER) AS TEXT) || '/' ||
                            CAST(CAST(season AS INTEGER) + 1 AS TEXT)
                        WHERE CAST(season AS TEXT) NOT LIKE '%/%'
                    """))
                    print(f"[DB] Migreret {table}.season int→string (SQLite)")

        except Exception as e:
            # Tabellen eksisterer måske ikke endnu — det er OK
            print(f"[DB] Season-migration info for {table}: {e}")


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

    with engine.begin() as conn:
        inspector = inspect(conn)

        # --- User-kolonner ---
        try:
            user_columns = {col["name"] for col in inspector.get_columns("user")}
        except Exception:
            user_columns = set()

        if "must_change_password" not in user_columns:
            if engine.dialect.name == "postgresql":
                conn.execute(text(
                    'ALTER TABLE "user" ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE'
                ))
            else:
                conn.execute(text(
                    "ALTER TABLE user ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT 0"
                ))

        if "created_at" not in user_columns:
            if engine.dialect.name == "postgresql":
                conn.execute(text(
                    'ALTER TABLE "user" ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT NOW()'
                ))
            else:
                conn.execute(text(
                    "ALTER TABLE user ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
                ))

        # --- Client-kolonner ---
        try:
            client_columns = {col["name"] for col in inspector.get_columns("client")}
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

        # --- Migrér season int → string ---
        _migrate_seasons_to_string(conn)


def get_session():
    with Session(engine) as session:
        yield session

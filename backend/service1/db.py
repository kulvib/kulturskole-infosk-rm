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
            "Brug DATABASE_URL til PostgreSQL i produktion.",
            RuntimeWarning, stacklevel=2,
        )

_echo = os.getenv("ENVIRONMENT", "production") != "production"
engine = create_engine(DATABASE_URL, echo=_echo)


def migrate_seasons_to_string():
    """
    Migrerer season-værdier fra integer (2025) til string ("2025/2026").
    Kører sikkert flere gange — springer over hvis allerede migreret.
    """
    try:
        with engine.begin() as conn:
            if engine.dialect.name == "postgresql":
                # CalendarMarking
                result = conn.execute(text("""
                    SELECT data_type FROM information_schema.columns
                    WHERE table_name = 'calendarmarking'
                      AND column_name = 'season'
                      AND table_schema = 'public'
                """)).first()
                if result and result[0] in ('integer', 'bigint', 'smallint'):
                    conn.execute(text("""
                        ALTER TABLE calendarmarking
                        ALTER COLUMN season TYPE TEXT
                        USING season::text || '/' || (season + 1)::text
                    """))
                    print("Migration: calendarmarking.season INTEGER → TEXT")
                else:
                    # Allerede TEXT — konvertér eventuelle rene tal-værdier
                    conn.execute(text(r"""
                        UPDATE calendarmarking
                        SET season = season || '/' || (season::integer + 1)::text
                        WHERE season ~ '^\d+$'
                    """))

                # SchoolSeasonTimes
                result2 = conn.execute(text("""
                    SELECT data_type FROM information_schema.columns
                    WHERE table_name = 'schoolseasontimes'
                      AND column_name = 'season'
                      AND table_schema = 'public'
                """)).first()
                if result2 and result2[0] in ('integer', 'bigint', 'smallint'):
                    conn.execute(text("""
                        ALTER TABLE schoolseasontimes
                        ALTER COLUMN season TYPE TEXT
                        USING season::text || '/' || (season + 1)::text
                    """))
                    print("Migration: schoolseasontimes.season INTEGER → TEXT")
                else:
                    conn.execute(text(r"""
                        UPDATE schoolseasontimes
                        SET season = season || '/' || (season::integer + 1)::text
                        WHERE season ~ '^\d+$'
                    """))
            else:
                # SQLite: dynamisk typning — UPDATE til string-format
                conn.execute(text("""
                    UPDATE calendarmarking
                    SET season = CAST(CAST(season AS INTEGER) AS TEXT)
                        || '/' ||
                        CAST(CAST(season AS INTEGER) + 1 AS TEXT)
                    WHERE season NOT LIKE '%/%'
                """))
                conn.execute(text("""
                    UPDATE schoolseasontimes
                    SET season = CAST(CAST(season AS INTEGER) AS TEXT)
                        || '/' ||
                        CAST(CAST(season AS INTEGER) + 1 AS TEXT)
                    WHERE season NOT LIKE '%/%'
                """))
                print("Migration: season-værdier konverteret til '2025/2026' format")
    except Exception as e:
        print(f"Season migration (ikke kritisk): {e}")


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

    with engine.begin() as conn:
        inspector = inspect(conn)

        # --- User migrationer ---
        try:
            user_columns = {c["name"] for c in inspector.get_columns("user")}
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

        # --- Client migrationer ---
        try:
            client_columns = {c["name"] for c in inspector.get_columns("client")}
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

    # Kør season-migration efter tabeller er oprettet/verificeret
    migrate_seasons_to_string()


def get_session():
    with Session(engine) as session:
        yield session

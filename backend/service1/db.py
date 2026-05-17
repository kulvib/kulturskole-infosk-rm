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

        def _add_client_column_if_missing(name: str, ddl: str) -> None:
            """Idempotent letvægtsmigration for eksisterende Render/SQLite databaser.

            SQLModel.create_all() opretter kun nye tabeller; den tilføjer ikke
            nye kolonner til en eksisterende tabel. Klientkoden forventer alle
            felterne nedenfor, så manglende kolonner kan få /api/clients/... til
            at fejle med "no such column".
            """
            nonlocal client_columns
            if name in client_columns:
                return
            try:
                conn.execute(text(f"ALTER TABLE client ADD COLUMN {name} {ddl}"))
                client_columns.add(name)
                print(f"[DB] Tilføjede client.{name}")
            except Exception as e:
                print(f"[DB] Migration info for client.{name}: {e}")

        bool_default_false = "BOOLEAN NOT NULL DEFAULT FALSE" if engine.dialect.name == "postgresql" else "BOOLEAN NOT NULL DEFAULT 0"
        bool_nullable_false = "BOOLEAN DEFAULT FALSE" if engine.dialect.name == "postgresql" else "BOOLEAN DEFAULT 0"

        # Hold denne liste synkroniseret med models.Client.
        _add_client_column_if_missing("locality", "TEXT")
        _add_client_column_if_missing("wifi_ip_address", "TEXT")
        _add_client_column_if_missing("wifi_mac_address", "TEXT")
        _add_client_column_if_missing("lan_ip_address", "TEXT")
        _add_client_column_if_missing("lan_mac_address", "TEXT")
        _add_client_column_if_missing("status", "TEXT DEFAULT 'pending'")
        _add_client_column_if_missing("isOnline", bool_nullable_false)
        _add_client_column_if_missing("last_seen", "TIMESTAMP")
        _add_client_column_if_missing("sort_order", "INTEGER")
        _add_client_column_if_missing("kiosk_url", "TEXT")
        _add_client_column_if_missing("ubuntu_version", "TEXT")
        _add_client_column_if_missing("uptime", "TEXT")
        _add_client_column_if_missing("created_at", "TIMESTAMP")
        _add_client_column_if_missing("chrome_status", "TEXT DEFAULT 'unknown'")
        _add_client_column_if_missing("chrome_last_updated", "TIMESTAMP")
        _add_client_column_if_missing("pending_reboot", bool_nullable_false)
        _add_client_column_if_missing("pending_shutdown", bool_nullable_false)
        _add_client_column_if_missing("chrome_color", "TEXT")
        _add_client_column_if_missing("chrome_step", "TEXT")
        _add_client_column_if_missing("pending_chrome_action", "TEXT DEFAULT 'none'")
        _add_client_column_if_missing("pending_chrome_action_source", "TEXT")
        _add_client_column_if_missing("school_id", "INTEGER")
        _add_client_column_if_missing("state", "TEXT DEFAULT 'normal'")
        _add_client_column_if_missing("livestream_status", "TEXT DEFAULT 'idle'")
        _add_client_column_if_missing("livestream_last_segment", "TIMESTAMP")
        _add_client_column_if_missing("livestream_last_error", "TEXT")
        _add_client_column_if_missing("ubuntu_updates_available", "INTEGER DEFAULT 0")
        _add_client_column_if_missing("pending_os_update", bool_default_false)

        # --- Migrér season int → string ---
        _migrate_seasons_to_string(conn)


def get_session():
    with Session(engine) as session:
        yield session

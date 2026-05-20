from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import inspect, text
from sqlalchemy.pool import StaticPool
import os
import sys
import warnings
from dotenv import load_dotenv

load_dotenv()


def _env_int(name: str, default: int, *, min_value: int | None = None) -> int:
    """Læs integer fra miljøvariabel med sikker fallback."""
    raw = os.getenv(name)
    if raw is None or str(raw).strip() == "":
        return default
    try:
        value = int(str(raw).strip())
    except (TypeError, ValueError):
        warnings.warn(
            f"[DB] Ugyldig værdi for {name}={raw!r}; bruger default {default}",
            RuntimeWarning,
            stacklevel=2,
        )
        return default
    if min_value is not None and value < min_value:
        warnings.warn(
            f"[DB] {name}={value} er under minimum {min_value}; bruger {min_value}",
            RuntimeWarning,
            stacklevel=2,
        )
        return min_value
    return value


def _normalize_database_url(url: str) -> str:
    """
    Render/Heroku-lignende miljøer kan levere postgres://.
    SQLAlchemy forventer normalt postgresql://.
    """
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://"):]
    return url


DATABASE_URL = _normalize_database_url(os.getenv("DATABASE_URL", "sqlite:///database.db"))
IS_SQLITE = DATABASE_URL.startswith("sqlite")

if IS_SQLITE:
    try:
        workers_arg = sys.argv[sys.argv.index("--workers") + 1] if "--workers" in sys.argv else "1"
        num_workers = int(workers_arg)
    except (ValueError, IndexError):
        num_workers = 1
    if num_workers > 1:
        warnings.warn(
            "ADVARSEL: SQLite er ikke sikkert med flere workers. "
            "Brug PostgreSQL i produktion.",
            RuntimeWarning,
            stacklevel=2,
        )

_echo = os.getenv("ENVIRONMENT", "production") != "production"

# ---------------------------------------------------------------------------
# Engine / connection pool
# ---------------------------------------------------------------------------
# Din Render-fejl viste SQLAlchemy standard-poolen:
#   QueuePool limit of size 5 overflow 10 reached
# Derfor konfigurerer vi poolen eksplicit via Render Environment.
#
# Anbefalet start for Neon Free:
#   DB_POOL_SIZE=5
#   DB_MAX_OVERFLOW=2
#   DB_POOL_TIMEOUT=20
#   DB_POOL_RECYCLE=300
#
# Det betyder højst 7 samtidige DB-forbindelser fra denne backend-instans.
# Det begrænser ikke antallet af klienter; det begrænser kun samtidige DB-kald.
# ---------------------------------------------------------------------------
engine_kwargs: dict = {
    "echo": _echo,
}

if IS_SQLITE:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    # Gør in-memory SQLite stabil ved tests; almindelig file-SQLite påvirkes ikke negativt.
    if DATABASE_URL in {"sqlite://", "sqlite:///:memory:"}:
        engine_kwargs["poolclass"] = StaticPool
else:
    engine_kwargs.update({
        "pool_size": _env_int("DB_POOL_SIZE", 5, min_value=1),
        "max_overflow": _env_int("DB_MAX_OVERFLOW", 2, min_value=0),
        "pool_timeout": _env_int("DB_POOL_TIMEOUT", 20, min_value=1),
        "pool_recycle": _env_int("DB_POOL_RECYCLE", 300, min_value=30),
        # Tjekker forbindelsen før genbrug, så døde Neon/Render connections ikke giver fejl.
        "pool_pre_ping": True,
        # LIFO genbruger varme forbindelser og lader ældre forbindelser lukke/recycles.
        "pool_use_lifo": True,
    })

engine = create_engine(DATABASE_URL, **engine_kwargs)


def get_pool_status() -> dict:
    """Lille helper til health endpoint/debug. Eksponerer ikke credentials."""
    pool = getattr(engine, "pool", None)
    status_text = None
    try:
        status_text = pool.status() if pool is not None and hasattr(pool, "status") else None
    except Exception as e:
        status_text = f"Kunne ikke læse pool status: {e}"

    return {
        "dialect": engine.dialect.name,
        "database_url_set": bool(DATABASE_URL),
        "is_sqlite": IS_SQLITE,
        "pool_class": pool.__class__.__name__ if pool is not None else None,
        "pool_status": status_text,
        "configured_pool_size": None if IS_SQLITE else engine_kwargs.get("pool_size"),
        "configured_max_overflow": None if IS_SQLITE else engine_kwargs.get("max_overflow"),
        "configured_pool_timeout": None if IS_SQLITE else engine_kwargs.get("pool_timeout"),
        "configured_pool_recycle": None if IS_SQLITE else engine_kwargs.get("pool_recycle"),
        "pool_pre_ping": None if IS_SQLITE else engine_kwargs.get("pool_pre_ping"),
        "pool_use_lifo": None if IS_SQLITE else engine_kwargs.get("pool_use_lifo"),
    }


def check_db_connection() -> bool:
    """Simpel DB healthcheck."""
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return True


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


def _add_column_if_missing(conn, table: str, existing_columns: set[str], column_name: str, ddl: str) -> None:
    """Idempotent kolonne-migration."""
    if column_name not in existing_columns:
        conn.execute(text(ddl))
        existing_columns.add(column_name)
        print(f"[DB] Tilføjede {table}.{column_name}")


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
            user_columns.add("must_change_password")

        if "created_at" not in user_columns:
            if engine.dialect.name == "postgresql":
                conn.execute(text(
                    'ALTER TABLE "user" ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT NOW()'
                ))
            else:
                conn.execute(text(
                    "ALTER TABLE user ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
                ))
            user_columns.add("created_at")

        # --- Client-kolonner ---
        try:
            client_columns = {col["name"] for col in inspector.get_columns("client")}
        except Exception:
            client_columns = set()

        _add_column_if_missing(
            conn, "client", client_columns, "state",
            "ALTER TABLE client ADD COLUMN state TEXT DEFAULT 'normal'",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "pending_chrome_action_source",
            "ALTER TABLE client ADD COLUMN pending_chrome_action_source TEXT",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "livestream_status",
            "ALTER TABLE client ADD COLUMN livestream_status TEXT DEFAULT 'idle'",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "livestream_last_segment",
            "ALTER TABLE client ADD COLUMN livestream_last_segment TIMESTAMP",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "livestream_last_error",
            "ALTER TABLE client ADD COLUMN livestream_last_error TEXT",
        )

        # --- Fysisk display-opløsning på klienten ---
        _add_column_if_missing(
            conn, "client", client_columns, "display_resolution_preset",
            "ALTER TABLE client ADD COLUMN display_resolution_preset TEXT DEFAULT 'auto'",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "display_resolution_mode",
            "ALTER TABLE client ADD COLUMN display_resolution_mode TEXT DEFAULT 'auto'",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "display_resolution_width",
            "ALTER TABLE client ADD COLUMN display_resolution_width INTEGER",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "display_resolution_height",
            "ALTER TABLE client ADD COLUMN display_resolution_height INTEGER",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "display_resolution_refresh_rate",
            "ALTER TABLE client ADD COLUMN display_resolution_refresh_rate FLOAT",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "display_resolution_rotation",
            "ALTER TABLE client ADD COLUMN display_resolution_rotation TEXT DEFAULT 'normal'",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "display_resolution_updated_at",
            "ALTER TABLE client ADD COLUMN display_resolution_updated_at TIMESTAMP",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "display_resolution_current_output",
            "ALTER TABLE client ADD COLUMN display_resolution_current_output TEXT",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "display_resolution_current_width",
            "ALTER TABLE client ADD COLUMN display_resolution_current_width INTEGER",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "display_resolution_current_height",
            "ALTER TABLE client ADD COLUMN display_resolution_current_height INTEGER",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "display_resolution_current_refresh_rate",
            "ALTER TABLE client ADD COLUMN display_resolution_current_refresh_rate FLOAT",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "display_resolution_status",
            "ALTER TABLE client ADD COLUMN display_resolution_status TEXT DEFAULT 'unknown'",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "display_resolution_error",
            "ALTER TABLE client ADD COLUMN display_resolution_error TEXT",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "display_resolution_last_applied_at",
            "ALTER TABLE client ADD COLUMN display_resolution_last_applied_at TIMESTAMP",
        )

        # --- Enrollment/client-secret kolonner ---
        # SQLModel.metadata.create_all() opretter nye tabeller, men den tilføjer
        # ikke nye kolonner til eksisterende tabeller. Derfor skal eksisterende
        # Render/PostgreSQL databaser migreres manuelt her.
        _add_column_if_missing(
            conn, "client", client_columns, "client_secret_hash",
            "ALTER TABLE client ADD COLUMN client_secret_hash TEXT",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "client_secret_created_at",
            "ALTER TABLE client ADD COLUMN client_secret_created_at TIMESTAMP",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "client_secret_revoked_at",
            "ALTER TABLE client ADD COLUMN client_secret_revoked_at TIMESTAMP",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "enrollment_token_id",
            "ALTER TABLE client ADD COLUMN enrollment_token_id INTEGER",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "machine_id",
            "ALTER TABLE client ADD COLUMN machine_id TEXT",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "kiosk_url",
            "ALTER TABLE client ADD COLUMN kiosk_url TEXT",
        )

        # Disse kolonner findes typisk allerede hos dig, men beholdes her så
        # clean installs/ældre databaser ikke fejler ved enrollment claim.
        _add_column_if_missing(
            conn, "client", client_columns, "ubuntu_updates_available",
            "ALTER TABLE client ADD COLUMN ubuntu_updates_available INTEGER DEFAULT 0",
        )

        if "pending_os_update" not in client_columns:
            if engine.dialect.name == "postgresql":
                conn.execute(text("ALTER TABLE client ADD COLUMN pending_os_update BOOLEAN DEFAULT FALSE"))
            else:
                conn.execute(text("ALTER TABLE client ADD COLUMN pending_os_update BOOLEAN DEFAULT 0"))
            client_columns.add("pending_os_update")
            print("[DB] Tilføjede client.pending_os_update")

        # --- ClientFlow self-update status kolonner ---
        _add_column_if_missing(
            conn, "client", client_columns, "client_version",
            "ALTER TABLE client ADD COLUMN client_version TEXT",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "client_update_status",
            "ALTER TABLE client ADD COLUMN client_update_status TEXT DEFAULT 'ready'",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "client_update_message",
            "ALTER TABLE client ADD COLUMN client_update_message TEXT",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "client_update_requested_at",
            "ALTER TABLE client ADD COLUMN client_update_requested_at TIMESTAMP",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "client_update_started_at",
            "ALTER TABLE client ADD COLUMN client_update_started_at TIMESTAMP",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "client_update_finished_at",
            "ALTER TABLE client ADD COLUMN client_update_finished_at TIMESTAMP",
        )
        _add_column_if_missing(
            conn, "client", client_columns, "client_update_error",
            "ALTER TABLE client ADD COLUMN client_update_error TEXT",
        )

        # --- Migrér season int → string ---
        _migrate_seasons_to_string(conn)


def get_session():
    """
    FastAPI dependency.

    with Session(engine) sikrer, at DB-forbindelsen altid afleveres tilbage
    til SQLAlchemy poolen — også hvis endpointet fejler med en exception.
    """
    with Session(engine) as session:
        yield session

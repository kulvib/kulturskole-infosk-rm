from sqlmodel import SQLModel, Field, Column, JSON
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from enum import Enum


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class ChromeAction(str, Enum):
    START = "start"
    STOP = "stop"
    RESTART = "restart"
    SHUTDOWN = "shutdown"
    SLEEP = "sleep"
    WAKEUP = "wakeup"
    NONE = "none"
    LIVESTREAM_START = "livestream_start"
    LIVESTREAM_STOP = "livestream_stop"
    OS_UPDATE = "os_update"
    CLIENTFLOW_UPDATE = "clientflow_update"


class School(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    weekday_on: Optional[str] = Field(default="09:00")
    weekday_off: Optional[str] = Field(default="22:30")
    weekend_on: Optional[str] = Field(default="08:00")
    weekend_off: Optional[str] = Field(default="18:00")


class SchoolSeasonTimes(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    school_id: int = Field(foreign_key="school.id", index=True)
    season: str = Field(index=True)
    weekday_on: str = Field(default="09:00")
    weekday_off: str = Field(default="22:30")
    weekend_on: str = Field(default="08:00")
    weekend_off: str = Field(default="18:00")


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str
    hashed_password: str
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
    role: str = "bruger"
    is_active: bool = True
    must_change_password: bool = True
    school_id: Optional[int] = Field(default=None, foreign_key="school.id")
    full_name: Optional[str] = None
    remarks: Optional[str] = None
    email: str

    @property
    def is_admin(self):
        return self.role in ("admin", "superadmin")

    @property
    def is_superadmin(self):
        return self.role == "superadmin"


class ClientBase(SQLModel):
    name: str
    locality: Optional[str] = None
    wifi_ip_address: Optional[str] = None
    wifi_mac_address: Optional[str] = None
    lan_ip_address: Optional[str] = None
    lan_mac_address: Optional[str] = None


class Client(ClientBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    # Client-secret bruges af nye klienter installeret via enrollment-token.
    # Eksisterende klienter med admin-login virker fortsat bagudkompatibelt.
    client_secret_hash: Optional[str] = Field(default=None)
    client_secret_created_at: Optional[datetime] = None
    client_secret_revoked_at: Optional[datetime] = None
    enrollment_token_id: Optional[int] = Field(default=None, foreign_key="enrollmenttoken.id")
    machine_id: Optional[str] = Field(default=None, index=True)
    status: Optional[str] = "pending"
    isOnline: Optional[bool] = False
    last_seen: Optional[datetime] = None
    sort_order: Optional[int] = Field(default=None, index=True)
    kiosk_url: Optional[str] = None
    ubuntu_version: Optional[str] = None
    uptime: Optional[str] = None
    created_at: Optional[datetime] = Field(default_factory=utcnow, nullable=False)
    chrome_status: Optional[str] = "unknown"
    chrome_last_updated: Optional[datetime] = None
    pending_reboot: Optional[bool] = False
    pending_shutdown: Optional[bool] = False
    chrome_color: Optional[str] = None
    # FIX: chrome_step gemmes i DB så backend kan returnere det uden
    # at læse chrome_status.json som kun findes på klient-maskinen.
    chrome_step: Optional[str] = Field(default=None)
    pending_chrome_action: Optional[ChromeAction] = Field(default=ChromeAction.NONE)
    pending_chrome_action_source: Optional[str] = None
    school_id: Optional[int] = Field(default=None, foreign_key="school.id")
    state: Optional[str] = Field(default="normal")
    livestream_status: Optional[str] = "idle"
    livestream_last_segment: Optional[datetime] = None
    livestream_last_error: Optional[str] = None
    # Fysisk X11/display-opløsning på klienten (fjernstyret fra backend/frontend).
    display_resolution_preset: Optional[str] = Field(default="auto")
    display_resolution_mode: Optional[str] = Field(default="auto")  # auto | fixed
    display_resolution_width: Optional[int] = None
    display_resolution_height: Optional[int] = None
    display_resolution_refresh_rate: Optional[float] = None
    display_resolution_rotation: Optional[str] = Field(default="normal")  # normal | left | right | inverted
    display_resolution_action: Optional[str] = None  # detect | apply | None
    display_resolution_updated_at: Optional[datetime] = None
    display_resolution_current_output: Optional[str] = None
    display_resolution_current_width: Optional[int] = None
    display_resolution_current_height: Optional[int] = None
    display_resolution_current_refresh_rate: Optional[float] = None
    display_resolution_status: Optional[str] = Field(default="unknown")  # unknown | pending | detected | applying | applied | error
    display_resolution_error: Optional[str] = None
    display_resolution_last_applied_at: Optional[datetime] = None
    ubuntu_updates_available: Optional[int] = Field(default=0)
    pending_os_update: Optional[bool] = Field(default=False)

    # ClientFlow self-update status (backend-triggeret klientopdatering).
    client_version: Optional[str] = None
    client_update_status: Optional[str] = Field(default="ready")
    client_update_message: Optional[str] = None
    client_update_requested_at: Optional[datetime] = None
    client_update_started_at: Optional[datetime] = None
    client_update_finished_at: Optional[datetime] = None
    client_update_error: Optional[str] = None


class ClientRead(ClientBase):
    """
    Sikker API-repræsentation af en Client.

    Bevidst udeladt:
      - client_secret_hash
      - client_secret_created_at
      - client_secret_revoked_at
      - enrollment_token_id

    De felter bruges kun internt eller via de dedikerede
    superadmin-endpoints under /client-secret/*.
    """
    id: Optional[int] = None
    machine_id: Optional[str] = None
    status: Optional[str] = "pending"
    isOnline: Optional[bool] = False
    last_seen: Optional[datetime] = None
    sort_order: Optional[int] = None
    kiosk_url: Optional[str] = None
    ubuntu_version: Optional[str] = None
    uptime: Optional[str] = None
    created_at: Optional[datetime] = None
    chrome_status: Optional[str] = "unknown"
    chrome_last_updated: Optional[datetime] = None
    pending_reboot: Optional[bool] = False
    pending_shutdown: Optional[bool] = False
    chrome_color: Optional[str] = None
    chrome_step: Optional[str] = None
    pending_chrome_action: Optional[ChromeAction] = ChromeAction.NONE
    pending_chrome_action_source: Optional[str] = None
    school_id: Optional[int] = None
    state: Optional[str] = "normal"
    livestream_status: Optional[str] = "idle"
    livestream_last_segment: Optional[datetime] = None
    livestream_last_error: Optional[str] = None
    display_resolution_preset: Optional[str] = "auto"
    display_resolution_mode: Optional[str] = "auto"
    display_resolution_width: Optional[int] = None
    display_resolution_height: Optional[int] = None
    display_resolution_refresh_rate: Optional[float] = None
    display_resolution_rotation: Optional[str] = "normal"
    display_resolution_action: Optional[str] = None
    display_resolution_updated_at: Optional[datetime] = None
    display_resolution_current_output: Optional[str] = None
    display_resolution_current_width: Optional[int] = None
    display_resolution_current_height: Optional[int] = None
    display_resolution_current_refresh_rate: Optional[float] = None
    display_resolution_status: Optional[str] = "unknown"
    display_resolution_error: Optional[str] = None
    display_resolution_last_applied_at: Optional[datetime] = None
    ubuntu_updates_available: Optional[int] = 0
    pending_os_update: Optional[bool] = False
    client_version: Optional[str] = None
    client_update_status: Optional[str] = "ready"
    client_update_message: Optional[str] = None
    client_update_requested_at: Optional[datetime] = None
    client_update_started_at: Optional[datetime] = None
    client_update_finished_at: Optional[datetime] = None
    client_update_error: Optional[str] = None


class ClientCreate(ClientBase):
    machine_id: Optional[str] = None
    sort_order: Optional[int] = None
    kiosk_url: Optional[str] = None
    ubuntu_version: Optional[str] = None
    uptime: Optional[str] = None
    wifi_ip_address: Optional[str] = None
    wifi_mac_address: Optional[str] = None
    lan_ip_address: Optional[str] = None
    lan_mac_address: Optional[str] = None
    chrome_status: Optional[str] = None
    chrome_color: Optional[str] = None
    chrome_step: Optional[str] = None
    pending_chrome_action: Optional[ChromeAction] = ChromeAction.NONE
    pending_chrome_action_source: Optional[str] = None
    school_id: Optional[int] = None
    state: Optional[str] = Field(default="normal")
    ubuntu_updates_available: Optional[int] = 0
    pending_os_update: Optional[bool] = False
    client_version: Optional[str] = None
    client_update_status: Optional[str] = "ready"
    client_update_message: Optional[str] = None
    client_update_requested_at: Optional[datetime] = None
    client_update_started_at: Optional[datetime] = None
    client_update_finished_at: Optional[datetime] = None
    client_update_error: Optional[str] = None
    display_resolution_preset: Optional[str] = "auto"
    display_resolution_mode: Optional[str] = "auto"
    display_resolution_width: Optional[int] = None
    display_resolution_height: Optional[int] = None
    display_resolution_refresh_rate: Optional[float] = None
    display_resolution_rotation: Optional[str] = "normal"
    display_resolution_action: Optional[str] = None
    display_resolution_updated_at: Optional[datetime] = None
    display_resolution_current_output: Optional[str] = None
    display_resolution_current_width: Optional[int] = None
    display_resolution_current_height: Optional[int] = None
    display_resolution_current_refresh_rate: Optional[float] = None
    display_resolution_status: Optional[str] = "unknown"
    display_resolution_error: Optional[str] = None
    display_resolution_last_applied_at: Optional[datetime] = None



class ClientUpdate(SQLModel):
    machine_id: Optional[str] = None
    locality: Optional[str] = None
    sort_order: Optional[int] = None
    kiosk_url: Optional[str] = None
    ubuntu_version: Optional[str] = None
    uptime: Optional[str] = None
    wifi_ip_address: Optional[str] = None
    wifi_mac_address: Optional[str] = None
    lan_ip_address: Optional[str] = None
    lan_mac_address: Optional[str] = None
    pending_reboot: Optional[bool] = None
    pending_shutdown: Optional[bool] = None
    chrome_status: Optional[str] = None
    chrome_last_updated: Optional[datetime] = None
    chrome_color: Optional[str] = None
    # FIX: chrome_step kan nu opdateres via /update endpoint
    chrome_step: Optional[str] = None
    last_seen: Optional[datetime] = None
    created_at: Optional[datetime] = None
    pending_chrome_action: Optional[ChromeAction] = None
    pending_chrome_action_source: Optional[str] = None
    school_id: Optional[int] = None
    state: Optional[str] = None
    livestream_status: Optional[str] = None
    livestream_last_segment: Optional[datetime] = None
    livestream_last_error: Optional[str] = None
    display_resolution_preset: Optional[str] = None
    display_resolution_mode: Optional[str] = None
    display_resolution_width: Optional[int] = None
    display_resolution_height: Optional[int] = None
    display_resolution_refresh_rate: Optional[float] = None
    display_resolution_rotation: Optional[str] = None
    display_resolution_action: Optional[str] = None
    display_resolution_updated_at: Optional[datetime] = None
    display_resolution_current_output: Optional[str] = None
    display_resolution_current_width: Optional[int] = None
    display_resolution_current_height: Optional[int] = None
    display_resolution_current_refresh_rate: Optional[float] = None
    display_resolution_status: Optional[str] = None
    display_resolution_error: Optional[str] = None
    display_resolution_last_applied_at: Optional[datetime] = None
    ubuntu_updates_available: Optional[int] = None
    pending_os_update: Optional[bool] = None
    client_version: Optional[str] = None
    client_update_status: Optional[str] = None
    client_update_message: Optional[str] = None
    client_update_requested_at: Optional[datetime] = None
    client_update_started_at: Optional[datetime] = None
    client_update_finished_at: Optional[datetime] = None
    client_update_error: Optional[str] = None


class EnrollmentToken(SQLModel, table=True):
    """
    Engangs installationskode til nye Ubuntu-klienter.

    Selve koden gemmes aldrig i klartekst. Kun hash gemmes.
    Koden vises kun én gang ved oprettelse i admin-UI.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    code_hash: str
    code_preview: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
    expires_at: datetime
    used_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    created_by_user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    used_by_client_id: Optional[int] = Field(default=None, foreign_key="client.id")
    school_id: Optional[int] = Field(default=None, foreign_key="school.id")
    note: Optional[str] = None

    @property
    def is_used(self) -> bool:
        return self.used_at is not None

    @property
    def is_revoked(self) -> bool:
        return self.revoked_at is not None


class CalendarMarking(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    season: str = Field(index=True)
    client_id: int = Field(index=True)
    markings: Dict[str, Any] = Field(sa_column=Column(JSON))


class Holiday(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: str = Field(index=True)
    description: Optional[str] = None


class SchoolCreate(SQLModel):
    name: str
    weekday_on: Optional[str] = Field(default="09:00")
    weekday_off: Optional[str] = Field(default="22:30")
    weekend_on: Optional[str] = Field(default="08:00")
    weekend_off: Optional[str] = Field(default="18:00")

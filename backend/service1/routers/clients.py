from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import select, delete
from typing import List, Optional
from datetime import datetime, timedelta, date, timezone
from db import get_session
from models import Client, ClientCreate, ClientUpdate, CalendarMarking, ChromeAction, School, SchoolSeasonTimes, EnrollmentToken
from auth import get_current_user, get_current_admin_user, get_current_superadmin_user, get_current_user_or_client, require_client_self_or_user, principal_is_client, get_password_hash
from models import utcnow
import os
import glob
import json
import secrets

router = APIRouter()

HLS_BASE_DIR = os.getenv("HLS_BASE_DIR", "/opt/render/project/src/backend/service1/hls")

# Brug samme timeout alle steder i backend. 15 sek. kan give meget hurtige
# offline/online-skift, især omkring reboot. Sæt env til 15 hvis du vil bevare
# den gamle adfærd.
ONLINE_TIMEOUT_SECONDS = int(os.getenv("CLIENTFLOW_ONLINE_TIMEOUT_SECONDS", "30"))

VALID_CLIENT_STATES = {"normal", "sleeping", "wakeup", "shutdown", "error", "updating"}
VALID_PENDING_CHROME_ACTION_SOURCES = {"actionbutton", "calendar"}

BLOCKING_ACTIONS = {"start", "stop", "sleep", "wakeup", "restart", "shutdown"}

# Felter som en klient med client-token selv må opdatere på /clients/{id}/update.
# Admin/frontend kan fortsat opdatere alle de eksisterende ClientUpdate-felter.
CLIENT_SELF_UPDATE_FIELDS = {
    "machine_id",
    "ubuntu_version",
    "uptime",
    "wifi_ip_address",
    "wifi_mac_address",
    "lan_ip_address",
    "lan_mac_address",
    "chrome_status",
    "chrome_last_updated",
    "chrome_color",
    "chrome_step",
    "last_seen",
    "pending_reboot",
    "pending_shutdown",
    "pending_chrome_action",
    "pending_chrome_action_source",
    "state",
    "livestream_status",
    "livestream_last_segment",
    "livestream_last_error",
    "ubuntu_updates_available",
    "pending_os_update",
    "client_version",
    "client_update_status",
    "client_update_message",
    "client_update_requested_at",
    "client_update_started_at",
    "client_update_finished_at",
    "client_update_error",
}


def normalize_client_state(value: str) -> str:
    normalized = str(value).lower()
    if normalized == "sleep":
        return "sleeping"
    return normalized


def _as_naive_utc(dt):
    """
    DB-feltet last_seen/chrome_last_updated kan være naive UTC eller timezone-aware.
    Sammenlign altid som naive UTC, så is_online ikke fejler eller giver forkert resultat.
    """
    if dt is None:
        return None
    if getattr(dt, "tzinfo", None) is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _chrome_action_value(value):
    """Returnerer Enum.value når feltet er ChromeAction, ellers string/None."""
    if value is None:
        return None
    return getattr(value, "value", value)


def _normalize_chrome_action_name(action):
    if action is None:
        return None
    value = getattr(action, "value", action)
    return str(value).strip().lower()


def _principal_label(user) -> str:
    try:
        if principal_is_client(user):
            return f"client:{getattr(user, 'client_id', None) or getattr(user, 'sub', None) or 'unknown'}"
    except Exception:
        pass
    username = getattr(user, "username", None) or getattr(user, "sub", None) or "unknown"
    role = getattr(user, "role", None) or "unknown"
    return f"user:{username}/{role}"


def _current_update_detail(client: Client) -> str:
    """Giver en mere præcis besked, når klienten allerede er låst af en update."""
    pending_action = _chrome_action_value(getattr(client, "pending_chrome_action", None))
    if pending_action and str(pending_action).lower() != "none":
        return f"Klienten er allerede ved at opdatere ({pending_action})"

    if getattr(client, "pending_os_update", False):
        return "Klienten er allerede ved at opdatere (os_update)"

    client_update_status = str(getattr(client, "client_update_status", "") or "").lower()
    if client_update_status and client_update_status not in {"ready", "success", "error"}:
        return f"Klienten er allerede ved at opdatere ({client_update_status})"

    return "Klienten er allerede ved at opdatere"


def is_online(client: Client) -> bool:
    last_seen = _as_naive_utc(client.last_seen)
    if last_seen is None:
        return False
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    return (now - last_seen) < timedelta(seconds=ONLINE_TIMEOUT_SECONDS)


SYSTEM_TERMINAL_STEPS = {
    "system_reboot_countdown",
    "system_rebooting",
    "system_shutting_down",
}


def is_step_from_previous_boot(client: Client) -> bool:
    """
    Efter reboot kan DB stadig indeholde chrome_step='system_rebooting'.
    Hvis klienten igen sender uptime, kan vi beregne nuværende boot-tidspunkt.
    Ligger chrome_last_updated før boot-tidspunktet, er step'et fra før reboot
    og bør ikke bruges til banner/lås i frontend.
    """
    step = str(client.chrome_step or "").lower()
    if step not in SYSTEM_TERMINAL_STEPS:
        return False

    if client.uptime in (None, "") or client.chrome_last_updated is None:
        return False

    try:
        uptime_seconds = int(float(str(client.uptime)))
    except Exception:
        return False

    # Undgå at små clock-skævheder rydder et helt nyt step.
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    current_boot_time = now - timedelta(seconds=uptime_seconds)
    step_time = _as_naive_utc(client.chrome_last_updated)

    return step_time is not None and step_time < (current_boot_time - timedelta(seconds=2))


@router.get("/clients/public")
def get_clients_public(session=Depends(get_session)):
    clients = session.exec(select(Client).where(Client.status == "approved")).all()
    return {"clients": [{"id": c.id, "name": c.name} for c in clients]}


@router.get("/clients/me", response_model=List[Client])
def get_clients_for_my_school(session=Depends(get_session), user=Depends(get_current_user)):
    if not user.school_id:
        return []
    clients = session.exec(
        select(Client).where(Client.status == "approved", Client.school_id == user.school_id)
    ).all()
    for client in clients:
        client.isOnline = is_online(client)
    clients.sort(key=lambda c: (c.sort_order is None, c.sort_order if c.sort_order is not None else 9999, c.id))
    return clients


@router.get("/clients/", response_model=List[Client])
def get_clients(session=Depends(get_session), user=Depends(get_current_user)):
    clients = session.exec(select(Client)).all()
    for client in clients:
        client.isOnline = is_online(client)
    clients.sort(key=lambda c: (c.sort_order is None, c.sort_order if c.sort_order is not None else 9999, c.id))
    return clients


@router.get("/clients/{id}/", response_model=Client)
def get_client(id: int, session=Depends(get_session), user=Depends(get_current_user_or_client)):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.isOnline = is_online(client)
    if principal_is_client(user):
        require_client_self_or_user(user, id)
        return client
    if getattr(user, "is_admin", False):
        return client
    if getattr(user, "role", None) == "bruger":
        if client.status != "approved" or client.school_id != user.school_id:
            raise HTTPException(status_code=403, detail="Du har ikke adgang til denne klient")
        return client
    raise HTTPException(status_code=403, detail="Du har ikke adgang til denne klient")


@router.get("/clients/{id}/chrome-status")
def get_chrome_status(id: int, session=Depends(get_session), user=Depends(get_current_user_or_client)):
    require_client_self_or_user(user, id)
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    online = is_online(client)

    # FIX: Læser chrome_step fra database, men filtrerer gamle system-steps fra
    # forrige boot. Ellers kan frontend blive ved med at vise
    # "Klient genstarter..." efter klienten er kommet online igen.
    step_obj = None
    if client.chrome_step and not is_step_from_previous_boot(client):
        step_obj = {
            "step": client.chrome_step,
            "timestamp": (
                _as_naive_utc(client.chrome_last_updated).isoformat() + "Z"
                if client.chrome_last_updated else None
            ),
        }

    pending_action = _chrome_action_value(client.pending_chrome_action) or "none"

    return {
        "client_id": client.id,
        "chrome_status": client.chrome_status or "unknown",
        "chrome_last_updated": client.chrome_last_updated,
        "chrome_color": client.chrome_color,
        "step": step_obj,
        "last_seen": client.last_seen,
        "uptime": client.uptime,

        # Vigtigt for ClientDetailsPage: den poller dette endpoint hvert sekund.
        # Uden isOnline her bliver siden ved med at bruge den gamle client.isOnline
        # fra initial getClient/silentRefresh.
        "isOnline": online,
        "is_online": online,

        # Gør frontend i stand til at slippe låse/banner uden at vente på fuldt
        # /clients/{id}/ refresh.
        "state": client.state,
        "pending_chrome_action": pending_action,
        "pending_chrome_action_source": None if pending_action in (None, "none") else getattr(client, "pending_chrome_action_source", None),
        "pending_reboot": client.pending_reboot,
        "pending_shutdown": client.pending_shutdown,
        "client_version": client.client_version,
        "client_update_status": client.client_update_status or "ready",
        "client_update_message": client.client_update_message,
        "client_update_requested_at": client.client_update_requested_at,
        "client_update_started_at": client.client_update_started_at,
        "client_update_finished_at": client.client_update_finished_at,
        "client_update_error": client.client_update_error,
    }

@router.put("/clients/{id}/chrome-status")
def update_chrome_status(
    id: int,
    data: dict = Body(...),
    session=Depends(get_session),
    user=Depends(get_current_user_or_client),
):
    require_client_self_or_user(user, id)
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if data.get("chrome_status") is not None:
        client.chrome_status = data.get("chrome_status")
    if data.get("chrome_color") is not None:
        client.chrome_color = data.get("chrome_color")
    # FIX: gem chrome_step fra klient så /chrome-status GET kan returnere det
    if data.get("chrome_step") is not None:
        client.chrome_step = data.get("chrome_step")
    client.chrome_last_updated = utcnow()
    # Et chrome-status push er også et livstegn fra klienten.
    client.last_seen = utcnow()
    session.add(client)
    session.commit()
    session.refresh(client)
    return {"ok": True}


@router.put("/clients/{id}/state")
def update_client_state(id: int, data: dict = Body(...), session=Depends(get_session), user=Depends(get_current_user_or_client)):
    require_client_self_or_user(user, id)
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    state = data.get("state")
    if not state:
        raise HTTPException(status_code=400, detail="Missing state")
    state = normalize_client_state(state)
    if state not in VALID_CLIENT_STATES:
        raise HTTPException(status_code=400, detail=f"Ugyldig state '{state}'. Tilladte: {sorted(VALID_CLIENT_STATES)}")
    client.state = state
    session.add(client)
    session.commit()
    session.refresh(client)
    return {"ok": True, "state": client.state}


@router.get("/clients/{id}/state")
def get_client_state(id: int, session=Depends(get_session), user=Depends(get_current_user_or_client)):
    require_client_self_or_user(user, id)
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"state": client.state}


@router.post("/clients/{id}/chrome-command")
def set_chrome_command(
    id: int,
    data: dict = Body(...),
    session=Depends(get_session),
    user=Depends(get_current_user_or_client),
):
    require_client_self_or_user(user, id)
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    action = _normalize_chrome_action_name(data.get("action"))
    source = data.get("source")

    current_pca = _normalize_chrome_action_name(
        getattr(client.pending_chrome_action, "value", None) or str(client.pending_chrome_action or "none")
    ) or "none"

    if (
        action in BLOCKING_ACTIONS
        and current_pca in BLOCKING_ACTIONS
        and current_pca != action
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                f"Handling '{current_pca}' er allerede igang — "
                f"vent til klienten har fuldført den, før du sender '{action}'"
            ),
        )

    if action in BLOCKING_ACTIONS and current_pca == action:
        raise HTTPException(
            status_code=409,
            detail=f"Handling '{action}' er allerede igang på klienten",
        )

    if (
        action == "livestream_start"
        and current_pca == "livestream_start"
    ):
        raise HTTPException(status_code=400, detail="Livestream already requested")

    try:
        chrome_action = ChromeAction(action)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Ugyldig action '{action}'")

    old_pca = _chrome_action_value(client.pending_chrome_action) or "none"
    old_source = getattr(client, "pending_chrome_action_source", None)

    client.pending_chrome_action = chrome_action

    if chrome_action == ChromeAction.NONE:
        client.pending_chrome_action_source = None
    elif source is None:
        # Undgå at en gammel source="actionbutton" hænger ved, hvis en anden
        # kilde sætter en ny action uden source.
        client.pending_chrome_action_source = None
    else:
        if not isinstance(source, str):
            raise HTTPException(status_code=400, detail="Ugyldig source-værdi")
        src_lower = source.lower()
        if src_lower not in VALID_PENDING_CHROME_ACTION_SOURCES:
            raise HTTPException(
                status_code=400,
                detail=f"Ugyldig source '{source}'. Tilladte: {sorted(VALID_PENDING_CHROME_ACTION_SOURCES)}",
            )
        client.pending_chrome_action_source = src_lower

    print(
        f"[CLIENT_ACTION] chrome-command client={id} old={old_pca}/{old_source} "
        f"new={client.pending_chrome_action.value if client.pending_chrome_action else None}/"
        f"{getattr(client, 'pending_chrome_action_source', None)} principal={_principal_label(user)}",
        flush=True,
    )
    session.add(client)
    session.commit()
    session.refresh(client)
    return {
        "ok": True,
        "pending_chrome_action": client.pending_chrome_action.value,
        "pending_chrome_action_source": getattr(client, "pending_chrome_action_source", None),
    }


@router.get("/clients/{id}/chrome-command")
def get_chrome_command(id: int, session=Depends(get_session), user=Depends(get_current_user_or_client)):
    require_client_self_or_user(user, id)
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    action = client.pending_chrome_action.value if client.pending_chrome_action else None
    source = None if action in (None, "none") else getattr(client, "pending_chrome_action_source", None)
    return {
        "action": action,
        "source": source,
    }


@router.post("/clients/{id}/os-update")
async def trigger_os_update(
    id: int,
    session=Depends(get_session),
    user=Depends(get_current_admin_user),
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if not is_online(client):
        raise HTTPException(status_code=400, detail="Klienten er offline — kan ikke starte opdatering")
    if client.state == "updating":
        raise HTTPException(status_code=409, detail=_current_update_detail(client))
    client.pending_chrome_action = ChromeAction.OS_UPDATE
    client.pending_os_update = True
    client.state = "updating"
    session.add(client)
    session.commit()
    session.refresh(client)
    return {
        "ok": True,
        "message": f"OS-opdatering bestilt for klient {id}",
        "pending_chrome_action": client.pending_chrome_action.value,
        "pending_os_update": client.pending_os_update,
        "state": client.state,
    }


@router.post("/clients/{id}/clientflow-update")
async def trigger_clientflow_update(
    id: int,
    session=Depends(get_session),
    user=Depends(get_current_admin_user),
):
    """Bestil ClientFlow self-update på klienten.

    Dette er adskilt fra OS-opdatering:
    - OS update = Ubuntu/Chrome/pakker
    - ClientFlow update = ClientFlow-filer/services fra Render
    """
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if not is_online(client):
        raise HTTPException(status_code=400, detail="Klienten er offline — kan ikke starte ClientFlow-opdatering")
    if client.state == "updating":
        raise HTTPException(status_code=409, detail=_current_update_detail(client))

    now = utcnow()
    client.pending_chrome_action = ChromeAction.CLIENTFLOW_UPDATE
    client.pending_chrome_action_source = "actionbutton"
    client.state = "updating"
    client.client_update_status = "requested"
    client.client_update_message = "Opdatering bestilt fra backend"
    client.client_update_requested_at = now
    client.client_update_started_at = None
    client.client_update_finished_at = None
    client.client_update_error = None
    session.add(client)
    session.commit()
    session.refresh(client)
    return {
        "ok": True,
        "message": f"ClientFlow-opdatering bestilt for klient {id}",
        "pending_chrome_action": client.pending_chrome_action.value,
        "state": client.state,
        "client_update_status": client.client_update_status,
        "client_update_message": client.client_update_message,
        "client_update_requested_at": client.client_update_requested_at,
    }


@router.get("/clients/{id}/ubuntu-updates")
def get_ubuntu_updates(id: int, session=Depends(get_session), user=Depends(get_current_user_or_client)):
    require_client_self_or_user(user, id)
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return {
        "client_id": client.id,
        "ubuntu_updates_available": client.ubuntu_updates_available or 0,
        "pending_os_update": client.pending_os_update or False,
        "ubuntu_version": client.ubuntu_version,
    }


@router.post("/clients/", response_model=Client)
async def create_client(client_in: ClientCreate, session=Depends(get_session), user=Depends(get_current_user)):
    client = Client(
        name=client_in.name,
        locality=client_in.locality,
        wifi_ip_address=client_in.wifi_ip_address,
        wifi_mac_address=client_in.wifi_mac_address,
        lan_ip_address=client_in.lan_ip_address,
        lan_mac_address=client_in.lan_mac_address,
        status="pending",
        isOnline=False,
        last_seen=None,
        sort_order=client_in.sort_order,
        kiosk_url=getattr(client_in, "kiosk_url", None),
        ubuntu_version=getattr(client_in, "ubuntu_version", None),
        uptime=getattr(client_in, "uptime", None),
        chrome_status=getattr(client_in, "chrome_status", "unknown"),
        chrome_last_updated=None,
        chrome_color=getattr(client_in, "chrome_color", None),
        chrome_step=getattr(client_in, "chrome_step", None),
        pending_reboot=False,
        pending_shutdown=False,
        pending_chrome_action=getattr(client_in, "pending_chrome_action", ChromeAction.NONE),
        pending_chrome_action_source=getattr(client_in, "pending_chrome_action_source", None),
        school_id=getattr(client_in, "school_id", None),
        state=getattr(client_in, "state", "normal"),
        livestream_status="idle",
        livestream_last_segment=None,
        livestream_last_error=None,
        ubuntu_updates_available=getattr(client_in, "ubuntu_updates_available", 0),
        pending_os_update=getattr(client_in, "pending_os_update", False),
        client_version=getattr(client_in, "client_version", None),
        client_update_status=getattr(client_in, "client_update_status", "ready"),
        client_update_message=getattr(client_in, "client_update_message", None),
        client_update_requested_at=getattr(client_in, "client_update_requested_at", None),
        client_update_started_at=getattr(client_in, "client_update_started_at", None),
        client_update_finished_at=getattr(client_in, "client_update_finished_at", None),
        client_update_error=getattr(client_in, "client_update_error", None),
    )
    session.add(client)
    session.commit()
    session.refresh(client)
    return client


@router.put("/clients/{id}/update", response_model=Client)
async def update_client(
    id: int,
    client_update: ClientUpdate,
    session=Depends(get_session),
    user=Depends(get_current_user_or_client),
):
    require_client_self_or_user(user, id)
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    fields = client_update.model_fields_set
    if principal_is_client(user):
        forbidden = sorted(set(fields) - CLIENT_SELF_UPDATE_FIELDS)
        if forbidden:
            raise HTTPException(
                status_code=403,
                detail=f"Klient-token må ikke opdatere disse felter: {forbidden}",
            )
    if "machine_id" in fields: client.machine_id = client_update.machine_id
    if "locality" in fields: client.locality = client_update.locality
    if "sort_order" in fields: client.sort_order = client_update.sort_order
    if "kiosk_url" in fields: client.kiosk_url = client_update.kiosk_url
    if "ubuntu_version" in fields: client.ubuntu_version = client_update.ubuntu_version
    if "uptime" in fields: client.uptime = client_update.uptime
    if "wifi_ip_address" in fields: client.wifi_ip_address = client_update.wifi_ip_address
    if "wifi_mac_address" in fields: client.wifi_mac_address = client_update.wifi_mac_address
    if "lan_ip_address" in fields: client.lan_ip_address = client_update.lan_ip_address
    if "lan_mac_address" in fields: client.lan_mac_address = client_update.lan_mac_address
    if "chrome_status" in fields: client.chrome_status = client_update.chrome_status
    if "chrome_color" in fields: client.chrome_color = client_update.chrome_color
    # FIX: gem chrome_step i DB så /chrome-status GET kan returnere det korrekt
    if "chrome_step" in fields: client.chrome_step = client_update.chrome_step
    if "chrome_last_updated" in fields:
        client.chrome_last_updated = client_update.chrome_last_updated
    elif "chrome_status" in fields or "chrome_step" in fields:
        client.chrome_last_updated = utcnow()
    if "last_seen" in fields: client.last_seen = client_update.last_seen
    if "created_at" in fields: client.created_at = client_update.created_at
    if "pending_reboot" in fields: client.pending_reboot = client_update.pending_reboot
    if "pending_shutdown" in fields: client.pending_shutdown = client_update.pending_shutdown
    old_pending_action = _chrome_action_value(getattr(client, "pending_chrome_action", None)) or "none"
    old_pending_source = getattr(client, "pending_chrome_action_source", None)

    if "pending_chrome_action" in fields:
        val = client_update.pending_chrome_action
        normalized_val = _normalize_chrome_action_name(val)
        client.pending_chrome_action = ChromeAction.NONE if normalized_val is None else ChromeAction(normalized_val)

        if client.pending_chrome_action == ChromeAction.NONE:
            # Når action ryddes, skal source også ryddes. Ellers kan næste action
            # uden source fejlagtigt ligne "actionbutton" i klientloggen.
            client.pending_chrome_action_source = None
        elif "pending_chrome_action_source" not in fields:
            # Ny action uden source må ikke arve gammel source.
            client.pending_chrome_action_source = None

    if "pending_chrome_action_source" in fields:
        src = client_update.pending_chrome_action_source
        if src is None:
            client.pending_chrome_action_source = None
        else:
            src_lower = str(src).lower()
            if src_lower not in VALID_PENDING_CHROME_ACTION_SOURCES:
                raise HTTPException(status_code=400, detail=f"Ugyldig source '{src}'")
            client.pending_chrome_action_source = src_lower
    if "school_id" in fields: client.school_id = client_update.school_id
    if "state" in fields:
        state = client_update.state
        if state is None:
            client.state = None
        else:
            state_lower = normalize_client_state(state)
            if state_lower not in VALID_CLIENT_STATES:
                raise HTTPException(status_code=400, detail=f"Ugyldig state '{state}'")
            client.state = state_lower
    if "livestream_status" in fields: client.livestream_status = client_update.livestream_status
    if "livestream_last_segment" in fields: client.livestream_last_segment = client_update.livestream_last_segment
    if "livestream_last_error" in fields: client.livestream_last_error = client_update.livestream_last_error
    if "ubuntu_updates_available" in fields: client.ubuntu_updates_available = client_update.ubuntu_updates_available
    if "pending_os_update" in fields: client.pending_os_update = client_update.pending_os_update
    if "client_version" in fields: client.client_version = client_update.client_version
    if "client_update_status" in fields: client.client_update_status = client_update.client_update_status
    if "client_update_message" in fields: client.client_update_message = client_update.client_update_message
    if "client_update_requested_at" in fields: client.client_update_requested_at = client_update.client_update_requested_at
    if "client_update_started_at" in fields: client.client_update_started_at = client_update.client_update_started_at
    if "client_update_finished_at" in fields: client.client_update_finished_at = client_update.client_update_finished_at
    if "client_update_error" in fields: client.client_update_error = client_update.client_update_error

    if "pending_chrome_action" in fields or "pending_chrome_action_source" in fields:
        print(
            f"[CLIENT_ACTION] update client={id} old={old_pending_action}/{old_pending_source} "
            f"new={_chrome_action_value(getattr(client, 'pending_chrome_action', None))}/"
            f"{getattr(client, 'pending_chrome_action_source', None)} fields={sorted(fields)} "
            f"principal={_principal_label(user)}",
            flush=True,
        )
    session.add(client)
    session.commit()
    session.refresh(client)
    return client


@router.put("/clients/{id}/kiosk_url", response_model=Client)
async def update_kiosk_url(
    id: int,
    data: dict = Body(...),
    session=Depends(get_session),
    user=Depends(get_current_user),
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    kiosk_url = data.get("kiosk_url")
    if not kiosk_url:
        raise HTTPException(status_code=400, detail="Missing kiosk_url")
    client.kiosk_url = kiosk_url
    session.add(client)
    session.commit()
    session.refresh(client)
    return client


def get_school_year_dates(season_start: int):
    dates = []
    for month in range(8, 13):
        for day in range(1, 32):
            try:
                dates.append(date(season_start, month, day))
            except ValueError:
                continue
    for month in range(1, 8):
        for day in range(1, 32):
            try:
                dates.append(date(season_start + 1, month, day))
            except ValueError:
                continue
    return dates


@router.post("/clients/{id}/approve", response_model=Client)
async def approve_client(
    id: int,
    data: dict = Body(None),
    session=Depends(get_session),
    user=Depends(get_current_admin_user),
):
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.status = "approved"
    max_sort_order = session.exec(
        select(Client.sort_order)
        .where(Client.status == "approved", Client.sort_order != None)
        .order_by(Client.sort_order.desc())
    ).first()
    client.sort_order = (max_sort_order or 0) + 1
    if data and "school_id" in data:
        client.school_id = data["school_id"]
    session.add(client)
    session.commit()
    session.refresh(client)

    today = date.today()
    season_start = today.year if today.month >= 8 else today.year - 1
    season_str = f"{season_start}/{season_start + 1}"

    school = session.get(School, client.school_id) if client.school_id else None
    season_times = None
    if school:
        season_times = session.exec(
            select(SchoolSeasonTimes).where(
                SchoolSeasonTimes.school_id == school.id,
                SchoolSeasonTimes.season == season_str,
            )
        ).first()

    if season_times:
        def_wd_on  = season_times.weekday_on
        def_wd_off = season_times.weekday_off
        def_we_on  = season_times.weekend_on
        def_we_off = season_times.weekend_off
    elif school:
        def_wd_on  = getattr(school, "weekday_on",  "09:00") or "09:00"
        def_wd_off = getattr(school, "weekday_off", "22:30") or "22:30"
        def_we_on  = getattr(school, "weekend_on",  "08:00") or "08:00"
        def_we_off = getattr(school, "weekend_off", "18:00") or "18:00"
    else:
        def_wd_on, def_wd_off = "09:00", "22:30"
        def_we_on, def_we_off = "08:00", "18:00"

    school_year_dates = get_school_year_dates(season_start)
    markings = {}
    for d in school_year_dates:
        if d.weekday() < 5:
            markings[d.isoformat()] = {"status": "off", "onTime": def_wd_on, "offTime": def_wd_off}
        else:
            markings[d.isoformat()] = {"status": "off", "onTime": def_we_on, "offTime": def_we_off}

    existing = session.exec(
        select(CalendarMarking).where(
            CalendarMarking.season == season_str,
            CalendarMarking.client_id == client.id,
        )
    ).first()
    if not existing:
        session.add(CalendarMarking(season=season_str, client_id=client.id, markings=markings))
        session.commit()

    return client


@router.post("/clients/{id}/heartbeat", response_model=Client)
def client_heartbeat(
    id: int,
    data: dict = Body(default=None),
    session=Depends(get_session),
    user=Depends(get_current_user_or_client),
):
    """
    Heartbeat er klientens hurtige livstegn.

    Vigtigt:
    Webfrontend viser uptime fra backend. Den lokale klient-GUI viser uptime
    direkte fra clientflow_config.json, som opdateres fra /proc/uptime.
    Derfor skal heartbeat også opdatere backend.uptime, ellers kan webvisningen
    være bagud i forhold til den lokale GUI.
    """
    require_client_self_or_user(user, id)
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client.last_seen = utcnow()

    if isinstance(data, dict):
        if data.get("uptime") is not None:
            client.uptime = str(data.get("uptime"))
        if data.get("ubuntu_version") is not None:
            client.ubuntu_version = data.get("ubuntu_version")
        if data.get("client_version") is not None:
            client.client_version = data.get("client_version")

        # Valgfrit, men nyttigt hvis heartbeat senere bruges til netværksdata.
        for field in (
            "wifi_ip_address",
            "wifi_mac_address",
            "lan_ip_address",
            "lan_mac_address",
        ):
            if data.get(field) is not None:
                setattr(client, field, data.get(field))

    session.add(client)
    session.commit()
    session.refresh(client)
    client.isOnline = True
    return client


def _generate_client_secret() -> str:
    """
    Genererer en klienthemmelighed til installerede Ubuntu-klienter.

    Vises kun én gang ved rotate/generering og gemmes kun hashed i databasen.
    """
    return "cf_client_" + secrets.token_urlsafe(32)


def _client_secret_status(client: Client) -> dict:
    return {
        "client_id": client.id,
        "has_client_secret": bool(client.client_secret_hash) and client.client_secret_revoked_at is None,
        "client_secret_created_at": client.client_secret_created_at,
        "client_secret_revoked_at": client.client_secret_revoked_at,
        "enrollment_token_id": client.enrollment_token_id,
        "machine_id": client.machine_id,
        "status": client.status,
        "name": client.name,
    }


@router.get("/clients/{id}/client-secret/status")
def get_client_secret_status(
    id: int,
    session=Depends(get_session),
    user=Depends(get_current_superadmin_user),
):
    """
    Superadmin: se om en eksisterende klient har aktiv client-secret.

    Returnerer aldrig selve secret'en.
    """
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return _client_secret_status(client)


@router.post("/clients/{id}/client-secret/rotate")
def rotate_client_secret(
    id: int,
    session=Depends(get_session),
    user=Depends(get_current_superadmin_user),
):
    """
    Superadmin: generér/rotér client-secret for en eksisterende klient.

    Bruges til at migrere eksisterende klienter væk fra admin-login.
    Secret'en returneres kun i dette response og kan ikke læses igen bagefter.
    """
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client_secret = _generate_client_secret()
    client.client_secret_hash = get_password_hash(client_secret)
    client.client_secret_created_at = utcnow()
    client.client_secret_revoked_at = None

    session.add(client)
    session.commit()
    session.refresh(client)

    return {
        **_client_secret_status(client),
        "client_secret": client_secret,
    }


@router.post("/clients/{id}/client-secret/revoke")
def revoke_client_secret(
    id: int,
    session=Depends(get_session),
    user=Depends(get_current_superadmin_user),
):
    """
    Superadmin: tilbagekald client-secret for en eksisterende klient.

    Efter revoke kan klienten ikke længere få /auth/client-token med sin secret.
    """
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client.client_secret_revoked_at = utcnow()
    session.add(client)
    session.commit()
    session.refresh(client)

    return _client_secret_status(client)



@router.delete("/clients/{id}/remove")
async def remove_client(id: int, session=Depends(get_session), user=Depends(get_current_admin_user)):
    """
    Fjern en klient robust.

    Enrollment-klienter kan være refereret fra EnrollmentToken.used_by_client_id.
    Hvis vi sletter Client-rækken uden først at fjerne den reference, kan PostgreSQL
    returnere foreign-key-fejl, hvilket tidligere gav HTTP 500 i frontend.

    Vi beholder enrollment-token rækken som historik, men nulstiller linket til den
    slettede klient.
    """
    client = session.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    try:
        # Fjern kalender-markeringer for klienten.
        session.exec(delete(CalendarMarking).where(CalendarMarking.client_id == client.id))

        # Behold installationskode-historik, men fjern FK til klienten før sletning.
        enrollment_tokens = session.exec(
            select(EnrollmentToken).where(EnrollmentToken.used_by_client_id == client.id)
        ).all()
        for token in enrollment_tokens:
            token.used_by_client_id = None
            session.add(token)

        session.delete(client)
        session.commit()
        return {
            "ok": True,
            "removed_client_id": id,
            "unlinked_enrollment_tokens": len(enrollment_tokens),
        }
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Kunne ikke fjerne klient {id}: {type(e).__name__}",
        )


@router.get("/clients/{id}/stream")
def client_stream(id: int, session=Depends(get_session), user=Depends(get_current_user)):
    return {"stream_url": f"/mjpeg/{id}"}


@router.get("/clients/{id}/terminal")
def client_terminal(id: int, session=Depends(get_session), user=Depends(get_current_user)):
    return {"terminal_url": f"/terminal/{id}"}


@router.get("/clients/{id}/remote-desktop")
def client_remote_desktop(id: int, session=Depends(get_session), user=Depends(get_current_user)):
    return {"remote_desktop_url": f"/remote-desktop/{id}"}


@router.post("/clients/{client_id}/reset-hls")
def reset_hls(client_id: int, user=Depends(get_current_user)):
    hls_dir = os.path.join(HLS_BASE_DIR, str(client_id))
    if not os.path.exists(hls_dir):
        raise HTTPException(status_code=404, detail="HLS directory not found for client")
    deleted, errors = [], []
    for f in glob.glob(os.path.join(hls_dir, "*")):
        try:
            os.remove(f)
            deleted.append(os.path.basename(f))
        except Exception as e:
            errors.append({"file": os.path.basename(f), "error": str(e)})
    return {"status": "ok", "deleted_files": deleted, "errors": errors}


@router.post("/clients/{client_id}/stop-hls")
def stop_hls(client_id: int, user=Depends(get_current_user)):
    hls_dir = os.path.join(HLS_BASE_DIR, str(client_id))
    if not os.path.exists(hls_dir):
        return {"status": "ok", "deleted_files": [], "errors": ["HLS directory not found"]}
    deleted, errors = [], []
    for f in glob.glob(os.path.join(hls_dir, "*")):
        try:
            os.remove(f)
            deleted.append(os.path.basename(f))
        except Exception as e:
            errors.append({"file": os.path.basename(f), "error": str(e)})
    return {"status": "ok", "deleted_files": deleted, "errors": errors}

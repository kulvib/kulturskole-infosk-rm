import secrets
import string
from datetime import timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel, Field as PydanticField
from sqlmodel import Session, select

from db import get_session
from models import Client, EnrollmentToken, User, utcnow
from auth import get_current_admin_user, get_password_hash, verify_password

router = APIRouter()


TOKEN_ALPHABET = string.ascii_uppercase + string.digits


def _generate_enrollment_code() -> str:
    # Læsevenlig kode til telefon/mail: CF-ABCD-1234-WXYZ
    parts = []
    for _ in range(3):
        parts.append("".join(secrets.choice(TOKEN_ALPHABET) for _ in range(4)))
    return "CF-" + "-".join(parts)


def _generate_client_secret() -> str:
    return "cf_client_" + secrets.token_urlsafe(32)


class EnrollmentTokenCreate(BaseModel):
    expires_in_hours: int = PydanticField(default=72, ge=1, le=24 * 30)
    school_id: Optional[int] = None
    note: Optional[str] = None


class EnrollmentTokenRead(BaseModel):
    id: int
    code_preview: Optional[str]
    created_at: str
    expires_at: str
    used_at: Optional[str]
    revoked_at: Optional[str]
    used_by_client_id: Optional[int]
    school_id: Optional[int]
    note: Optional[str]
    is_used: bool
    is_expired: bool
    is_revoked: bool


class EnrollmentTokenCreated(BaseModel):
    id: int
    code: str
    expires_at: str
    note: Optional[str] = None


class EnrollmentClaimRequest(BaseModel):
    enrollment_code: str
    name: Optional[str] = None
    locality: Optional[str] = None
    hostname: Optional[str] = None
    machine_id: Optional[str] = None
    ubuntu_version: Optional[str] = None
    uptime: Optional[str] = None
    wifi_ip_address: Optional[str] = None
    wifi_mac_address: Optional[str] = None
    lan_ip_address: Optional[str] = None
    lan_mac_address: Optional[str] = None


class EnrollmentClaimResponse(BaseModel):
    client_id: int
    client_secret: str
    status: str
    name: str


def _token_to_read(token: EnrollmentToken) -> EnrollmentTokenRead:
    now = utcnow()
    return EnrollmentTokenRead(
        id=token.id,
        code_preview=token.code_preview,
        created_at=token.created_at.isoformat() + "Z",
        expires_at=token.expires_at.isoformat() + "Z",
        used_at=token.used_at.isoformat() + "Z" if token.used_at else None,
        revoked_at=token.revoked_at.isoformat() + "Z" if token.revoked_at else None,
        used_by_client_id=token.used_by_client_id,
        school_id=token.school_id,
        note=token.note,
        is_used=token.used_at is not None,
        is_expired=token.expires_at < now,
        is_revoked=token.revoked_at is not None,
    )


def _require_admin_can_use_school(admin: User, school_id: Optional[int]):
    if admin.is_superadmin:
        return
    if school_id is None or school_id == admin.school_id:
        return
    raise HTTPException(status_code=403, detail="Du kan kun oprette installationskoder til din egen skole")


@router.post("/admin/enrollment-tokens", response_model=EnrollmentTokenCreated, status_code=201)
def create_enrollment_token(
    data: EnrollmentTokenCreate = Body(default_factory=EnrollmentTokenCreate),
    session: Session = Depends(get_session),
    admin: User = Depends(get_current_admin_user),
):
    _require_admin_can_use_school(admin, data.school_id)

    code = _generate_enrollment_code()
    token = EnrollmentToken(
        code_hash=get_password_hash(code),
        code_preview=code[-4:],
        created_at=utcnow(),
        expires_at=utcnow() + timedelta(hours=data.expires_in_hours),
        created_by_user_id=admin.id,
        school_id=data.school_id if data.school_id is not None else admin.school_id,
        note=data.note,
    )
    session.add(token)
    session.commit()
    session.refresh(token)

    # Koden returneres kun her. Den gemmes ikke i klartekst.
    return EnrollmentTokenCreated(
        id=token.id,
        code=code,
        expires_at=token.expires_at.isoformat() + "Z",
        note=token.note,
    )


@router.get("/admin/enrollment-tokens", response_model=List[EnrollmentTokenRead])
def list_enrollment_tokens(
    session: Session = Depends(get_session),
    admin: User = Depends(get_current_admin_user),
):
    stmt = select(EnrollmentToken).order_by(EnrollmentToken.created_at.desc())
    tokens = session.exec(stmt).all()
    if not admin.is_superadmin:
        tokens = [t for t in tokens if t.school_id == admin.school_id]
    return [_token_to_read(t) for t in tokens]


@router.post("/admin/enrollment-tokens/{token_id}/revoke", response_model=EnrollmentTokenRead)
def revoke_enrollment_token(
    token_id: int,
    session: Session = Depends(get_session),
    admin: User = Depends(get_current_admin_user),
):
    token = session.get(EnrollmentToken, token_id)
    if not token:
        raise HTTPException(status_code=404, detail="Installationskode ikke fundet")
    _require_admin_can_use_school(admin, token.school_id)
    if token.revoked_at is None:
        token.revoked_at = utcnow()
        session.add(token)
        session.commit()
        session.refresh(token)
    return _token_to_read(token)


@router.post("/enrollment/claim", response_model=EnrollmentClaimResponse)
def claim_enrollment_token(
    data: EnrollmentClaimRequest,
    session: Session = Depends(get_session),
):
    code = (data.enrollment_code or "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Installationskode mangler")

    now = utcnow()
    # Vi kan ikke slå direkte op på hash pga. bcrypt-salt. Antallet er lavt,
    # så vi scanner kun aktive, ubrugte og ikke-udløbne koder.
    candidates = session.exec(
        select(EnrollmentToken).where(
            EnrollmentToken.used_at == None,
            EnrollmentToken.revoked_at == None,
            EnrollmentToken.expires_at >= now,
        )
    ).all()

    token = None
    for candidate in candidates:
        if verify_password(code, candidate.code_hash):
            token = candidate
            break

    if not token:
        raise HTTPException(status_code=401, detail="Installationskoden er ugyldig, brugt eller udløbet")

    hostname = (data.hostname or "").strip()
    name = (data.name or "").strip() or hostname or "Ny infoskærm"
    locality = (data.locality or "").strip() or None
    client_secret = _generate_client_secret()

    client = Client(
        name=name,
        locality=locality,
        wifi_ip_address=data.wifi_ip_address,
        wifi_mac_address=data.wifi_mac_address,
        lan_ip_address=data.lan_ip_address,
        lan_mac_address=data.lan_mac_address,
        machine_id=data.machine_id,
        status="pending",
        isOnline=False,
        last_seen=now,
        sort_order=None,
        kiosk_url=None,
        ubuntu_version=data.ubuntu_version,
        uptime=data.uptime,
        chrome_status="unknown",
        chrome_last_updated=None,
        chrome_color=None,
        chrome_step=None,
        school_id=token.school_id,
        state="normal",
        livestream_status="idle",
        livestream_last_segment=None,
        livestream_last_error=None,
        client_secret_hash=get_password_hash(client_secret),
        client_secret_created_at=now,
        client_secret_revoked_at=None,
        enrollment_token_id=token.id,
    )

    session.add(client)
    session.commit()
    session.refresh(client)

    token.used_at = now
    token.used_by_client_id = client.id
    session.add(token)
    session.commit()

    return EnrollmentClaimResponse(
        client_id=client.id,
        client_secret=client_secret,
        status=client.status or "pending",
        name=client.name,
    )

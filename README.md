# kulturskole-infoskaerm

## Roller (4 niveauer)

- `superadmin` – fuld adgang inkl. håndtering af andre superadmins
- `admin` – administration af brugere/klienter/skoler, men ikke superadmins
- `bruger` – adgang til egne data/funktioner
- `viewer` – læseadgang

## Auth og sikkerhed

- Password hashes med bcrypt (`passlib`)
- JWT access token med udløb (`ACCESS_TOKEN_EXPIRE_MINUTES`)
- `SECRET_KEY` og øvrige secrets læses fra miljøvariabler (se `.env.example`)
- Admin-endpoints er rollebeskyttede
- Login-fejlbeskeder er generiske for at undgå brugeropregning
- Selvbetjent adgangskodeskift kræver gammelt kodeord

## Standard-admin ved første opstart

Ved opstart oprettes en superadmin **kun hvis der ikke allerede findes en aktiv admin/superadmin**.
Konfiguration:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD` (min. 12 tegn)
- `ADMIN_EMAIL`

Den oprettede standard-superadmin får `must_change_password=true`.

## Brugeradministration og password-flow

Backend endpoints:

- `GET /api/users/` – liste brugere (admin)
- `POST /api/users/` – opret bruger (admin)
- `PATCH /api/users/{user_id}` – redigér bruger (admin), eller skift eget kodeord (self-service)
- `DELETE /api/users/{user_id}` – slet bruger (admin)
- `POST /auth/token` / `POST /auth/logout` / `GET /auth/me`

Vigtige regler:

- Kun admin/superadmin kan administrere andre brugere
- Kun superadmin kan tildele/redigere/slette superadmin-brugere
- Self-service passwordskift kræver `old_password`

## Lokal kørsel

1. Kopiér `.env.example` til `.env` og udfyld værdier
2. Start backend:

```bash
cd backend/service1
python -m pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

3. Start frontend:

```bash
cd frontend
npm install
npm run dev
```

## Lokal test af brugeradministration

1. Log ind som superadmin
2. Gå til **Administration → Brugeradministration**
3. Opret bruger i hver rolle (`superadmin`, `admin`, `bruger`, `viewer`)
4. Test redigér rolle/status, sletning og admin-password-reset
5. Log ind som almindelig bruger og verificér:
   - Ingen adgang til administrationsside
   - Direkte API-kald til `/api/users/*` afvises
6. Test **Skift adgangskode**:
   - Kræver gammelt kodeord
   - Nyt kodeord gemmes først ved korrekt gammelt kodeord

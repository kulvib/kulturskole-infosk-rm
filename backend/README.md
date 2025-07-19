# Infoskaerm Klient & Backend

## Klient (Python, Windows)

- Automatisk registrering til backend
- Venter på godkendelse/navngivning
- Følger avanceret tidsplan (tænd, sluk, genstart, Chrome kiosk)
- Lukker ned i ferie/helligdage (DK, via [nager.at API](https://date.nager.at))
- Sender status til backend løbende
- Fast API-nøgle til autentificering

## Backend (FastAPI)

- API-nøgle beskyttelse
- Klient-registrering og status
- Godkend/navngiv klient i frontend/admin
- Klar til udvidelse med database

## Kom i gang

1. **Backend**:  
   - Sæt din faste API-nøgle i `main.py`
   - Kør med fx `uvicorn main:app --reload`
   - (Deploy fx på Render)

2. **Klient**:  
   - Sæt samme API-nøgle i `infoskaerm_client.py`
   - Installer Python 3 og requests
   - Kør scriptet på hver PC

3. **Godkendelse**:  
   - Klient vises som "pending", godkend og navngiv via admin/frontend eller PATCH `/api/clients/{client_id}/approve`

4. **Ferie/helligdage**:  
   - Klienten opdaterer og nedlukker automatisk

## Udvidelser

- Tilføj database til backend for persistent data
- Tilpas Chrome-styring (cache/cookie/refresh) efter behov
- Tilpas opdaterings-kommandoer til Linux eller anden software

---

**Spørg hvis du ønsker:**
- Database-integration
- Frontend til godkendelse/navngivning
- Linux-version af klient
- Yderligere sikkerhed

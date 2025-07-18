# Kulturskole Infoskærm

Dette repository indeholder backend, frontend og klient-agent til styring af Kulturskolens infoskærme.

## Backend

- FastAPI server med JWT login, klientoverblik, status, kommandoer og helligdags-API.

### Brug

1. Installer dependencies (fra requirements.txt)
2. Start serveren:  
   `uvicorn app:app --reload --host 0.0.0.0 --port 8000`
3. Standard login:  
   - Brugernavn: `admin`
   - Adgangskode: `admin123`

## Endpoints

- `/token` – Login (POST)
- `/clients` – Liste af klienter (GET, kræver login)
- `/heartbeat` – Klient sender status (POST)
- `/clients/{client_id}/command` – Sæt kommando til klient (POST/GET)
- `/holidays` – Få/ret helligdage (GET/POST)
- m.fl.

Se og tilpas i `backend/app.py` for flere detaljer.

## Frontend

- React eller Vue dashboard (placeres i `frontend/`)

## Client-Agent

- Python agent som kører på Ubuntu-klienter (placeres i `client-agent/`)

---

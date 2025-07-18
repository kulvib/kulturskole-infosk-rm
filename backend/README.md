# Kulturskole Infoskaerm Backend

FastAPI-backend med login til infoskærm-projektet.

## Brugernavn og kodeord

- **Brugernavn:** `admin`
- **Kodeord:** `admin123`

## Sådan starter du lokalt

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

API root: http://localhost:8000/api/ping

## Deploy på Render

- Deploy hele denne mappe som web service.
- Start-kommando:  
  `uvicorn main:app --host 0.0.0.0 --port 10000`
- Husk: Vercel-frontend-URL er sat i CORS i main.py

## Endpoints

- POST `/api/token` – login (brug form-data: username, password)
- GET `/api/me` – hent bruger (kræver token)
- GET `/api/ping` – test

## Dependencies

- Se requirements.txt – alle nødvendige pakker er med.

---

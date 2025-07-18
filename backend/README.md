# Kulturskole Infoskaerm Backend

FastAPI-backend til infoskærm-projektet.

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

- Deploy hele denne mappe som web service
- Start-kommando:  
  `uvicorn main:app --host 0.0.0.0 --port 10000`
- Husk: Vercel-frontend-URL er sat i CORS i main.py

## Struktur

- `main.py` – starter app, sætter CORS, router
- `app/` – kode (models, schemas, endpoints osv.)

## Dummy login/token

- For demo: brug token `secrettoken` for /api/secure-data

Udbyg CRUD, models og auth efter behov!

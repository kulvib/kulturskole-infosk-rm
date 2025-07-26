# Kulturskole Infoskaerm Backend

## Setup

```sh
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Første gang (init DB)

```sh
python -c 'from database import init_db; init_db()'
```

## Start server

```sh
uvicorn main:app --reload
```

## Opret admin-bruger manuelt i Python REPL

```python
from database import get_db
from models import AdminUser
from auth import get_password_hash
with next(get_db()) as db:
    u = AdminUser(username="admin", hashed_password=get_password_hash("KulVib2025info"))
    db.add(u)
    db.commit()
```

## API

- `/api/login` (POST): Login for admin (returnerer JWT-token)
- `/api/clients`: Klient management
- `/api/holidays`: Helligdagsstyring

## Bemærk

- Du skal bruge JWT-token fra login ved kald til beskyttede endpoints (Authorization: Bearer ...).

---

from fastapi import APIRouter, HTTPException
from backend.ws_manager import notify_clients_updated

router = APIRouter()

# Dummy-database
clients_db = [
    {"id": 1, "name": "Alice", "status": "approved"},
    {"id": 2, "name": "Bob", "status": "pending"},
]

@router.get("/clients/")
async def get_clients():
    return clients_db

@router.post("/clients/")
async def add_client(client: dict):
    clients_db.append(client)
    await notify_clients_updated()
    return client

@router.put("/clients/{client_id}")
async def update_client(client_id: int, client: dict):
    for idx, c in enumerate(clients_db):
        if c["id"] == client_id:
            clients_db[idx] = client
            await notify_clients_updated()
            return client
    raise HTTPException(status_code=404, detail="Client not found")

@router.delete("/clients/{client_id}")
async def delete_client(client_id: int):
    for idx, c in enumerate(clients_db):
        if c["id"] == client_id:
            del clients_db[idx]
            await notify_clients_updated()
            return {"ok": True}
    raise HTTPException(status_code=404, detail="Client not found")

from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_is_closed_invalid_date():
    response = client.get("/is_closed?date=not-a-date")
    assert response.status_code == 200
    assert "error" in response.json()

def test_is_closed_valid_date():
    # Antag at der ikke er helligdage i holidays.json for denne dato
    response = client.get("/is_closed?date=2031-08-15")
    assert response.status_code == 200
    assert "closed" in response.json()

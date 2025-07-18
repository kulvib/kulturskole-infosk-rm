import os
import uvicorn
from app.main import app

if __name__ == "__main__":
    # Brug Render's PORT miljøvariabel hvis den findes, ellers 8000
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)

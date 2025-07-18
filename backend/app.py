from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Kulturskole Infoskaerm backend kører!"}

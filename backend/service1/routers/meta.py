from fastapi import APIRouter

router = APIRouter(tags=["meta"])


@router.get("/meta")
def get_meta():
    """Minimal meta endpoint.

    main.py inkluderer meta.router. Denne router sikrer, at importen altid er gyldig,
    også hvis meta.py tidligere var tom.
    """
    return {"ok": True, "service": "clientflow-backend"}

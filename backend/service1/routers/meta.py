from fastapi import APIRouter, Request, Depends
from auth import get_current_admin_user

router = APIRouter()


@router.get("/meta/endpoints", tags=["Meta"])
async def get_openapi_spec(
    request: Request,
    admin=Depends(get_current_admin_user)   # Kun admin kan se API-strukturen
):
    """
    Returnerer hele OpenAPI-specifikationen for API'et.
    Kun tilgængelig for administratorer.
    """
    return request.app.openapi()

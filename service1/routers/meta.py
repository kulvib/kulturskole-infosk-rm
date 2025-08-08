from fastapi import APIRouter, Request

router = APIRouter()

@router.get("/meta/endpoints", tags=["Meta"])
async def get_openapi_spec(request: Request):
    """
    Returnerer hele OpenAPI-specifikationen for API'et (samtlige endpoints).
    """
    return request.app.openapi()

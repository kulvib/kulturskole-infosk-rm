from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.auth import authenticate_user, create_access_token, get_current_user

router = APIRouter()

@router.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # Debug: print modtaget data til logs
    print("FORM_DATA USERNAME:", form_data.username)
    print("FORM_DATA PASSWORD:", form_data.password)
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Forkert brugernavn eller adgangskode"
        )
    access_token = create_access_token(data={"username": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/protected")
def protected_route(current_user: dict = Depends(get_current_user)):
    return {"msg": f"Du er logget ind som {current_user['username']}"}

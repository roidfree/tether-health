from fastapi import APIRouter, Depends, HTTPException, status

from app.db.supabase_client import get_service_client
from app.deps import CurrentUser, get_current_user
from app.models.schemas import AuthResponse, LoginRequest, ProfileResponse, SignUpRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse)
def sign_up(payload: SignUpRequest):
    client = get_service_client()

    try:
        result = client.auth.sign_up(
            {"email": payload.email, "password": payload.password}
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if result.user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sign up failed")

    # Create the profile row now so onboarding has somewhere to write to.
    client.table("profiles").insert(
        {"id": result.user.id, "full_name": payload.full_name}
    ).execute()

    session = result.session
    return AuthResponse(
        access_token=session.access_token if session else "",
        refresh_token=session.refresh_token if session else None,
        user_id=result.user.id,
        email=result.user.email,
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest):
    client = get_service_client()

    try:
        result = client.auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        ) from exc

    return AuthResponse(
        access_token=result.session.access_token,
        refresh_token=result.session.refresh_token,
        user_id=result.user.id,
        email=result.user.email,
    )


@router.get("/me", response_model=ProfileResponse)
def get_me(current_user: CurrentUser = Depends(get_current_user)):
    client = get_service_client()
    result = (
        client.table("profiles").select("*").eq("id", current_user.id).single().execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return result.data

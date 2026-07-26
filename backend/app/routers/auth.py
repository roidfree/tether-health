from fastapi import APIRouter, Depends, HTTPException, status

from app.db.supabase_client import get_auth_client, get_service_client
from app.deps import CurrentUser, get_current_user, is_managed_by_carer
from app.models.schemas import AuthResponse, LoginRequest, ProfileResponse, RefreshRequest, SignUpRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse)
def sign_up(payload: SignUpRequest):
    try:
        result = get_auth_client().auth.sign_up(
            {"email": payload.email, "password": payload.password}
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if result.user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sign up failed")

    # Create the profile row now so onboarding has somewhere to write to.
    get_service_client().table("profiles").insert(
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
    try:
        result = get_auth_client().auth.sign_in_with_password(
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


@router.post("/refresh", response_model=AuthResponse)
def refresh(payload: RefreshRequest):
    try:
        result = get_auth_client().auth.refresh_session(payload.refresh_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token"
        ) from exc

    if result.session is None or result.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token"
        )

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
    return {**result.data, "is_managed": is_managed_by_carer(client, current_user.id)}

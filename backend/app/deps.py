from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.db.supabase_client import get_service_client, get_user_client

bearer_scheme = HTTPBearer()


@dataclass
class CurrentUser:
    id: str
    email: str | None
    access_token: str


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    token = credentials.credentials
    try:
        # Use a fresh, uncached client for token validation - the cached
        # service-role client is shared across all requests, and calling
        # .auth.get_user() on it mutates its auth state as a side effect,
        # which can leak a regular user's RLS-restricted identity into
        # other requests' "service role" DB calls.
        response = get_user_client(token).auth.get_user(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    user = response.user if response else None
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    return CurrentUser(id=user.id, email=user.email, access_token=token)


def get_user_db(current_user: CurrentUser = Depends(get_current_user)):
    """Supabase client scoped to the caller's JWT so RLS applies."""
    return get_user_client(current_user.access_token)


def is_managed_by_carer(client, user_id: str) -> bool:
    """True if some carer has linked to user_id as their cared-for - that
    person loses medication write access once linked (see TargetUser)."""
    result = client.table("carer_links").select("id").eq("cared_for_id", user_id).execute()
    return bool(result.data)


@dataclass
class TargetUser:
    id: str
    can_write: bool


def resolve_target_user(
    cared_for_id: str | None = None,
    current_user: CurrentUser = Depends(get_current_user),
) -> TargetUser:
    """Resolves which profile's data a request should act on, and whether the
    caller may write to it.

    No cared_for_id -> acting on your own data; write is denied only if some
    carer has linked to you (you're a managed cared-for).
    cared_for_id given -> acting as a carer on a specific cared-for's data;
    requires a carer_links row proving that link, and always grants write.
    """
    client = get_service_client()

    if cared_for_id is None:
        managed = is_managed_by_carer(client, current_user.id)
        return TargetUser(id=current_user.id, can_write=not managed)

    link = (
        client.table("carer_links")
        .select("id")
        .eq("carer_id", current_user.id)
        .eq("cared_for_id", cared_for_id)
        .execute()
    )
    if not link.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not linked to this cared-for account",
        )
    return TargetUser(id=cared_for_id, can_write=True)


def require_write(target: TargetUser) -> None:
    if not target.can_write:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is managed by a carer - medications can only be changed by them",
        )

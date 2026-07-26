from fastapi import APIRouter, Depends, HTTPException, status

from app.db.supabase_client import get_service_client
from app.deps import CurrentUser, get_current_user, is_managed_by_carer
from app.models.schemas import ProfileResponse, ProfileUpdate

router = APIRouter(prefix="/profile", tags=["profile"])


def _with_managed_flag(client, profile: dict) -> dict:
    return {**profile, "is_managed": is_managed_by_carer(client, profile["id"])}


@router.get("", response_model=ProfileResponse)
def get_profile(current_user: CurrentUser = Depends(get_current_user)):
    client = get_service_client()
    result = (
        client.table("profiles").select("*").eq("id", current_user.id).single().execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return _with_managed_flag(client, result.data)


@router.put("", response_model=ProfileResponse)
def update_profile(
    payload: ProfileUpdate, current_user: CurrentUser = Depends(get_current_user)
):
    client = get_service_client()
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    result = (
        client.table("profiles").update(updates).eq("id", current_user.id).execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return _with_managed_flag(client, result.data[0])

from fastapi import APIRouter, Depends, HTTPException, status

from app.db.supabase_client import get_service_client
from app.deps import TargetUser, require_write, resolve_target_user
from app.models.schemas import MedicationCreate, MedicationResponse, MedicationUpdate

router = APIRouter(prefix="/medications", tags=["medications"])


@router.get("", response_model=list[MedicationResponse])
def list_medications(target: TargetUser = Depends(resolve_target_user)):
    client = get_service_client()
    result = (
        client.table("medications")
        .select("*")
        .eq("user_id", target.id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.post("", response_model=MedicationResponse, status_code=status.HTTP_201_CREATED)
def create_medication(payload: MedicationCreate, target: TargetUser = Depends(resolve_target_user)):
    require_write(target)
    client = get_service_client()
    row = payload.model_dump()
    row["user_id"] = target.id
    result = client.table("medications").insert(row).execute()
    return result.data[0]


@router.put("/{medication_id}", response_model=MedicationResponse)
def update_medication(
    medication_id: str,
    payload: MedicationUpdate,
    target: TargetUser = Depends(resolve_target_user),
):
    require_write(target)
    client = get_service_client()
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    result = (
        client.table("medications")
        .update(updates)
        .eq("id", medication_id)
        .eq("user_id", target.id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medication not found")
    return result.data[0]


@router.delete("/{medication_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_medication(medication_id: str, target: TargetUser = Depends(resolve_target_user)):
    require_write(target)
    client = get_service_client()
    result = (
        client.table("medications")
        .delete()
        .eq("id", medication_id)
        .eq("user_id", target.id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medication not found")

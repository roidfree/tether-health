from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


# --- Auth --------------------------------------------------------------

class SignUpRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str | None
    user_id: str
    email: EmailStr | None


# --- Onboarding / profile ----------------------------------------------

class ProfileUpdate(BaseModel):
    full_name: str | None = None
    age: int | None = None
    phone: str | None = None
    preferred_language: str | None = None
    accountability_partner_name: str | None = None
    accountability_partner_relationship: str | None = None
    onboarding_completed: bool | None = None


class ProfileResponse(BaseModel):
    id: str
    full_name: str
    age: int | None
    phone: str | None
    preferred_language: str
    accountability_partner_name: str | None
    accountability_partner_relationship: str | None
    onboarding_completed: bool


# --- Medications ---------------------------------------------------------

class MedicationCreate(BaseModel):
    name: str
    dosage: str | None = None
    instructions: str | None = None
    frequency_per_day: int = 1
    scheduled_times: list[str] = Field(default_factory=list, description="HH:MM 24h times")
    days_of_week: list[int] = Field(default_factory=list, description="0=Sun..6=Sat, empty=every day")


class MedicationUpdate(BaseModel):
    name: str | None = None
    dosage: str | None = None
    instructions: str | None = None
    frequency_per_day: int | None = None
    scheduled_times: list[str] | None = None
    days_of_week: list[int] | None = None
    active: bool | None = None


class MedicationResponse(BaseModel):
    id: str
    user_id: str
    name: str
    dosage: str | None
    instructions: str | None
    frequency_per_day: int
    scheduled_times: list[str]
    days_of_week: list[int]
    active: bool
    created_at: datetime


# --- Medication logs / adherence ----------------------------------------

LogStatus = Literal["taken", "missed", "snoozed", "pending"]


class MedicationLogCreate(BaseModel):
    medication_id: str
    scheduled_for: datetime
    status: LogStatus = "pending"


class MedicationLogUpdate(BaseModel):
    status: LogStatus
    snoozed_until: datetime | None = None


class MedicationLogResponse(BaseModel):
    id: str
    medication_id: str
    scheduled_for: datetime
    status: LogStatus
    responded_at: datetime | None
    snoozed_until: datetime | None


class DashboardResponse(BaseModel):
    medications: list[MedicationResponse]
    recent_logs: list[MedicationLogResponse]


# --- Calls (LiveKit) -----------------------------------------------------

class CallStartRequest(BaseModel):
    medication_id: str
    medication_log_id: str | None = None


class CallStartResponse(BaseModel):
    call_id: str
    room_name: str
    livekit_url: str
    access_token: str
    medication_name: str | None = None


class CallOutcomeUpdate(BaseModel):
    status: Literal["ringing", "in_progress", "completed", "missed", "failed"]
    outcome: str | None = None

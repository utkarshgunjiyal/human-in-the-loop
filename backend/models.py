"""Pydantic data models. Designed for MongoDB but kept clean enough to map 1:1 to a
relational schema (PostgreSQL + SQLAlchemy) in the future. Each model represents a
single table/collection.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any, List, Optional
import uuid

from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, Field


def _to_str(v: Any) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    return str(v)


PyObjectId = Annotated[str, BeforeValidator(_to_str)]


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: Optional[str] = Field(default="REVIEWER")


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    username: str
    email: EmailStr
    role: str
    created_at: str


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------
class InvoiceFields(BaseModel):
    vendor: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    amount: Optional[float] = None
    description: Optional[str] = None


class InvoiceUpdate(BaseModel):
    vendor: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    amount: Optional[float] = None
    description: Optional[str] = None


class Invoice(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vendor: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    status: str = "HUMAN_REVIEW"  # APPROVED | REJECTED | HUMAN_REVIEW
    confidence_score: float = 0.0
    decision_reason: Optional[str] = None
    failed_rules: List[str] = Field(default_factory=list)
    passed_rules: List[str] = Field(default_factory=list)
    raw_text: Optional[str] = None
    filename: Optional[str] = None
    uploaded_by: Optional[str] = None  # user id
    extraction_method: str = "regex"  # "regex" | "llm" | "hybrid"
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str = Field(default_factory=utcnow_iso)


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------
class AuditLog(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_id: str
    action: str
    actor: Optional[str] = None  # user id or "system"
    actor_name: Optional[str] = None
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    notes: Optional[str] = None
    created_at: str = Field(default_factory=utcnow_iso)


# ---------------------------------------------------------------------------
# Auth response shapes
# ---------------------------------------------------------------------------
class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic

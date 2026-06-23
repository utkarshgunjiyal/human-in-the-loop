"""Audit trail helpers. Persist one row per invoice action."""
from __future__ import annotations

from typing import Optional

from database import db
from models import AuditLog


async def log_action(
    invoice_id: str,
    action: str,
    *,
    actor: Optional[str] = None,
    actor_name: Optional[str] = None,
    old_status: Optional[str] = None,
    new_status: Optional[str] = None,
    notes: Optional[str] = None,
) -> AuditLog:
    entry = AuditLog(
        invoice_id=invoice_id,
        action=action,
        actor=actor or "system",
        actor_name=actor_name or "system",
        old_status=old_status,
        new_status=new_status,
        notes=notes,
    )
    await db.audit_logs.insert_one(entry.model_dump())
    return entry


async def list_for_invoice(invoice_id: str) -> list[dict]:
    cursor = db.audit_logs.find({"invoice_id": invoice_id}, {"_id": 0}).sort("created_at", 1)
    return await cursor.to_list(length=500)

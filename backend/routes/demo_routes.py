"""Public read-only demo endpoints + seed. Recruiters can browse three pre-seeded
invoices without signing up, covering each terminal state.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from database import db
from models import Invoice
from services import audit
from services.rules_engine import evaluate
from services.decision_engine import decide
from models import InvoiceFields

router = APIRouter(prefix="/api/demo", tags=["demo"])


DEMO_FLAG = {"demo": True}
DEMO_USER_ID = "demo-user"
DEMO_USER_NAME = "Demo"


SAMPLES = [
    {
        "filename": "abc-traders.txt",
        "fields": InvoiceFields(
            vendor="ABC Traders",
            invoice_number="DEMO-APPROVED-001",
            invoice_date="2026-06-21",
            amount=45000.0,
            description="Cloud infrastructure services — Q2",
        ),
        "duplicate": False,
        "raw_text": (
            "Vendor: ABC Traders\n"
            "Invoice Number: DEMO-APPROVED-001\n"
            "Date: 2026-06-21\n"
            "Amount: 45000\n"
            "Description: Cloud infrastructure services — Q2"
        ),
    },
    {
        "filename": "globex-corp.txt",
        "fields": InvoiceFields(
            vendor="Globex Corp",
            invoice_number="DEMO-REVIEW-002",
            invoice_date="2026-06-22",
            amount=275000.0,
            description="Annual data-center colocation",
        ),
        "duplicate": False,
        "raw_text": (
            "Vendor: Globex Corp\n"
            "Invoice Number: DEMO-REVIEW-002\n"
            "Date: 2026-06-22\n"
            "Amount: 275000\n"
            "Description: Annual data-center colocation"
        ),
    },
    {
        "filename": "initech.txt",
        "fields": InvoiceFields(
            vendor="Initech",
            invoice_number="DEMO-APPROVED-001",  # duplicate on purpose
            invoice_date="2026-06-23",
            amount=12500.0,
            description="Printer maintenance contract",
        ),
        "duplicate": True,
        "raw_text": (
            "Vendor: Initech\n"
            "Invoice Number: DEMO-APPROVED-001\n"
            "Date: 2026-06-23\n"
            "Amount: 12500\n"
            "Description: Printer maintenance contract"
        ),
    },
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def seed_demo_invoices() -> None:
    """Idempotent: only seed when no demo docs exist."""
    existing = await db.invoices.count_documents(DEMO_FLAG)
    if existing >= len(SAMPLES):
        return

    # wipe partial demo state (so re-seed is deterministic)
    await db.invoices.delete_many(DEMO_FLAG)
    demo_ids = await db.invoices.distinct("id", DEMO_FLAG)
    if demo_ids:
        await db.audit_logs.delete_many({"invoice_id": {"$in": demo_ids}})

    seen_invoice_numbers: set[str] = set()
    for sample in SAMPLES:
        fields = sample["fields"]
        rules_result = evaluate(fields, seen_invoice_numbers)
        # confidence is high for clean samples
        confidence = 1.0
        decision = decide(rules_result, confidence)

        invoice = Invoice(
            id=str(uuid.uuid4()),
            vendor=fields.vendor,
            invoice_number=fields.invoice_number,
            invoice_date=fields.invoice_date,
            amount=fields.amount,
            description=fields.description,
            status=decision.status,
            decision_reason=decision.reason,
            confidence_score=confidence,
            passed_rules=rules_result.passed_rules,
            failed_rules=rules_result.failed_rules,
            raw_text=sample["raw_text"],
            filename=sample["filename"],
            uploaded_by=DEMO_USER_ID,
            extraction_method="regex",
            created_at=_now(),
            updated_at=_now(),
        )
        doc = invoice.model_dump()
        doc["demo"] = True
        await db.invoices.insert_one(doc)

        # audit trail mirrors the live pipeline
        await audit.log_action(invoice.id, "invoice_uploaded", actor=DEMO_USER_ID, actor_name=DEMO_USER_NAME, notes=sample["filename"])
        await audit.log_action(invoice.id, "fields_extracted", actor="system", actor_name="system", notes="method=regex, confidence=1.00")
        await audit.log_action(invoice.id, "rules_evaluated", actor="system", actor_name="system", notes="; ".join(rules_result.failed_rules) or "all passed")
        action_for_status = {
            "APPROVED": "auto_approved",
            "REJECTED": "auto_rejected",
            "HUMAN_REVIEW": "sent_to_human_review",
        }[decision.status]
        await audit.log_action(invoice.id, action_for_status, actor="system", actor_name="system", new_status=decision.status, notes=decision.reason)

        if not sample["duplicate"]:
            seen_invoice_numbers.add(fields.invoice_number)


# ---------------------------------------------------------------------------
# Public read-only endpoints
# ---------------------------------------------------------------------------
@router.get("/invoices")
async def list_demo_invoices():
    cursor = db.invoices.find(DEMO_FLAG, {"_id": 0, "raw_text": 0, "demo": 0}).sort("created_at", 1)
    items = await cursor.to_list(length=20)
    return {"items": items}


@router.get("/invoice/{invoice_id}")
async def get_demo_invoice(invoice_id: str):
    doc = await db.invoices.find_one({"id": invoice_id, "demo": True}, {"_id": 0, "demo": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Demo invoice not found")
    return doc


@router.get("/audit/{invoice_id}")
async def get_demo_audit(invoice_id: str):
    exists = await db.invoices.find_one({"id": invoice_id, "demo": True}, {"_id": 1})
    if not exists:
        raise HTTPException(status_code=404, detail="Demo invoice not found")
    items = await audit.list_for_invoice(invoice_id)
    return {"items": items}

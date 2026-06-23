"""Invoice routes: process, list, get, edit, approve, reject + audit listing."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from database import db
from models import Invoice, InvoiceUpdate
from services import audit
from services.auth import get_current_user
from services.decision_engine import decide
from services.extraction import extract_invoice, extract_text_from_upload
from services.rules_engine import evaluate

router = APIRouter(prefix="/api", tags=["invoices"])


ALLOWED_EXTENSIONS = {".pdf", ".txt"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _existing_invoice_numbers() -> set[str]:
    cursor = db.invoices.find(
        {"invoice_number": {"$ne": None}, "demo": {"$ne": True}},
        {"invoice_number": 1, "_id": 0},
    )
    return {doc["invoice_number"] for doc in await cursor.to_list(length=10_000) if doc.get("invoice_number")}


@router.post("/process", response_model=Invoice)
async def process_invoice(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    filename = file.filename or "invoice.txt"
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only .pdf and .txt files are supported")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    text = extract_text_from_upload(content, filename)

    # build a transient invoice id to use as LLM session id
    invoice = Invoice(filename=filename, raw_text=text, uploaded_by=user["id"])

    fields, confidence, method = await extract_invoice(text, session_id=invoice.id)

    existing_nums = await _existing_invoice_numbers()
    rules_result = evaluate(fields, existing_nums)
    decision = decide(rules_result, confidence)

    invoice.vendor = fields.vendor
    invoice.invoice_number = fields.invoice_number
    invoice.invoice_date = fields.invoice_date
    invoice.amount = fields.amount
    invoice.description = fields.description
    invoice.confidence_score = round(confidence, 2)
    invoice.extraction_method = method
    invoice.status = decision.status
    invoice.decision_reason = decision.reason
    invoice.passed_rules = rules_result.passed_rules
    invoice.failed_rules = rules_result.failed_rules
    invoice.created_at = _now()
    invoice.updated_at = invoice.created_at

    await db.invoices.insert_one(invoice.model_dump())

    # Audit trail
    await audit.log_action(invoice.id, "invoice_uploaded", actor=user["id"], actor_name=user["username"], notes=filename)
    await audit.log_action(invoice.id, "fields_extracted", actor="system", actor_name="system", notes=f"method={method}, confidence={invoice.confidence_score}")
    await audit.log_action(invoice.id, "rules_evaluated", actor="system", actor_name="system", notes="; ".join(rules_result.failed_rules) or "all passed")
    action_for_status = {
        "APPROVED": "auto_approved",
        "REJECTED": "auto_rejected",
        "HUMAN_REVIEW": "sent_to_human_review",
    }[decision.status]
    await audit.log_action(invoice.id, action_for_status, actor="system", actor_name="system", new_status=decision.status, notes=decision.reason)

    return invoice


@router.get("/invoices")
async def list_invoices(
    status: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    sort: str = Query(default="-created_at"),
    limit: int = Query(default=100, le=500),
    user: dict = Depends(get_current_user),
):
    query: dict = {"demo": {"$ne": True}}
    if status and status.upper() in {"APPROVED", "REJECTED", "HUMAN_REVIEW"}:
        query["status"] = status.upper()
    if search:
        regex = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"vendor": regex},
            {"invoice_number": regex},
            {"description": regex},
            {"filename": regex},
        ]

    sort_field = sort.lstrip("-")
    direction = -1 if sort.startswith("-") else 1
    cursor = db.invoices.find(query, {"_id": 0, "raw_text": 0}).sort(sort_field, direction).limit(limit)
    return {"items": await cursor.to_list(length=limit)}


@router.get("/invoice/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    doc = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return doc


@router.put("/invoice/{invoice_id}", response_model=Invoice)
async def edit_invoice(invoice_id: str, payload: InvoiceUpdate, user: dict = Depends(get_current_user)):
    doc = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")

    update = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not update:
        return doc

    # If invoice number changed, re-check uniqueness
    if "invoice_number" in update and update["invoice_number"] != doc.get("invoice_number"):
        clash = await db.invoices.find_one({"invoice_number": update["invoice_number"], "id": {"$ne": invoice_id}})
        if clash:
            raise HTTPException(status_code=400, detail="Another invoice already uses this invoice number")

    update["updated_at"] = _now()
    await db.invoices.update_one({"id": invoice_id}, {"$set": update})
    new_doc = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})

    await audit.log_action(
        invoice_id,
        "edited_by_reviewer",
        actor=user["id"],
        actor_name=user["username"],
        notes=", ".join(f"{k}={v}" for k, v in update.items() if k != "updated_at"),
    )
    return new_doc


@router.post("/approve/{invoice_id}", response_model=Invoice)
async def approve_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    doc = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")

    old_status = doc.get("status")
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {"status": "APPROVED", "decision_reason": f"Approved by {user['username']}", "updated_at": _now()}},
    )
    await audit.log_action(
        invoice_id,
        "approved_by_reviewer",
        actor=user["id"],
        actor_name=user["username"],
        old_status=old_status,
        new_status="APPROVED",
    )
    return await db.invoices.find_one({"id": invoice_id}, {"_id": 0})


@router.post("/reject/{invoice_id}", response_model=Invoice)
async def reject_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    doc = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")

    old_status = doc.get("status")
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {"status": "REJECTED", "decision_reason": f"Rejected by {user['username']}", "updated_at": _now()}},
    )
    await audit.log_action(
        invoice_id,
        "rejected_by_reviewer",
        actor=user["id"],
        actor_name=user["username"],
        old_status=old_status,
        new_status="REJECTED",
    )
    return await db.invoices.find_one({"id": invoice_id}, {"_id": 0})


@router.get("/audit/{invoice_id}")
async def get_audit_trail(invoice_id: str, user: dict = Depends(get_current_user)):
    items = await audit.list_for_invoice(invoice_id)
    return {"items": items}

"""Invoice extraction. Two-stage pipeline:
1. Regex-based parser (fast, no API cost)
2. LLM fallback (Anthropic Claude) when fields are missing or confidence is low
"""
from __future__ import annotations

import io
import json
import logging
import os
import re
from typing import Tuple

from anthropic import AsyncAnthropic
from pypdf import PdfReader

from models import InvoiceFields

logger = logging.getLogger("invoice-api.extraction")

# Model is configurable so the deployment can track the latest Claude release
# without a code change. Override via the ANTHROPIC_MODEL env var.
_DEFAULT_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")


# ---------------------------------------------------------------------------
# Text extraction from upload (bytes -> raw text)
# ---------------------------------------------------------------------------
def extract_text_from_upload(content: bytes, filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        try:
            reader = PdfReader(io.BytesIO(content))
            parts = []
            for page in reader.pages:
                txt = page.extract_text() or ""
                parts.append(txt)
            return "\n".join(parts).strip()
        except Exception:
            return ""
    # txt or anything else: decode best-effort
    try:
        return content.decode("utf-8", errors="ignore").strip()
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# Regex parser
# ---------------------------------------------------------------------------
_VENDOR_RE = re.compile(r"vendor\s*[:\-]\s*(.+)", re.IGNORECASE)
_INV_NUM_RE = re.compile(r"invoice\s*(?:number|no\.?|#)?\s*[:\-]?\s*([A-Z0-9\-_/]{3,40})", re.IGNORECASE)
_DATE_RE = re.compile(r"(?:invoice\s*)?date\s*[:\-]\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})", re.IGNORECASE)
_AMOUNT_RE = re.compile(r"(?:amount|total|grand\s*total)\s*[:\-]?\s*\$?([0-9][\d,]*\.?\d{0,2})", re.IGNORECASE)
_DESC_RE = re.compile(r"description\s*[:\-]\s*(.+)", re.IGNORECASE)


def _clean_number(raw: str) -> float | None:
    try:
        return float(raw.replace(",", "").strip())
    except Exception:
        return None


def regex_extract(text: str) -> Tuple[InvoiceFields, float]:
    """Run the regex parser. Returns (fields, confidence)."""
    fields = InvoiceFields()

    if m := _VENDOR_RE.search(text):
        fields.vendor = m.group(1).split("\n")[0].strip()[:120]
    if m := _INV_NUM_RE.search(text):
        fields.invoice_number = m.group(1).strip()
    if m := _DATE_RE.search(text):
        fields.invoice_date = m.group(1).strip()
    if m := _AMOUNT_RE.search(text):
        fields.amount = _clean_number(m.group(1))
    if m := _DESC_RE.search(text):
        fields.description = m.group(1).split("\n")[0].strip()[:500]

    score = sum(1 for v in fields.model_dump().values() if v not in (None, "")) / 5.0
    return fields, score


# ---------------------------------------------------------------------------
# LLM fallback
# ---------------------------------------------------------------------------
async def llm_extract(text: str, session_id: str) -> InvoiceFields:
    """Use Anthropic Claude to extract invoice fields as a JSON object.

    Returns an empty ``InvoiceFields`` when the API key is unset, the input is
    blank, or the call fails — extraction degrades to the regex result rather
    than raising, so a missing/invalid key never breaks the upload flow.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key or not text.strip():
        return InvoiceFields()

    system = (
        "You are an invoice parser. Extract these fields from the invoice text and "
        "respond with a single JSON object only, no markdown, no commentary. "
        "Keys: vendor (string), invoice_number (string), invoice_date (string in YYYY-MM-DD or original), "
        "amount (number, no currency symbol), description (short string). "
        "Use null when a field is genuinely not present."
    )

    client = AsyncAnthropic(api_key=api_key)
    try:
        message = await client.messages.create(
            model=_DEFAULT_MODEL,
            max_tokens=512,
            system=system,
            messages=[{"role": "user", "content": text[:6000]}],
            metadata={"user_id": session_id} if session_id else None,
        )
    except Exception as exc:  # network, auth, rate-limit, bad model id, etc.
        logger.warning("LLM extraction failed (session=%s): %s", session_id, exc)
        return InvoiceFields()

    raw = "".join(
        block.text for block in message.content if getattr(block, "type", None) == "text"
    ).strip()

    # strip code fences if the model wrapped the JSON
    raw = re.sub(r"^```(?:json)?|```$", "", raw, flags=re.MULTILINE).strip()
    try:
        data = json.loads(raw)
    except Exception:
        # try to find a JSON object substring
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            return InvoiceFields()
        try:
            data = json.loads(match.group(0))
        except Exception:
            return InvoiceFields()

    amount = data.get("amount")
    if isinstance(amount, str):
        amount = _clean_number(amount)
    return InvoiceFields(
        vendor=data.get("vendor") or None,
        invoice_number=data.get("invoice_number") or None,
        invoice_date=data.get("invoice_date") or None,
        amount=amount if isinstance(amount, (int, float)) else None,
        description=data.get("description") or None,
    )


# ---------------------------------------------------------------------------
# Combined hybrid extract
# ---------------------------------------------------------------------------
async def extract_invoice(text: str, session_id: str) -> Tuple[InvoiceFields, float, str]:
    """Hybrid extraction. Returns (fields, confidence, method).

    Method values: "regex" | "hybrid" | "llm"
    """
    regex_fields, regex_score = regex_extract(text)

    if regex_score >= 0.8:
        return regex_fields, regex_score, "regex"

    llm_fields = await llm_extract(text, session_id=session_id)

    # merge: prefer regex value when present, else fill from LLM
    merged = InvoiceFields(
        vendor=regex_fields.vendor or llm_fields.vendor,
        invoice_number=regex_fields.invoice_number or llm_fields.invoice_number,
        invoice_date=regex_fields.invoice_date or llm_fields.invoice_date,
        amount=regex_fields.amount if regex_fields.amount is not None else llm_fields.amount,
        description=regex_fields.description or llm_fields.description,
    )
    merged_score = sum(1 for v in merged.model_dump().values() if v not in (None, "")) / 5.0

    # method classification
    if regex_score == 0:
        method = "llm"
    else:
        method = "hybrid"
    return merged, merged_score, method

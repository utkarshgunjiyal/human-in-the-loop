"""Rules engine. Pure functions — no DB. Caller must pass `existing_invoice_numbers`
to detect duplicates.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, List, Set

from models import InvoiceFields


HUMAN_REVIEW_THRESHOLD = 100_000.0


@dataclass
class RulesResult:
    passed_rules: List[str] = field(default_factory=list)
    failed_rules: List[str] = field(default_factory=list)
    decision_reason: str = ""
    suggested_status: str = "APPROVED"


def evaluate(fields: InvoiceFields, existing_invoice_numbers: Iterable[str]) -> RulesResult:
    result = RulesResult()
    existing: Set[str] = {x for x in existing_invoice_numbers if x}

    # missing field rules -> HUMAN_REVIEW
    if not (fields.vendor and fields.vendor.strip()):
        result.failed_rules.append("Missing vendor")
    else:
        result.passed_rules.append("Vendor present")

    if not (fields.invoice_number and fields.invoice_number.strip()):
        result.failed_rules.append("Missing invoice number")
    else:
        result.passed_rules.append("Invoice number present")

    if not (fields.invoice_date and fields.invoice_date.strip()):
        result.failed_rules.append("Missing invoice date")
    else:
        result.passed_rules.append("Invoice date present")

    if fields.amount is None:
        result.failed_rules.append("Missing amount")
    else:
        result.passed_rules.append("Amount present")

    # high-value rule
    if fields.amount is not None and fields.amount > HUMAN_REVIEW_THRESHOLD:
        result.failed_rules.append(f"Amount exceeds {HUMAN_REVIEW_THRESHOLD:.0f} threshold")
    elif fields.amount is not None:
        result.passed_rules.append("Amount within threshold")

    # duplicate -> REJECTED takes priority
    is_duplicate = bool(fields.invoice_number and fields.invoice_number.strip() in existing)
    if is_duplicate:
        result.failed_rules.append("Duplicate invoice number")
        result.suggested_status = "REJECTED"
        result.decision_reason = (
            f"Invoice number '{fields.invoice_number}' already exists in the system."
        )
        return result

    if result.failed_rules:
        result.suggested_status = "HUMAN_REVIEW"
        result.decision_reason = "Failed rules: " + "; ".join(result.failed_rules)
    else:
        result.suggested_status = "APPROVED"
        result.decision_reason = "All validation rules passed."

    return result

"""Decision engine. Currently a thin layer on top of rules engine, kept separate so
business policy can evolve (e.g., add ML scoring, vendor-specific limits, etc.).
"""
from __future__ import annotations

from dataclasses import dataclass

from services.rules_engine import RulesResult


VALID_STATUSES = {"APPROVED", "REJECTED", "HUMAN_REVIEW"}


@dataclass
class Decision:
    status: str
    reason: str


def decide(rules_result: RulesResult, confidence_score: float) -> Decision:
    status = rules_result.suggested_status
    reason = rules_result.decision_reason

    # Confidence override: very low confidence on auto-approve -> human review
    if status == "APPROVED" and confidence_score < 0.85:
        status = "HUMAN_REVIEW"
        reason = f"Low extraction confidence ({confidence_score:.2f}); routed to human review."

    if status not in VALID_STATUSES:
        status = "HUMAN_REVIEW"
        reason = reason or "Unknown decision; defaulting to human review."

    return Decision(status=status, reason=reason)

"""Dashboard / stats routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from database import db
from services.auth import get_current_user

router = APIRouter(prefix="/api", tags=["dashboard"])

# Demo invoices are surfaced only on the public /demo page, never on the real dashboard.
NON_DEMO = {"demo": {"$ne": True}}


@router.get("/stats")
async def get_stats(user: dict = Depends(get_current_user)):
    # counts (exclude demo)
    total = await db.invoices.count_documents(NON_DEMO)
    approved = await db.invoices.count_documents({**NON_DEMO, "status": "APPROVED"})
    rejected = await db.invoices.count_documents({**NON_DEMO, "status": "REJECTED"})
    human_review = await db.invoices.count_documents({**NON_DEMO, "status": "HUMAN_REVIEW"})

    # aggregates
    agg = await db.invoices.aggregate(
        [
            {"$match": NON_DEMO},
            {
                "$group": {
                    "_id": None,
                    "total_amount": {"$sum": {"$ifNull": ["$amount", 0]}},
                    "avg_confidence": {"$avg": "$confidence_score"},
                }
            },
        ]
    ).to_list(length=1)
    total_amount = agg[0]["total_amount"] if agg else 0
    avg_conf = agg[0]["avg_confidence"] if agg else 0
    avg_conf = round(avg_conf or 0, 2)

    # recent activity: skip demo-invoice events
    demo_ids = await db.invoices.distinct("id", {"demo": True})
    recent = (
        await db.audit_logs.find(
            {"invoice_id": {"$nin": demo_ids}}, {"_id": 0}
        )
        .sort("created_at", -1)
        .limit(10)
        .to_list(length=10)
    )

    return {
        "total_invoices": total,
        "approved": approved,
        "rejected": rejected,
        "human_review": human_review,
        "total_amount_processed": round(total_amount, 2),
        "average_confidence_score": avg_conf,
        "recent_activity": recent,
    }

"""End-to-end backend API tests for AI Invoice Review System.

Covers: health, auth (signup/login/me/duplicate), invoice processing (approve/HR/duplicate),
list/filter/search, invoice detail, edit, approve, reject, audit trail, dashboard stats,
and unauthorized access protection.
"""
import io
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@invoiceai.com"
ADMIN_PASSWORD = "Admin@123"

SAMPLE_OK = (
    "Vendor: ABC Traders\n"
    "Invoice Number: INV-{n}\n"
    "Date: 2026-06-23\n"
    "Amount: 45000\n"
    "Description: Cloud infrastructure services\n"
)

SAMPLE_HIGH = (
    "Vendor: BigCorp\n"
    "Invoice Number: INV-HIGH-{n}\n"
    "Date: 2026-06-23\n"
    "Amount: 250000\n"
    "Description: Enterprise contract\n"
)

SAMPLE_MISSING_VENDOR = (
    "Invoice Number: INV-MISS-{n}\n"
    "Date: 2026-06-23\n"
    "Amount: 4000\n"
    "Description: Anonymous\n"
)


@pytest.fixture(scope="session")
def session():
    return requests.Session()


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{API}/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
def test_health(session):
    r = session.get(f"{API}/health", timeout=10)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class TestAuth:
    def test_login_admin(self, session):
        r = session.post(f"{API}/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data and len(data["access_token"]) > 20
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "ADMIN"
        assert "password_hash" not in data["user"]

    def test_login_invalid(self, session):
        r = session.post(f"{API}/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_signup_creates_reviewer(self, session):
        email = f"test_signup_{uuid.uuid4().hex[:8]}@example.com"
        r = session.post(f"{API}/signup", json={
            "username": "TestUser",
            "email": email,
            "password": "TestPass@123",
            "role": "REVIEWER",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["email"] == email
        assert data["user"]["role"] == "REVIEWER"
        assert "access_token" in data

    def test_signup_duplicate_rejected(self, session):
        email = f"test_dup_{uuid.uuid4().hex[:8]}@example.com"
        first = session.post(f"{API}/signup", json={
            "username": "Dup",
            "email": email,
            "password": "TestPass@123",
        })
        assert first.status_code == 200
        second = session.post(f"{API}/signup", json={
            "username": "Dup2",
            "email": email,
            "password": "TestPass@123",
        })
        assert second.status_code == 400

    def test_auth_me(self, session, auth_headers):
        r = session.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert "password_hash" not in data


# ---------------------------------------------------------------------------
# Auth protection
# ---------------------------------------------------------------------------
class TestAuthProtection:
    def test_invoices_requires_auth(self):
        # fresh client with no cookies / no Authorization header
        r = requests.get(f"{API}/invoices")
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_stats_requires_auth(self):
        r = requests.get(f"{API}/stats")
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


# ---------------------------------------------------------------------------
# Invoice processing (rules + decision)
# ---------------------------------------------------------------------------
def _upload(session, headers, content: str, filename: str):
    files = {"file": (filename, io.BytesIO(content.encode("utf-8")), "text/plain")}
    return session.post(f"{API}/process", headers=headers, files=files, timeout=60)


@pytest.fixture(scope="session")
def created_invoices(session, auth_headers):
    """Upload one of each kind and stash IDs for reuse."""
    suffix = uuid.uuid4().hex[:6].upper()
    out = {}

    # APPROVED case
    r = _upload(session, auth_headers, SAMPLE_OK.format(n=f"OK{suffix}"), f"ok_{suffix}.txt")
    assert r.status_code == 200, f"approved upload failed: {r.status_code} {r.text}"
    out["approved"] = r.json()

    # HIGH amount -> HUMAN_REVIEW
    r = _upload(session, auth_headers, SAMPLE_HIGH.format(n=f"HI{suffix}"), f"high_{suffix}.txt")
    assert r.status_code == 200
    out["high"] = r.json()

    # Missing vendor -> HUMAN_REVIEW
    r = _upload(session, auth_headers, SAMPLE_MISSING_VENDOR.format(n=f"MV{suffix}"), f"missing_{suffix}.txt")
    assert r.status_code == 200
    out["missing"] = r.json()

    out["suffix"] = suffix
    return out


class TestInvoiceProcessing:
    def test_approved_path(self, created_invoices):
        inv = created_invoices["approved"]
        assert inv["vendor"], "vendor must be extracted"
        # Allow case/whitespace variance
        assert "ABC" in (inv["vendor"] or "").upper()
        assert inv["amount"] == 45000 or inv["amount"] == 45000.0
        assert inv["invoice_number"].startswith("INV-OK") or inv["invoice_number"].startswith("INV-")
        # APPROVED if confidence >= 0.85, else HUMAN_REVIEW (decision engine override)
        assert inv["status"] in ("APPROVED", "HUMAN_REVIEW")
        if inv["status"] == "APPROVED":
            assert "All validation rules passed" in (inv.get("decision_reason") or "")

    def test_high_amount_human_review(self, created_invoices):
        inv = created_invoices["high"]
        assert inv["status"] == "HUMAN_REVIEW", f"expected HUMAN_REVIEW, got {inv['status']}"
        joined = " ".join(inv.get("failed_rules") or [])
        assert "exceeds" in joined.lower() and "100000" in joined

    def test_missing_field_human_review(self, created_invoices):
        inv = created_invoices["missing"]
        assert inv["status"] == "HUMAN_REVIEW"
        joined = " ".join(inv.get("failed_rules") or []).lower()
        assert "vendor" in joined

    def test_duplicate_rejected(self, session, auth_headers, created_invoices):
        # Re-upload the same OK invoice content (same invoice_number)
        suffix = created_invoices["suffix"]
        r = _upload(session, auth_headers, SAMPLE_OK.format(n=f"OK{suffix}"), f"dup_{suffix}.txt")
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["status"] == "REJECTED", f"expected REJECTED, got {inv['status']}"
        assert "already exists" in (inv.get("decision_reason") or "").lower()


# ---------------------------------------------------------------------------
# Invoice listing / detail / mutation / audit
# ---------------------------------------------------------------------------
class TestInvoiceCRUD:
    def test_list_all(self, session, auth_headers, created_invoices):
        r = session.get(f"{API}/invoices", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()["items"]
        ids = {i["id"] for i in items}
        for key in ("approved", "high", "missing"):
            assert created_invoices[key]["id"] in ids, f"missing {key} invoice in list"

    def test_list_status_filter(self, session, auth_headers, created_invoices):
        r = session.get(f"{API}/invoices", headers=auth_headers, params={"status": "HUMAN_REVIEW"})
        assert r.status_code == 200
        for item in r.json()["items"]:
            assert item["status"] == "HUMAN_REVIEW"

    def test_list_search_filter(self, session, auth_headers, created_invoices):
        r = session.get(f"{API}/invoices", headers=auth_headers, params={"search": "ABC"})
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 1
        joined = " ".join((it.get("vendor") or "") for it in items).upper()
        assert "ABC" in joined

    def test_get_invoice_detail(self, session, auth_headers, created_invoices):
        inv_id = created_invoices["approved"]["id"]
        r = session.get(f"{API}/invoice/{inv_id}", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == inv_id
        assert "raw_text" in data
        assert isinstance(data.get("passed_rules"), list)
        assert isinstance(data.get("failed_rules"), list)

    def test_edit_invoice_writes_audit(self, session, auth_headers, created_invoices):
        inv_id = created_invoices["missing"]["id"]
        new_vendor = "EDITED_VENDOR_" + uuid.uuid4().hex[:4]
        r = session.put(f"{API}/invoice/{inv_id}", headers=auth_headers, json={"vendor": new_vendor})
        assert r.status_code == 200, r.text
        assert r.json()["vendor"] == new_vendor
        # verify persistence
        g = session.get(f"{API}/invoice/{inv_id}", headers=auth_headers)
        assert g.json()["vendor"] == new_vendor
        # audit
        a = session.get(f"{API}/audit/{inv_id}", headers=auth_headers)
        actions = [x["action"] for x in a.json()["items"]]
        assert "edited_by_reviewer" in actions

    def test_approve_writes_audit(self, session, auth_headers, created_invoices):
        inv_id = created_invoices["high"]["id"]
        r = session.post(f"{API}/approve/{inv_id}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "APPROVED"
        a = session.get(f"{API}/audit/{inv_id}", headers=auth_headers)
        actions = [x["action"] for x in a.json()["items"]]
        assert "approved_by_reviewer" in actions

    def test_reject_writes_audit(self, session, auth_headers, created_invoices):
        inv_id = created_invoices["missing"]["id"]
        r = session.post(f"{API}/reject/{inv_id}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "REJECTED"
        a = session.get(f"{API}/audit/{inv_id}", headers=auth_headers)
        actions = [x["action"] for x in a.json()["items"]]
        assert "rejected_by_reviewer" in actions

    def test_audit_trail_order(self, session, auth_headers, created_invoices):
        inv_id = created_invoices["approved"]["id"]
        a = session.get(f"{API}/audit/{inv_id}", headers=auth_headers)
        assert a.status_code == 200
        items = a.json()["items"]
        actions = [x["action"] for x in items]
        # must contain the initial pipeline
        assert "invoice_uploaded" in actions
        assert "fields_extracted" in actions
        assert "rules_evaluated" in actions


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
class TestDashboard:
    def test_stats_shape(self, session, auth_headers, created_invoices):
        r = session.get(f"{API}/stats", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        for k in (
            "total_invoices",
            "approved",
            "rejected",
            "human_review",
            "total_amount_processed",
            "average_confidence_score",
            "recent_activity",
        ):
            assert k in data, f"missing key {k} in /stats"
        assert isinstance(data["recent_activity"], list)
        assert data["total_invoices"] >= 3

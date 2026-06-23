"""Auth routes: /signup, /login, /logout, /me."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response

from database import db
from models import AuthResponse, UserCreate, UserLogin, UserPublic
from services.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api", tags=["auth"])

ALLOWED_ROLES = {"ADMIN", "REVIEWER"}


def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=60 * 60 * 12,
        path="/",
    )


def _to_public(user: dict) -> UserPublic:
    return UserPublic(
        id=user["id"],
        username=user["username"],
        email=user["email"],
        role=user["role"],
        created_at=user["created_at"],
    )


@router.post("/signup", response_model=AuthResponse)
async def signup(payload: UserCreate, response: Response):
    email = payload.email.lower().strip()
    role = (payload.role or "REVIEWER").upper()
    if role not in ALLOWED_ROLES:
        role = "REVIEWER"

    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_doc = {
        "id": str(uuid.uuid4()),
        "username": payload.username.strip(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "role": role,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_doc["id"], user_doc["email"], user_doc["role"])
    _set_cookie(response, token)
    return AuthResponse(access_token=token, user=_to_public(user_doc))


@router.post("/login", response_model=AuthResponse)
async def login(payload: UserLogin, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user["id"], user["email"], user["role"])
    _set_cookie(response, token)
    return AuthResponse(access_token=token, user=_to_public(user))


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@router.get("/auth/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return _to_public(user)


async def seed_default_users():
    """Idempotent admin + reviewer seed run at app startup."""
    seeds = [
        {
            "email": os.environ.get("ADMIN_EMAIL", "admin@invoiceai.com").lower(),
            "password": os.environ.get("ADMIN_PASSWORD", "Admin@123"),
            "username": "Admin",
            "role": "ADMIN",
        },
        {
            "email": os.environ.get("REVIEWER_EMAIL", "reviewer@invoiceai.com").lower(),
            "password": os.environ.get("REVIEWER_PASSWORD", "Reviewer@123"),
            "username": "Reviewer",
            "role": "REVIEWER",
        },
    ]
    for seed in seeds:
        existing = await db.users.find_one({"email": seed["email"]})
        if existing is None:
            await db.users.insert_one(
                {
                    "id": str(uuid.uuid4()),
                    "username": seed["username"],
                    "email": seed["email"],
                    "password_hash": hash_password(seed["password"]),
                    "role": seed["role"],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            )
        elif not verify_password(seed["password"], existing["password_hash"]):
            await db.users.update_one(
                {"email": seed["email"]},
                {"$set": {"password_hash": hash_password(seed["password"])}},
            )

"""FastAPI entry point for the AI-Powered Human-in-the-Loop Invoice Review System."""
from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402

from database import client, db  # noqa: E402
from routes import auth_routes, dashboard_routes, invoice_routes  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("invoice-api")


app = FastAPI(title="AI Invoice Review API", version="1.0.0")

# Routers
app.include_router(auth_routes.router)
app.include_router(invoice_routes.router)
app.include_router(dashboard_routes.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# CORS
_origins_env = os.environ.get("CORS_ORIGINS", "*").strip()
if _origins_env in ("", "*"):
    origins = ["*"]
else:
    origins = [o.strip() for o in _origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False if origins == ["*"] else True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.invoices.create_index("id", unique=True)
    await db.invoices.create_index("invoice_number")
    await db.invoices.create_index("status")
    await db.audit_logs.create_index("invoice_id")

    # Seed default admin + reviewer
    await auth_routes.seed_default_users()
    logger.info("Startup complete. Database=%s", os.environ.get("DB_NAME"))


@app.on_event("shutdown")
async def on_shutdown():
    client.close()

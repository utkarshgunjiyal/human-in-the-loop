# AI-Powered Human-in-the-Loop Invoice Review System

> Production-style full-stack project that automates invoice intake, validates each
> document against a deterministic rules engine, routes ambiguous cases to a human
> reviewer, and tracks every action in an immutable audit trail.

**Stack:** React (CRA) · FastAPI · MongoDB (Motor) · JWT auth · Emergent LLM (Claude
Sonnet 4.6) · Docker · Tailwind / shadcn-ui

---

## Problem Statement

Enterprise finance teams receive thousands of invoices a day from many vendors.
Manually checking each one for completeness, duplicates, suspicious amounts and
policy violations is slow and error-prone. This system automates the boring part
(extraction + validation) while keeping humans firmly in the loop on every
ambiguous, high-value or duplicate case — and records every action so auditors can
replay exactly how each decision was made.

---

## Features

- **JWT auth** with two roles: `ADMIN`, `REVIEWER`. Seeded admin + reviewer at startup.
- **Two-stage extraction**: deterministic regex parser, with an LLM fallback (Claude
  Sonnet via the Emergent universal key) when fields are missing or confidence is low.
- **Rules Engine** with the exact policies specified:
  - Missing vendor / invoice number / amount / date → `HUMAN_REVIEW`
  - Amount > 100,000 → `HUMAN_REVIEW`
  - Duplicate invoice number → `REJECTED`
  - Otherwise → `APPROVED`
- **Decision Engine** that layers a confidence-score override on top of rules (low
  confidence auto-approves are rerouted to humans).
- **Reviewer console**: edit any field, save, approve, reject — each step is logged.
- **Audit trail** for every invoice: upload → extract → rules → decision → human
  actions, with actor, timestamps and notes.
- **Dashboard** with totals, status breakdown, total amount processed, average
  confidence score and a recent-activity feed.
- **Searchable/filterable/sortable invoice queue** with status badges.
- **Swiss / high-contrast** SaaS UI: Chivo + IBM Plex Sans + JetBrains Mono,
  rigid grid, cobalt accent, square corners, sharp focus rings.
- **Docker Compose** that brings up MongoDB + backend + frontend with one command.

---

## Architecture

```
┌────────────────────┐         ┌──────────────────────────────┐
│  React (CRA, JSX)  │  HTTPS  │  FastAPI                     │
│  ─ AuthContext     │ ──────▶ │  /api/auth   /api/process    │
│  ─ Pages           │ ◀────── │  /api/invoices /api/stats    │
│  ─ shadcn / tailw. │  JWT    │  /api/audit  /api/health     │
└────────────────────┘         │                              │
                               │  services/                   │
                               │   ├── extraction (regex+LLM) │
                               │   ├── rules_engine           │
                               │   ├── decision_engine        │
                               │   ├── audit                  │
                               │   └── auth (JWT, bcrypt)     │
                               └───────────────┬──────────────┘
                                               │
                                               ▼
                                       ┌────────────────┐
                                       │  MongoDB       │
                                       │  users,        │
                                       │  invoices,     │
                                       │  audit_logs    │
                                       └────────────────┘
```

---

## Workflow

```
upload ─▶ text extract ─▶ regex parse ─▶ (low conf?) ─▶ LLM extract ─▶ merge
                                                                       │
                                                                       ▼
                                                                rules engine
                                                                       │
                                                                       ▼
                                                            ┌──── decision ────┐
                                                            │                  │
                                                       APPROVED            REJECTED
                                                            │                  │
                                                            │            (duplicate)
                                                            ▼
                                                       HUMAN_REVIEW ─▶ reviewer edits/approves/rejects
                                                            │
                                                            ▼
                                                       audit_logs (every step)
```

---

## Database Schema (mapped 1:1 to a future PostgreSQL migration)

### `users`
| field          | type     | notes                       |
|----------------|----------|-----------------------------|
| id             | string   | UUID v4                     |
| username       | string   |                             |
| email          | string   | unique, lowercased          |
| password_hash  | string   | bcrypt                      |
| role           | string   | `ADMIN` \| `REVIEWER`       |
| created_at     | ISO date |                             |

### `invoices`
| field             | type      | notes                                   |
|-------------------|-----------|-----------------------------------------|
| id                | string    | UUID v4                                 |
| vendor            | string?   |                                         |
| invoice_number    | string?   |                                         |
| invoice_date      | string?   | original-format string                  |
| amount            | float?    |                                         |
| description       | string?   |                                         |
| status            | string    | `APPROVED` \| `REJECTED` \| `HUMAN_REVIEW` |
| confidence_score  | float     | 0–1                                     |
| decision_reason   | string?   |                                         |
| passed_rules      | string[]  |                                         |
| failed_rules      | string[]  |                                         |
| raw_text          | string?   | original extracted text                 |
| filename          | string?   |                                         |
| uploaded_by       | string?   | users.id                                |
| extraction_method | string    | `regex` \| `hybrid` \| `llm`            |
| created_at        | ISO date  |                                         |
| updated_at        | ISO date  |                                         |

### `audit_logs`
| field        | type     | notes                                       |
|--------------|----------|---------------------------------------------|
| id           | string   | UUID v4                                     |
| invoice_id   | string   |                                             |
| action       | string   | e.g. `invoice_uploaded`, `approved_by_reviewer` |
| actor        | string?  | user id or `system`                         |
| actor_name   | string?  | username or `system`                        |
| old_status   | string?  |                                             |
| new_status   | string?  |                                             |
| notes        | string?  |                                             |
| created_at   | ISO date |                                             |

---

## API Documentation

All routes are prefixed with `/api`.

### Auth
- `POST /api/signup` — body `{ username, email, password, role? }`
- `POST /api/login`  — body `{ email, password }` → `{ access_token, user }`
- `POST /api/logout`
- `GET  /api/auth/me`

### Invoices
- `POST /api/process` — `multipart/form-data` with `file` (.pdf or .txt)
- `GET  /api/invoices?status=&search=&sort=-created_at&limit=`
- `GET  /api/invoice/{id}`
- `PUT  /api/invoice/{id}` — body of any subset of fields
- `POST /api/approve/{id}`
- `POST /api/reject/{id}`

### Audit / Dashboard / Health
- `GET /api/audit/{invoice_id}`
- `GET /api/stats`
- `GET /api/health`

Authentication: send `Authorization: Bearer <token>` *or* rely on the
`access_token` httpOnly cookie set on login/signup.

---

## Setup (local, without Docker)

```bash
# 1. Install dependencies
cd backend && pip install -r requirements.txt
cd ../frontend && yarn install

# 2. Copy env files
cp .env.example backend/.env
cp .env.example frontend/.env
# edit JWT_SECRET, MONGO_URL, REACT_APP_BACKEND_URL

# 3. Run MongoDB locally (or via docker)
docker run -d -p 27017:27017 --name mongo mongo:7

# 4. Run backend
cd backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# 5. Run frontend
cd frontend && yarn start
```

Visit http://localhost:3000 — log in with `admin@invoiceai.com` / `Admin@123`.

## Setup (Docker)

```bash
docker compose up --build
```

This brings up MongoDB, the FastAPI backend (port 8001) and the React frontend
served by nginx (port 3000) with `/api` proxied to the backend.

---

## Resume Bullet Points

- Designed and shipped an **enterprise human-in-the-loop invoice review platform**
  (React + FastAPI + MongoDB + JWT + Docker) with a deterministic rules engine and
  full audit trail.
- Implemented a **hybrid extraction pipeline**: deterministic regex parser
  followed by an LLM fallback (Claude Sonnet via Emergent Universal Key) when
  field confidence is low, achieving robust parsing on PDF and TXT invoices.
- Built a **role-based reviewer console** (Admin / Reviewer) with editable
  fields, approval workflow and a timeline of every system + reviewer action,
  end-to-end testable via FastAPI dependency injection.
- Packaged the entire stack as a one-command **Docker Compose** deployment with
  nginx-served frontend and proxied API.

---

## Future Improvements

- **OCR** for scanned image-only invoices (Tesseract / cloud OCR).
- **Direct LLM extraction** for messy or unstructured invoices, with schema
  validation and structured-output mode.
- **AI-based confidence scoring** that learns from human corrections over time.
- **PostgreSQL** + SQLAlchemy migration (the schema is already designed to map
  cleanly to a relational model).
- **Role-based workflows**: dual-approval thresholds, vendor-specific routing,
  delegated review.
- **Analytics**: cycle-time trends, vendor risk scoring, anomaly detection on
  unusual amounts or out-of-pattern submissions.

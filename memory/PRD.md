# PRD — AI-Powered Human-in-the-Loop Invoice Review System

## Problem statement (verbatim)
Build a realistic enterprise invoice processing platform where invoices are
automatically processed, validated using business rules, routed for human
review when necessary, and fully tracked through an audit trail.

## User personas
- **Admin** — full access; manages reviewers; sees stats and audit.
- **Reviewer** — handles the human-review queue; can edit/approve/reject.

## Core requirements (static)
1. Auth (JWT) with ADMIN / REVIEWER roles
2. Invoice upload (PDF, TXT)
3. Hybrid extraction: regex → LLM fallback (Claude via Emergent key)
4. Rules engine: missing/duplicate/threshold checks
5. Decision engine: APPROVED / REJECTED / HUMAN_REVIEW + reason
6. Reviewer console: edit fields, approve, reject
7. Audit trail for every action
8. Dashboard: totals, status counts, amount processed, avg confidence, recent activity
9. Invoice queue: search/filter/sort/badges
10. Docker + docker-compose + README

## What's been implemented (2026-06-23)
- Backend modular structure: `services/{auth,extraction,rules_engine,decision_engine,audit}`, `routes/{auth,invoice,dashboard}`
- All API endpoints from the brief, all under `/api`
- Seeded admin + reviewer; bcrypt + JWT
- Indexes on users.email, invoices.id, invoices.invoice_number, audit_logs.invoice_id
- Hybrid extraction (regex + emergent Claude fallback)
- Frontend pages: Login, Signup, Dashboard, Upload, Queue, Invoice Detail with editable fields + actions + audit timeline
- Tailwind: Chivo / IBM Plex Sans / JetBrains Mono fonts + cobalt theme
- Dockerfile (backend), Dockerfile (frontend + nginx), docker-compose.yml, .env.example
- README with architecture/workflow diagrams, API docs, resume bullets, future work

## Backlog / next
- P1: PDF preview pane on Invoice Detail (currently shows raw text)
- P1: Pagination on Invoice Queue (currently first 100)
- P2: OCR for scanned PDFs
- P2: Admin-only audit explorer page
- P2: Per-vendor analytics

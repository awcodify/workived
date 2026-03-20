---
description: Think as Software Engineer — implement following all Workived engineering rules
---

You are the **Workived Software Engineer**.

**Step 1 — Read layer rules:**
- Go → `services/CLAUDE.md`
- React → `apps/web/CLAUDE.md`
- Migrations → `migrations/CLAUDE.md`

**Step 2 — Pre-flight checklist:**

**Backend (Go):**
- `organisation_id` first param, first WHERE clause
- Money = `BIGINT` + `currency_code`
- Handler thin (validate, call service, respond)
- Service owns business logic
- Repository owns all SQL
- Cursor pagination (not offset)
- Handle all errors (no `_` discards)
- Every file has tests
- always update openapi.yaml for any API updates

**Frontend (React):**
- API calls via client layer (no raw fetch)
- Follow design system (`design/tokens.ts`)
- Loading/error/empty states
- Every file has tests

**Migrations:**
- Reversible (up + down)
- New tables: `organisation_id`, `created_at`, `updated_at`, `is_active`
- Money = `BIGINT` + `currency_code`

**Step 3:** Write code + tests together. Check existing patterns first.

$ARGUMENTS

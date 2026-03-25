# Sprint 17 — Gender Leave UI, Claim Status Colors, OpenAPI Auth, Budget Periods

**Duration:** March 25, 2026
**Status:** ✅ COMPLETE
**Team:** Full stack
**Type:** Feature completion + polish + new feature

**Summary:** Completed gender-based leave frontend + employee gender field, config-driven claim status color semantics, HTTP Basic Auth on OpenAPI docs, claim budget period policies (monthly/yearly) with CTE-based aggregation, and configurable auto-archive for completed tasks (default 7 days).

---

## 📋 Previous Sprint Summary

### Sprint 16 Completed ✅ (March 25, 2026)
- ✅ Claims payment flow (backend + frontend) — full lifecycle: submit → approve → pay
- ✅ Hierarchical multi-level approval — recursive CTE replaces flat reporting_to
- ✅ Gender-based leave eligibility (backend) — policy-level gender gates
- ✅ Data-driven tab/dock visibility — no longer JWT-gated
- ✅ Workspace name validation — reserved names blocklist + 3-char minimum
- ✅ 360+ backend tests, 405+ frontend tests

---

## 🎯 Current Sprint (Sprint 17)

---

### Task 1: Claim Status Color Semantics ⭐⭐⭐ | XS (15 min)

**🧠 PO:** Green should mean "done, nothing left to do." In claims, `approved` is a middle state (waiting for payment), not terminal. Grey communicates "in progress." In leave, `approved` IS terminal — green is correct.

**🎨 Design:**

| Status | Claims Color | Leave Color | Rationale |
|--------|-------------|-------------|-----------|
| pending | yellow/orange (`warnDim`/`warnText`) | yellow/orange | Waiting for review |
| approved | **grey** (`ink100`/`ink500`) | **green** (`okDim`/`okText`) | Claims: waiting for payment. Leave: done. |
| paid | **green** (`okDim`/`okText`) | — | Terminal, money received |
| rejected | red (`errDim`/`errText`) | red | Terminal |
| cancelled | grey (`ink100`/`ink500`) | grey | Terminal |

**👨‍💻 Engineer:**

Files to change:
- `apps/web/src/components/workived/shared/requests/RequestListItem.tsx` — status badge colors
- `apps/web/src/components/workived/shared/requests/RequestDetailsModal.tsx` — detail modal status
- Need a config-driven approach: pass status color map from module config, not hardcoded in shared component

**Approach:** Add `getStatusColor` to `RequestListItemConfig` so claims and leave can define their own color maps. This avoids hardcoding `paid` in the shared component.

---

### Task 2: OpenAPI `/docs` Auth ⭐⭐⭐⭐ | XS (half day)

**🏗️ Architect:**

**Decision:** HTTP Basic Auth on `/docs` and `/docs/openapi.yaml` routes.

**Why not JWT?** These routes are for developers, not end users. Basic auth is simpler, works with browser prompt, and doesn't require a login flow.

**Implementation:**
- New env vars: `DOCS_USERNAME`, `DOCS_PASSWORD`
- If either is empty, docs are disabled entirely (safe default)
- Gin middleware: `gin.BasicAuth()` on the docs route group
- No new migration needed

**Trade-offs:**
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Basic auth (env var) | Simple, no DB, works immediately | Single credential shared | ✅ Pick this |
| JWT-gated | Reuses existing auth | Needs login flow for docs | Overkill |
| IP whitelist | No credentials | Breaks on mobile/VPN | Too rigid |

**Files:**
- `services/cmd/api/docs.go` — add basic auth middleware

---

### Task 3: Gender-Based Leave Frontend ⭐⭐⭐⭐ | S (1 day)

**🏗️ Architect:**

Backend is complete (Sprint 16). API already returns `gender_eligibility` on policies. Frontend needs:
1. TypeScript types updated to include `gender_eligibility` field
2. Policy create/edit form: gender eligibility toggle (any/male/female)
3. Leave request form: filter out policies the employee is not eligible for
4. Error state: if employee's gender is not set, show helpful message

**Data flow:**
```
GET /api/v1/leave/policies → includes gender_eligibility per policy
GET /api/v1/employees/me → includes gender field
Frontend: filter policies where gender_eligibility === null OR gender_eligibility === employee.gender
```

**🎨 Design:**

Policy form — gender eligibility selector:
- Segmented control: "All" | "Male" | "Female" (default: All)
- Placed below "Days per year" field
- Label: "Eligible gender"
- Muted helper text: "Restrict this leave type to a specific gender"

Leave request — ineligible policy handling:
- Don't show ineligible policies in the balance list at all (hide, don't grey out)
- If employee has no gender set: show all policies (backend validates at submission)

**👨‍💻 Engineer:**

Files to change:
- `apps/web/src/types/api.ts` — add `gender_eligibility` to `LeavePolicy` type
- `apps/web/src/routes/_app/leave/index.tsx` — filter balances by gender eligibility
- Leave policy settings page (if exists) — add gender toggle to form
- `apps/web/src/lib/validations/` — update Zod schema if policy form has one

---

### Task 4: Claim Budget Period Policies ⭐⭐⭐⭐ | M (3-4 days)

**🏗️ Architect:**

**Problem:** Claim categories only support monthly limits. Ahmad wants "Medical: AED 5,000/year" or "Transport: AED 500/month."

**Data model change:**

```sql
-- Migration 000037
ALTER TABLE claim_categories
  ADD COLUMN budget_period VARCHAR(10) NOT NULL DEFAULT 'monthly'
  CHECK (budget_period IN ('monthly', 'yearly'));
```

**Balance calculation change:**
- Monthly: current behavior (sum claims in current month)
- Yearly: sum claims in current year (January to December)
- The `claim_balances` table already has `year` + `month` columns
- For yearly: query `WHERE year = $Y` (ignore month)
- For monthly: query `WHERE year = $Y AND month = $M` (current behavior)

**API impact:**
- `ClaimCategory` response adds `budget_period` field
- `CreateCategoryInput` / `UpdateCategoryInput` accept `budget_period`
- Balance endpoint adjusts query based on category's `budget_period`

**Trade-offs:**
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| budget_period on category | Simple, clear | Can't mix periods within category | ✅ Pick this |
| budget_period on balance | Flexible | Confusing, over-engineered | Skip |
| Separate yearly_limit column | Backward compatible | Two limit columns to maintain | Skip |

**🎨 Design:**

Category form — budget period selector:
- Segmented control: "Monthly" | "Yearly" (default: Monthly)
- Placed next to or below the limit amount field
- When "Yearly" selected, label changes: "Monthly limit" → "Yearly limit"
- Balance bar in employee view shows period context: "AED 3,200 / 5,000 yearly" or "AED 200 / 500 this month"

**👨‍💻 Engineer:**

Backend files:
- `migrations/000037_add_budget_period_to_claim_categories.up.sql` + `.down.sql`
- `services/internal/claims/types.go` — add `BudgetPeriod` to Category + request structs
- `services/internal/claims/repository.go` — update balance queries for yearly period
- `services/internal/claims/service.go` — pass budget_period through
- `services/internal/claims/handler.go` — accept/validate budget_period
- `services/openapi.yaml` — update schema
- Tests for all above

Frontend files:
- `apps/web/src/types/api.ts` — add `budget_period` to `ClaimCategory`
- `apps/web/src/routes/_app/claims/categories.tsx` — add period toggle to form
- `apps/web/src/routes/_app/claims/index.tsx` — show "monthly" / "yearly" context on balance bars
- `apps/web/src/components/workived/claims/ClaimRequestConfig.tsx` — update budget display

---

### Task 5: Auto-Archive Done Tasks ⭐⭐⭐ | S (1 day)

**🏗️ Architect:**

**Decision:** On-read filter (not cron job), configurable per-request via `TaskFilters.ArchiveDays`.

**Why not cron?** Cron adds infrastructure complexity (scheduler, idempotency, missed runs). On-read filter is simpler: completed tasks older than N days are excluded from the response.

**Implementation:**
```sql
-- In ListTasks query:
AND (
  $5 = 'completed'           -- show all when explicitly filtering completed
  OR t.completed_at IS NULL   -- always show pending tasks
  OR $8::int = 0              -- 0 = archiving disabled
  OR t.completed_at > NOW() - ($8::int || ' days')::interval
)
```

Default: **7 days** (`DefaultArchiveDays` constant). Configurable via `TaskFilters.ArchiveDays`. When board config UI is built, will read from org settings and pass through handler.

**No migration needed.** Pure query filter + types change.

**Trade-offs:**
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| On-read filter | No infra, instant | Old tasks still in DB | ✅ Pick this |
| Cron soft-delete | Cleaner DB | Needs scheduler, recovery | Over-engineered |
| Org setting | Flexible | Needs migration + UI | Future (when board config UI exists) |

**👨‍💻 Engineer:**

Backend files:
- `services/internal/tasks/types.go` — added `ArchiveDays int` to `TaskFilters`, `DefaultArchiveDays = 7` constant
- `services/internal/tasks/repository.go` — `ListTasks` query uses `$8::int` param for configurable interval

Frontend: no changes needed (tasks simply stop appearing).

---

## 📊 Sprint 17 Checklist

| # | Task | Effort | Status |
|---|------|--------|--------|
| 1 | Claim status color semantics | XS | ✅ |
| 2 | OpenAPI `/docs` basic auth | XS | ✅ |
| 3 | Gender-based leave frontend + employee gender field | S | ✅ |
| 4 | Claim budget period policies | M | ✅ |
| 5 | Auto-archive done tasks | S | ✅ |

---

## 🚀 Next Sprint Plan (Sprint 18)

### Candidates
1. **Pro gating + Stripe integration** — Feature flags, billing, landing page
2. **Notification infrastructure** — Foundation for @mentions, approval alerts, announcements
3. **Repository integration tests** — `testcontainers-go` for SQL correctness
4. **Employee profile expansion** — Personal data, documents, work permit expiry

---

## ✅ Sprint 17 Complete (March 25, 2026)

**5 tasks shipped:**

1. **Claim status color semantics** — Config-driven `StatusColors` map per module. Claims: approved=grey (middle state), paid=green (terminal). Leave: approved=green (terminal). Shared components accept color overrides.

2. **OpenAPI `/docs` basic auth** — `gin.BasicAuth()` on `/docs` route group. Controlled by `DOCS_USERNAME`/`DOCS_PASSWORD` env vars. Disabled when either is empty (secure default). 9 tests.

3. **Gender-based leave + employee gender field** — Full-stack: gender field added to employee create/edit (backend types, repository SQL, frontend forms). Leave policy create/edit has gender eligibility segmented control (All/Male/Female). Leave balance list filters by employee gender. Backend validates at submission.

4. **Claim budget period policies** — Migration 000037 adds `budget_period` column to `claim_categories` (monthly/yearly, default monthly). CTE-based `ListBalancesByEmployee` aggregates yearly categories across all months. `GetYearlySpent` repo method for budget validation. Frontend: segmented control in category modal, dynamic label ("Monthly/Yearly Limit"), balance cards show period context ("/month" or "/year").

5. **Auto-archive done tasks** — Configurable on-read filter in `ListTasks` query. `TaskFilters.ArchiveDays` field with `DefaultArchiveDays = 7`. Parameterized interval (`$8::int || ' days'`). Completed tasks older than N days hidden by default; still visible when explicitly filtering for `completed`. Value of 0 disables archiving. Ready for future board config UI.

**Files changed (backend):**
- `services/internal/claims/types.go` — `BudgetPeriod` on Category, ClaimBalanceWithCategory, request structs
- `services/internal/claims/repository.go` — budget_period in all category CRUD, CTE balance query, `GetYearlySpent`
- `services/internal/claims/service.go` — yearly budget validation in `SubmitClaim`, `GetYearlySpent` in repo interface
- `services/internal/claims/service_test.go` — fake repo updated with `GetYearlySpent`
- `services/internal/tasks/types.go` — `ArchiveDays` filter field, `DefaultArchiveDays` constant
- `services/internal/tasks/repository.go` — parameterized archive interval in `ListTasks`
- `services/internal/employee/types.go` — `Gender` in Create/Update request structs
- `services/internal/employee/repository.go` — gender in INSERT/UPDATE SQL
- `services/internal/platform/config/config.go` — `DocsUsername`, `DocsPassword` fields
- `services/cmd/api/docs.go` — `gin.BasicAuth()` middleware
- `services/cmd/api/docs_test.go` — 9 auth tests
- `services/cmd/api/openapi.yaml` — budget_period on 3 schemas
- `migrations/000037_add_budget_period_to_claim_categories.up.sql` + `.down.sql`

**Files changed (frontend):**
- `apps/web/src/types/api.ts` — budget_period, gender on multiple types
- `apps/web/src/components/workived/shared/requests/RequestListItem.tsx` — config-driven StatusColors
- `apps/web/src/components/workived/shared/requests/RequestDetailsModal.tsx` — StatusColors prop
- `apps/web/src/components/workived/claims/ClaimRequestConfig.tsx` — claimStatusColors map
- `apps/web/src/components/workived/claims/CategoryModal.tsx` — budget period segmented control
- `apps/web/src/routes/_app/claims/index.tsx` — period context on balance bars
- `apps/web/src/routes/_app/claims/categories/index.tsx` — period label on cards
- `apps/web/src/routes/_app/leave/index.tsx` — gender-based balance filtering
- `apps/web/src/routes/_app/leave/policies/new.tsx` — gender eligibility control
- `apps/web/src/routes/_app/leave/policies/$id.tsx` — gender eligibility control
- `apps/web/src/routes/_app/people/$id/route.tsx` — gender field in create/edit forms
- `apps/web/src/lib/validations/leave.ts` — gender_eligibility in Zod schema

**Test counts:** 171 claims+tasks Go tests passing, TypeScript clean build.

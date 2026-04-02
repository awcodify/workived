# Workived Production Review — April 2, 2026

**Reviewers:** PO, Architect, Engineer, QA, Security (all roles except Infra)
**Sprint:** 24 (Bug-Fix Sprint, March 31–April 4)
**Data Source:** Linear (live) + codebase analysis

---

## 1. Product Status (Linear)

### Issue Breakdown

| Status | Count | Key Issues |
|--------|-------|------------|
| **Done** | 16+ | WOR-67 (holiday multi-tenancy leak), WOR-18 (task filtering), WOR-76 (N+1 fix), WOR-37 (bundle size), WOR-73 (UAE parental leave), WOR-62 (attendance date filter), WOR-65 (leave policy modal), WOR-35 (pro-rating), WOR-72 (setup preview), WOR-56 (attendance status), WOR-31 (calendar vs working days), WOR-34 (holiday calendar), WOR-53 (task comments), WOR-63 (pending invitation status), WOR-54 (task filter), WOR-58 (modal z-index) |
| **In Review** | 11 | WOR-86 (test fixes), WOR-85 (work schedule CRUD), WOR-52 (per-employee schedule), WOR-68 (new employee leave balance), WOR-78 (holiday vs weekend), WOR-60 (Resend email), WOR-11 (employment type eligibility), WOR-32 (Hajj one-time), WOR-81 (API latency), WOR-80 (Redis cache), WOR-17 (changelog), WOR-20 (pro gating), WOR-21 (PWA), WOR-77 (Eid date fix) |
| **In Progress** | 4 | WOR-64 (unlimited leave display), WOR-71 (error wording), WOR-55 (task status), WOR-74 (owner task visibility) |
| **Backlog** | 8+ | WOR-79 (leave policy 500), WOR-84 (people search), WOR-82 (status mismatch), WOR-70 (data-testid), WOR-66 (admin separation), WOR-75 (multi-board kanban) |

### Projects

| Project | Status | Priority |
|---------|--------|----------|
| V1.0 Launch Readiness | In Progress | Urgent |
| Leave Module Maturity | Backlog | High |
| Pro Monetization | Backlog | High |
| Employee Experience | Backlog | Medium |
| Platform Quality | Backlog | Medium |

### V1.0 Launch Blockers (still open)

| Issue | Priority | Status | Risk |
|-------|----------|--------|------|
| WOR-68 — New employee no leave balance | Urgent | In Review | Blocks onboarding flow |
| WOR-79 — Leave policy create/edit 500 error | Urgent | **Backlog** | Blocks leave setup — not started |
| WOR-74 — Owner can't see all tasks | Urgent | In Progress | Core visibility broken |
| WOR-11 — Employment type eligibility not filtering | Urgent | In Review | Compliance risk (intern gets full-time leave) |
| WOR-20 — Pro feature gating (no upgrade UI) | Urgent | In Review | Monetization blocked |
| WOR-84 — People search broken | Medium | Backlog | Not started |
| WOR-82 — Employee status mismatch (list vs profile) | Medium | Backlog | Not started |

**Risk:** Sprint 24 ends April 4 (2 days remaining). 3 Urgent issues still In Progress/Backlog. 11 items "In Review" — suggests merge/deploy bottleneck. WOR-79 (leave policy 500 error) in Backlog is a red flag.

---

## 2. Architecture Review

### Backend: Grade A

- **Structure:** 13 domain modules (admin, attendance, auth, calendar, claims, department, employee, leave, organisation, setup, tasks, audit, approval), each following handler/service/repository/types pattern
- **Shared packages:** apperr, cache, email, logger, paginate, validate
- **Entrypoints:** `cmd/api/main.go` (HTTP server), `cmd/rollover/main.go` (batch job)
- **Redis caching layer** (WOR-80) implemented — org lookups, tenant middleware cached (2-min TTL)
- **N+1 query fix** (WOR-76) shipped for attendance team/week endpoint

### Frontend: Grade A-

- React 19 + Vite 8, TanStack Router (type-safe file-based routing), TanStack Query v5
- Zustand for client state, React Hook Form + Zod v4 for validation
- PWA with runtime caching strategy (NetworkFirst/API, CacheFirst/images, NetworkOnly/auth)
- shadcn/ui component library with design tokens
- Code splitting via `autoCodeSplitting: true` in TanStack Router Vite plugin

### Concern: Missing Test Files

Packages with zero test files (violates 98% coverage rule):
- `internal/department/`
- `internal/platform/config/`
- `internal/platform/database/`
- `internal/platform/storage/`
- `pkg/logger/`, `pkg/paginate/`, `pkg/validate/`

---

## 3. Code Quality

### Backend: Grade A

- All 25 Go test packages pass
- SQL: 100% parameterized queries (`$1`, `$2`...), zero string concatenation
- Multi-tenancy: `WHERE organisation_id = $1` always first in every query
- Money: `int64` + `currency_code` everywhere, no floats
- Timestamps: UTC `timestamptz`, org timezone conversion at API layer only
- Soft delete: `is_active` pattern for HR records
- golangci-lint with gosec (G201, G202 for SQL injection, G101 for secrets)

### Frontend: Grade A-

- 61 test files, 567 tests pass (8 todo)
- TypeScript `strict: true` with `noUncheckedIndexedAccess: true`
- Zod validation on all forms
- Error extraction utility prevents internal error leak to UI

### Issue: 3 Backend Handlers Missing Loggers

The following handlers lack `zerolog.Logger` injection, violating the convention "EVERY handler MUST have zerolog.Logger injected":

- `services/internal/auth/handler.go`
- `services/internal/employee/handler.go`
- `services/internal/organisation/handler.go`

**Impact:** Failed login attempts, employee CRUD errors, and org update errors are not logged with context.

---

## 4. Security Review

### CRITICAL: Stored XSS in Task Comments

**File:** `apps/web/src/components/TaskDetailModal.tsx` (line 442)

```tsx
dangerouslySetInnerHTML={{ 
  __html: comment.content_type === 'markdown' 
    ? comment.body 
    : `<p>${comment.body}</p>`  // UNESCAPED USER INPUT
}}
```

User-submitted comment body is rendered directly as HTML without sanitization. A malicious user can inject `<script>` or `<img onerror>` payloads that persist in the database and execute for every user who views that task.

**Fix:** Use `DOMPurify.sanitize()` (already in dependencies) or switch to `react-markdown` component.

### Auth Token Storage: Best Practice ✅

- Access token in Zustand memory (not localStorage) — protected from XSS
- Refresh token in httpOnly cookie (not accessible from JavaScript)
- Auto-refresh on 401 with retry
- Open redirect prevention on login redirect

### SQL Injection: None Found ✅

All repositories use parameterized queries. gosec linting enforces this.

### Multi-Tenancy Isolation: Properly Enforced ✅

Every query filters by `organisation_id = $1` as first WHERE clause. OrgID extracted from JWT context, never from request body.

### No Hardcoded Secrets ✅

All secrets loaded from environment variables via Viper. gosec (G101) linting enabled.

### Missing CSP Headers ⚠️

No Content-Security-Policy headers configured. If XSS slips through sanitization, there's no browser-level mitigation.

### No CSRF Protection ⚠️

No `X-CSRF-Token` for state-changing requests. Mitigated by Bearer token auth (not cookie-only), but defense-in-depth is missing.

---

## 5. QA Review

### Test Health

| Layer | Status | Details |
|-------|--------|---------|
| Backend (Go) | ✅ All pass | 25 packages, setup takes 0.8s |
| Frontend (Vitest) | ✅ All pass | 61 test files, 567 tests, 8 todo |
| E2E | ❌ None | WOR-40 in backlog, no Playwright tests |

### Test Gaps

1. **No E2E tests** — zero browser-level tests. API contract breaking changes would ship undetected
2. **Department module** — no backend tests
3. **Platform packages** (config, database, storage) — no tests
4. **Frontend coverage unknown** — no coverage report configured in vitest
5. **data-testid missing** (WOR-70) — QA automation blocked

### QA-Reported Bugs Still Unresolved

| Issue | Reporter | Status | Notes |
|-------|----------|--------|-------|
| WOR-79 — Leave policy 500 | Ricko (QA) | Backlog | Not started — should be in sprint |
| WOR-84 — People search broken | Ricko (QA) | Backlog | Not started |
| WOR-82 — Employee status mismatch | Ricko (QA) | Backlog | Not started |
| WOR-55 — Task status misleading | Ricko (QA) | In Progress | Stale since April 1 |

---

## 6. Non-Negotiable Rules Compliance

| Rule | Status | Evidence |
|------|--------|----------|
| Multi-tenancy: `WHERE organisation_id = $1` always first | ✅ Pass | All 12+ repos checked |
| Money: BIGINT + currency_code, never FLOAT | ✅ Pass | Claims, salaries, budgets |
| Timestamps: UTC timestamptz, convert at API layer | ✅ Pass | DB schema + config.go |
| Country rules: Config tables, never hardcode | ✅ Pass | Leave templates, seed data |
| HR records: Soft delete (is_active) | ✅ Pass | Employees, members, invitations |
| Audit log: Every state-changing action | ✅ Pass | Claims, leave, org changes |
| Multi-currency: Always carry currency_code | ✅ Pass | IDR, AED, MYR, SGD supported |
| Multi-timezone: Use org's timezone | ✅ Pass | `organisations.timezone` column |
| Free tier limit: 25 employees | ✅ Pass | Enforced at app layer |
| Test file for every file created | ⚠️ Partial | 7 packages missing test files |
| 98% coverage (service + handler) | ⚠️ Unverified | coverage.out exists but not enforced in CI |

---

## 7. Priority Action Items

### 🔴 Must Fix Before Launch

| # | Item | Type | Effort |
|---|------|------|--------|
| 1 | **Fix stored XSS in TaskDetailModal.tsx** — sanitize `dangerouslySetInnerHTML` with DOMPurify | Security | S |
| 2 | **WOR-79: Leave policy 500 error** — pull from Backlog into sprint immediately | Bug | M |
| 3 | **WOR-74: Owner task visibility** — in progress since Apr 1, needs completion | Bug | S |
| 4 | **WOR-68: New employee leave balance** — In Review, needs merge | Bug | S |
| 5 | **Clear the "In Review" bottleneck** — 11 items pending merge/deploy | Process | - |

### 🟡 Should Fix Before Launch

| # | Item | Type | Effort |
|---|------|------|--------|
| 6 | Add loggers to auth/employee/organisation handlers | Code quality | S |
| 7 | WOR-82: Employee status mismatch (Active vs Pending) | Bug | S |
| 8 | WOR-84: People search broken | Bug | S |
| 9 | Add CSP headers to backend response middleware | Security | S |
| 10 | Add tests for `department` module | Testing | M |

### 🟢 Post-Launch (track in backlog)

| # | Item | Type |
|---|------|------|
| 11 | E2E test suite with Playwright (WOR-40) | Testing |
| 12 | Frontend test coverage reporting | Testing |
| 13 | CSRF double-submit token | Security |
| 14 | Tests for platform packages (config, database, storage) | Testing |
| 15 | data-testid attributes for QA automation (WOR-70) | Testing |
| 16 | WOR-81: API latency optimization (merge pending) | Performance |

---

## 8. Summary

**Overall Grade: B+**

The codebase demonstrates excellent backend security posture — zero SQL injection risk, proper multi-tenancy isolation, secure auth token handling, and solid error abstraction. Architecture is clean and well-structured.

**Three things that must happen before v1.0 ships:**

1. **Fix the stored XSS in task comments** — this is a security vulnerability that allows any user to execute JavaScript in other users' browsers
2. **Unblock WOR-79** — leave policy creation is broken (500 error) and sitting in Backlog with 2 days left in the sprint
3. **Clear the merge queue** — 11 items in "In Review" suggest a deployment bottleneck that's stalling progress

The product is close to launch-ready. The gaps are fixable with focused effort over the remaining sprint days.

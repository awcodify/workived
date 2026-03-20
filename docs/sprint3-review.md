---
name: Sprint 3 Full Team Review
description: Comprehensive review (PO/Architect/Engineer/Security/Infra/QA) of Sprint 3 — Auth, Employees, Invitations. Includes blockers, verdicts, and action items.
type: project
---

# Sprint 3 Full Team Review — 2026-03-19

**Scope reviewed:** Auth flow, org setup, invitation system, employee CRUD, settings (company + members), conditional dock.

## Overall Verdict: Needs Work

### Top 3 Blockers

| # | Issue | Severity | Owner |
|---|-------|----------|-------|
| 1 | Missing test files for 6+ frontend files — violates non-negotiable testing rule | Blocker | Engineer |
| 2 | `ListMembers` JOIN doesn't filter employees by org_id — multi-tenancy data leak risk | High | Architect/Engineer |
| 3 | No email delivery for invitations — renders invite feature unusable for real users | High | PO/Engineer |

### What's On Track
- Auth flow (login/register/setup-org) works end-to-end
- RBAC with Pro-gating is comprehensive
- Multi-tenancy enforced at every layer (except the JOIN bug)
- Invitation token security (hashed, single-use) is solid
- Frontend patterns (TanStack Query, Zustand, RHF+Zod) are consistent
- Free tier enforcement (25 employee limit) at service layer

### Action Items Before Shipping

**Must fix:**
1. Write missing test files: members route, company route, login, useInvitations hook, API clients (organisations, auth)
2. Fix `ListMembers` employee JOIN to include `organisation_id` filter
3. Add DB index on `invitations(email)`
4. Extract shared `extractApiError` utility (duplicated in 3+ files)
5. Extract invite token URL parsing utility (fragile `split('?token=')` in multiple places)
6. Replace hardcoded colors (#6357E8, rgba values) with design token imports
7. Wire up audit logging for invitation/member actions

**Should fix:**
- Add rate limiting on invitation creation endpoint
- Add circuit breaker for JWT refresh loop (axios interceptor retries infinitely on 401)
- Standardize query key factories across all API modules (not just invitations)
- Centralize post-auth navigation logic (currently scattered across register, setup-org, invite, company routes)

### Defer/Drop
- Pro role UI (hr_admin, manager, finance) — defer until Pro billing exists
- Transfer ownership UI — low priority
- Full a11y audit (skip links, focus traps) — defer to dedicated sprint
- Retry/circuit breaker on mutations — not needed at MVP scale

### Per-Role Verdicts
- **PO:** Ship with caveats (email delivery is blocker for real users)
- **Architect:** Sound, needs 2 fixes (JOIN bug + email index)
- **Engineer:** Needs fixes (missing tests, duplicated utils, hardcoded colors)
- **Security:** Secure with minor gaps (rate limiting, refresh loop)
- **Infra:** Efficient for MVP (add audit logging + email index before prod)
- **QA:** Needs more tests (happy paths work, concurrent/edge cases undertested)

### Key Edge Cases to Test
1. Double-accept race condition on same invitation
2. Invite with employee_id → soft-delete employee → accept invite
3. Email case sensitivity in invitation matching
4. Token expiry between page load and form submit
5. Concurrent invite + revoke by two admins

**Why:** This review establishes baseline quality before shipping Sprint 3 features. All blockers must be resolved before merging to main.

**How to apply:** Reference this review when prioritizing remaining Sprint 3 work. Check off action items as they're completed. Re-review after fixes are applied.
---
name: Sprint 3 Architect Review
description: Software Architect review of Sprint 3 — data model, multi-tenancy, race conditions, scale concerns.
type: project
---

# Architect Review — Sprint 3 (2026-03-19)

**Verdict: Sound, needs 2 fixes**

## What's Good
- Data model is well-structured: organisations, organisation_members, invitations, employees with proper FKs
- org_id on everything, every repo query starts with `WHERE organisation_id = $1`
- OrgID extracted from JWT in middleware, never from request body
- Invitation tokens hashed (SHA-256) before storage
- `AcceptInvitation` is transactional (marks invitation + creates/reactivates member atomically)
- RBAC is in-memory with wildcard/prefix matching — fast, no DB overhead
- Cursor-based pagination on employee list
- Money as BIGINT, timestamps as TIMESTAMPTZ

## Critical Issues

### 1. `ListMembers` JOIN Bug (High)
The LEFT JOIN on employees doesn't filter by `organisation_id`:
```sql
LEFT JOIN employees e ON e.user_id = om.user_id
```
Should be:
```sql
LEFT JOIN employees e ON e.organisation_id = om.organisation_id AND e.user_id = om.user_id
```
If a user is in two orgs with employee records in both, the wrong employee record could surface. **Multi-tenancy data isolation bug.**

### 2. Missing Index on `invitations(email)` (Medium)
`IsEmailAlreadyMember` and `RevokePendingInvitationsByEmail` query by email. Will cause sequential scans at scale.

## Concerns to Watch

- **`TransferOwnership` race condition** — If current owner is concurrently deleted between demote and promote steps, org could end up ownerless. Transaction should fail on demote (rows affected = 0), but verify.
- **`GetMemberOrgID` returns first org only** (repo line ~108) — If multi-org support is ever needed, this is a problem. Document as intentional single-org assumption.
- **`ListPendingInvitations` subquery** — Excludes already-active members via subquery. Acceptable at small scale, may need optimization at 1000+ invitations.

## Alternatives Considered
Current architecture (modular monolith, application-layer multi-tenancy) is correct for this stage. No redesign needed — just fix the JOIN bug and add the index.
---
name: Sprint 3 Engineer Review
description: Engineer review of Sprint 3 — code compliance, missing tests, duplicated utils, hardcoded values.
type: project
---

# Engineer Review — Sprint 3 (2026-03-19)

**Verdict: Needs fixes**

## Backend Compliance (CLAUDE.md)
- org_id first parameter: ✅
- Money as BIGINT: ✅
- Timestamps as TIMESTAMPTZ: ✅
- Soft deletes: ✅
- Handler/service/repo separation: ✅
- Typed errors with `apperr`: ✅

## Frontend Compliance
- API calls through client layer: ✅
- TanStack Query for server state: ✅
- React Hook Form + Zod: ✅
- Loading/error/empty states: Partial ⚠️

## Issues to Fix

### 1. Missing Test Files (Blocker)
Violates non-negotiable "every file must have tests" rule:
- `settings/company/route.tsx` — has test file now but needs verification
- `settings/members/route.tsx` — NO TEST FILE
- `login/route.tsx` — NO TEST FILE
- `lib/hooks/useInvitations.ts` — has test file (useInvitations.test.ts)
- `lib/api/organisations.ts` — NO TEST FILE
- `lib/api/auth.ts` — NO TEST FILE

### 2. Duplicated `extractApiError` (Medium)
Defined locally in `company/route.tsx`, `invite/route.tsx`, `register/route.tsx`. Should be extracted to `lib/utils/errors.ts`.

### 3. Fragile Token Extraction (Medium)
`inv.invite_url.split('?token=')[1] ?? ''` in multiple places. Should use `URL` API or backend should return token separately.

### 4. Hardcoded Colors (Medium)
`#6357E8`, `rgba(255,255,255,0.06)`, `#0C0C0F` scattered across route files instead of importing from `design/tokens.ts`. Violates CLAUDE.md.

### 5. No Query Key Factory for Orgs (Low)
`useInvitations.ts` has `invitationKeys` (good pattern), but org detail, auth, and employee queries use ad-hoc string keys. Should standardize.

### 6. `any` Types in Tests (Low)
Multiple `as any` casts in test mocks. Acceptable for mocks but could use proper typing.
---
name: Sprint 3 Infra Review
description: Infrastructure review of Sprint 3 — query performance, caching, migrations, observability.
type: project
---

# Infra Review — Sprint 3 (2026-03-19)

**Verdict: Efficient for MVP**

## Query Performance
- No N+1 queries detected — lists use single queries with JOINs ✅
- `ListPendingInvitations` has subquery to exclude active members — acceptable at small scale, may need optimization at 1000+ invitations
- **Missing index on `invitations(email)`** — will cause sequential scans on `IsEmailAlreadyMember` and `RevokePendingInvitationsByEmail`

## Caching
- Frontend: TanStack Query with `staleTime: 30_000` ✅
- Backend: No caching layer yet. Acceptable for MVP scale (5-25 employees per org)
- No caching needed until we hit 100+ orgs with concurrent usage

## Migrations
- Migration 039 (fix role names) is clean and reversible ✅
- No data backfill needed (existing rows only use owner/member/admin) ✅
- All migrations follow the CLAUDE.md template

## Observability Gaps
- Errors logged via `apperr` package ✅
- **No structured logging** for key actions (invitation sent, accepted, employee created) ⚠️
- **No audit log entries** for invitation/member operations ⚠️ (audit_logs table exists but not wired up)
- No metrics/tracing yet — acceptable for MVP

## Action Items Before Production
1. Add index on `invitations(email)` — new migration
2. Wire up audit logging for: invitation created, accepted, revoked; member added, removed; employee created, updated, deactivated
3. Add structured logging for key business events (JSON format with org_id, user_id, action)
---
name: Sprint 3 PO Review
description: Product Owner review of Sprint 3 (Auth, Invitations, Employees) — user value, scope, missing features, monetisation angle.
type: project
---

# PO Review — Sprint 3 (2026-03-19)

**Verdict: Ship with caveats**

## What We Built
Auth flow (login/register), org setup, invitation system, employee CRUD, settings (company + members), conditional dock based on org membership.

## User Value
- The core loop "create org → invite team → add employees" is functional
- Ahmad can onboard his first 5-25 people
- No-org state handled gracefully (dock hides team members, company settings shows setup CTA + pending invitations)
- Free tier enforcement (25 employee limit) exists at service layer

## What's Missing (and Matters)
- **No email delivery** — invitations generate tokens but no email is sent. Ahmad has to manually share invite URLs. This is a **blocker for real usage**.
- **No "resend invitation" button** — if link expires, admin must revoke and re-invite
- **No member removal** — once invited, you can't remove a member (only transfer ownership exists)

## What to Cut
- Pro roles (hr_admin, manager, finance) — defined but untestable without Pro plan logic. Don't invest more time until Pro billing exists.
- Transfer ownership UI — nice to have, not urgent for MVP

## Monetisation
- Free tier (up to 25 employees) drives acquisition — Ahmad can try without payment
- Pro roles (hr_admin, manager, finance) are the natural upgrade trigger when teams grow beyond flat structure
- Invitation system is free tier — it's the onboarding funnel, not a monetisation gate

## Open Questions
- When is email delivery shipping? Without it, invitations are a developer feature.
- Should we add a "copy invite link" button as a stopgap before email?
- Do we need member removal before MVP launch?
---
name: Sprint 3 QA Review
description: QA review of Sprint 3 — edge cases, missing tests, concurrency risks, data integrity concerns.
type: project
---

# QA Review — Sprint 3 (2026-03-19)

**Verdict: Needs more tests**

## Edge Cases That Could Break Things

### 1. Double-Accept Race (High)
Two browser tabs accept the same invitation simultaneously. `WHERE accepted_at IS NULL` guard should prevent double-processing, but the member upsert (`ON CONFLICT DO UPDATE`) could result in unpredictable role assignment.

### 2. Invite with Employee → Soft-Delete Employee → Accept (Medium)
Admin invites with `employee_id`, then soft-deletes that employee before invite is accepted. `AcceptInvitation` will link to an inactive employee record.

### 3. Email Case Sensitivity (Medium)
Invited as `Ahmad@Company.com` but registers as `ahmad@company.com`. Email comparison may be case-sensitive — invitation won't match.

### 4. Token Expiry Between Load and Submit (Low)
Invitation page loads successfully, user waits, token expires before clicking accept. User gets confusing error instead of "invitation expired" message.

### 5. Concurrent Invite + Revoke (Low)
Admin A invites email X, Admin B revokes simultaneously. `RevokePendingInvitationsByEmail` deletes ALL pending invitations for that email, potentially nuking the freshly-created one.

## Missing Test Cases (Priority Order)

1. **High:** `settings/members/route.tsx` — invite flow, pending list, revoke, role selection
2. **High:** `settings/company/route.tsx` — no-org view, accept invitation from settings, locked fields
3. **High:** Backend `AcceptInvitation` concurrent double-accept
4. **Medium:** `login/route.tsx` — error states, redirect after login
5. **Medium:** `useInvitations.ts` hook — query key invalidation, error states
6. **Medium:** Backend email case sensitivity in invitation matching
7. **Low:** Frontend token expiry handling UX

## Backend Test Coverage
- `service_test.go` exists with comprehensive fake repo ✅
- Covers: Create, InviteMember, AcceptInvitation, RevokeInvitation, ListPendingInvitations, ListMembers, GetDetail, Update, TransferOwnership, GetMyInvitations, ListUnlinkedMembers
- Missing: concurrent scenario tests, integration tests with real DB

## Frontend Test Coverage
- `people/$id/route.test.tsx` ✅ (new + edit employee)
- `invite/route.test.tsx` ✅
- `register/route.test.tsx` ✅
- `setup-org/route.test.tsx` ✅
- `useRole.test.ts` ✅
- `jwt.test.ts` ✅
- **Missing:** members route, company route, login route, useInvitations hook, API client tests
---
name: Sprint 3 Security Review
description: Security review of Sprint 3 — multi-tenancy isolation, auth, IDOR, input validation, PII exposure.
type: project
---

# Security Review — Sprint 3 (2026-03-19)

**Verdict: Secure with minor gaps**

## What's Secure
- **Multi-tenancy isolation:** Every query filters by `organisation_id` from JWT. OrgID never from request body. `TenantMiddleware` validates active membership.
- **Input validation:** `validate.Struct()` with struct tags on backend. Zod schemas on frontend. Role values validated with `oneof=`.
- **IDOR protection:** All resource IDs are UUIDs (not guessable). Invitation tokens cryptographically random + hashed.
- **Auth/AuthZ:** JWT middleware on all `_app` routes. `Require(permission)` middleware on sensitive endpoints. Public endpoints appropriately scoped.
- **Invitation tokens:** Hashed before storage, single-use (accepted_at set on use), time-limited (expires_at).

## Minor Gaps

### 1. No Rate Limiting on Invitation Creation (Medium)
An admin could spam thousands of invitations. Backend should have rate limiting on `POST /invitations`.

### 2. JWT Refresh Infinite Loop (Medium)
Axios interceptor retries on 401 with a refresh. If refresh also returns 401, it retries infinitely. Need a circuit breaker (e.g., max 1 retry, then logout).

### 3. Invitation Token in URL Query Params (Low)
Invite URL contains raw token as query parameter. If server logs capture full URLs, tokens could leak. Mitigated by single-use nature, but expired-but-not-accepted tokens sit in DB indefinitely.

### 4. `/invitations/mine` Endpoint (Low — Not a Vulnerability)
Returns pending invitations for authenticated user's email. Trusts JWT `uid` to look up email. Since email is set at registration and verified (or will be), this is safe.

## No Critical Vulnerabilities Found
No SQL injection, no XSS vectors, no privilege escalation paths identified. The code is defensively written.

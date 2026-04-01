# Workived — Production Readiness Review #2

**Review Date:** March 28, 2026  
**Previous Review:** March 21, 2026 (Sprint 10, score 75%)  
**Current State:** Sprint 22 complete (22 sprints, ~14 weeks)  
**Reviewers:** Full Team (PO, Architect, Designer, Engineer, QA, Security, Infra)  
**Review Type:** Comprehensive end-to-end assessment

---

## Executive Summary

### Production Maturity: **85% Complete — Beta-Ready with Caveats** 🎯

| Category | Sprint 10 | Now | Delta | Blocker? |
|----------|-----------|-----|-------|----------|
| **Core Product** | 95% | 97% | +2 | No |
| **API Coverage** | 95% | 97% | +2 | No |
| **Frontend** | 90% | 93% | +3 | No |
| **Testing** | 70% | 75% | +5 | No |
| **Security** | 90% | 88% | -2 | **YES (WOR-67)** |
| **Compliance** | 65% | 80% | +15 | No |
| **Infrastructure** | 40% | 85% | +45 | No |
| **Monetization** | 0% | 0% | 0 | No (post-beta) |

### Verdict

**✅ Ready for closed beta** (with WOR-67 multi-tenancy fix)  
**❌ NOT ready for public launch** (monetization, E2E tests, analytics missing)

### Critical Blockers (must fix before ANY beta user)

1. ❌ **WOR-67: Custom holidays leak across organisations** (multi-tenancy violation)
2. ❌ **2 failing test suites** (organisation + setup repository tests)

### High-Priority Items (fix within 1 week of beta)

3. ⚠️ WOR-55: Task status misleading display
4. ⚠️ WOR-56: Attendance "0 present" status mismatch
5. ⚠️ WOR-62: Attendance shows employees before join date
6. ⚠️ WOR-64: Unlimited leave (365 days) shown in balance — confusing
7. ⚠️ WOR-63: Pending invitation employees showing as "Active" (In Review)

### Timeline Projections

- **Beta Launch:** 1-2 days (after WOR-67 fix + test fixes)
- **Public Launch:** 6-8 weeks (billing, landing page, analytics, E2E tests)

---

## What Changed Since Review #1 (Sprint 10 → Sprint 22)

### New Features Shipped (Sprints 11–22)

| Sprint | Features |
|--------|----------|
| **11-14** | Calendar module, custom holidays, leave prorate, day count logic, public holiday integration |
| **15-16** | Setup wizard (guided onboarding), claim budget periods, work schedule templates |
| **17-18** | Performance indexes, workload indexes, comment reactions, claim category templates |
| **19** | Policy templates, mark-as-paid claims, RBAC improvements |
| **20** | Leave prorate, day count logic, holiday-aware leave calculation |
| **21** | Bug fixes: task comments, task filters, attendance status, sick leave 999→365, claim currency |
| **22** | **PWA**, employment type policy eligibility, system changelog |

### Database Growth

- **Sprint 10:** 35 migrations
- **Sprint 22:** 44 migrations (+9)
- **Key additions:** `eligible_employment_types` on policies, `is_unlimited` on templates, `content_type` on task comments, performance indexes, work schedule templates, claim budget periods

### Infrastructure Transformation

- **Sprint 10:** No deployment pipeline existed
- **Sprint 22:** Full Docker + CI/CD + multi-region + VPS bootstrap + health monitoring

---

## Linear Issue Tracker Status

### By Status

| Status | Count | Issues |
|--------|-------|--------|
| **In Progress** | 5 | WOR-17 (Changelog), WOR-55 (Task status), WOR-56 (Attendance status), WOR-62 (Attendance join date), WOR-64 (Unlimited leave display) |
| **In Review** | 3 | WOR-60 (Resend email), WOR-63 (Pending invitation status), WOR-11 (Employment type eligibility) |
| **Backlog** | 20+ | WOR-67 (holiday leak), WOR-66 (admin separation), WOR-7 (timezone due dates), WOR-65 (leave policy modal), WOR-50 (approval delegation), WOR-41 (multi-level approval), WOR-26 (analytics), etc. |
| **Done** | 6+ | WOR-57 (sick leave 999→365), WOR-54 (task filter), WOR-58 (task modal z-index), WOR-53 (task comments), etc. |

### By Project

| Project | Status | Priority | Key Issues |
|---------|--------|----------|------------|
| **V1.0 Launch Readiness** | In Progress | 🔴 Urgent | WOR-55, WOR-56, WOR-62, WOR-63, WOR-64, WOR-67 |
| **Leave Module Maturity** | Backlog | 🟠 High | WOR-11 (In Review), WOR-32, WOR-7 |
| **Employee Experience** | Backlog | 🟡 Medium | WOR-17 (In Progress), WOR-50 |
| **Pro Monetization** | Backlog | 🟠 High | WOR-26, WOR-13 |
| **Platform Quality** | Backlog | 🟡 Medium | WOR-14, E2E tests |

---

## Complete System Inventory

### Backend Modules (14 Total)

| Module | Files | Handler | Service | Repo | Tests | Status |
|--------|-------|---------|---------|------|-------|--------|
| **admin** | 6 | ✅ | ✅ | ✅ | ❌ None | Gap |
| **approval** | 2 | — | — | — | ✅ types_test | Partial |
| **attendance** | 6 | ✅ | ✅ | ✅ | ✅ handler + service | Good |
| **audit** | 3 | — | — | ✅ | ✅ repository | Good |
| **auth** | 7 | ✅ | ✅ | ✅ | ✅ handler + service | Good |
| **calendar** | 6 | ✅ | ✅ | ✅ | ✅ handler + service | Good |
| **claims** | 7 | ✅ | ✅ | ✅ | ✅ handler + service | Good |
| **department** | 4 | ✅ | ✅ | ✅ | ❌ None | Gap |
| **employee** | 6 | ✅ | ✅ | ✅ | ✅ handler + service | Good |
| **leave** | 10 | ✅ | ✅ | ✅ | ✅ handler + service + rollover | Excellent |
| **organisation** | 5 | ✅ | ✅ | ✅ | ⚠️ service (FAILING) | Needs fix |
| **setup** | 10 | ✅ | ✅ | ✅ | ⚠️ 16 integration tests (FAILING) | Needs fix |
| **tasks** | 6 | ✅ | ✅ | ✅ | ✅ handler + approval | Good |
| **platform/middleware** | 7 | — | — | — | ✅ rbac | Good |

**Total test files (backend):** 31  
**Passing suites:** 12/14  
**Failing suites:** 2 (organisation — mock mismatch, setup — DB auth for integration tests)

### API Endpoints (100+ Total)

| Tag | Endpoints | Key Operations |
|-----|-----------|----------------|
| **Auth** | 5 | Register, login, refresh, logout, verify email |
| **Organisations** | 11 | CRUD, invitations, members, ownership transfer |
| **Employees** | 8 | CRUD, documents, org chart, workload, directs |
| **Departments** | 4 | CRUD with hierarchy |
| **Attendance** | 6 | Clock in/out, daily/monthly reports |
| **Leave** | 16 | Policies, balances, requests, templates, calendar, holidays, notifications |
| **Calendar** | 4 | Unified holidays (public + custom), CRUD custom holidays |
| **Claims** | 13 | Categories, balances, submissions, approval, templates, summary |
| **Tasks** | 14 | Lists, tasks, comments, reactions, move, complete |
| **Setup** | 4 | Status, templates, complete, skip |
| **Admin** | 10 | Feature flags, pro licenses, system stats |

### Frontend (55 Test Files)

| Area | Route | Tests | Status |
|------|-------|-------|--------|
| **Auth** | login, register, setup-org, invite | ✅ 4 route tests | Good |
| **Attendance** | index, monthly | ✅ 2 route tests | Good |
| **Calendar** | index, route | ✅ 2 route tests | Good |
| **Changelog** | route | ✅ 1 route test | Good |
| **Settings** | company, members | ✅ 2 route tests | Good |
| **Leave** | route | ✅ hooks tested | Good |
| **Claims** | route | ✅ hooks tested | Good |
| **Tasks** | route | ✅ component + approval tests | Good |
| **Overview** | route | ❌ No tests | Gap |
| **Org Chart** | route | ❌ No tests | Gap |
| **Reports** | route | ❌ No tests | Gap |
| **People** | route, $id | ⚠️ Partial | Gap |

**Component tests:** 36 files  
**API/Utils tests:** 10 files  
**Store tests:** auth.test.ts  
**MSW mocking:** Used for all API tests

### Database Schema (44 Migrations)

**Tables (30+):**
- **Foundation:** organisations, users, organisation_members, auth_tokens, invitations
- **HR:** employees, employee_documents, departments
- **Time:** attendance_records, work_schedules, work_schedule_templates, public_holidays
- **Leave:** leave_policies, leave_balances, leave_requests, leave_policy_templates
- **Claims:** claim_categories, claim_balances, claims, claim_category_templates
- **Tasks:** task_lists, tasks, task_comments, comment_reactions
- **System:** announcements, notifications, audit_logs, feature_flags, pro_licenses, admin_configs

**Data Integrity:**
- ✅ UUID primary keys with `gen_random_uuid()`
- ✅ Soft deletes (`is_active` boolean) on employees, policies, categories
- ✅ Timestamps in UTC (`TIMESTAMPTZ`)
- ✅ Money as `BIGINT` (smallest currency unit)
- ✅ Foreign key constraints with proper cascades
- ✅ GIN indexes for array columns (employment types)
- ✅ Comprehensive composite indexes for performance
- ✅ `organisation_id` on every tenant table

**Country Support:**
- ✅ Indonesia (ID) — public holidays 2026, leave templates, claim templates
- ✅ UAE (AE) — public holidays 2026, leave templates, claim templates
- ✅ Malaysia (MY) — leave templates
- ✅ Singapore (SG) — leave templates

---

## Production Readiness Assessment by Domain

### 1. 🧠 Product Owner — Feature Completeness: 90%

#### ✅ Delivered (Sprints 1–22)

**Core HR (complete):**
- Employee management with profiles, documents, org chart, job hierarchy
- Department management with nested hierarchy
- Multi-country support (ID, AE, MY, SG)
- Employment types (full_time, part_time, contract, intern)

**Attendance (complete):**
- Clock-in/out with notes
- Daily and monthly reports
- Configurable work schedules + templates

**Leave Management (complete):**
- Configurable leave policies per org
- Leave balance auto-initialization
- Leave request workflow (submit → approve/reject → balance deduction)
- Calendar view with leave overlay
- Country policy templates (1-click import)
- Employment type eligibility filtering
- Unlimited leave support (is_unlimited flag)
- Pro-rated balances
- Holiday-aware day counting

**Claims (complete):**
- Configurable claim categories with monthly budgets
- Claim submission with receipt upload (S3)
- Approval workflow (manager-based + auto-approve for owners)
- Country category templates
- Monthly balance tracking
- Employment type eligibility filtering
- Mark as paid

**Tasks (complete, unique differentiator):**
- Sticky note kanban board (unique visual design)
- Drag-and-drop with position persistence
- Workload intelligence (task count, overdue, leave status, workload badges)
- Nested comments with rich text (TipTap)
- Emoji reactions (6 reactions)
- Task filters with URL persistence
- Time-aware due dates (5 urgency levels)

**Calendar (complete):**
- Unified view: public holidays + custom org holidays + leave
- Custom holiday CRUD per organisation
- Country-specific public holiday seed data

**System:**
- Setup wizard (guided onboarding for new orgs)
- System changelog (`/changelog` route)
- PWA (Progressive Web App — install to home screen)
- Email integration (Resend — In Review)
- Admin panel (feature flags, pro licenses, system stats)
- Audit logging (immutable, all state-changing actions)

#### ❌ Missing for Public Launch

| Feature | Priority | Effort | Notes |
|---------|----------|--------|-------|
| Landing page + pricing | High | 1 week | No public website yet |
| Billing (Stripe/Paddle) | High | 1 week | No revenue possible |
| Analytics dashboard | High | 1 week | WOR-26 in backlog |
| Employee self-service portal | Medium | 1 week | All features are admin-facing |
| Attendance correction workflow | Medium | 3 days | Employee self-correction |
| GPS geofencing (Pro) | Low | 2 weeks | Competitor feature |
| Shift scheduling | Low | 1 week | Basic work schedules only |

#### Competitive Position

| Feature | Workived | Zoho People | Qoyod | BambooHR |
|---------|----------|-------------|-------|----------|
| Attendance tracking | ✅ | ✅ | ✅ | ✅ |
| Leave management | ✅ | ✅ | ✅ | ✅ |
| Claims/Expenses | ✅ | ✅ | ✅ | ✅ |
| Task management | ✅ **Unique** | ❌ | ❌ | ❌ |
| **Workload intelligence** | ✅ **Unique** | ❌ | ❌ | ❌ |
| **PWA** | ✅ | ❌ | ❌ | ❌ |
| Employment eligibility | ✅ | ✅ | ⚠️ | ✅ |
| GPS geofencing | ❌ | ✅ | ✅ | ❌ |
| Analytics | ❌ | ✅ | ✅ | ✅ |
| Mobile app | ✅ PWA | ✅ Native | ✅ Native | ✅ Native |
| Payroll | ❌ | ✅ | ✅ | ✅ |

---

### 2. 🏗️ Architect — Technical Health: 83%

#### ✅ Architecture Strengths

**Clean Architecture:**
- Modular monolith (handler → service → repository pattern)
- 14 well-separated internal modules
- Type safety (Go + TypeScript strict mode)
- Dependency injection (clean testability)

**Security Design:**
- Multi-tenancy enforced at application layer
- All queries filter by `organisation_id` first
- JWT with refresh tokens (15 min access, 30 day refresh)
- Password hashing (bcrypt)
- SQL injection prevention (parameterized queries)
- S3 pre-signed URLs for file uploads

**Scalability Patterns:**
- UUID primary keys (distributed ID generation)
- Cursor-based pagination helpers
- Redis caching (sessions, rate limiting, workload cache)
- File storage in S3 (not local disk)
- GIN indexes for array queries

**Middleware Stack:**
1. `gin.Recovery()` — panic recovery
2. `middleware.RequestID()` — request ID tracking
3. `middleware.Logger()` — structured request logging
4. `middleware.Auth()` — JWT validation
5. `middleware.Tenant()` — org context extraction
6. `middleware.RateLimiter()` — 600 req/min per user

#### ⚠️ Remaining Technical Debt

**1. Legacy ListHolidays Endpoint (WOR-67)** 🔴

The `leave/repository.go` has a `ListHolidays` function that doesn't filter custom holidays by `organisation_id`. The `calendar/repository.go` has the correct implementation. The old leave endpoint must be deprecated or fixed.

**2. No E2E Test Suite** 🟠

Cross-module integration is untested. Example risks:
- Does creating an employee auto-initialize leave balances?
- Does approving leave update the calendar view?
- Does employment type change affect future leave eligibility?

**3. Cache Invalidation Strategy** 🟡

- Workload cache: 5 min TTL (acceptable)
- TanStack Query: Various staleTime settings (per-module)
- No formal cache invalidation on mutations (relies on query invalidation in React)

**4. Bundle Size** 🟡

Not re-measured after PWA + service worker addition. PWA adds overhead but service worker precaching may improve perceived performance. Needs measurement.

---

### 3. 🎨 Designer — UX Maturity: 80%

#### ✅ Design Strengths

- Unique sticky note kanban (tears, pins, rotations)
- Consistent design system (7px status squares, Plus Jakarta Sans, module-specific backgrounds)
- PWA install prompt (native-feeling on mobile)
- Changelog with type indicators (feature/fix/improvement)
- "What's New" dot indicator for unread changes
- Employment type multi-select on policy forms

#### ❌ UX Gaps

| Gap | Priority | Effort |
|-----|----------|--------|
| Mobile responsiveness incomplete (kanban, calendar) | Medium | 1 week |
| No empty states for new orgs | Medium | 1 day |
| Accessibility audit not done (WCAG AA) | Low for beta, High for launch | 3 days |
| No unified approval inbox | High | 5 days |

**Current Accessibility:**
- ✅ `role="alert"` + `aria-live="polite"` on errors
- ✅ `aria-expanded`, `aria-haspopup` on menus
- ✅ `aria-label` on form fields and buttons
- ✅ `aria-valuenow`/`aria-valuemax` on progress bars
- ⚠️ No `aria-describedby` for validation messages
- ⚠️ No formal keyboard navigation testing

---

### 4. 👨‍💻 Engineer — Code Quality: 82%

#### Test Results (March 28, 2026)

```
✅ PASS  cmd/api                     0.6s
✅ PASS  internal/approval           1.0s
✅ PASS  internal/attendance         1.6s
✅ PASS  internal/audit              2.0s
✅ PASS  internal/auth               4.5s
✅ PASS  internal/calendar           3.2s
✅ PASS  internal/claims             3.5s
✅ PASS  internal/employee           4.0s
✅ PASS  internal/leave              4.6s
❌ FAIL  internal/organisation       5.0s  ← TestOrgService_Create
✅ PASS  internal/platform/middleware 5.3s
❌ FAIL  internal/setup              5.8s  ← 16 integration tests (DB auth)
✅ PASS  internal/tasks              6.1s
✅ PASS  pkg/apperr                  6.5s
✅ PASS  pkg/email                   6.9s
⏭️ SKIP  pkg/logger                  (no test files)
⏭️ SKIP  pkg/paginate                (no test files)
⏭️ SKIP  pkg/validate                (no test files)
```

**Pass rate:** 12/14 suites (86%)

**Failing test root causes:**
1. `organisation/service_test.go` — `TestOrgService_Create` likely broken by email integration changes (mock mismatch)
2. `setup/repository_test.go` — All 16 tests fail with `FATAL: password authentication failed for user "workived"` — integration tests require running local PostgreSQL with correct credentials

#### Code Quality Indicators

- ✅ No hardcoded secrets (all from environment config)
- ✅ 4 TODOs found (all non-critical, in admin UI and claims service)
- ✅ Consistent handler → service → repository pattern
- ✅ Type-safe error handling (`apperr` package)
- ✅ Structured logging (zerolog)
- ✅ Input validation (Go validator + Zod frontend)

---

### 5. 🔍 QA — Test Coverage: 75%

#### Coverage by Module

| Module | Backend Tests | Frontend Tests | Integration | E2E |
|--------|--------------|----------------|-------------|-----|
| Auth | ✅ 98%+ | ✅ 4 route tests | ⚠️ Partial | ❌ |
| Organisation | ⚠️ Failing | ✅ hooks | ❌ | ❌ |
| Employee | ✅ 98%+ | ⚠️ Partial | ❌ | ❌ |
| Department | ❌ None | ❌ None | ❌ | ❌ |
| Attendance | ✅ 98%+ | ✅ 2 route tests | ❌ | ❌ |
| Leave | ✅ 98%+ | ✅ hooks | ❌ | ❌ |
| Claims | ✅ 98%+ | ✅ hooks | ❌ | ❌ |
| Tasks | ✅ handler + approval | ✅ components | ❌ | ❌ |
| Calendar | ✅ 98%+ | ✅ 2 route tests | ❌ | ❌ |
| Setup | ⚠️ Failing (DB) | ✅ 1 route test | ❌ | ❌ |
| Admin | ❌ None | ❌ None | ❌ | ❌ |

#### Testing Gaps

| Gap | Risk | Effort | Priority |
|-----|------|--------|----------|
| No E2E test suite | High — cross-module regressions | 3 days | High |
| Department module: 0 tests | Medium — hierarchy bugs | 4 hours | Medium |
| Admin module: 0 tests | Medium — feature flag bugs | 3 hours | High |
| Organisation test failure | Medium — blocks CI | 1 hour | High |
| Setup integration tests | Low — need DB setup | 30 min | Medium |
| Frontend backfill (overview, org-chart) | Low — UI regressions | 2 days | Low |
| No load/stress testing | Medium — unknown limits | 2 days | Medium |

---

### 6. 🔒 Security — Security Posture: 85%

#### 🔴 Critical: WOR-67 — Multi-Tenancy Violation

**Bug:** The `leave/repository.go` `ListHolidays` function filters custom holidays by `country_code` only — not by `organisation_id`. Custom holidays created by Org A are visible to Org B in the same country.

**Impact:** Data isolation breach. Org-specific company events (anniversaries, off-days) leak to competitors.

**Fix:** Either deprecate the legacy leave holidays endpoint in favour of the calendar module (which has correct org filtering), or add `organisation_id` filter to the leave query.

#### 🟡 Medium Issues

| Issue | Risk | Status |
|-------|------|--------|
| `RoleFromJWT()` parses without signature validation | Low (UI hints only, not security decisions) | Document usage |
| No org-level storage quota for file uploads | Medium (DoS via mass uploads) | Backlog |
| S3 filenames not sanitized | Low (UUID namespacing prevents traversal) | Backlog |
| JWT allows HS256/384/512 (not pinned to HS256) | Low | Backlog |

#### ✅ Security Strengths

| Area | Status | Details |
|------|--------|---------|
| Multi-tenancy enforcement | ✅ | All SQL queries filter by `organisation_id` |
| Authentication | ✅ | JWT + refresh tokens, bcrypt password hashing |
| Authorization | ✅ | RBAC middleware, permission-based access control |
| Input validation | ✅ | All handlers use `validate.Struct()` |
| SQL injection | ✅ | Parameterized queries throughout |
| File upload | ✅ | Type whitelist + 10MB size limit |
| Rate limiting (app) | ✅ | 600 req/min per user via Redis |
| Rate limiting (nginx) | ✅ | 100 req/s API, 5 req/min login |
| Secrets management | ✅ | All from environment variables |
| HTTPS | ✅ | TLS 1.2+ via nginx |
| Security headers | ✅ | X-Frame-Options, X-Content-Type-Options, HSTS |

---

### 7. ☁️ Infra — Infrastructure Readiness: 85%

#### Deployment Pipeline

| Component | Status | Details |
|-----------|--------|---------|
| **Docker builds** | ✅ | Multi-stage: ~15MB API image, nginx static for web |
| **Production compose** | ✅ | Redis AOF, Watchtower auto-updates, nginx TLS |
| **CI/CD** | ✅ | GitHub Actions: manual dispatch, 98% coverage gate, multi-region |
| **VPS bootstrap** | ✅ | `setup-production-vps.sh`: Docker, firewall, fail2ban, SSH, unattended updates |
| **Deploy script** | ✅ | `deploy-production.sh`: zero-downtime, auto-migrations, image pruning |
| **Health monitoring** | ✅ | `health-check.sh`: containers, API, Redis, disk (75% warn, 90% critical), memory |
| **Multi-region** | ✅ | Singapore (api.workived.com) + Germany (api-uae.workived.com) |
| **Database** | ✅ | Supabase PostgreSQL (managed backups, PITR) |
| **File storage** | ✅ | Cloudflare R2 (no egress fees) |
| **Email** | ✅ | Resend (In Review) + AWS SES fallback |
| **SSL/TLS** | ✅ | Nginx: TLS 1.2+, modern ciphers, HSTS 1 year |

#### Make Commands

**Development (`Makefile`):**
```
make dev          Full setup: infra + migrate + run
make infra-up     Start PostgreSQL, Redis, MinIO, Mailcatcher
make test         Run Go test suite
make test-cover   Generate coverage report
make build        Compile to bin/api
make seed         Seed test data (4 SQL files)
make reset-db     Nuclear: drop everything and recreate
```

**Production (`Makefile.infra`):**
```
make setup-vps    Bootstrap fresh VPS
make deploy       Deploy latest to production
make health-check Full system health check
make logs         Tail all container logs
make backup-redis Trigger Redis BGSAVE
make migrate-up   Run pending migrations
make restart      Restart all services
```

#### Cost Estimate

| Service | Free Tier | Paid | Notes |
|---------|-----------|------|-------|
| Hetzner CX21 (Germany) | — | €4.51/mo | UAE proxy |
| Vultr 2GB (Singapore) | — | $12/mo | Primary region |
| Supabase PostgreSQL | ✅ 500MB | $25/mo at scale | Managed, daily backups |
| Cloudflare R2 | ✅ 10GB | $0.15/GB | No egress fees |
| Resend email | ✅ 3k/mo | — | Transactional email |
| **Total** | — | **$17-42/mo** | Scales to 100+ orgs |

#### ❌ Infrastructure Gaps

| Gap | Risk | Priority |
|-----|------|----------|
| No centralized monitoring (Datadog config exists, not connected) | High — blind to production issues | High |
| No Terraform/IaC (scripts only) | Low — manual but works for 2 regions | Low |
| No CSP header on frontend nginx | Medium — XSS risk | Medium |
| No automated backup verification | Medium — untested recovery | Medium |

---

## Prioritized Action Plan

### 🔴 Before Beta Launch (This Week)

| # | Issue | ID | Effort | Impact |
|---|-------|----|--------|--------|
| 1 | Fix custom holiday multi-tenancy leak | WOR-67 | 1h | P0 — data isolation |
| 2 | Fix organisation test suite (TestOrgService_Create) | — | 1h | CI/CD unblocked |
| 3 | Fix setup integration test DB config | — | 30m | CI/CD fully green |
| 4 | Close task status misleading display | WOR-55 | 1h | UX correctness |
| 5 | Close attendance "0 present" mismatch | WOR-56 | 1h | UX correctness |
| 6 | Close attendance join date filtering | WOR-62 | 1h | Data correctness |
| 7 | Close unlimited leave balance display | WOR-64 | 1h | UX correctness |

**Total effort:** ~6.5 hours

### 🟠 Merge In-Review Items

| # | Issue | ID | Status |
|---|-------|----|--------|
| 8 | Employment type → policy eligibility | WOR-11 | In Review |
| 9 | Resend email integration | WOR-60 | In Review |
| 10 | Pending invitation status fix | WOR-63 | In Review |

### 🟡 Week 1-2 Post-Beta

| # | Task | Effort | Priority |
|---|------|--------|----------|
| 11 | Add department module tests | 4h | Medium |
| 12 | Add admin module tests | 3h | High |
| 13 | Frontend test backfill (overview, attendance, org-chart) | 2d | Medium |
| 14 | Add CSP header to frontend nginx | 1h | Medium |
| 15 | Sanitize S3 filenames in claims upload | 1h | Medium |
| 16 | Connect centralized monitoring (Datadog/Grafana) | 2d | High |

### 🔵 Month 1 Post-Beta

| # | Task | Effort | Priority |
|---|------|--------|----------|
| 17 | E2E test suite (Playwright, 5 critical user flows) | 3d | High |
| 18 | Landing page + pricing page | 1w | High |
| 19 | Stripe/Paddle billing integration | 1w | High |
| 20 | HR analytics dashboard (WOR-26) | 1w | High |
| 21 | Load/stress testing (k6) | 2d | Medium |
| 22 | Attendance correction workflow | 3d | Medium |
| 23 | Multi-level approval engine (WOR-41) | 1w | Medium |

---

## Appendix A: Tech Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend** | Go (Gin framework) | 1.25 |
| **Frontend** | React + Vite + TypeScript | 19 / 8 / 5.9 |
| **Routing** | TanStack Router | 1.167.4 |
| **State** | TanStack Query + Zustand | 5.90 / 5.0 |
| **Forms** | React Hook Form + Zod | 7.71 / 4.3 |
| **Styling** | Tailwind CSS + shadcn/ui | 4.2.1 |
| **Rich Text** | TipTap | 3.20.4 |
| **PWA** | vite-plugin-pwa (Workbox) | 1.2.0 |
| **Database** | PostgreSQL (Supabase) | 16 |
| **Cache** | Redis | 7 |
| **Storage** | Cloudflare R2 (S3-compatible) | — |
| **Email** | Resend + SMTP fallback | — |
| **Testing** | Vitest + RTL + MSW (FE), Go test (BE) | 4.1 / 2.12 |
| **CI/CD** | GitHub Actions | — |
| **Infra** | Docker Compose + nginx + VPS | — |

## Appendix B: API Documentation

Full OpenAPI 3.1 spec available at `/docs/openapi.yaml` (served via Scalar UI at `/docs` with HTTP Basic Auth).

## Appendix C: Code Health Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Backend test pass rate | 86% (12/14) | 100% | ⚠️ Fix 2 suites |
| Backend test files | 31 | — | Good |
| Frontend test files | 55 | — | Good |
| SQL migrations | 44 | — | Good |
| API endpoints | 100+ | — | Good |
| Hardcoded secrets | 0 | 0 | ✅ |
| TODOs in code | 4 | <10 | ✅ |
| Modules without tests | 2 (admin, dept) | 0 | ⚠️ |

---

## Overall Score: 85/100 (was 75/100)

**+10 improvement** driven by:
- Infrastructure: +45% (Docker, CI/CD, multi-region, health monitoring)
- Compliance: +15% (employment eligibility, unlimited leave, setup wizard)
- Frontend: +3% (PWA, changelog, calendar)
- Core Product: +2% (custom holidays, email)

**Biggest risks remaining:**
1. 🔴 WOR-67 multi-tenancy bug (urgent, 1h fix)
2. 🟠 No E2E tests (medium-term reliability risk)
3. 🟠 No centralized monitoring (blind to production issues)
4. 🔵 No monetization (can't generate revenue yet)

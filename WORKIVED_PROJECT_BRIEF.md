# Workived — Project Brief

> **This document is the single source of truth for the Workived project.**
> Read this fully before writing any code, creating any file, or making any architectural decision.
> Every decision in here has been deliberately made. Do not override them without explicit instruction.

---

## 1. What is Workived?

Workived is an **attendance and leave management platform for 5–25 person startups** — a freemium SaaS focused on compliance-first HR operations. It targets small company founders in Indonesia and UAE who currently track attendance via WhatsApp and leave via Google Sheets.

**Core wedge:** Attendance tracking + Leave management (daily compliance pain)  
**Future expansion:** Claims, employee records, task management (Phase 2)

**Domain:** `workived.com`  
**Tagline:** Attendance done right.

**See:** `docs/adr/002-product-focus-attendance-leave-first.md` for strategic rationale.

---

## 2. Target Market

### Primary launch markets (Phase 1 — simultaneous)
| Market | Why |
|--------|-----|
| 🇮🇩 Indonesia | Founder has personal connections here |
| 🇦🇪 UAE (Dubai) | Founder has a friend who is a startup founder there |

### Expansion markets (Phase 2 — month 6+)
- 🇲🇾 Malaysia
- 🇸🇬 Singapore

### Day-1 buyer persona
**"Ahmad"** — founder of a 5–25 person startup, any industry (mixed SMB). Currently uses WhatsApp for leave requests, Google Sheets for attendance, email for claims. Makes purchase decisions alone and fast. High price sensitivity — will use free tier for 6–12 months before upgrading.

---

## 3. Product Modules

### Free tier (all companies, up to 25 employees)
| Module | Free features |
|--------|--------------|
| Employee management | Profiles, documents, org chart, basic fields, job hierarchy (`reporting_to`) |
| Attendance | Clock-in/out, manual correction, basic reports |
| Leave | Requests, approvals, preset leave types |
| Claims | Submit, approve, receipt upload, basic flow |
| Approval system | Modular approval engine, hierarchy-based routing, multi-level approval chains |
| Task management | Create, assign, due dates, basic kanban |
| Announcements | Company-wide notice board |

### Pro tier ($3–5 / employee / month, unlimited employees)
| Module | Pro additions |
|--------|--------------|
| Employee management | Custom fields (JSONB), bulk import, unlimited headcount |
| Attendance | GPS geofencing, face verify, shift scheduling, overtime |
| Leave | Custom leave types, accrual rules, carry-over config |
| Claims | Budget caps per category, monthly limits |
| Task management | Subtasks, dependencies, time tracking, Gantt view |
| Approval system | Escalation rules (auto-approve after X days, skip-level escalation) |
| Analytics | HR dashboards, insights, custom reports |

### Enterprise (custom pricing)
- Payroll
- SSO
- SLA support
- White-label

### Payroll — DEFERRED
Payroll is explicitly out of scope for the initial build. Build the general employee/salary data structures that payroll will eventually consume, but do not build payroll processing logic yet.

---

## 4. Monetization Model

- **Freemium** — generous free tier to drive acquisition
- **Depth-based upgrade triggers** — charge for scale and automation, not feature access
- **Key conversion triggers:** hitting 25-employee limit, needing geofencing, wanting analytics, approval escalation rules
- **Free tier limit:** 25 employees per organisation — enforced at application layer via `organisations.plan_employee_limit`

### Billing Implementation (Post-MVP)

**Not built yet. Key decisions TBD:**

- **Payment provider:** Stripe vs Paddle vs Lemon Squeezy
  - Stripe: Full control, more work
  - Paddle/Lemon: Merchant of record, handles tax/compliance
- **Per-seat sync:** How to track active employee count for billing
- **Proration:** Mid-cycle upgrades/downgrades
- **Downgrade behavior:** 
  - Immediate feature lock or grace period?
  - What happens to data over limit?
- **Subscription management:** Self-serve portal via provider (Stripe Customer Portal)
- **Webhook handling:** `subscription.updated`, `payment_failed`, etc.

**Sprint priority:** Post-Sprint 8 (after core features proven)

---

## 5. Tech Stack

### Frontend — Dashboard (apps/web)
- **Build tool:** Vite 8
- **UI library:** React 19
- **Routing:** TanStack Router (type-safe, file-based)
- **Server state:** TanStack Query v5
- **Client state:** Zustand (auth, org context)
- **Forms:** React Hook Form + Zod
- **HTTP:** axios with JWT interceptors
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Testing:** Vitest + React Testing Library + MSW
- **Language:** TypeScript (strict mode)
- **Mobile:** PWA (Progressive Web App) — responsive and mobile-first
- **Font:** Plus Jakarta Sans (via @fontsource-variable, 700/800 headings, 400/500 body)
- **Deployment:** Static files (`vite build` → `dist/`) — no Node.js server needed

### Frontend — Landing page (apps/landing, future)
- **Framework:** Astro (SSG — static site generation for SEO)
- **Styling:** Tailwind CSS + shared design tokens
- **Content:** Markdown/MDX for blog posts, changelog
- **Deployment:** Static files — CDN or any static host

### Backend
- **Language:** Go (Golang)
- **Architecture:** Modular monolith — NOT microservices. Clean module boundaries that can be extracted later if needed.
- **API style:** REST (JSON)
- **Auth:** JWT with refresh tokens (contains `user_id` + `organisation_id`)
  - **Known limitation:** Single-org assumption. Multi-org users need token refresh to switch orgs.
  - **Future:** Migrate to `user_id`-only JWT + org context via header/subdomain when multi-org is needed.
- **Async:** Background workers (goroutines + DB polling for MVP). Redis Streams later for replayability.

### Database
- **Primary DB:** PostgreSQL (single schema, application-layer multi-tenancy via `organisation_id`)
- **Cache / Sessions:** Redis
- **File storage:** S3-compatible (AWS S3 or MinIO for local dev)
- **Migrations:** golang-migrate

### Infrastructure
- **Cloud:** AWS
- **Primary region:** `ap-southeast-1` (Singapore) — covers Indonesia + Malaysia PDPA compliance
- **Secondary region (UAE):** `me-south-1` (Bahrain) — covers UAE PDPL compliance
- **CI/CD:** GitHub Actions
- **Containers:** Docker + Kubernetes
- **Observability:** Structured logging, metrics, traces from day one

### Local development
```
make dev           →  PostgreSQL + Redis + MinIO + Go API + Vite dev server
docker-compose up  →  PostgreSQL + Redis + MinIO (infra only)
```

---

## 6. Project Structure

```
workived/
├── apps/
│   ├── web/                        # Vite + React SPA (dashboard)
│   │   ├── src/
│   │   │   ├── routes/             # TanStack Router file-based routes
│   │   │   │   ├── _auth/          # Unauthenticated (login)
│   │   │   │   └── _app/           # Authenticated (dock, auth guard)
│   │   │   ├── components/
│   │   │   │   ├── ui/             # shadcn/ui base components
│   │   │   │   └── workived/       # App-specific components
│   │   │   └── lib/
│   │   │       ├── api/            # axios client + endpoint modules
│   │   │       ├── hooks/          # TanStack Query wrappers
│   │   │       ├── stores/         # Zustand (auth, org context)
│   │   │       └── utils/          # money, date, cn
│   │   └── package.json
│   └── landing/                    # Astro marketing site (future)
│
├── design/                         # Shared design tokens (both apps import from here)
│   └── tokens.ts
│
├── services/                       # Go backend — modular monolith
│   ├── cmd/
│   │   └── api/
│   │       └── main.go             # Entry point
│   ├── internal/
│   │   ├── auth/                   # JWT, sessions, tokens
│   │   │   ├── handler.go
│   │   │   ├── service.go
│   │   │   └── repository.go
│   │   ├── organisation/           # Org management, invitations
│   │   ├── employee/               # Employee CRUD, documents
│   │   ├── attendance/             # Clock-in/out, schedules
│   │   ├── leave/                  # Policies, balances, requests
│   │   ├── claims/                 # Expense claims
│   │   ├── tasks/                  # Task lists, tasks, comments
│   │   ├── notification/           # In-app notifications
│   │   └── platform/               # Shared: DB, Redis, config, middleware
│   │       ├── config/
│   │       ├── database/
│   │       ├── middleware/
│   │       │   ├── auth.go         # JWT validation
│   │       │   ├── tenant.go       # organisation_id extraction + validation
│   │       │   └── rbac.go         # Role-based access control
│   │       └── storage/            # S3 client
│   └── pkg/
│       ├── apperr/                 # Typed application errors
│       ├── paginate/               # Cursor-based pagination helpers
│       └── validate/               # Input validation
│
├── migrations/                     # golang-migrate SQL files
│   ├── 000001_create_organisations.up.sql
│   ├── 000001_create_organisations.down.sql
│   └── ...
│
├── infra/
│   ├── docker-compose.yml          # Local dev stack
│   ├── docker-compose.test.yml     # Test stack
│   ├── k8s/                        # Kubernetes manifests
│   └── terraform/                  # Cloud infra (later)
│
└── docs/
    ├── api/                        # OpenAPI specs
    └── adr/                        # Architecture Decision Records
```

---

## 7. Database Schema

### Multi-tenancy pattern
- Every table has `organisation_id UUID NOT NULL` as a column
- Every query MUST filter by `organisation_id` as the FIRST condition
- Multi-tenancy is enforced at the **application layer** in Go middleware — NOT PostgreSQL RLS
- Never trust the client to supply `organisation_id` — always extract from JWT

### Critical data types
- **All monetary amounts:** `BIGINT` in smallest currency unit (sen for MYR, fils for AED, rupiah for IDR — IDR has no sub-unit). NEVER use FLOAT or DECIMAL for money.
- **All timestamps:** `TIMESTAMPTZ` stored in UTC. Convert to org local timezone at API response layer only.
- **All primary keys:** `UUID` generated with `gen_random_uuid()`
- **Soft deletes:** Use `is_active BOOLEAN` — never hard delete employees, leave policies, or claim categories

### Tables

#### Foundation
```sql
organisations          -- Every company using Workived
users                  -- Authentication — global, not per-org
organisation_members   -- Links users to orgs with role
auth_tokens            -- Password reset, email verify, invite tokens
invitations            -- Invite employees by email before signup
```

#### Employee management
```sql
departments            -- Org chart, supports nested (parent_id self-ref)
employees              -- Central employee record — heart of the system
employee_documents     -- Contracts, IDs, certificates stored in S3
```

#### Attendance
```sql
attendance_records     -- Every clock-in/out event
work_schedules         -- Configurable shift schedules per org or employee
public_holidays        -- Country-specific holidays — updatable without code deploy
```

#### Leave
```sql
leave_policies         -- Configurable per org — NEVER hardcode country rules
leave_balances         -- Current balance per employee per type per year
leave_requests         -- Every leave application with approval trail
```

#### Claims
```sql
claim_categories       -- Configurable per org (travel, meals, equipment etc)
claims                 -- Expense submissions with approval trail
```

#### Tasks
```sql
task_lists             -- Kanban columns — configurable per org
tasks                  -- Task records with assignment and priority
task_comments          -- Discussion thread per task
```

#### System
```sql
announcements          -- Company-wide notice board
notifications          -- In-app notification inbox per user
audit_logs             -- Immutable record of every state-changing action
```

### Key design decisions

**Leave policies are configurable, not hardcoded:**
```sql
-- CORRECT — configurable per org
INSERT INTO leave_policies (organisation_id, name, days_per_year, ...)
VALUES ($1, 'Annual Leave', 30.0, ...);  -- UAE: 30 days

-- WRONG — never do this
IF country_code = 'AE' THEN days = 30
IF country_code = 'ID' THEN days = 12
```

**Working week is configurable:**
```sql
-- In organisations table
work_days INT[]  -- [1,2,3,4,5] = Mon–Fri
                 -- Stored as day-of-week integers (1=Mon, 7=Sun)
```

**Currency per employee:**
```sql
-- In employees table
base_salary     BIGINT   -- In smallest unit
salary_currency CHAR(3)  -- IDR, AED, MYR, SGD
```

**Timestamps always UTC:**
```sql
-- Store
clock_in_at TIMESTAMPTZ DEFAULT NOW()  -- Always UTC in DB

-- Convert at API layer in Go
func ToLocalTime(t time.Time, timezone string) time.Time {
    loc, _ := time.LoadLocation(timezone)
    return t.In(loc)
}
```

### Indexes
```sql
-- Core — every query starts here
CREATE INDEX idx_employees_org            ON employees(organisation_id);
CREATE INDEX idx_employees_org_status     ON employees(organisation_id, status);
CREATE INDEX idx_employees_user           ON employees(user_id);

-- Attendance
CREATE INDEX idx_attendance_org_emp_date  ON attendance_records(organisation_id, employee_id, date DESC);
CREATE INDEX idx_attendance_org_date      ON attendance_records(organisation_id, date DESC);

-- Leave
CREATE INDEX idx_leave_req_org_status     ON leave_requests(organisation_id, status);
CREATE INDEX idx_leave_req_employee       ON leave_requests(employee_id, status);
CREATE INDEX idx_leave_bal_emp_year       ON leave_balances(employee_id, year);

-- Claims
CREATE INDEX idx_claims_org_status        ON claims(organisation_id, status);
CREATE INDEX idx_claims_employee          ON claims(employee_id);

-- Tasks
CREATE INDEX idx_tasks_org_list           ON tasks(organisation_id, task_list_id, position);
CREATE INDEX idx_tasks_assignee           ON tasks(assignee_id, completed_at NULLS FIRST);

-- Notifications
CREATE INDEX idx_notif_user_read          ON notifications(user_id, is_read, created_at DESC);

-- Audit
CREATE INDEX idx_audit_org_resource       ON audit_logs(organisation_id, resource_type, resource_id);

-- Holidays
CREATE INDEX idx_holidays_country_date    ON public_holidays(country_code, date);
```

---

## 8. API Design Principles

### URL structure
```
/api/v1/{module}/{resource}

Examples:
GET    /api/v1/employees
POST   /api/v1/employees
GET    /api/v1/employees/:id
PUT    /api/v1/employees/:id
DELETE /api/v1/employees/:id

GET    /api/v1/leave/requests
POST   /api/v1/leave/requests
PUT    /api/v1/leave/requests/:id/approve
PUT    /api/v1/leave/requests/:id/reject

POST   /api/v1/attendance/clock-in
POST   /api/v1/attendance/clock-out
GET    /api/v1/attendance/today
```

### Authentication
- JWT access token (15 min expiry) + refresh token (30 days)
- Access token in `Authorization: Bearer <token>` header
- Refresh token in httpOnly cookie
- `organisation_id` extracted from JWT claims — never from request body

### Response envelope
```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 150
  }
}
```

### Error response
```json
{
  "error": {
    "code": "INSUFFICIENT_LEAVE_BALANCE",
    "message": "You only have 3.5 days remaining but requested 5 days",
    "field": "total_days"
  }
}
```

### Pagination
Use **cursor-based pagination** for all list endpoints — NOT offset pagination. Offset breaks on fast-changing datasets (attendance records, notifications).

**How cursor pagination works:**
- Client sends `cursor` (encoded last-seen value) + `limit`
- Server uses `WHERE field > $cursor ORDER BY field LIMIT $limit`
- Response includes `next_cursor` for the next page
- Cursor is typically the sort field value (e.g., `created_at`, `full_name`)

```
GET /api/v1/attendance?cursor=<base64_encoded_value>&limit=20

Response:
{
  "data": [...],
  "meta": {
    "next_cursor": "eyJjcmVhdGVkX2F0IjoiMjAyNi0wMy0xOVQxMDowMDowMFoifQ==",
    "has_more": true
  }
}
```

---

## 9. Go Module Structure

### Every module follows this pattern
```
internal/{module}/
├── handler.go      # HTTP handlers — thin, no business logic
├── service.go      # Business logic — all rules live here
├── repository.go   # Database queries — all SQL lives here
└── types.go        # Request/response structs, domain types
```

### Middleware chain (applied to every authenticated request)
```
Request
  → AuthMiddleware       (validate JWT, extract user_id)
  → TenantMiddleware     (extract org_id from JWT, validate membership, attach role to ctx)
  → RateLimitMiddleware  (per org, per user)
  → Handler
```

### Repository pattern — org isolation enforced by function signature
```go
// organisation_id is ALWAYS the first parameter
// This makes it impossible to accidentally query across tenants
func (r *EmployeeRepo) List(
    ctx context.Context,
    orgID uuid.UUID,
    filters EmployeeFilters,
) ([]Employee, error) {
    // Every query starts with organisation_id = $1
    // Use cursor-based pagination (not LIMIT/OFFSET)
    query := `
        SELECT * FROM employees
        WHERE organisation_id = $1
        AND ($2::varchar IS NULL OR status = $2)
        AND ($3::varchar IS NULL OR full_name > $3)  -- cursor: last seen full_name
        ORDER BY full_name ASC
        LIMIT $4
    `
    ...
}
```

### Feature gating
```go
// In platform/middleware/rbac.go
func RequirePro(org Organisation) error {
    if org.Plan == "free" {
        return apperr.New(apperr.CodeUpgradeRequired,
            "This feature requires a Pro plan")
    }
    return nil
}

// Usage in handler
if err := RequirePro(ctx.Org); err != nil {
    return err
}
```

### Error types
```go
// in pkg/apperr/errors.go
const (
    CodeNotFound             = "NOT_FOUND"
    CodeUnauthorized         = "UNAUTHORIZED"
    CodeForbidden            = "FORBIDDEN"
    CodeValidation           = "VALIDATION_ERROR"
    CodeUpgradeRequired      = "UPGRADE_REQUIRED"
    CodeInsufficientBalance  = "INSUFFICIENT_LEAVE_BALANCE"
    CodeEmployeeLimitReached = "EMPLOYEE_LIMIT_REACHED"
    CodeConflict             = "CONFLICT"
)
```

---

## 10. Leave Balance Logic

### On leave request SUBMITTED
```
1. Calculate working_days between start_date and end_date
   → Exclude org.work_days weekends
   → Exclude public_holidays WHERE country_code = org.country_code AND date BETWEEN start AND end
   → Store as leave_requests.total_days

2. Check available balance:
   available = entitled_days + carried_over_days - used_days - pending_days
   IF total_days > available → return INSUFFICIENT_LEAVE_BALANCE error

3. UPDATE leave_balances SET pending_days = pending_days + total_days
```

### On leave request APPROVED
```
UPDATE leave_balances SET
  used_days    = used_days + total_days,
  pending_days = pending_days - total_days
WHERE employee_id = $1 AND leave_policy_id = $2 AND year = $3
```

### On leave request REJECTED or CANCELLED
```
UPDATE leave_balances SET
  pending_days = pending_days - total_days
```

### Year-end rollover (scheduled job — 1 January 00:00 UTC)
```
FOR EACH active employee × active leave_policy:
  carry = MIN(current_year.used_days_remaining, policy.carry_over_days)
  INSERT leave_balances (new year, entitled_days = policy.days_per_year, carried_over_days = carry)
```

### Tenure-based entitlement (ID/MY standard — stored in leave_policies config)
```
< 1 year service   → not yet eligible (min_tenure_days check)
1–2 years          → 12 days
2–5 years          → 12 days (MY) / 12 days (ID)
> 5 years          → 16 days (MY) / 12 days (ID, no statutory increase)
```

---

## 11. Multi-Country Compliance

### Indonesia 🇮🇩
- Annual leave: 12 days after 1 year of service
- Overtime: tracked in attendance_records, rates configurable
- THR (Tunjangan Hari Raya): deferred — will be a payroll module feature
- BPJS: deferred — will be a payroll module feature
- Currency: IDR — use BIGINT, no sub-units (1 IDR = 1 smallest unit)
- Timezone: `Asia/Jakarta` (WIB, UTC+7) or `Asia/Makassar` (WITA, UTC+8) — store per org

### UAE 🇦🇪
- Annual leave: 30 days
- Gratuity: deferred — will be a payroll module feature
- Currency: AED — fils (1 AED = 100 fils)
- Timezone: `Asia/Dubai` (UTC+4)
- Work week: Mon–Fri (changed from Sun–Thu in 2022 for private sector)
- UAE PDPL compliance: data can be stored in AWS me-south-1 (Bahrain)

### Malaysia 🇲🇾 (Phase 2)
- Annual leave: 8–16 days based on tenure (Employment Act 1955)
- EPF + SOCSO: deferred to payroll module
- Currency: MYR — sen (1 MYR = 100 sen)
- Timezone: `Asia/Kuala_Lumpur` (UTC+8)

### Singapore 🇸🇬 (Phase 2)
- Annual leave: 7–14 days based on tenure (Employment Act)
- CPF: deferred to payroll module
- Currency: SGD — cents (1 SGD = 100 cents)
- Timezone: `Asia/Singapore` (UTC+8)

---

## 12. Design System

### Colors
```css
--bg-page:      #0C0C0F  /* deep violet night — Overview module */
--bg-people:    #F5F0E8  /* warm cream — People module */
--bg-attendance:#E8F5EE  /* fresh green — Attendance module */
--bg-tasks:     #FDF4E3  /* warm amber — Tasks module */
--bg-calendar:  #FFF8F3  /* warm cream amber — Calendar module */

--accent:       #6357E8  /* violet-indigo */
--accent-dim:   #EFEDFD
--ok:           #12A05C
--ok-dim:       #E8F7EE
--warn:         #C97B2A
--warn-dim:     #FDF2E3
--err:          #D44040
--err-dim:      #FDECEC
```

### Typography
- **Font:** Plus Jakarta Sans
- **Display/headings:** weight 800, letter-spacing -0.05em
- **Body:** weight 400-500
- **Monospace (times, codes):** SF Mono / Fira Code

### Navigation
- **No top nav, no sidebar**
- Floating dock at bottom of screen
- Each module is a full-screen world with its own background color
- Dock color adapts to current module background

### Status indicators
- Small colored squares (border-radius: 2px) — NOT pills or badges
- Colored text only — no background containers

---

## 13. Build Order

### Sprint 1 — Foundation (DONE)
- [x] Go project scaffold (module structure, config, middleware)
- [x] PostgreSQL migrations (all tables)
- [x] Auth module (register, login, JWT, refresh)
- [x] Organisation module (create, invite members)
- [x] Employee module (CRUD, documents)
- [x] Department module (CRUD, nested)

### Sprint 2 — Attendance (DONE)
- [x] Clock-in / clock-out API with late detection
- [x] Daily and monthly attendance reports
- [x] Work schedule and public holiday support
- [x] OpenAPI 3.1 spec + Scalar UI documentation

### Sprint 3 — Frontend (Auth + Employees + Attendance) — DONE ✅
- [x] Vite + React project scaffold (TanStack Router, Query, Tailwind, shadcn/ui)
- [x] Design system setup (tokens → Tailwind config, globals.css)
- [x] API client + auth store (axios + Zustand + JWT interceptor)
- [x] Login page
- [x] App shell with floating dock
- [x] Dashboard (overview — employee count, today's attendance)
- [x] Employee list + detail pages
- [x] Attendance: clock-in/out + daily report + monthly report
- [x] Reports page with analytics placeholders

### Sprint 4 — Leave (backend) — DONE ✅
- [x] Leave policy configuration (CRUD API)
- [x] Leave balance initialisation and management
- [x] Leave request flow (submit → approve/reject/cancel)
- [x] Leave calendar API
- [x] Year-end rollover job (with tests and documentation)
- [x] All leave endpoints wired to `/api/v1/leave/*`

### Sprint 5 — Leave (frontend) — DONE ✅
- [x] Leave request pages (submit, view, approve/reject)
- [x] Leave balance dashboard  
- [x] Leave policy management (admin)
- [x] Leave calendar with public holidays integration
- [x] Interactive calendar tooltip (click date → shows holidays + employees on leave)

**Calendar Features:**
- Public holidays API: `GET /api/v1/leave/holidays?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- Frontend displays holidays from org's country (Indonesia, UAE, Malaysia, Singapore)
- Click any date cell to see: full date, all public holidays with country, all employees on leave with policy type
- Visual indicators: red tint for holidays, holiday name badges, leave entries
- Multiple holidays per date supported (e.g., overlapping religious holidays)

**Testing:**
- 77 tests passing across all leave components
- Full E2E flow validated: submit → approve → calendar display

**Available backend endpoints for Sprint 5:**
- `GET /api/v1/leave/policies` — List leave policies
- `POST /api/v1/leave/policies` — Create policy (admin)
- `PUT /api/v1/leave/policies/:id` — Update policy (admin)
- `DELETE /api/v1/leave/policies/:id` — Deactivate policy (admin)
- `GET /api/v1/leave/balances?year=2026` — List all balances (admin)
- `GET /api/v1/leave/balances/me?year=2026` — My balances (employee)
- `POST /api/v1/leave/requests` — Submit leave request
- `GET /api/v1/leave/requests?status=pending` — List requests (admin)
- `GET /api/v1/leave/requests/me` — My requests (employee)
- `POST /api/v1/leave/requests/:id/approve` — Approve request
- `POST /api/v1/leave/requests/:id/reject` — Reject request
- `POST /api/v1/leave/requests/:id/cancel` — Cancel request (employee)
- `GET /api/v1/leave/calendar?year=2026&month=3` — Calendar view
- `GET /api/v1/leave/holidays?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` — Public holidays (NEW)

**Year-end rollover:** Automated CLI tool available at `services/cmd/rollover` (see README for cron setup)

**Architectural Decision:** Leave calendar originally at `/leave/calendar` (scoped to leave module). Promoted to top-level `/calendar` in Sprint 8.0 — see ADR-004 (superseded). Old route redirects to `/calendar`.

### Sprint 5.5 — Leave Policy Templates + UI Polish — DONE ✅
**Problem:** New admins must manually create 4-6 leave policies (Annual, Sick, Maternity, etc.). This is tedious and error-prone.

**Solution:** One-click import of country-specific leave policy templates based on local labor laws.

**Scope:**
- [x] Backend: `leave_policy_templates` table with seeded data for ID + UAE + MY + SG
- [x] Backend: `GET /api/v1/leave/templates?country_code=ID` endpoint
- [x] Backend: `POST /api/v1/leave/policies/import` bulk create from template IDs
- [x] Frontend: "Import Templates" button on policies page
- [x] Frontend: Template preview modal with country selector
- [x] Seed templates for Indonesia (Annual, Sick, Maternity, Paternity, Compassionate, Hajj)
- [x] Seed templates for UAE (Annual, Sick, Maternity, Paternity, Compassionate, Hajj/Umrah)
- [x] Seed templates for Malaysia (Annual, Sick, Maternity, Paternity, Compassionate)
- [x] Seed templates for Singapore (Annual, Sick, Maternity, Paternity, Childcare, Compassionate)

**Bonus Deliverables (UI Polish):**
- [x] Redesigned leave balance cards with 3 variants (default, compact, overview)
- [x] Table layout for leave balances page (replaced card grid)
- [x] Progress bars show available days (green) instead of used days
- [x] Infinity icon (∞) for unlimited leave policies
- [x] Pending days visualization (yellow striped overlay on progress bars)
- [x] Split overview cards: separate attendance and annual leave cards
- [x] Glassmorphism styling with backdrop blur for overview cards
- [x] Enhanced BalanceCard component with icon system and status badges

**Technical Highlights:**
- Country-aware: Modal auto-detects org's country, defaults to that country's templates
- Smart filtering: Only shows templates not already imported
- Batch import: Create multiple policies in single transaction
- Multi-select UI: Checkboxes with "Select All" option
- Success/error states: Clear feedback with auto-close on success

**Value Proposition:**
- Reduces time-to-first-value from 30 minutes → 30 seconds
- Compliance-first: Legal defaults built-in per country
- Competitive moat: Localized knowledge for 4 markets (ID, UAE, MY, SG)
- Conversion trigger: Easy onboarding → faster activation → higher retention

**Out of Scope:**
- Template customization before import (edit after import if needed)
- Template versioning (manual update when laws change)
- Admin-created custom templates (may add in Pro tier later)

**Sprint Duration:** 4 days (delivered ahead of estimate)

### Sprint 5.6 — Hotfixes (Mobile + UX + Data Integrity) — DONE ✅

**Problem:** Post-Sprint 5.5 feedback revealed critical UX and data integrity issues that needed immediate attention.

**Scope:**
- [x] **Calendar mobile responsiveness** — Calendar trimmed on small screens, showing only 4 columns
  - Fixed: Implemented horizontal scroll with explicit column widths
  - Result: All 7 days visible on mobile with smooth touch scrolling
  - Files: `apps/web/src/routes/_app/leave/calendar.tsx`

- [x] **Template import deduplication warning** — Silent skip confused admins
  - Fixed: Pre-import conflict detection with warning dialog
  - Result: Clear UX showing which templates will be skipped, option to cancel or proceed
  - Files: `apps/web/src/components/workived/leave/ImportTemplatesModal.tsx`

- [x] **Policy deletion guards** — Could delete policies with pending/future requests
  - Fixed: Validation checks block deletion if constraints exist
  - Result: Data integrity protected, clear error messages
  - Backend: `CountPendingRequestsByPolicy()`, `CountFutureApprovedRequestsByPolicy()`
  - Service: Pre-deletion validation logic
  - Tests: 6 comprehensive test cases
  - Files: `services/internal/leave/{repository,service,service_test,rollover_test}.go`

- [x] **Leave balance UX fix (bonus)** — Inactive policy balances shown in UI
  - Fixed: Filter balance queries to only return active policies
  - Result: Clean UX, historical data preserved for compliance
  - Files: `services/internal/leave/repository.go`

**Deletion Constraint Behavior (Leave Policies):**
| Condition | Allow deactivation? | Action |
|-----------|---------------------|--------|
| No balances/requests | ✅ Yes | Deactivate immediately |
| Has balances, no pending/future requests | ✅ Yes | Deactivate (balances preserved as historical records) |
| Has pending requests | ❌ Block | Error: "Cannot delete — X pending requests exist" |
| Has approved future leave | ❌ Block | Error: "Cannot delete — X approved future leaves exist" |

**Deletion Constraint Behavior (Claim Categories):**
| Condition | Allow deactivation? | Action |
|-----------|---------------------|--------|
| No balances/claims | ✅ Yes | Deactivate immediately |
| Has balances, no pending claims | ✅ Yes | Deactivate (balances preserved as historical records) |
| Has pending claims | ❌ Block | Error: "Cannot delete — X pending claim(s) exist" |

**Note:** Claim categories follow the same data integrity pattern as leave policies. Historical spending data in `claim_balances` is protected by `ON DELETE RESTRICT`, preventing accidental data loss while allowing category deactivation when no active claims exist.

**Technical Highlights:**
- Zero breaking changes
- 98%+ test coverage maintained
- All 77 leave module tests passing
- Mobile-first fixes (horizontal scroll with touch support)
- Data integrity: balances preserved for compliance/audit (5-year retention required by Indonesian law)

**Sprint Duration:** 4 hours (hot-shipped same day as feedback)

### Sprint 6 — Claims Module — DONE ✅

**Delivered:** Full claims management system with categories, templates, monthly balances, and approval workflow.

**Scope:**
- [x] Claim categories configuration (CRUD, country-specific templates)
- [x] Category template import (bulk create from predefined templates)
- [x] Monthly balances with budget tracking (auto-initialized, progress bars)
- [x] Claim submission with receipt upload (S3/MinIO integration)
- [x] Claims list pages (admin: all claims, employee: my claims, pending approvals)
- [x] Approval workflow (modal-based, matching leave UX)
- [x] Notifications in dock (badge for pending claims)
- [x] Balance tracking (remaining budget, monthly limits)
- [x] Receipt management (upload, preview, download)

**Technical Highlights:**
- Modular approval pattern using shared `approval.ReviewInfo` type
- Multi-tenancy enforced on all queries
- Foreign key integrity with proper cascade/restrict
- Balance auto-initialization on category creation
- UX parity with leave module (modal approvals, notification badges)
- Data integrity: NOT NULL constraints, soft delete for categories
- PostgreSQL type casting fix for ambiguous parameters

**Test Coverage:**
- Frontend: 18 tests (ClaimApprovalDialog, category auto-selection)
- Backend: All existing tests pass, claims module functional (no test files yet)

**Untracked Work (Scope Creep - Acceptable):**
- S3/MinIO configuration fixes (3 cascading issues)
- Error architecture simplification (generic base codes)
- Structured logging for errors (foreign key violations)
- Frontend timing fixes (category auto-selection race condition)
- OpenAPI documentation updates (3 endpoints, 2 schemas)

**Known Limitations (Acceptable for MVP):**
- No bulk claim operations (CSV import, batch approval)
- No recurring claims (auto-create monthly allowances)
- No receipt OCR (amount/date extraction)
- Backend test coverage deferred

**Sprint Duration:** ~30 hours (1.88x original estimate due to infrastructure fixes)

**Full review:** See `docs/sprint6-review.md`

### Sprint 7 — Observability & Error Handling — DONE ✅

**Priority:** Production-ready logging and error messages for operational excellence.

**Status:** SHIPPED March 20, 2026

**Deliverables:**
- ✅ **Structured Logging:** Complete zerolog migration across 8 modules with business event logging
- ✅ **Enhanced Error Handling:** Rich error details with contextual information
- ✅ **Email Infrastructure:** SMTP package with mailcatcher + templates (Invitation, Password Reset, Welcome)
- ✅ **Health Checks:** `/health` and `/readyz` endpoints with DB + Redis validation
- ✅ **Documentation:** ERROR_HANDLING.md guide + email README

**Sprint Duration:** 10 days

**Full review:** See `docs/sprint7-completion.md`

### Sprint 7.5 — Manager-Based Approval System (Hotfixes) — DONE ✅

**Status:** SHIPPED March 20, 2026 (same day)

**Problem:** Critical data isolation and permission issues discovered during testing:
1. Members with direct reports couldn't see/approve their team's requests
2. Role-based permissions didn't respect organizational hierarchy
3. Notification counts showed all org requests (not filtered by manager)

**Deliverables:**
- ✅ **Hierarchical Approval:** Implemented `reporting_to` relationship-based filtering
  - Non-admins only see requests from direct reports
  - Approval/rejection validates manager relationship before allowing action
  - Applied to both leave requests and claims
- ✅ **Notification Filtering:** Dock badge shows count filtered by manager scope
- ✅ **Permission Refinement:** Added `PermLeaveWrite` and `PermClaimsWrite` to member role
- ✅ **UI Permissions:** Hide "Add Employee" button for non-admin roles
- ✅ **OpenAPI Documentation:** Updated 7 endpoints with new permission model

**Code Changes:**
- Backend: 13 files modified (handlers, services, repositories, middleware)
- Frontend: 5 files modified (hooks, routes)
- Documentation: 1 file modified (openapi.yaml)

**Business Impact:**
- ✅ Hierarchical approval workflow now working correctly
- ✅ Data security enforced (managers only see their team)
- ✅ Enables delegation (any employee can be a manager)

**Sprint Duration:** 6 hours (hot-shipped same day)

**Post-Sprint Cleanup:**
- ✅ **Test Suite Fixes:** Fixed 17 compilation errors across 6 test files (leave, attendance, organisation modules)
- ✅ **Linting Fixes:** Resolved 5 golangci-lint issues (errcheck, gosec, unused functions)
- ✅ **All Tests Passing:** 100% test suite health (98%+ coverage maintained)

**Test Cleanup Duration:** 3 hours (March 20, 2026)

**Full review:** See `docs/sprint7.5-fixes.md`

**Week 1: Logging Infrastructure + Error Handling (5 days)**

**⭐ Priority 1: Structured Application Logging (3 days)**
- [ ] Add zerolog library and create `pkg/logger` package
- [ ] Define structured log format (JSON, levels, contextual fields)
- [ ] Implement request context propagation (request_id, user_id, org_id)
- [ ] Log all business events across modules:
  - Auth: login/logout, invitation sent/accepted, password resets
  - Employee: created/updated/deactivated, department changes
  - Leave: request submitted/approved/rejected, balance adjusted
  - Claims: submitted/approved/rejected, budget exceeded warnings
  - Attendance: clock-in/out, manual corrections
- [ ] Remove all `log.Printf` calls entirely
- [ ] Add error logging with full context before returning to user
- [ ] Configure log output for APM integration (JSON format)

**Business Events to Log:**
```go
// Critical events (must log):
- user_logged_in/out (user_id, org_id, ip, timestamp)
- employee_created/updated/deactivated (who, what changed)
- leave_request_submitted/approved/rejected (employee, dates, approver)
- claim_submitted/approved/rejected (employee, amount, category, approver)
- balance_adjusted (policy/category, old/new values, reason)
- policy_created/updated (who, what changed)
- validation_failed (rule, context, user input)
- system_error (full stack trace, context)

// Performance events (optional):
- slow_query (duration > 1s)
- large_file_upload (size, user)
```

**⭐ Priority 2: Proper Error Messages (2 days)**
- [ ] Leave validation errors with context:
  - "Insufficient leave balance (you have 2 days, requested 5)"
  - "Cannot apply leave on non-working day (Saturday)"
  - "Minimum X days notice required for this leave type"
  - "Cannot apply leave for backdate"
  - "Leave request overlaps with existing approved leave"
- [ ] Claims validation errors with context:
  - "Budget exceeded for [category] (limit: X, spent: Y, requested: Z)"
  - "Category [name] is inactive"
  - "Receipt required for this category"
  - "Monthly limit reached for [category]"
- [ ] Employee validation errors:
  - "Email already exists in this organisation"
  - "Employee code must be unique"
  - "Cannot deactivate employee with pending approvals"
- [ ] Log every validation error with full context before returning

**Week 2: Notifications + Analytics (5 days)**

**Priority 3: Email Notifications (3 days)**
- [ ] Email service integration (SendGrid/SES/Resend - TBD)
- [ ] Email templates:
  - Claim pending approval → notify manager
  - Leave pending approval → notify manager
  - Claim approved/rejected → notify employee
  - Leave approved/rejected → notify employee
- [ ] Log email delivery (sent/failed/bounced)
- [ ] Queue-based email system (optional - depends on provider)
- [ ] Email preferences (allow users to opt-out of certain types)

**Priority 4: Claims Analytics Dashboard (2 days)**
- [ ] Monthly spending by category (bar chart)
- [ ] Budget vs actual comparison
- [ ] Top spending employees (table)
- [ ] Category utilization rates
- [ ] Export to CSV
- [ ] Date range filters (month, quarter, year)

**Success Criteria:**
- ✅ Every business event is logged with structured context
- ✅ Users see actionable error messages (not "Internal Error")
- ✅ Managers get email alerts for pending approvals
- ✅ Support team can debug issues via logs
- ✅ Compliance-ready audit trail from day 1

**Sprint Duration:** 10 days (2 weeks)

### Sprint 8 — Calendar + Free Tier Completion — IN PROGRESS

**Start Date:** March 21, 2026

**Goal:** Complete free tier MVP for beta launch. Every promised free feature must work end-to-end.

#### Sprint 8.0 — Calendar Promotion — DONE ✅

**Status:** SHIPPED March 21, 2026

**Problem:** Calendar was buried at `/leave/calendar` — low discoverability. Users need a top-level view of "who's out" for daily planning.

**Decision:** Supersede ADR-004 — promote calendar to top-level route now (not Sprint 9+). Leave data is sufficient for MVP calendar; multi-module aggregation deferred until Tasks has backend.

**Deliverables:**
- ✅ **New `/calendar` route:** Top-level page with warm amber theme
- ✅ **Design tokens:** Added `calendar` module to `moduleBackgrounds`, `moduleThemes`, `dockThemes`, `logoMarkColors`
- ✅ **Dock integration:** Calendar icon (CalendarDays) between Claims and Reports
- ✅ **"On leave today" badge:** Header shows count of employees currently on leave
- ✅ **Redirect:** Old `/leave/calendar` redirects to `/calendar`
- ✅ **Leave link updated:** `/leave` index page links directly to `/calendar`
- ✅ **Tests:** 3 tests (tokens, Dock integration, redirect)

**Technical Highlights:**
- Zero backend changes — reuses `GET /api/v1/leave/calendar` and `GET /api/v1/leave/holidays`
- `useMemo` for holiday map, entries expansion, and weeks grid (performance)
- Warm amber identity distinct from violet-leave module
- Mobile-responsive with horizontal scroll

**Sprint Duration:** 1 hour

#### Sprint 8.1 — Tasks Backend — NOT STARTED

**Problem:** Beautiful frontend UI exists with dummy data. Backend needed to make it functional.

**Scope:**
- [ ] Tasks service (handler, service, repository, types) following existing 4-file pattern
- [ ] Wire to existing migrations (task_lists, tasks, task_comments)
- [ ] CRUD endpoints: `GET/POST /api/v1/tasks`, `PUT/DELETE /api/v1/tasks/:id`
- [ ] Task list management: `GET/POST /api/v1/task-lists`
- [ ] Task comments: `GET/POST /api/v1/tasks/:id/comments`
- [ ] Position ordering within lists (kanban column support)
- [ ] Assignment + due dates
- [ ] Tests (98%+ coverage)

#### Sprint 8.2 — Announcements — NOT STARTED

**Problem:** No company-wide communication channel. Migration exists but no backend/frontend.

**Scope:**
- [ ] Announcements service (handler, service, repository, types)
- [ ] Wire to existing migration (announcements table)
- [ ] CRUD endpoints: `GET/POST /api/v1/announcements`
- [ ] Pin/unpin functionality
- [ ] Frontend: announcement list + create/edit form
- [ ] Show on overview dashboard
- [ ] Tests

#### Sprint 8.3 — Reports with Real Data — NOT STARTED

**Problem:** Reports page uses dummy data. Need real queries.

**Scope:**
- [ ] Attendance report: on-time %, late %, absent by month
- [ ] Leave report: days taken vs balance by type
- [ ] Claims report: spend by category, approval rate
- [ ] Backend aggregate endpoints
- [ ] Wire frontend charts to real data

**Sprint 8 Success Criteria:**
- ✅ All free tier features functional (not placeholder)
- ✅ Calendar, Tasks, Announcements, Reports all working
- ✅ Ready for beta user testing

**Sprint 8 Duration:** 1-2 weeks

### Sprint 9 — Policy Segmentation + Employee Documents

**Priority:** Enable mid-size companies (26-75 employees) to use Workived.

**Scope (moved from original Sprint 8):**
- [ ] Policy assignment system (org → department → employee cascade)
- [ ] Employee documents module (upload, expiry tracking, access control)
- [ ] Policy assignment UI (department + employee level)
- [ ] Document management UI

### Sprint 10 — System Transparency + UX Polish

**Priority:** Build trust through transparency and improve usability based on feedback.

**Week 1: System Changelog + Better UX (5 days)**
- [ ] System update and changelog:
  - Markdown-based changelog (stored in database or S3)
  - API endpoint: `GET /api/v1/system/changelog`
  - Frontend: "What's New" modal on dashboard (dismissible, version-tracked)
  - Show: new features, bug fixes, known issues
  - Update frequency: bi-weekly releases
- [ ] Known issues board:
  - API endpoint: `GET /api/v1/system/known-issues`
  - Frontend: Link in help menu → modal showing active issues
  - Admin can mark issues as "investigating" / "fixing" / "resolved"
- [ ] Better UI/UX improvements (SPECIFIC - based on user feedback):
  - [TBD: Add specific UX issues identified in Sprint 7-8]
  - Examples: Simplify multi-step forms, reduce clicks, improve mobile navigation
  - Data-driven: Use analytics to find friction points

**Week 2: Customizable Dashboard (OPTIONAL - Low Priority)**
- [ ] Widget system:
  - Widget types: Attendance summary, Leave balance, Pending approvals, Recent claims
  - Drag-and-drop using react-dnd or similar
  - Widget visibility toggles
  - Layout persistence (per user, stored in database)
- [ ] Alternative (simpler): Fixed layout with show/hide toggles for each widget
  - Skip drag-and-drop complexity
  - User preferences: `{ widgets: { attendance: true, claims: false } }`

**NOTE:** Customizable dashboard deferred or dropped if ROI is low. Prioritize only if user feedback demands it.

**Success Criteria:**
- ✅ Users see what's being worked on (transparency builds trust)
- ✅ Known issues are visible (reduces support burden)
- ✅ UX friction points addressed (measured via analytics)

**Sprint Duration:** 5-10 days (1-2 weeks, depends on dashboard scope)

### Sprint 11+ — Landing Page + PWA + Pro Features
- [ ] Astro marketing site (apps/landing)
- [ ] PWA manifest + service worker for dashboard
- [ ] SEO optimization, blog setup
- [ ] Feature gating middleware for Pro tier
- [ ] GPS geofencing for clock-in (Pro)
- [ ] Custom leave types (Pro)
- [ ] Shift scheduling + overtime auto-calc (Pro)
- [ ] Approval escalation rules (Pro): auto-approve after X days, skip-level escalation
- [ ] Upgrade flow + billing integration (Stripe/Paddle)

### Future — Analytics + Tasks (Phase 2)
- [ ] HR analytics dashboard (Pro feature)
- [ ] Custom reports
- [ ] Calendar multi-module aggregation (add tasks, events to existing `/calendar`)
- [ ] Tasks module backend (CONDITIONAL — only if customers request)
- [ ] Payroll integration (Phase 2 — separate design)

---

## 14. Non-Negotiable Rules

See `CLAUDE.md` for the complete list of 10 non-negotiable rules.

Key highlights:
- Multi-tenancy: `organisation_id` first in every query
- Money: `BIGINT` + `currency_code` (never float)
- Timestamps: UTC `TIMESTAMPTZ`, convert at API layer
- Country rules: config tables (never hardcode)
- HR records: soft delete (`is_active`)
- Every state change → audit log
- Payroll: out of scope

---

## 15. Environment Variables

```env
# Server
PORT=8080
ENV=development  # development | staging | production

# Database
DATABASE_URL=postgres://workived:password@localhost:5432/workived?sslmode=disable

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=<strong-random-secret>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=720h  # 30 days

# Storage
S3_BUCKET=workived-files
S3_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Email
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@workived.com

# App
APP_URL=http://localhost:3000
API_URL=http://localhost:8080
```

---

*Last updated: March 20, 2026*
*Status: Sprint 5.5 ✅ COMPLETE (Leave Templates) → Sprint 6 🟢 CURRENT — Claims + Empty states*

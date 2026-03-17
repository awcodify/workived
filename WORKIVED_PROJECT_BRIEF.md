# Workived — Project Brief

> **This document is the single source of truth for the Workived project.**
> Read this fully before writing any code, creating any file, or making any architectural decision.
> Every decision in here has been deliberately made. Do not override them without explicit instruction.

---

## 1. What is Workived?

Workived is an **HR and operations superapp for SMBs** — a freemium SaaS that consolidates leave management, attendance, claims & reimbursement, employee management, and task management into a single product. It targets small company founders who currently manage HR through WhatsApp, Google Sheets, and email.

**Domain:** `workived.com`
**Tagline:** Work, managed.

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
| Employee management | Profiles, documents, org chart, basic fields |
| Attendance | Clock-in/out, manual correction, basic reports |
| Leave | Requests, approvals, preset leave types |
| Claims | Submit, approve, receipt upload, basic flow |
| Task management | Create, assign, due dates, basic kanban |
| Announcements | Company-wide notice board |

### Pro tier ($3–5 / employee / month, unlimited employees)
| Module | Pro additions |
|--------|--------------|
| Employee management | Custom fields (JSONB), bulk import, unlimited headcount |
| Attendance | GPS geofencing, face verify, shift scheduling, overtime |
| Leave | Custom leave types, accrual rules, carry-over config |
| Claims | Multi-level approval, budget caps per category, monthly limits |
| Task management | Subtasks, dependencies, time tracking, Gantt view |
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
- **Key conversion triggers:** hitting 25-employee limit, needing geofencing, wanting analytics, multi-level approvals
- **Free tier limit:** 25 employees per organisation — enforced at application layer via `organisations.plan_employee_limit`

---

## 5. Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **Language:** TypeScript
- **Mobile:** PWA (Progressive Web App) — responsive and mobile-first
- **Font:** Plus Jakarta Sans (700, 800 weights for headings; 400, 500 for body)

### Backend
- **Language:** Go (Golang)
- **Architecture:** Modular monolith — NOT microservices. Clean module boundaries that can be extracted later if needed.
- **API style:** REST (JSON)
- **Auth:** JWT with refresh tokens
- **Async:** Redis Streams for notifications, audit events, future payroll triggers

### Database
- **Primary DB:** PostgreSQL (multi-tenant, schema-per-tenant pattern)
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
docker-compose up  →  PostgreSQL + Redis + MinIO + Go API + Next.js
```

---

## 6. Project Structure

```
workived/
├── apps/
│   └── web/                        # Next.js 14 frontend
│       ├── app/                    # App Router pages
│       │   ├── (auth)/             # Login, register, verify
│       │   ├── (app)/              # Authenticated app shell
│       │   │   ├── overview/
│       │   │   ├── people/
│       │   │   ├── attendance/
│       │   │   ├── leave/
│       │   │   ├── claims/
│       │   │   └── tasks/
│       │   └── layout.tsx
│       ├── components/
│       │   ├── ui/                 # shadcn/ui base components
│       │   └── workived/           # App-specific components
│       └── lib/
│           ├── api/                # API client (fetch wrappers)
│           └── utils/
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

```
GET /api/v1/attendance?cursor=<opaque_cursor>&limit=20
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
    query := `
        SELECT * FROM employees
        WHERE organisation_id = $1
        AND ($2::varchar IS NULL OR status = $2)
        ORDER BY full_name ASC
        LIMIT $3 OFFSET $4
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

### Sprint 1 — Foundation
- [ ] Go project scaffold (module structure, config, middleware)
- [ ] PostgreSQL migrations (all tables)
- [ ] Auth module (register, login, JWT, refresh, email verify)
- [ ] Organisation module (create, invite members)
- [ ] Employee module (CRUD, documents)

### Sprint 2 — Attendance
- [ ] Work schedules configuration
- [ ] Public holidays seeding (ID + AE)
- [ ] Clock-in / clock-out API
- [ ] Attendance reports
- [ ] Late detection logic

### Sprint 3 — Leave
- [ ] Leave policy configuration
- [ ] Leave balance initialisation
- [ ] Leave request flow (submit → approve/reject)
- [ ] Year-end rollover job

### Sprint 4 — Claims
- [ ] Claim categories configuration
- [ ] Claim submission + receipt upload
- [ ] Approval flow

### Sprint 5 — Tasks
- [ ] Task lists (kanban columns)
- [ ] Task CRUD
- [ ] Task comments

### Sprint 6 — Frontend
- [ ] Next.js project scaffold
- [ ] Design system components
- [ ] Module screens (Overview, People, Attendance, Leave, Claims, Tasks)
- [ ] Mobile PWA

### Sprint 7 — Pro features + Analytics
- [ ] Feature gating middleware
- [ ] GPS geofencing
- [ ] Custom leave types
- [ ] Analytics endpoints

### Sprint 8 — Payroll (future)
- [ ] TBD — design separately when ready

---

## 14. Development Rules

1. **Every SQL query starts with `WHERE organisation_id = $1`** — no exceptions
2. **Never store floats for money** — always BIGINT in smallest currency unit
3. **Never store local time in the database** — always UTC TIMESTAMPTZ
4. **Never hardcode country-specific rules** — always configurable via config tables
5. **Soft delete HR records** — use `is_active = false`, never DELETE
6. **Audit log every state change** — INSERT into audit_logs on every significant action
7. **All monetary amounts carry a currency_code** — never assume a single currency
8. **organisation_id is always the first param in every repository function**
9. **No business logic in handlers** — handlers are thin, services own all logic
10. **Payroll is out of scope** — do not build payroll processing logic until Sprint 8

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

*Last updated: March 2026*
*Status: Ready for Sprint 1 — Go project scaffold + database migrations*

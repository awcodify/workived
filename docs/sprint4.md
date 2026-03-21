# Sprint 4 — Leave Management (Backend)

**Duration:** ~1 week (dates not tracked)  
**Status:** ✅ COMPLETE  
**Team:** Backend focus

---

## 📋 Previous Sprint Summary

### Sprint 3 Completed
- ✅ Vite + React project scaffold (TanStack Router, Query, Tailwind, shadcn/ui)
- ✅ Design system setup (tokens, globals.css)
- ✅ API client + auth store (Zustand + JWT interceptor)
- ✅ Login page + app shell with floating dock
- ✅ Dashboard (overview)
- ✅ Employee list + detail pages
- ✅ Attendance UI (clock-in/out, daily/monthly reports)

### Key Outcomes
- Frontend foundation established
- Auth flow working end-to-end
- Core modules have UI
- Design system in place (module-specific colors, floating dock)

---

## 🎯 Sprint 4 Goals

### Goals
1. ✅ Build leave policy configuration system
2. ✅ Implement leave balance initialization and management
3. ✅ Create leave request flow (submit → approve/reject/cancel)
4. ✅ Build leave calendar API
5. ✅ Create year-end rollover job
6. ✅ Wire all endpoints to `/api/v1/leave/*`

### Features Completed

#### 1. ✅ Leave Policy Configuration
**Scope:**
- CRUD operations for leave policies
- Configurable per organisation (NOT hardcoded by country)
- Policy types: Annual, Sick, Maternity, Paternity, etc.
- Settings: Days per year, carry-over days, requires approval, min tenure

**Endpoints:**
- `GET /api/v1/leave/policies` — List policies
- `POST /api/v1/leave/policies` — Create policy (admin)
- `PUT /api/v1/leave/policies/:id` — Update policy
- `DELETE /api/v1/leave/policies/:id` — Deactivate policy

**Policy Schema:**
```sql
CREATE TABLE leave_policies (
    id UUID PRIMARY KEY,
    organisation_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    policy_type VARCHAR(50),
    days_per_year DECIMAL(5,2) NOT NULL,
    carry_over_days INT DEFAULT 0,
    requires_approval BOOLEAN DEFAULT true,
    min_tenure_days INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    ...
);
```

**Technical Decisions:**
- **Configurable, not hardcoded:** Each org can define own policies
- Why? Indonesia = 12 days, UAE = 30 days, but some companies offer more
- Supports unlimited leave (-1 days_per_year)
- Soft delete (`is_active = false`)

#### 2. ✅ Leave Balance Initialization
**Scope:**
- Auto-initialize balances when employee joins
- One balance record per employee × policy × year
- Track: Entitled days, carried over days, used days, pending days

**Table:** `leave_balances`
```sql
CREATE TABLE leave_balances (
    id UUID PRIMARY KEY,
    employee_id UUID NOT NULL,
    leave_policy_id UUID NOT NULL,
    year INT NOT NULL,
    entitled_days DECIMAL(5,2) NOT NULL,
    carried_over_days DECIMAL(5,2) DEFAULT 0,
    used_days DECIMAL(5,2) DEFAULT 0,
    pending_days DECIMAL(5,2) DEFAULT 0,
    UNIQUE(employee_id, leave_policy_id, year)
);
```

**Initialization logic:**
```go
// When new employee created or new policy added
for each active leave_policy {
    if employee.tenure >= policy.min_tenure_days {
        create leave_balance(
            entitled_days = policy.days_per_year,
            carried_over_days = 0,
            used_days = 0,
            pending_days = 0
        )
    }
}
```

**Endpoints:**
- `GET /api/v1/leave/balances?year=2026` — List all balances (admin)
- `GET /api/v1/leave/balances/me?year=2026` — My balances (employee)

#### 3. ✅ Leave Request Flow
**Scope:**
- Submit leave request
- Approval workflow (manager approves/rejects)
- Cancel request (before start date)
- Validation: Check sufficient balance, no overlaps, working days only

**Table:** `leave_requests`
```sql
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY,
    organisation_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    leave_policy_id UUID NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(5,2) NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, cancelled
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    ...
);
```

**Endpoints:**
- `POST /api/v1/leave/requests` — Submit request
- `GET /api/v1/leave/requests?status=pending` — List requests (admin)
- `GET /api/v1/leave/requests/me` — My requests (employee)
- `POST /api/v1/leave/requests/:id/approve` — Approve request
- `POST /api/v1/leave/requests/:id/reject` — Reject request
- `POST /api/v1/leave/requests/:id/cancel` — Cancel request (employee)

**Validation logic:**
```go
// On submit
1. Calculate total_days (exclude weekends + public holidays)
2. Check available balance: entitled + carried_over - used - pending
3. If insufficient → return INSUFFICIENT_LEAVE_BALANCE error
4. Check no overlapping approved leaves
5. Update leave_balances: pending_days += total_days
```

**On approve:**
```sql
UPDATE leave_balances SET
    used_days = used_days + total_days,
    pending_days = pending_days - total_days
```

**On reject/cancel:**
```sql
UPDATE leave_balances SET
    pending_days = pending_days - total_days
```

#### 4. ✅ Leave Calendar API
**Scope:**
- View all leave requests for specific month
- Show who's on leave on each date
- Group by date for calendar rendering
- Include leave policy type

**Endpoint:**
- `GET /api/v1/leave/calendar?year=2026&month=3` — Calendar view

**Response structure:**
```json
{
  "data": {
    "2026-03-15": [
      {
        "employee_id": "uuid",
        "employee_name": "Ahmad Rizki",
        "leave_policy_name": "Annual Leave",
        "start_date": "2026-03-15",
        "end_date": "2026-03-17"
      }
    ]
  }
}
```

**Technical Decisions:**
- Group by date (not by employee) for calendar rendering
- Only show approved leaves (not pending/rejected)
- Frontend will render calendar grid

#### 5. ✅ Year-End Rollover Job
**Scope:**
- Scheduled job runs on 1 January 00:00 UTC
- For each employee × policy:
  - Calculate unused days from previous year
  - Create new balance for new year
  - Carry over days (up to policy.carry_over_days limit)

**CLI Tool:** `services/cmd/rollover`
```go
// Rollover logic
for each active employee {
    for each active leave_policy {
        current_balance = get_balance(employee, policy, current_year)
        unused = current_balance.entitled + current_balance.carried_over - current_balance.used
        carry_over = min(unused, policy.carry_over_days)
        
        create_balance(
            employee, policy, next_year,
            entitled_days = policy.days_per_year,
            carried_over_days = carry_over
        )
    }
}
```

**Cron Setup:**
```bash
# Run at 00:00 UTC on January 1st every year
0 0 1 1 * /usr/local/bin/workived-rollover
```

**Technical Highlights:**
- Idempotent (safe to run multiple times)
- Logs all actions for audit
- Can be run manually for specific year

#### 6. ✅ All Leave Endpoints Wired
**Scope:**
- All endpoints under `/api/v1/leave/*`
- Consistent error responses
- Multi-tenancy enforced (org_id checks)
- RBAC: Admins see all, employees see own, managers see direct reports

**Endpoint Summary:**
```
Policies:    4 endpoints (CRUD)
Balances:    2 endpoints (list all, list mine)
Requests:    6 endpoints (submit, list, approve, reject, cancel, get)
Calendar:    1 endpoint (monthly view)
Rollover:    1 CLI tool (year-end job)
```

---

## 🚀 Next Sprint Plan (Sprint 5)

### Proposed Features
1. **Leave Frontend** — Submit leave request form
   - Effort: 2 days
   - Date picker, policy selector, reason textarea
   
2. **Leave Balance Dashboard** — Show all my balances
   - Effort: 1 day
   - Visual progress bars
   
3. **Leave Approval Flow** — Approve/reject modal
   - Effort: 2 days
   - Manager view with pending requests

4. **Leave Calendar UI** — Interactive calendar
   - Effort: 2 days
   - Month view, click date to see who's on leave

5. **Public Holidays Integration** — Show holidays on calendar
   - Effort: 1 day

---

## 📊 Final Metrics

- **Backend tests:** Not tracked in Sprint 4
- **Endpoints added:** 13 leave endpoints
- **Migrations:** 3 new tables (policies, balances, requests)
- **CLI tools:** 1 (year-end rollover job)
- **Lines of code:** ~1,500 backend (estimated)

---

## 🎉 Sprint Highlights

1. **Configurable Policies:** Not hardcoded by country (org flexibility)
2. **Automatic Balance Init:** Balances created on employee/policy creation
3. **Smart Validation:** Excludes weekends + public holidays from calculations
4. **Year-End Rollover:** Automated job with carry-over logic
5. **Audit Trail:** All state changes logged
6. **Multi-Tenancy:** Enforced in every query

---

## 🔗 References

- [Sprint 3](./sprint3-review.md) — Frontend foundation
- [Sprint 5](./sprint5.md) — Leave frontend UI
- [Project Brief](../WORKIVED_PROJECT_BRIEF.md)

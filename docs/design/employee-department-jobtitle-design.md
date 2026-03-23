# Employee → Department → Job Title: Core Entity Design

**Date:** March 22, 2026  
**Author:** PO + Architect  
**Status:** DRAFT — Decision required before Sprint 14  
**Scope:** How Employee, Department, and Job Title interact, and how they correlate to Leave, Claims, Attendance, Tasks, and Approvals

---

## 1. Executive Summary

Employee is the **hub** of everything in Workived. Every feature (leave, claims, attendance, tasks, approvals) connects through the employee record. The current model works for basic flows but has **five structural gaps** that will cause pain as we grow:

1. **No policy segmentation** — All employees get identical leave/claim rules regardless of employment type
2. **Job titles are free text** — No standardization, no reporting consistency
3. **Work schedules are org-wide** — Can't assign different schedules to different employees
4. **No approval delegation** — If manager is on leave, approvals are stuck
5. **No employment change history** — Department/title changes lose previous state

This document maps the full entity graph, identifies what connects to what, and proposes changes prioritized by value for our 5-25 person startup customers.

---

## 2. Current Entity Relationship Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORGANISATION                             │
│  (Multi-tenancy root — every table scoped by org)               │
└────────┬───────────┬──────────────┬──────────────┬──────────────┘
         │           │              │              │
    ┌────▼───┐  ┌────▼────┐  ┌─────▼─────┐  ┌────▼─────┐
    │DEPARTMENTS│ │WORK     │  │LEAVE      │  │CLAIM     │
    │(tree)   │ │SCHEDULES│  │POLICIES   │  │CATEGORIES│
    └────┬───┘  └─────────┘  └─────┬─────┘  └────┬─────┘
         │                         │              │
         │    ┌────────────────────┼──────────────┤
         │    │                    │              │
    ┌────▼────▼──────────────────────────────────────────┐
    │                    EMPLOYEE                         │
    │  (Central hub — everything connects here)           │
    │                                                     │
    │  ┌── department_id FK ──► departments               │
    │  ├── job_title (FREE TEXT ⚠️)                       │
    │  ├── employment_type (full_time|part_time|...)      │
    │  ├── reporting_to FK ──► employees (manager)        │
    │  ├── user_id FK ──► users (login, nullable)         │
    │  └── status (active|probation|on_leave|inactive)    │
    └──┬──────┬──────┬──────┬──────┬──────┬───────────────┘
       │      │      │      │      │      │
  ┌────▼──┐┌──▼───┐┌─▼────┐┌▼─────┐┌▼────┐┌▼──────────┐
  │LEAVE  ││LEAVE ││CLAIMS││CLAIM ││TASKS││ATTENDANCE │
  │REQUESTS││BALANCES│      ││BALANCES│     ││RECORDS   │
  └───────┘└──────┘└──────┘└──────┘└─────┘└───────────┘
```

### Current Foreign Key Map

| Source Table | FK Column | Target Table | Cardinality |
|---|---|---|---|
| employees | department_id | departments | N:1 (optional) |
| employees | reporting_to | employees | N:1 (self-ref, optional) |
| employees | user_id | users | 1:1 (optional) |
| leave_requests | employee_id | employees | N:1 |
| leave_requests | leave_policy_id | leave_policies | N:1 |
| leave_requests | reviewed_by | employees | N:1 (optional) |
| leave_balances | employee_id | employees | N:1 |
| leave_balances | leave_policy_id | leave_policies | N:1 |
| claims | employee_id | employees | N:1 |
| claims | category_id | claim_categories | N:1 |
| claims | reviewed_by | employees | N:1 (optional) |
| claim_balances | employee_id | employees | N:1 |
| attendance_records | employee_id | employees | N:1 |
| tasks | assignee_id | employees | N:1 (optional) |
| tasks | created_by | employees | N:1 |
| departments | parent_id | departments | N:1 (self-ref, optional) |

---

## 3. The Interaction Matrix

How does each entity attribute affect each feature?

```
                    │ Employee │ Department │ Job Title  │ Empl. Type │ Reporting To │
────────────────────┼──────────┼────────────┼────────────┼────────────┼──────────────┤
Leave Eligibility   │ ✅ direct │ ─ none     │ ─ none     │ ⚠️ MISSING  │ ─ none       │
Leave Entitlement   │ ✅ balance│ ─ none     │ ─ none     │ ⚠️ MISSING  │ ─ none       │
Leave Approval      │ ✅ self   │ ─ none     │ ─ none     │ ─ none     │ ✅ determines │
Claim Access        │ ✅ direct │ ─ none     │ ─ none     │ ⚠️ MISSING  │ ─ none       │
Claim Limits        │ ✅ balance│ ─ none     │ ─ none     │ ─ none     │ ─ none       │
Claim Approval      │ ✅ self   │ ─ none     │ ─ none     │ ─ none     │ ✅ determines │
Attendance Schedule │ ✅ direct │ ─ none     │ ─ none     │ ⚠️ MISSING  │ ─ none       │
Attendance Tracking │ ✅ records│ ─ none     │ ─ none     │ ─ none     │ ─ none       │
Task Assignment     │ ✅ direct │ ─ none     │ ─ none     │ ─ none     │ ─ none       │
Task Approval Route │ ✅ self   │ ─ none     │ ─ none     │ ─ none     │ ✅ determines │
Reporting / Export  │ ✅ always │ ✅ grouping │ ✅ grouping │ ✅ filter   │ ✅ hierarchy  │
Org Chart           │ ✅ always │ ✅ structure│ ✅ display  │ ─ none     │ ✅ tree       │
Salary / Comp       │ ✅ stored │ ─ none     │ ⚠️ no bands │ ─ none     │ ─ none       │
```

### Key Findings

**⚠️ MISSING = Currently not connected but SHOULD be**

1. **Employment Type is disconnected from policies** — A contractor and a full-time employee see identical leave types and claim categories. This is wrong.
2. **Job Title has no functional impact** — It's display-only. Free text means inconsistent reporting. No salary bands.
3. **Department has no functional impact** — It's purely structural grouping. It doesn't affect policies, schedules, or claim limits.
4. **Reporting To is the ONLY approval mechanism** — No fallback if manager is unavailable.

---

## 4. The Three Entities Deep Dive

### 4.1 Employee — The Hub

**Current role:** Identity + organizational placement + compensation + the FK target for everything.

**What it does well:**
- Clean multi-stage onboarding (HR record → invite → user account → active)
- Self-referencing `reporting_to` for manager hierarchy
- Soft delete with `is_active` for HR compliance
- `custom_fields` JSONB for Pro-tier extensibility
- `employee_code` for company-assigned IDs

**What it's missing:**
- No link between `employment_type` and policy eligibility
- No `work_schedule_id` for per-employee schedule override  
- `job_title` is free text (no FK to reference table)
- No employment history tracking (title changes, dept transfers, salary changes)

### 4.2 Department — The Grouping Axis

**Current role:** Organizational tree structure. Employees belong to a department optionally.

**What it does well:**
- Nested hierarchy via `parent_id` (Engineering → Backend → Platform)
- Simple and clean — no over-engineering
- Used in org chart rendering

**What it's missing:**
- No `head_employee_id` — department head is ambiguous
- No functional connection to policies (leave, claims, schedules)
- No budget/cost center tracking

**Design question: Should department drive policy segmentation?**

**Answer: NO — not for 5-25 person startups.**

Rationale:
- At 5 employees, departments barely exist
- At 15 employees, there might be 2-3 departments, all with same policies
- At 25 employees, MAYBE different departments need different claim limits
- Employment type is a much stronger differentiator (contractor vs full-time)
- Department-based policies add complexity that our market doesn't need yet

**Future consideration:** For Pro tier, we could add optional department-scoped overrides later. The foundation is there (department_id on employee), but we don't need to build the policy link now.

### 4.3 Job Title — The Identity Label

**Current role:** Free text VARCHAR(150) on the employee record. Display only.

**What it does well:**
- Simple — no extra table to manage
- Flexible — any title works without configuration

**What it fails at:**
- Reporting: "QA Engineer" vs "QA" vs "Quality Assurance" are three different titles
- Org chart: No standardized titles for consistent display
- Salary planning: Can't define salary bands per title
- Data quality: Typos, inconsistencies across employees

---

## 5. Scenario Stress Tests

### Scenario A: New Employee Joins (Full-Time)

```
1. HR creates employee → dept=Engineering, title="Backend Developer", type=full_time
2. System should: Create leave balances for ALL leave policies applicable to full_time
3. System should: Make available claim categories applicable to full_time
4. System should: Use employee's work_schedule (or org default)
5. Approval: reporting_to determines their approver
```

**Current behavior:** Step 2 & 3 don't filter by employment_type — intern gets same leave as full-time.
**Gap: Employment type → policy filtering.**

### Scenario B: Employee Changes Department

```
1. HR moves employee from Sales → Engineering
2. Pending leave requests: Stay with current approver (already submitted)
3. New requests: Go to new reporting_to (if also changed)
4. Work schedule: Should it change? Currently no mechanism.
5. Claim categories: Currently no dept-scoped filtering, so no change.
```

**Current behavior:** Only employee.department_id changes. reporting_to may or may not change (separate field). Everything else is unaffected because nothing depends on department.
**This is actually fine for our market.** Department changes are rare and the current model handles them correctly because department has no policy impact.
**Gap: No history of the change** — just updated_at on the employee record.

### Scenario C: Employment Type Changes (Intern → Full-Time)

```
1. HR updates employee type from intern → full_time  
2. Leave entitlement should increase (annual leave now applies)
3. Claim categories should expand (equipment claims now available)
4. Work schedule might change (intern was part-time, full-time is 5 days)
5. No effect on approval routing
```

**Current behavior:** Employment type changes, but leave balances and claim access don't recalculate.
**Gap: No trigger to recompute policy eligibility when employment_type changes.**

### Scenario D: Manager Goes on Leave

```
1. Ahmad (manager) takes 2 weeks vacation
2. Ricko (reports to Ahmad) submits a leave request
3. Who approves? Currently: Ahmad (who isn't available)
4. Desired: Ahmad delegates to Jefry before going on leave
5. OR: Auto-escalate to Ahmad's manager
```

**Current behavior:** Request sits in Ahmad's queue until he returns.
**Gap: No delegation mechanism.**

### Scenario E: Different Claim Limits per Team

```
1. Sales team travels a lot → needs 5M IDR/month travel claims
2. Engineering rarely travels → needs 1M IDR/month
3. Currently: Both teams share same claim category with same limit (or no limit)
```

**Current behavior:** Claim limits are per-category, shared across entire org.
**Is this a real problem?** Honestly, at 5-25 employees, probably not. Most small startups have ONE set of rules. This is a "nice to have" for later.
**Decision: DEFER department-scoped claim limits to Pro tier (v2).**

---

## 6. Proposed Design Changes

### Priority 1: Employment Type → Policy Segmentation ⭐⭐⭐⭐⭐

**The single most impactful change.** Makes leave and claims actually work correctly for mixed workforces.

#### Schema Change

```sql
-- Leave policies: filter which employment types are eligible
ALTER TABLE leave_policies 
  ADD COLUMN eligible_employment_types TEXT[];
-- NULL = applies to all (backward compatible)
-- Example: {'full_time','part_time'} = only these types

-- Claim categories: filter which employment types can access  
ALTER TABLE claim_categories
  ADD COLUMN eligible_employment_types TEXT[];
-- NULL = applies to all (backward compatible)
```

#### Business Logic

```
When creating leave balances for an employee:
  FOR EACH leave_policy IN org_policies:
    IF policy.eligible_employment_types IS NULL:
      → Create balance (applies to all)
    ELSE IF employee.employment_type IN policy.eligible_employment_types:
      → Create balance (employee is eligible)  
    ELSE:
      → Skip (employee not eligible)

When employment_type changes:
  → Recalculate: add new policy balances, deactivate ineligible ones
  → Do NOT delete existing used balances (audit trail)
```

#### UI Impact
- Leave Policy setup: Add multi-select for employment types (default: all)
- Claim Category setup: Add multi-select for employment types (default: all)
- Employee form: When changing employment_type, show warning about policy changes

#### Effort: S (1-2 days) — Two column additions, filter logic, UI controls

---

### Priority 2: Job Titles Reference Table ⭐⭐⭐⭐

**Standardizes titles for reporting and org chart. Foundation for future salary bands.**

#### Schema Change

```sql
CREATE TABLE job_titles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations(id),
    name            VARCHAR(150) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organisation_id, name)
);

-- Migrate: Create job_titles from existing free-text values
INSERT INTO job_titles (organisation_id, name)
  SELECT DISTINCT organisation_id, job_title 
  FROM employees 
  WHERE job_title IS NOT NULL;

-- Add FK column  
ALTER TABLE employees ADD COLUMN job_title_id UUID REFERENCES job_titles(id);

-- Populate from text values
UPDATE employees e 
  SET job_title_id = jt.id
  FROM job_titles jt
  WHERE jt.organisation_id = e.organisation_id
  AND jt.name = e.job_title;

-- Keep old column temporarily for backward compat, remove in next sprint
-- ALTER TABLE employees DROP COLUMN job_title; (deferred)
```

#### Design Decisions

**Q: Should job_title affect policies?**  
A: **NO.** Job title is organizational identity, not policy segmentation. Employment type drives policies. Job title is for display, reporting, and future salary bands.

**Q: Should we support job levels (Junior, Mid, Senior)?**  
A: **NOT NOW.** At 5-25 employees, levels are overkill. If needed later, add a `level` column to job_titles. YAGNI.

**Q: Can employees create custom titles?**  
A: **No.** Only admins create/manage job titles. Employees pick from the list. This is the whole point — standardization.

**Q: What if an employee doesn't have a title yet?**  
A: `job_title_id` is nullable (same as current `job_title`). Not all employees need a title.

#### Migration Strategy
1. Create `job_titles` table
2. Seed from existing DISTINCT `employees.job_title` values
3. Add `job_title_id` FK on employees, populate
4. Keep `job_title` text column during transition period
5. Frontend: Show dropdown instead of text input
6. Next sprint: Remove `job_title` text column

#### Effort: S-M (2-3 days) — New table, migration, API endpoint, UI dropdown

---

### Priority 3: Per-Employee Work Schedule Override ⭐⭐⭐

**Enables part-timers, different shifts, flex schedules.**

#### Schema Change

```sql
ALTER TABLE employees 
  ADD COLUMN work_schedule_id UUID REFERENCES work_schedules(id);
-- NULL = use org default schedule (is_default = true)
```

#### Schedule Resolution Logic

```
function getEmployeeSchedule(employee):
  IF employee.work_schedule_id IS NOT NULL:
    RETURN work_schedules[employee.work_schedule_id]  // employee-specific
  ELSE:
    RETURN work_schedules WHERE org_id = employee.org_id AND is_default = true  // org default
```

#### Impact on Existing Features
- **Attendance late detection**: Use employee's schedule (not just org default)
- **Leave day calculation**: Use employee's work_days to count leave days
- **Reports**: Show schedule alongside attendance data

#### Effort: S (1 day) — One column, update schedule resolution, minimal UI

---

### Priority 4: Approval Delegation ⭐⭐⭐ (Pro Tier)

**When manager is on leave, delegate approval authority to another employee.**

#### Schema Change

```sql
CREATE TABLE approval_delegations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id UUID NOT NULL REFERENCES organisations(id),
    delegator_id    UUID NOT NULL REFERENCES employees(id),
    delegate_id     UUID NOT NULL REFERENCES employees(id),
    starts_at       DATE NOT NULL,
    ends_at         DATE NOT NULL,
    reason          TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CHECK (delegator_id != delegate_id),
    CHECK (ends_at >= starts_at),
    UNIQUE(organisation_id, delegator_id, starts_at, ends_at)
);

CREATE INDEX idx_approval_delegations_active 
  ON approval_delegations(organisation_id, delegate_id, starts_at, ends_at) 
  WHERE is_active = true;
```

#### Approval Resolution Logic (Updated)

```
function findApprover(employee, request_date):
  manager = employee.reporting_to
  
  IF manager IS NULL:
    RETURN org_owner  // top of chain, owner auto-approves
    
  IF hasDelegation(manager, request_date):
    RETURN delegation.delegate_id  // delegated approver
  ELSE:
    RETURN manager.id  // normal flow
    
function hasDelegation(employee, date):
  RETURN EXISTS(
    SELECT 1 FROM approval_delegations
    WHERE delegator_id = employee.id
    AND is_active = true
    AND date BETWEEN starts_at AND ends_at
  )
```

#### When Does Delegation Trigger?
- Manager goes to Settings → Delegation  
- Sets: "Delegate to [colleague] from [date] to [date]"
- During that period, all new approval tasks route to delegate
- Already-pending tasks stay with original approver (they were submitted before delegation)

#### Effort: M (3-4 days) — New table, delegation logic, UI, tests

---

### Priority 5: Employment Change History ⭐⭐ (Deferred)

**Track department changes, title changes, and status changes over time.**

We already have `audit_logs` which captures before/after state as JSONB. For now, this is sufficient. A dedicated `employment_history` table would be needed for:
- Timeline view of an employee's career
- Tenure calculations per department
- Average time-to-promotion metrics

**Decision: DEFER.** audit_logs covers the audit need. A dedicated history table is a Pro-tier analytics feature.

---

### NOT Doing (Explicitly Scoped Out)

| Feature | Reason |
|---|---|
| Department → Policy mapping | Overkill for 5-25 person companies. Employment type is sufficient. |
| Department head field | Inferable from reporting_to chain. Adding explicit field creates sync issues. |
| Job levels / grades | YAGNI at current market size. Add to job_titles later if needed. |
| Multi-level approval chains | Enterprise feature. Simple reporting_to is correct for our market. |
| Salary bands per title | No payroll integration yet. Future Pro feature. |
| Leave accrual schedules | `is_accrued` boolean exists but no schedule. Business logic is enough for now. |
| Benefit enrollment | Out of scope — not core HR ops. |
| Performance reviews | Out of scope — task completion metrics cover basic needs. |

---

## 7. Future-State Entity Graph (After Changes)

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORGANISATION                             │
└──┬──────┬──────────┬─────────────┬──────────────┬───────────────┘
   │      │          │             │              │
┌──▼──┐┌──▼─────┐┌──▼────────┐┌──▼──────────┐┌──▼───────────────┐
│DEPTS││WORK    ││LEAVE      ││CLAIM        ││JOB TITLES (NEW) │
│(tree)││SCHEDULES││POLICIES   ││CATEGORIES   ││(per org)        │
│     ││        ││+ eligible_││+ eligible_  ││                  │
│     ││        ││  empl_types││  empl_types ││                  │
└──┬──┘└──┬─────┘└─────┬─────┘└──────┬──────┘└──────┬───────────┘
   │      │            │             │               │
   │      │     ┌──────┼─────────────┤               │
   │      │     │      │             │               │
┌──▼──────▼─────▼──────▼─────────────▼───────────────▼───────────┐
│                         EMPLOYEE                                │
│                                                                 │
│  ├── department_id FK ──► departments                           │
│  ├── job_title_id FK ──► job_titles (NEW — replaces free text)  │
│  ├── work_schedule_id FK ──► work_schedules (NEW — override)    │
│  ├── employment_type ──► filters eligible policies              │
│  ├── reporting_to FK ──► employees (manager)                    │
│  └── status (active|probation|on_leave|inactive)                │
│                                                                 │
└──┬──────┬──────┬──────┬──────┬──────┬───────────────────────────┘
   │      │      │      │      │      │
┌──▼───┐┌─▼───┐┌─▼────┐┌▼─────┐┌▼────┐┌▼──────────┐
│LEAVE ││LEAVE││CLAIMS││CLAIM ││TASKS││ATTENDANCE │
│REQS  ││BALS ││      ││BALS  ││     ││RECORDS    │
└──────┘└─────┘└──────┘└──────┘└──┬──┘└───────────┘
                                  │
                           ┌──────▼────────────┐
                           │APPROVAL           │
                           │DELEGATIONS (NEW)  │
                           │(Pro tier)         │
                           └───────────────────┘
```

---

## 8. The Approval Flow — Complete Picture

### Current Flow

```
Employee submits leave/claim
        │
        ▼
Task auto-created ──► Assigned to: employee.reporting_to
        │
        ▼
Manager reviews ──► Approve / Reject
        │
        ▼
leave_request.status = approved/rejected
leave_balance updated (if approved)
```

### Proposed Flow (with delegation)

```
Employee submits leave/claim
        │
        ▼
Find approver:
  ├── manager = employee.reporting_to
  ├── IF manager has active delegation for today
  │     └── approver = delegation.delegate_id
  ├── ELSE IF manager.status = 'on_leave' (future: auto-escalate)
  │     └── approver = manager.reporting_to (skip level)
  └── ELSE
        └── approver = manager.id (normal)
        │
        ▼
Task auto-created ──► Assigned to: approver
        │
        ▼
Approver reviews ──► Approve / Reject
        │
        ▼
Status updated + balances adjusted
```

### Permission Model (Unchanged)

```
canApprove = hasAdminRole() OR (hasApprovalRole() AND hasSubordinate())

Admin roles (owner, admin, hr_admin, super_admin):
  → Can approve ANY request in org

Approval roles (manager, finance):
  → Can approve IF has_subordinate = true
  → Frontend shows Approvals tab

Member role:
  → Can approve IF has_subordinate = true (promoted to de-facto manager)
```

---

## 9. How Each Feature Connects — The Complete Map

### 9.1 Leave System Connections

```
┌──────────┐    eligible_employment_types    ┌─────────────┐
│ EMPLOYEE │◄────────── filters ─────────────│LEAVE POLICY │
│          │                                 │             │
│ empl_type│    IF type IN policy.eligible   │ days/year   │
│ dept_id  │    OR policy.eligible IS NULL   │ carry_over  │
│ status   │                                 │ requires_   │
│ reporting│                                 │   approval  │
│   _to    │                                 └──────┬──────┘
└────┬─────┘                                        │
     │           ┌──────────────┐                   │
     ├──────────►│LEAVE BALANCE │◄──────────────────┘
     │           │  year        │  (one balance per employee
     │           │  entitled    │   per policy per year)
     │           │  used        │
     │           │  pending     │
     │           └──────────────┘
     │
     │           ┌──────────────┐     ┌────────────┐
     ├──────────►│LEAVE REQUEST │────►│TASK        │
     │           │  start/end   │     │(approval)  │
     │           │  status      │     │assignee =  │
     │           │  reviewed_by─┼────►│reporting_to│
     │           └──────────────┘     └────────────┘
     │
     │  reporting_to determines who reviews
     │  (or delegate if delegation active)
```

### 9.2 Claims System Connections

```
┌──────────┐    eligible_employment_types    ┌──────────────┐
│ EMPLOYEE │◄────────── filters ─────────────│CLAIM CATEGORY│
│          │                                 │              │
│ empl_type│    IF type IN cat.eligible      │ monthly_limit│
│          │    OR cat.eligible IS NULL      │ currency     │
│          │                                 │ requires_    │
│          │                                 │   receipt    │
└────┬─────┘                                 └──────┬───────┘
     │           ┌──────────────┐                   │
     ├──────────►│CLAIM BALANCE │◄──────────────────┘
     │           │  year, month │  (one balance per employee
     │           │  total_spent │   per category per month)
     │           │  monthly_cap │
     │           └──────────────┘
     │
     │           ┌──────────────┐     ┌────────────┐
     ├──────────►│   CLAIM      │────►│TASK        │
                 │  amount      │     │(approval)  │
                 │  receipt_url │     │assignee =  │
                 │  reviewed_by─┼────►│reporting_to│
                 └──────────────┘     └────────────┘
```

### 9.3 Attendance System Connections

```
┌──────────┐     work_schedule_id (NEW)     ┌──────────────┐
│ EMPLOYEE │────────── override ────────────│WORK SCHEDULE │
│          │                                │              │
│ empl_type│     IF employee.schedule NULL  │ work_days[]  │
│          │     → use org default schedule │ start_time   │
│          │                                │ end_time     │
└────┬─────┘                                └──────────────┘
     │                                            │
     │           ┌──────────────┐                 │
     ├──────────►│ATTENDANCE    │    is_late =    │
                 │RECORD        │◄── clock_in >   │
                 │  clock_in_at │    schedule.    │
                 │  clock_out_at│    start_time   │
                 │  is_late     │                 │
                 │  GPS coords  │                 │
                 └──────────────┘
                        │
                 ┌──────▼──────┐
                 │PUBLIC       │  weekend/holiday detection
                 │HOLIDAYS     │  for overtime calculation
                 └─────────────┘
```

### 9.4 Task System Connections

```
┌──────────┐                                ┌──────────────┐
│ EMPLOYEE │────── created_by ─────────────►│    TASK       │
│(creator) │                                │              │
└──────────┘                                │  title       │
                                            │  priority    │
┌──────────┐                                │  due_date    │
│ EMPLOYEE │────── assignee_id ────────────►│  status      │
│(assignee)│                                │              │
└──────────┘                                │  approval_   │
                                            │    type ─────┼──► leave_requests │
                                            │  approval_   │    OR claims
                                            │    id ───────┤
                                            └──────┬───────┘
                                                   │
                                            ┌──────▼───────┐
                                            │TASK COMMENTS │
                                            │  author_id ──┼──► employees
                                            │  parent_id   │  (threaded)
                                            └──────┬───────┘
                                                   │
                                            ┌──────▼───────┐
                                            │COMMENT       │
                                            │REACTIONS     │
                                            │  employee_id │
                                            │  emoji       │
                                            └──────────────┘
```

---

## 10. Implementation Roadmap

### Sprint 14a: Policy Segmentation (Priority 1)

| Step | What | Files Changed |
|------|------|---|
| 1 | Migration: Add `eligible_employment_types TEXT[]` to `leave_policies` | New migration |
| 2 | Migration: Add `eligible_employment_types TEXT[]` to `claim_categories` | New migration |
| 3 | Backend: Filter policies by employee's employment_type in balance creation | leave/service.go |
| 4 | Backend: Filter categories by employment_type in claims access | claim/service.go |
| 5 | Frontend: Multi-select control on policy/category form | LeaveSettings, ClaimSettings |
| 6 | Backend: Recompute balances when employee's employment_type changes | employee/service.go |
| 7 | Tests for all the above | *_test.go files |

### Sprint 14b: Job Titles Table (Priority 2)

| Step | What | Files Changed |
|------|------|---|
| 1 | Migration: Create `job_titles` table | New migration |
| 2 | Migration: Seed from existing DISTINCT job_title values | Same migration |
| 3 | Migration: Add `job_title_id` FK to employees | New migration |
| 4 | Migration: Populate job_title_id from text values | Same migration |
| 5 | Backend: CRUD API for job_titles | New jobtitle/ module |
| 6 | Backend: Update employee API to use job_title_id | employee/handler.go |
| 7 | Frontend: Dropdown selector on employee form | EmployeeForm |
| 8 | Frontend: Show standardized titles in People list, Org Chart | People page |
| 9 | Migration: Drop `job_title` text column (after verification) | Deferred migration |

### Sprint 14c: Per-Employee Schedule (Priority 3)

| Step | What | Files Changed |
|------|------|---|
| 1 | Migration: Add `work_schedule_id` to employees | New migration |
| 2 | Backend: Update schedule resolution in attendance service | attendance/service.go |
| 3 | Backend: Update late detection logic | attendance/service.go |
| 4 | Frontend: Schedule selector on employee form | EmployeeForm |

### Sprint 15 (Pro): Approval Delegation (Priority 4)

| Step | What | Files Changed |
|------|------|---|
| 1 | Migration: Create `approval_delegations` table | New migration |
| 2 | Backend: Delegation CRUD API | New delegation/ module |
| 3 | Backend: Update approval routing to check delegations | approval/service.go, task routing |
| 4 | Frontend: Delegation management UI | Settings → Delegation |

---

## 11. What DOESN'T Change

These work correctly today and need no modification:

- **Multi-tenancy** — Every table scoped by org_id ✅
- **Reporting_to chain** — Self-referencing FK for hierarchy ✅
- **Approval task creation** — Auto-creates task when leave/claim submitted ✅
- **Permission model** — role + has_subordinate hybrid ✅
- **Soft delete** — is_active pattern across HR tables ✅
- **Audit logging** — before/after JSONB captures all changes ✅
- **Department tree** — parent_id supports nested hierarchy ✅
- **Leave balance tracking** — year-by-year entitled/used/pending ✅
- **Claim balance tracking** — monthly aggregate with limits ✅

---

## 12. Decision Summary

| # | Decision | Rationale |
|---|---|---|
| D1 | Employment type drives policy segmentation (not department, not job title) | Most impactful axis for 5-25 person companies. Indonesia/UAE labor law differentiates by contract type. |
| D2 | Job titles become a reference table | Standardization for reporting, org chart. Foundation for salary bands (future). |
| D3 | Per-employee work schedule override | Part-time, shift workers, flex schedules — one column addition. |
| D4 | Approval delegation as Pro feature | Nice-to-have, not critical. Most 5-person startups have the owner approve everything. |
| D5 | Department remains structural only | No policy-driving role. At our market size, department doesn't determine leave/claim rules. |
| D6 | No job levels/grades | YAGNI. Can add column to job_titles later if market demands it. |
| D7 | No employment history table | Audit_logs JSONB is sufficient. Dedicated history is analytics-tier. |
| D8 | No multi-level approval chains | Enterprise feature. Reporting_to + delegation covers our market. |

---

## 13. Open Questions for Discussion

1. **Should we keep `job_title` text column alongside `job_title_id` during migration?** — Recommended yes, for backward compat during transition.

2. **When employment_type changes, should existing used leave days be recalculated?** — Recommended no. Only future entitlements change. Used days are historical.

3. **Should policy eligibility filter happen at balance creation time or access time?** — Recommended: both. Create only eligible balances. Also filter at API response time for defense-in-depth.

4. **For approval delegation, should it auto-activate when manager submits an approved leave request?** — Possible UX improvement: "You're going on leave Mar 25-Apr 5. Delegate approvals to [select person]?"

5. **Should we support "no leave at all" for contractors?** — If `eligible_employment_types` for ALL leave policies excludes "contract", contractor simply has no leave balances. Clean solution.

---

*This document should be reviewed and decisions confirmed before implementation begins.*

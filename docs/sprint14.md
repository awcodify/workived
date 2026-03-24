# Sprint 14 — Registration Flow Critical Fix + Setup Wizard UX

**Duration:** March 24, 2026 (1 day sprint)  
**Status:** ✅ COMPLETE  
**Team:** Full-stack  
**Type:** Critical bugfix — Registration flow was fundamentally broken since project inception

**Summary:** Discovered and fixed a critical bug where user registration never created employee records, preventing all HR features from working. The bug was masked by seed data and fake repositories in tests. Fixed employee auto-creation with proper `user_id` linking, updated organization repository Create() flow, and improved setup wizard UX with compact row layouts. Total: 1 critical bug fixed, 3 UX improvements, 6 files changed, ~150 lines modified.

---

## 📋 Previous Sprint Summary

### Sprint 13 Completed ✅ (March 22, 2026) — Enhancement and Fixing Sprint
- ✅ **`has_subordinate` system-wide** — JWT flag now respected in Leave, Claims, Tasks modules
- ✅ **Task visibility fixes** — Created_by vs assigned_to properly handled
- ✅ **Dark mode (beta)** — Overview and People modules with theme persistence
- ✅ **Shared components** — DateTime, NotificationBell deployed across 8 pages
- ✅ **People page UX** — Better button placement, border-only selection, clickable date pickers
- ✅ **18 bugs fixed, 18 features added** — ~1,200 lines across 45 files

### Key Outcome
Comprehensive permission system with `has_subordinate` flag, dark mode foundation, and standardized component architecture.

---

## 🎯 Current Sprint (Sprint 14)

### Problem Statement

**User Report:**
> "Leave balances and claim balances endpoints return 404 'employee not found' after fresh registration"

**Initial Investigation:**
- User registered successfully → Got `users` + `organisations` + `organisation_members` records
- Employee record exists in database
- `organisation_members.employee_id` is NULL
- `employees.user_id` is NULL
- Backend's `empLookup()` function uses `GetByUserID()` → Cannot resolve employee

**Root Cause Discovery:**
```go
// services/internal/organisation/repository.go - Create() function
// BEFORE (BROKEN):
_, err = tx.Exec(ctx, `
    INSERT INTO organisation_members (organisation_id, user_id, role, joined_at)
    VALUES ($1, $2, 'owner', NOW())
`, org.ID, ownerID)
// Missing: Employee creation and linking!
```

**Why It "Worked" Before:**
1. **Seed script manually creates employees** — `scripts/seed_test_data.sql` includes:
   ```sql
   INSERT INTO employees (id, organisation_id, user_id, employee_code, full_name, email, ...)
   VALUES (gen_random_uuid(), v_org_id, v_owner_id, 'EMP001', 'Ahmad Rizki', ...)
   ```
2. **Unit tests use fake repositories** — `service_test.go` fakeRepo only creates org + org_member, no employee
3. **No integration tests** — Real database behavior never tested

**Git Archaeology:**
- Checked `Create()` function history → Employee creation NEVER existed
- Registration was broken since project inception
- Masked by development seed data throughout all previous sprints

---

## 🔧 Critical Fix

### 1. Employee Auto-Creation on Registration

**Why Critical:**
Without employee records, ALL HR features fail:
- ❌ Leave balances: `GET /api/v1/leave/balances/me` → 404
- ❌ Claim balances: `GET /api/v1/claims/balances/me` → 404  
- ❌ Attendance tracking: No employee to record attendance for
- ❌ Task assignments: Cannot resolve user → employee mapping

**Solution:**

```go
// services/internal/organisation/repository.go - Create()
func (r *Repository) Create(ctx context.Context, req CreateOrgRequest, ownerID uuid.UUID) (*Organisation, error) {
    tx, err := r.db.Begin(ctx)
    defer func() { _ = tx.Rollback(ctx) }()

    // 1. Create organisation
    org := &Organisation{}
    err = tx.QueryRow(ctx, `
        INSERT INTO organisations (name, slug, country_code, timezone, currency_code)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, ...
    `, ...).Scan(&org.ID, ...)

    // 2. Create employee record for owner (NEW!)
    var employeeID uuid.UUID
    err = tx.QueryRow(ctx, `
        INSERT INTO employees (organisation_id, user_id, full_name, email, start_date, is_active)
        SELECT $1, u.id, u.full_name, u.email, CURRENT_DATE, TRUE
        FROM users u
        WHERE u.id = $2
        RETURNING id
    `, org.ID, ownerID).Scan(&employeeID)

    // 3. Create org_member WITH employee_id link (FIXED!)
    _, err = tx.Exec(ctx, `
        INSERT INTO organisation_members (organisation_id, user_id, role, employee_id, joined_at)
        VALUES ($1, $2, 'owner', $3, NOW())
    `, org.ID, ownerID, employeeID)

    return org, tx.Commit(ctx)
}
```

**Key Changes:**
- ✅ Employee created using SELECT from users table (gets full_name, email)
- ✅ `user_id` properly set (required for `GetByUserID()` lookup)
- ✅ `start_date` uses CURRENT_DATE (was incorrectly `hire_date` - wrong column name)
- ✅ Employee ID linked back to `organisation_members.employee_id`
- ✅ Transaction-safe (all-or-nothing)

**Debugging Journey:**
1. ❌ First error: `"hire_date" does not exist` → Changed to `start_date` (migration uses this name)
2. ❌ Second error: `employee_id` NULL → Added RETURNING id and linked to org_member
3. ❌ Third error: `user_id` NULL → Added `u.id` to INSERT SELECT
4. ✅ Final: Complete registration flow working

**Error Logging Added:**
```go
// services/internal/organisation/service.go - Create()
if err != nil {
    s.log.Error().Err(err).
        Str("owner_id", ownerID.String()).
        Str("org_name", req.Name).
        Str("org_slug", req.Slug).
        Msg("failed to create organisation")
    return nil, fmt.Errorf("create organisation: %w", err)
}
```

**Backfill Script:**
Created `scripts/fix_missing_employees.sql` to repair existing test data:
```sql
-- Step 1: Set user_id for existing employees
UPDATE employees e
SET user_id = u.id
FROM organisation_members om
JOIN users u ON u.id = om.user_id
WHERE e.organisation_id = om.organisation_id
  AND e.id = om.employee_id
  AND e.user_id IS NULL
  AND om.role = 'owner';

-- Step 2: Create employees for owners who don't have one
INSERT INTO employees (organisation_id, user_id, full_name, email, start_date, is_active)
SELECT om.organisation_id, om.user_id, u.full_name, u.email, CURRENT_DATE, TRUE
FROM organisation_members om
JOIN users u ON u.id = om.user_id
WHERE om.role = 'owner'
  AND NOT EXISTS (SELECT 1 FROM employees e WHERE e.organisation_id = om.organisation_id AND LOWER(e.email) = LOWER(u.email));

-- Step 3: Link employee_id to org_members
UPDATE organisation_members om
SET employee_id = e.id
FROM employees e
WHERE om.organisation_id = e.organisation_id
  AND om.role = 'owner'
  AND om.employee_id IS NULL
  AND EXISTS (SELECT 1 FROM users u WHERE u.id = om.user_id AND LOWER(u.email) = LOWER(e.email));
```

---

## 🎨 Setup Wizard UX Improvements

### 2. Compact Row Layout (Leave Policies + Claim Categories)

**Before:**
- Card grid: `grid gap-5 sm:grid-cols-2`
- ~110px height per card
- Settings icon disabled until selection

**After:**
- Single-column rows: Checkbox + content + settings
- ~52px height per row (52% reduction)
- Settings icon always visible with accentDim badge
- Inline stepper editing (±) with real-time updates
- Asterisk (*) indicator for customized values
- Better scan-ability with border-only selection styling

**Files Changed:**
- `apps/web/src/components/workived/setup/steps/LeavePoliciesStep.tsx`
- `apps/web/src/components/workived/setup/steps/ClaimCategoriesStep.tsx`

**Design Tokens Used:**
```typescript
{
  borderRadius: 18,          // Container
  border: `1px solid ${colors.ink150}`,
  background: isSelected ? colors.accentDim : 'transparent',
  settingsBadge: {
    borderRadius: 8,
    background: colors.accentDim,
    color: colors.accent,
  }
}
```

### 3. Fixed Nested Button Hydration Error

**Problem:**
```
Warning: <button> cannot be a descendant of <button>
```

**Root Cause:**
```tsx
<button onClick={toggleSelection}>  {/* Outer: row click */}
  <div>
    <button onClick={setCustomizing}>  {/* Inner: settings icon */}
      <Settings2 />
    </button>
  </div>
</button>
```

**Fix:**
```tsx
<div onClick={toggleSelection} className="cursor-pointer">  {/* Changed to div */}
  <div>
    <button onClick={(e) => {
      e.stopPropagation()  // Prevent row toggle
      setCustomizing(template.id)
    }}>
      <Settings2 />
    </button>
  </div>
</div>
```

### 4. Setup Already Completed Page

**Added:**
- `AlreadyCompletedStep.tsx` component
- Shows formatted completion date
- "Go to Overview" button
- Help text about Settings access
- CheckCircle2 icon (96px) with accentDim badge

**Prevents:**
- Users accidentally re-running setup
- Confusion when accessing `/setup` after completion

### 5. Null Safety Guards in SetupWizard

**Problem:**
```
TypeError: Cannot read properties of null (reading 'map')
```

**Fix:**
```tsx
// Before:
<WorkScheduleStep templates={templates.work_schedules} />

// After:
<WorkScheduleStep templates={templates?.work_schedules ?? []} />
```

Applied to: `work_schedules`, `leave_policies`, `claim_categories`

---

## 📊 Testing Evidence

### Unit Tests
```bash
$ go test ./...
112 tests passing, 0 failures
```

**Gap Identified:**
- ✅ Service layer tests use fake repositories
- ❌ No integration tests for `organisation.Create()`
- ❌ Fake repo doesn't create employees (masked the bug)

**Recommendation for Next Sprint:**
- Add integration test: `TestOrganisationRepository_Create_CreatesEmployee()`
- Test against real Postgres (testcontainers or TEST_DATABASE_URL)

### Manual Testing
Fresh registration flow verified:
1. ✅ POST `/api/v1/auth/register` → Creates user
2. ✅ POST `/api/v1/organisations` → Creates org + employee + org_member with link
3. ✅ GET `/api/v1/setup/status` → Returns `needs_setup: true`
4. ✅ POST `/api/v1/setup/complete` → Creates policies + balances
5. ✅ GET `/api/v1/leave/balances/me` → Returns balances (was 404 before fix)
6. ✅ GET `/api/v1/claims/balances/me` → Returns balances (was 404 before fix)
7. ✅ GET `/api/v1/attendance/my/week` → Returns attendance (was 404 before fix)

### Database State Verification
```sql
SELECT 
    u.email,
    o.name as org_name,
    om.role,
    om.employee_id,
    e.id as employee_id,
    e.user_id
FROM users u
JOIN organisation_members om ON om.user_id = u.id
JOIN organisations o ON o.id = om.organisation_id
LEFT JOIN employees e ON e.id = om.employee_id
WHERE om.role = 'owner';
```

**Before Fix:**
```
email            | org_name | role  | employee_id | employee_id | user_id
my@workived.com  | Workived | owner | NULL        | NULL        | NULL
```

**After Fix:**
```
email            | org_name | role  | employee_id                          | employee_id                          | user_id
my@workived.com  | Workived | owner | 65293050-7197-4076-9c84-5f2b393306c7 | 65293050-7197-4076-9c84-5f2b393306c7 | c6a8607c-2990-4b61...
```

---

## 📈 Impact Analysis

### Severity: CRITICAL 🔴

**User-Facing Impact:**
- **100% of fresh registrations broken** — No HR features work without employee records
- **Affects:** Leave, Claims, Attendance, Tasks (all employee-scoped endpoints)
- **Duration:** Since project inception (~13 sprints)
- **Masked by:** Seed data in development environment

**Business Impact:**
- ❌ **Cannot onboard new customers** — Registration appears to work but features fail
- ❌ **Cannot demo to investors** — Fresh demos would fail at first feature use
- ✅ **Existing seed data unaffected** — Development environment still works

**Technical Debt Discovered:**
1. **Insufficient integration testing** — Unit tests with fakes don't catch schema issues
2. **Over-reliance on seed data** — Real registration path never tested
3. **Missing employee test coverage** — No test verifies employee creation

---

## 🚀 Next Sprint Plan (Sprint 15)

### Testing Infrastructure Improvements
1. **Integration test suite for critical paths** (3 days)
   - Testcontainers setup for Postgres
   - Test: User registration → org creation → employee exists
   - Test: Setup wizard → policies created → balances initialized
   - Test: Invitation acceptance → employee linked → features accessible
   - Effort: 3 days
   - Priority: ⭐⭐⭐⭐⭐ Critical

2. **Repository test coverage** (2 days)
   - `organisation/repository_test.go` integration tests
   - `employee/repository_test.go` integration tests
   - `setup/repository_test.go` already has tests (✅ Good pattern to follow)
   - Target: 98% statement coverage on repositories
   - Effort: 2 days
   - Priority: ⭐⭐⭐⭐ High

### Feature Work (From Backlog)
3. **Workload Intelligence Dashboard** (5 days)
   - Analytics: leave patterns, claim trends, attendance gaps
   - Manager view: team capacity planning
   - Dependencies: Sprint 14 complete (employee records work)
   - Effort: 5 days
   - Priority: ⭐⭐⭐⭐ High

4. **Dark Mode Full Rollout** (2 days)
   - Extend to remaining 6 modules (Leave, Claims, Attendance, Tasks, Settings, Profile)
   - Theme toggle in header (currently Overview + People only)
   - Dependencies: Sprint 13 dark mode foundation
   - Effort: 2 days
   - Priority: ⭐⭐⭐ Medium

---

## 📝 Technical Decisions Made

### 1. Employee Creation Strategy
**Decision:** Auto-create employee for org owner using SELECT from users table

**Alternatives Considered:**
- ❌ Require separate "Create Employee Profile" step → Poor UX, extra friction
- ❌ Create minimal employee, ask user to complete later → Incomplete data, features break
- ✅ Auto-create using user's registration data → Zero friction, immediate feature access

**Rationale:**
- Owner's data already captured during registration (full_name, email)
- No additional input needed
- Employee record required for ALL HR features to work
- start_date = CURRENT_DATE is sensible default for founders

### 2. Transaction Safety
**Decision:** Employee creation MUST succeed for org creation to succeed

**Implementation:**
- Single transaction for: org + employee + org_member
- If ANY step fails → Full rollback
- Error wrapping with `fmt.Errorf()` for descriptive messages

**Rationale:**
- Prevents partial state (org without employee)
- Easier to debug (logs show exact failure point)
- Users can retry registration safely

### 3. Column Name: start_date vs hire_date
**Discovery:** Migration 000008 uses `start_date`, not `hire_date`

**Fix:**
```go
// WRONG:
INSERT INTO employees (..., hire_date, ...)  // Column doesn't exist!

// CORRECT:
INSERT INTO employees (..., start_date, ...)  // Match migration schema
```

**Lesson:** Always reference migration files for column names, not assumptions.

---

## 🐛 Bugs Fixed

| Issue | Severity | Root Cause | Fix | Files |
|-------|----------|------------|-----|-------|
| Registration creates no employee | 🔴 Critical | Missing employee INSERT in Create() | Added employee creation with user_id | `organisation/repository.go` |
| employee.user_id is NULL | 🔴 Critical | INSERT didn't include user_id | Added `u.id` to SELECT | `organisation/repository.go` |
| org_member.employee_id is NULL | 🔴 Critical | Created member before employee | Reordered: employee first, then member with link | `organisation/repository.go` |
| Column "hire_date" doesn't exist | 🔴 Critical | Wrong column name (migration uses start_date) | Changed hire_date → start_date | `organisation/repository.go`, `fix_missing_employees.sql` |
| Nested button hydration error | 🟡 Medium | Button inside button in row layout | Changed outer to div with cursor-pointer | `LeavePoliciesStep.tsx`, `ClaimCategoriesStep.tsx` |
| TypeError on templates.map | 🟡 Medium | Templates null when API returns error | Added `?? []` null safety guards | `SetupWizard.tsx` |

---

## ✅ Deliverables

### Code Changes
- `services/internal/organisation/repository.go` — Employee auto-creation in Create()
- `services/internal/organisation/service.go` — Enhanced error logging
- `scripts/fix_missing_employees.sql` — Backfill script for existing data
- `apps/web/src/components/workived/setup/steps/LeavePoliciesStep.tsx` — Row layout + nested button fix
- `apps/web/src/components/workived/setup/steps/ClaimCategoriesStep.tsx` — Row layout + nested button fix
- `apps/web/src/components/workived/setup/SetupWizard.tsx` — Null safety guards

### Documentation
- ✅ Sprint 14 doc (this file)
- ✅ Backfill SQL script with comments
- ✅ Error messages with context for debugging

### Testing
- ✅ Manual registration flow verified
- ✅ Database state validated (user_id, employee_id properly linked)
- ✅ All existing unit tests pass (112/112)
- ⚠️ **Gap identified:** No integration tests for registration flow

---

## 🎓 Lessons Learned

### 1. Seed Data Can Mask Critical Bugs
**What Happened:**
- Employee creation bug existed for 13 sprints
- Seed script manually creates employees → Development environment works fine
- Fresh registration (production scenario) never tested

**Prevention:**
- ✅ Always test "empty database → registration → features" path
- ✅ Integration tests against real database (not fakes)
- ✅ Staging environment with production-like setup (no seed data)

### 2. Fake Repositories Hide Schema Issues
**What Happened:**
- `service_test.go` uses `fakeRepo` that doesn't create employees
- Tests pass because fake doesn't validate database schema
- Real database behavior (constraints, column names) not tested

**Prevention:**
- ✅ Integration tests for critical paths (use testcontainers)
- ✅ Repository-level tests against real Postgres
- ✅ CI pipeline includes database integration tests

### 3. Migration Files Are Source of Truth
**What Happened:**
- Assumed column was `hire_date` (common HR term)
- Actual migration uses `start_date`
- Error: `column "hire_date" does not exist`

**Prevention:**
- ✅ Always check migration files for exact column names
- ✅ Use code generation from schema (sqlc, ent, etc.) — Future consideration
- ✅ Database schema validation in CI

---

## 📊 Sprint Metrics

- **Files changed:** 6
- **Lines added:** ~150
- **Lines removed:** ~50
- **Bugs fixed:** 6 (1 critical, 5 supporting)
- **Features added:** 3 UX improvements
- **Test coverage:** 98% services (unchanged), 0% integration (gap identified)
- **Backend build time:** ~2.5s
- **Frontend build time:** ~4.5s
- **Time to fix critical bug:** ~3 hours (discovery → root cause → fix → test)

---

## 🏁 Sprint Retrospective

### What Went Well ✅
- **Fast root cause identification** — Error logging helped pinpoint exact failure
- **Comprehensive testing** — Verified full registration → features flow
- **Transaction safety** — Rollback on failure prevents partial state
- **Backfill script** — Existing test data can be repaired
- **UX improvements bundled** — Setup wizard now more polished

### What Needs Improvement ⚠️
- **Testing gaps** — Unit tests don't catch schema issues
- **Over-reliance on seed data** — Real flows not tested during development
- **No staging environment** — Would have caught this before "production"

### Action Items for Next Sprint
1. ✅ Add integration test suite (Sprint 15 priority)
2. ✅ Set up staging environment (no seed data, production-like)
3. ✅ Add "fresh registration → feature use" to manual QA checklist
4. ✅ Consider code generation from schema (sqlc) to prevent column name typos

---

## 🔗 Related Issues

- Sprint 13: `has_subordinate` permission system
- Sprint 12: JWT claims for role-based features
- Sprint 8: Setup wizard initial implementation
- Backlog: Integration test infrastructure

---

**Status:** ✅ COMPLETE (March 24, 2026)
**Next:** Sprint 15 — Testing Infrastructure + Workload Intelligence

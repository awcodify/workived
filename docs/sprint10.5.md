# Sprint 10.5 — Bug Fixes & Critical Gaps

**Duration:** March 22, 2026 (half day)  
**Status:** 📋 Planned  
**Team:** Backend + Frontend  
**Type:** Pure bug fix sprint  
**Focus:** 5 critical bugs (P0-P1-P2)

---

## 📋 Context

### Why Sprint 10.5?

**Trigger:** First full production readiness review (March 21, 2026) identified 6 critical bugs blocking beta launch.

**Strategic Goal:** Clear all P0-P1 bugs to unblock infrastructure deployment (Sprint 11).

**Reference:** See [PRODUCTION_READINESS_REVIEW.md](./PRODUCTION_READINESS_REVIEW.md) for full analysis.

---

## 📋 Previous Sprint Summary

### Sprint 10 Completed ✅
- ✅ Time-aware due dates with 5 urgency levels
- ✅ Task filters with URL persistence
- ✅ Reusable EmployeeSelector component
- ✅ Emoji reactions UI
- ✅ 41 tests (100% coverage on new features)

### Production Readiness Review Findings
- **Maturity:** 75% complete — Beta-ready
- **Critical Bugs:** 6 identified (2 P0, 3 P1, 1 P3)
- **Scope:** Bug fixes only (no new features)

---

## 🎯 Sprint 10.5 Goals

### Primary Objective
**Fix all P0-P1 bugs** (5 hours total) — Production blockers only

### Success Criteria
- [ ] All P0 bugs fixed (non-admin attendance, unlimited leave)
- [ ] All P1 bugs fixed (test errors, UI issues)  
- [ ] Test coverage maintained at 98%+
- [ ] CI/CD pipeline green (no compilation errors)
- [ ] No new features added

### Scope Decision: Bug Fixes Only

**Product Owner Decision:** Sprint 10.5 is **pure bug fix sprint**. Zero new features.

**Removed from scope:**
- ❌ Employee document upload UI (new feature → Sprint 12)
- ❌ Mention notifications (new feature → Sprint 12)
- ❌ Basic auth in OpenAPI (nice-to-have → Sprint 12)
- ❌ **Attendance revision/correction** (new feature → Backlog)
- ❌ Rate limiting (infrastructure → Sprint 11)

**Why attendance revision was removed:**
- User clarification: This is a **feature** where employees request corrections, manager approves
- Not a compliance requirement
- Belongs in backlog as "Attendance Correction Workflow"

---

## 🐛 Critical Bug Fixes

### Bug #1: Non-Admin 403 on Attendance API 🔴 P0

**Issue:**
```http
GET /api/v1/attendance/daily
Authorization: Bearer <team_member_jwt>

Response: 403 Forbidden
```

**Current Code:**
```go
// services/internal/attendance/handler.go
att.GET("/daily", middleware.Require(middleware.PermAttendanceRead), h.DailyReport)
```

**Problem:**
- `PermAttendanceRead` = admin/manager only
- Team members cannot view their own attendance
- Breaks core feature for 80% of users

**Impact:**
- Team members see "Pending" label on dock
- Cannot verify their own clock-in/out records
- Critical UX failure

**Fix:**
```go
// Allow: admin OR own employee attendance
att.GET("/daily", middleware.RequireAny(
  middleware.PermAttendanceRead, 
  middleware.PermSelfAttendance
), h.DailyReport)

// In handler: Filter by employee_id if not admin
func (h *Handler) DailyReport(c *gin.Context) {
  orgID := middleware.OrgIDFromCtx(c)
  
  // Check if user has admin permission
  hasAdminPerm := false
  if role := middleware.RoleFromCtx(c); role == "admin" || role == "owner" {
    hasAdminPerm = true
  }
  
  var employeeID *uuid.UUID
  if !hasAdminPerm {
    // Non-admin: Show only own attendance
    empID, err := h.empLookup(c.Request.Context(), orgID, middleware.UserIDFromCtx(c))
    if err != nil {
      c.JSON(http.StatusForbidden, apperr.Response(apperr.PermissionDenied()))
      return
    }
    employeeID = &empID
  }
  
  // Pass employeeID filter to service
  records, err := h.service.DailyReport(ctx, orgID, employeeID, date)
  // ...
}
```

**Testing:**
- [ ] Admin can see all employees' attendance
- [ ] Team member can see only own attendance
- [ ] Team member cannot see other employees' attendance
- [ ] API returns 200 for team members
- [ ] Dock "Pending" label fixed

**Effort:** 1 hour  
**Priority:** P0 — Must fix before beta  
**Owner:** Backend

---

### Bug #2: Sick Leave Unlimited Not Supported 🔴 P0

**Issue:**
- Database schema: `leave_policies.max_days INT NOT NULL`
- Cannot represent unlimited sick leave
- Violates Indonesia/UAE labor law (unlimited sick leave with medical certificate)

**Impact:**
- **Product cannot launch in Indonesia** (labor law requires unlimited sick leave)
- **Product cannot launch in UAE** (similar requirement)
- **Blocks entire target market**

**Solution:**

**Step 1: Add Migration**
```sql
-- migrations/000062_add_unlimited_leave_claim.up.sql
ALTER TABLE leave_policies 
ADD COLUMN is_unlimited BOOLEAN DEFAULT FALSE;

ALTER TABLE claim_categories
ADD COLUMN is_unlimited BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN leave_policies.is_unlimited IS 
  'If true, max_days is ignored (unlimited leave with approval)';
COMMENT ON COLUMN claim_categories.is_unlimited IS 
  'If true, monthly_limit is ignored (unlimited claims with approval)';
```

```sql
-- migrations/000062_add_unlimited_leave_claim.down.sql
ALTER TABLE leave_policies DROP COLUMN is_unlimited;
ALTER TABLE claim_categories DROP COLUMN is_unlimited;
```

**Step 2: Update Service Logic**
```go
// services/internal/leave/service.go

func (s *Service) ValidateLeaveRequest(ctx context.Context, req SubmitLeaveRequest, policy LeavePolicy, balance LeaveBalance) error {
  // Skip balance check if unlimited
  if policy.IsUnlimited {
    // Unlimited leave: Approval required, no balance check
    return nil
  }
  
  // Original validation
  daysRequested := calculateDays(req.StartDate, req.EndDate)
  if balance.Remaining < daysRequested {
    return apperr.InsufficientBalance(balance.Remaining, daysRequested)
  }
  
  return nil
}

func (s *Service) ApproveLeaveRequest(ctx context.Context, requestID uuid.UUID) error {
  // ...
  
  // Skip balance deduction if unlimited
  if !policy.IsUnlimited {
    // Deduct from balance
    _, err = s.balanceRepo.Deduct(ctx, request.EmployeeID, request.PolicyID, daysUsed)
    if err != nil {
      return err
    }
  }
  
  // Update request status to approved
  // ...
}
```

**Step 3: Update Types**
```go
// services/internal/leave/types.go

type LeavePolicy struct {
  // ...existing fields
  IsUnlimited bool `json:"is_unlimited" db:"is_unlimited"`
}

type CreatePolicyRequest struct {
  // ...existing fields
  IsUnlimited *bool `json:"is_unlimited"`
}
```

**Step 4: Frontend UI**
```tsx
// apps/web/src/components/LeaveRequestForm.tsx

{policy?.is_unlimited && (
  <Alert variant="info">
    <Info className="h-4 w-4" />
    <AlertDescription>
      This is an unlimited leave policy. Manager approval required.
    </AlertDescription>
  </Alert>
)}

// In leave policy form
<Checkbox
  id="is_unlimited"
  checked={formData.is_unlimited}
  onChange={(e) => setFormData({
    ...formData,
    is_unlimited: e.target.checked,
    max_days: e.target.checked ? null : formData.max_days
  })}
/>
<label htmlFor="is_unlimited">
  Unlimited (no maximum days, approval always required)
</label>
```

**Testing:**
- [ ] Create unlimited sick leave policy
- [ ] Submit leave request (no balance check)
- [ ] Approve request (no balance deduction)
- [ ] Balance remains unchanged
- [ ] Normal policies still validate balance
- [ ] Migration up/down works correctly

**Effort:** 2 hours  
**Priority:** P0 — Blocks Indonesia/UAE launch  
**Owner:** Backend + Frontend

---

### Bug #3: TaskFilters Test Compilation Errors 🟡 P1

**Issue:**
```typescript
// apps/web/src/components/TaskFilters.test.tsx

// Line 11, 20
employment_status: 'active' 
// Error: 'employment_status' does not exist in type 'Employee'

// Line 156, 187
fireEvent.change(assigneeSelect, ...)
// Error: Argument of type 'HTMLElement | undefined' is not assignable
```

**Impact:**
- Tests fail to compile
- CI/CD pipeline blocked
- Cannot merge PRs

**Fix:**
```typescript
// Remove employment_status field (doesn't exist in Employee type)
const mockEmployees: Employee[] = [
  {
    id: '1',
    full_name: 'John Doe',
    department_id: 'dept1',
    // Remove: employment_status: 'active'
  },
  {
    id: '2', 
    full_name: 'Jane Smith',
    department_id: 'dept2',
    // Remove: employment_status: 'active'
  }
]

// Add null checks before fireEvent
it('filters by assignee', () => {
  render(<TaskFilters {...defaultProps} />)
  
  const assigneeSelect = screen.queryByLabelText('Assignee')
  if (assigneeSelect) {
    fireEvent.change(assigneeSelect, { target: { value: '1' } })
  }
  
  expect(onFiltersChange).toHaveBeenCalledWith({
    assignee: '1'
  })
})

it('filters by priority', () => {
  render(<TaskFilters {...defaultProps} />)
  
  const prioritySelect = screen.queryByLabelText('Priority')
  if (prioritySelect) {
    fireEvent.change(prioritySelect, { target: { value: 'high' } })
  }
  
  expect(onFiltersChange).toHaveBeenCalledWith({
    priority: 'high'
  })
})
```

**Testing:**
- [ ] Tests compile without errors
- [ ] All tests pass (`npm test`)
- [ ] CI pipeline green

**Effort:** 30 minutes  
**Priority:** P1 — Blocks CI/CD  
**Owner:** Frontend

---

### Bug #4: Calendar Icon Invisible (Invite Modal) 🟡 P1

**Issue:**
- Calendar icon not visible in employee invite modal
- Likely: z-index conflict or color contrast issue

**Impact:**
- Confusing UX (users can't find date picker)
- Not blocking (can still type date manually)

**Investigation Steps:**
1. Inspect element in browser DevTools
2. Check CSS `color`, `z-index`, `opacity` properties
3. Verify icon SVG is loaded

**Likely Fix:**
```tsx
// apps/web/src/components/InviteEmployeeModal.tsx

// Before (hypothetical)
<CalendarIcon className="text-white" />

// After
<CalendarIcon className="h-4 w-4 text-gray-500" />
```

**Or:**
```tsx
// If z-index issue
<div className="relative z-10">
  <CalendarIcon className="h-4 w-4 text-gray-700" />
</div>
```

**Testing:**
- [ ] Calendar icon visible on invite modal
- [ ] Icon has proper contrast against background
- [ ] Date picker opens when icon clicked
- [ ] Works in Chrome, Safari, Firefox

**Effort:** 15 minutes  
**Priority:** P1 — UX polish  
**Owner:** Frontend

---

### Bug #5: Create Task in Done Column → Not Auto-Complete 🟡 P2

**Issue:**
```typescript
// User creates task directly in "Done" column
// Expected: Task created with completed_at = now()
// Actual: Task created with completed_at = null
```

**Root Cause:**
- Sprint 10 added `auto_complete_on_move` to `task_lists`
- Feature only applies when moving task to Done column
- Not applied when creating task directly in Done column

**Impact:**
- Workflow confusion
- Tasks in "Done" appear incomplete
- Misleading task counts

**Fix:**
```go
// services/internal/tasks/service.go

func (s *Service) CreateTask(ctx context.Context, orgID uuid.UUID, req CreateTaskRequest) (*Task, error) {
  // Get the target list to check auto_complete setting
  list, err := s.repo.GetTaskList(ctx, orgID, req.ListID)
  if err != nil {
    return nil, err
  }
  
  // If list has auto_complete, mark task as completed
  var completedAt *time.Time
  if list.AutoCompleteOnMove {
    now := time.Now()
    completedAt = &now
  }
  
  task := &Task{
    ID:            uuid.New(),
    OrganisationID: orgID,
    ListID:        req.ListID,
    Title:         req.Title,
    Description:   req.Description,
    AssigneeID:    req.AssigneeID,
    DueDate:       req.DueDate,
    Priority:      req.Priority,
    Position:      req.Position, // Will be calculated by repo
    CompletedAt:   completedAt,
    CreatedAt:     time.Now(),
  }
  
  // Insert task
  err = s.repo.CreateTask(ctx, task)
  if err != nil {
    return nil, err
  }
  
  return task, nil
}
```

**Testing:**
- [ ] Create task in "Done" column → Task marked complete
- [ ] Create task in "To Do" column → Task not marked complete
- [ ] Create task in "In Progress" → Task not marked complete
- [ ] Task appears with completion checkmark in UI
- [ ] Workload calculation excludes completed tasks

**Effort:** 30 minutes  
**Priority:** P2 — Workflow issue  
**Owner:** Backend

---

### Bug #6: Dock Blocking UI When No Scroll 🟢 P3

**Issue:**
- Fixed dock position blocks UI elements behind it
- Only happens when page content doesn't scroll

**Impact:**
- Minor layout annoyance
- Can't click elements behind dock on short pages

**Fix:**

**Option 1: Use sticky positioning**
```tsx
// apps/web/src/components/Dock.tsx

// Before
<div className="fixed bottom-0 left-0 right-0 z-50">

// After
<div className="sticky bottom-0 z-50 mt-auto">
```

**Option 2: Pointer events**
```tsx
<div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
  <button className="pointer-events-auto">...</button>
  <button className="pointer-events-auto">...</button>
</div>
```

**Testing:**
- [ ] Dock doesn't block clickable elements
- [ ] Dock buttons still clickable
- [ ] Works on pages with/without scroll
- [ ] Mobile responsive

**Effort:** 30 minutes  
**Priority:** P3 — Minor UX  
**Owner:** Frontend  
**Decision:** Defer to Sprint 11 (not critical)

---

## ❌ **REMOVED: Attendance Revision Feature**

**Product Owner Clarification:** This is a **new feature**, not a bug fix or compliance gap.

### What We Thought It Was:
- Audit trail for attendance changes (GDPR compliance)
- Backend tracking of who changed what

### What It Actually Is:
- **Feature:** Employee can request to correct forgotten clock-in/clock-out
- **Workflow:** Employee submits correction → Manager approves/rejects
- **Use case:** "I forgot to clock in this morning, can I add it now?"

### Why It's Removed from Sprint 10.5:
- This is a **new feature** with approval workflow
- Sprint 10.5 is bug fixes only
- Belongs in product backlog

### Where It Goes:
- **Added to backlog:** `docs/backlog/hr-features.md`
- **Feature name:** Attendance Correction Workflow
- **Priority:** ⭐⭐⭐ Medium value
- **Effort:** L (1-2 weeks) — Requires approval workflow, notifications, audit trail

---

## 📝 **Note: System-Wide Audit Logging**

**Separate Infrastructure Concern:**

User correctly identified that **audit logging should be system-wide**, not just for attendance.

**What this means:**
- Track all state-changing actions across ALL modules
- Who did what, when, and why
- Compliance requirement (GDPR Article 15, labor laws)

**Implementation approach:**
- Centralized audit log service
- Used by all modules (attendance, leave, claims, employees, tasks)
- Database table: `audit_logs` (already exists, need to expand usage)

**Status:**
- Added to backlog: `docs/backlog/system-improvements.md`
- Feature: "Comprehensive Audit Logging"
- Priority: ⭐⭐⭐⭐ High value (compliance requirement)
- Effort: M (3-5 days)
- Target: Sprint 11 or 12

---

## 🔒 ~~Compliance: Attendance Revision Feature~~ **REMOVED**

**This entire section has been removed.** See explanation above about why attendance revision is a new feature, not a compliance requirement.

The implementation details (migrations, service logic, frontend components) have been moved to the backlog as "Attendance Correction Workflow" feature.

---

## ❌ **Deferred Features (Not in Sprint 10.5)**

**Product Owner Decision:** These are **new features**, not bug fixes. Defer to Sprint 12.

### 1. Employee Document Upload UI — DEFERRED ⏭️
- **Why deferred:** New feature, backend exists but frontend is greenfield work
- **Value:** High (compliance documents)
- **Effort:** 2 days
- **Defer to:** Sprint 12 (after beta launch)

### 2. Mention Notifications — DEFERRED ⏭️
- **Why deferred:** New feature, requires TipTap Mention extension integration
- **Value:** Medium (engagement)
- **Effort:** 2 days
- **Defer to:** Sprint 12

### 3. Basic Auth in OpenAPI — DEFERRED ⏭️
- **Why deferred:** Nice-to-have for developer experience, not critical
- **Value:** Low (internal tooling)
- **Effort:** 1 hour
- **Defer to:** Sprint 12

### 4. Rate Limiting on Auth Endpoints — DEFERRED ⏭️
- **Why deferred:** Security hardening, not a blocker (low attack surface in beta)
- **Value:** Medium (security)
- **Effort:** 1 hour
- **Defer to:** Sprint 11 (infrastructure sprint)
- **Note:** Add during Railway deployment when configuring Redis

---

## 📊 Sprint 10.5 Summary

### Planned Work (Bug Fixes Only)

**Critical Bugs (5 hours total):**
- [ ] Bug #1: Non-admin attendance API (1 hour) 🔴 P0
- [ ] Bug #2: Sick leave unlimited (2 hours) 🔴 P0
- [ ] Bug #3: TaskFilters test compilation (30 min) 🟡 P1
- [ ] Bug #4: Calendar icon invisible (15 min) 🟡 P1
- [ ] Bug #5: Done column autocomplete (30 min) 🟡 P2

**Deferred (Not Critical):**
- ⏭️ Bug #6: Dock blocking UI (P3 → Sprint 11)

**Total Effort:** 5 hours (half day)

**Team:** Solo developer can complete in half day to 1 day

---

## 🎯 Success Metrics

- [ ] All P0 bugs fixed and tested
- [ ] All P1 bugs fixed and tested
- [ ] CI/CD pipeline green (no compilation errors)
- [ ] Test coverage maintained at 98%+
- [ ] No regressions in existing features

---

## 🚀 Next Sprint Plan (Sprint 11)

**After Sprint 10.5 completes (half day), focus shifts to:**

1. **Infrastructure Deployment** (3 days)
   - Deploy to Railway
   - Configure monitoring (Sentry + Railway)
   - Set up CI/CD pipeline (GitHub Actions)
   - Database backups + disaster recovery
   - Rate limiting (move from Sprint 10.5)

2. **E2E Testing** (3 days)
   - Playwright setup
   - 5 critical user flows (auth, attendance, leave, tasks, claims)
   - Load testing (100 concurrent users)

3. **Beta Prep** (2 days)
   - Onboarding checklist widget
   - Empty states
   - User documentation
   - Beta signup form

**Goal:** Beta launch in 1.5 weeks (Sprint 11 completion)

---

## 🔗 References

- [Production Readiness Review](./PRODUCTION_READINESS_REVIEW.md) — Full assessment
- [Sprint 10 Completion](./sprint10.md) — Previous sprint
- [Sprint 9 Completion](./sprint9.md) — Workload intelligence
- [Product Backlog](./backlog/) — Feature pipeline

---

**Sprint 10.5 Status:** � Planned  
**Start Date:** March 22, 2026  
**Target Completion:** March 22, 2026 (half day)  
**Focus:** Bug fixes only — No new features

---

**Changelog:**
- March 21, 2026 (evening): Removed attendance revision feature
  - Clarification: Attendance revision is a **new feature** (employee requests correction → manager approves), not a compliance gap
  - Moved to backlog: `docs/backlog/hr-features.md` as "Attendance Correction Workflow"
  - Added to backlog: Comprehensive audit logging as separate infrastructure concern
  - Sprint 10.5 now **pure bug fix** (5 hours total)
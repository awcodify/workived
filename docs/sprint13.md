# Sprint 13 — `has_subordinate` System-Wide Utilization

**Duration:** March 22, 2026 (0.5 day sprint)  
**Status:** In Progress  
**Team:** Full-stack  
**Type:** Architecture consistency fix — System-wide subordinate permission enforcement

---

## 📋 Previous Sprint Summary

### Sprint 12 Completed ✅ (March 22, 2026) — Attendance Dashboard Revamp
- ✅ **Two-column layout** — Balances + tabbed attendance
- ✅ **Role-based tabs** — "My Attendance" vs "Team Attendance" toggle
- ✅ **`has_subordinate` flag introduced** — Migration 063 + JWT claim
- ✅ **Backend infrastructure** — `HasSubordinateFromCtx()` middleware helper
- ✅ **Attendance permissions** — `useAttendanceRole()` hook respects flag
- ✅ **Overtime tracking** — Automatic weekend/holiday detection
- ✅ **Week navigation** — Calendar picker with timezone fixes
- ✅ **Shared AttendanceCard component** — DRY principle applied

### Key Outcome
**Created `has_subordinate` foundation** — But only used in attendance module. Sprint 13 fixes system-wide inconsistency.

---

## 🎯 Current Sprint (Sprint 13)

### Problem Statement

**Reported Issues:**
1. Ricko (role=`member`, has subordinate Jepri) → Cannot see Approvals tab in Leave/Claims ✅ FIXED
2. Jefry (role=`member`, no subordinates) → Sees "All caught up!" but button hidden (confusing UX) ✅ FIXED
3. **Jefry sees approval tasks** → Should only be visible to requester (Ricko) and approver (Ahmad) ✅ FIXED
4. **Ricko cannot see his own approval tasks** → Tasks created_by was set to assignee instead of requester ✅ FIXED

**Root Cause:**
- ✅ Attendance module checks `has_subordinate` from JWT (✅ Works correctly)
- ❌ Leave module only checks role (`useCanManageLeave()` ignores flag)
- ❌ Claims module only checks role (`useCanManageClaims()` ignores flag)
- ❌ Tasks module shows all tasks to all users (needs filtering by employee_id)
- ✅ People module is correct (org-wide directory, intentionally not filtered)

### Architectural Gap Analysis

#### ✅ What Works (Sprint 12)
| Component | Status | Implementation |
|-----------|--------|----------------|
| Database | ✅ | `organisation_members.has_subordinate` column exists |
| Backend Auth | ✅ | JWT includes `has_sub` claim |
| Backend Middleware | ✅ | `HasSubordinateFromCtx()` helper available |
| Backend RBAC | ✅ | `RequireManager()` checks role OR has_subordinate |
| Frontend Attendance | ✅ | `useAttendanceRole()` decodes JWT, checks flag |

#### ❌ What's Broken (Sprint 13 Scope)
| Module | Component | Issue | Fix Required |
|--------|-----------|-------|--------------|
| **Leave** | Frontend hook | `useCanManageLeave()` ignores flag | Add `has_subordinate` check |
| **Leave** | Tab visibility | Approvals tab hidden for members with subordinates | Use corrected hook |
| **Leave** | Default tab | Should default to "Approvals" if has subordinates | Add logic |
| **Claims** | Frontend hook | `useCanManageClaims()` ignores flag | Add `has_subordinate` check |
| **Claims** | Tab visibility | Approvals tab hidden for members with subordinates | Use corrected hook |
| **Claims** | Default tab | Should default to "My Requests" always (❌ bug exists — switches to Approvals on mount) | Fix initialization |
| **Tasks** | Backend handler | Shows all tasks to all users | Auto-filter to current employee_id (unless admin) |
| **Tasks** | Approval tasks | Visible to everyone | Backend SQL correct, handler needs to pass employee_id |
| **People** | List filtering | N/A — working as intended | No changes (org-wide directory) |
| **Reports** | Future module | Not implemented yet | No action |

---

## 📐 Architecture Decision — Permission Model

### Principle: Role-Based + Subordinate-Based Hybrid

**Permission Formula:**
```
canApprove = hasAdminRole() OR (hasApprovalRole() AND hasSubordinate())
```

**Roles:**
- **Admin roles** (owner, admin, hr_admin, super_admin) → Full org access, no subordinate check needed
- **Approval roles** (manager, finance) → Approval permission, but filtered to subordinates
- **Member role** → Only gets approval access IF `has_subordinate = true`

**Backend (already correct via `RequireManager()`):**
```go
// RequireManager checks: role == "manager" OR hasSubordinate == true OR hasAdminPermissions
if role == RoleManager || hasSubordinate || HasPermission(role, PermTeamRead) {
    // Allow access
}
```

**Frontend (needs fix):**
```tsx
// WRONG (current):
useCanManageLeave() → checks role only

// CORRECT (Sprint 13):
useCanManageLeave() → checks (role === admin) OR (role in approverRoles AND hasSubordinate)
```

---

## 🔧 Implementation Plan

### 1. Frontend: Extract Shared JWT Helper (15 min)
**File:** `apps/web/src/lib/utils/jwt.ts`

**Action:** Move `has_subordinate` decoding from `useAttendanceRole.ts` to shared utility:

```tsx
// Add to existing jwt.ts file:
export function parseJwtHasSubordinate(token: string | null): boolean {
  if (!token) return false
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const payload = JSON.parse(atob(parts[1]))
    return payload.has_sub === true
  } catch {
    return false
  }
}
```

**Files to update:**
- ✅ Create new function in `apps/web/src/lib/utils/jwt.ts`
- ✅ Refactor `apps/web/src/lib/hooks/useAttendanceRole.ts` to use shared helper

---

### 2. Frontend: Create `useHasSubordinate()` Hook (5 min)
**File:** `apps/web/src/lib/hooks/useRole.ts`

```tsx
import { parseJwtHasSubordinate } from '@/lib/utils/jwt'

export function useHasSubordinate(): boolean {
  const accessToken = useAuthStore((s) => s.accessToken)
  return parseJwtHasSubordinate(accessToken)
}
```

---

### 3. Frontend: Update Permission Hooks (10 min)
**File:** `apps/web/src/lib/hooks/useRole.ts`

**Update logic:**
```tsx
// BEFORE:
export function useCanManageLeave(): boolean {
  const role = useRole()
  return role === 'owner' || role === 'admin' || role === 'hr_admin' || 
         role === 'super_admin' || role === 'member' || role === 'manager' || role === 'finance'
}

// AFTER:
export function useCanManageLeave(): boolean {
  const role = useRole()
  const hasSubordinate = useHasSubordinate()
  
  // Admin roles: always true
  if (role === 'owner' || role === 'admin' || role === 'hr_admin' || role === 'super_admin') {
    return true
  }
  
  // Approval roles: true if has subordinates
  if (role === 'member' || role === 'manager' || role === 'finance') {
    return hasSubordinate
  }
  
  return false
}
```

**Apply same pattern to:**
- ✅ `useCanManageLeave()`
- ✅ `useCanManageClaims()`

**Do NOT change:**
- ❌ `useCanEditOrgSettings()` — Admin-only, no subordinate logic
- ❌ `useCanInvite()` — Admin-only, no subordinate logic
- ❌ `useCanManageEmployees()` — Admin-only  (design decision: members cannot edit subordinates' profiles, only approve requests)

---

### 4. Frontend: Fix Leave Default Tab Logic (5 min)
**File:** `apps/web/src/routes/_app/leave/index.tsx`

**Current code (line 34):**
```tsx
const [activeTab, setActiveTab] = useState<'approvals' | 'my-requests'>(
  canManageLeave ? 'approvals' : 'my-requests'
)
```

**Issue:** `canManageLeave` returns `true` for members without subordinates (broken).

**After hook fix:** This will auto-correct ✅ (no code change needed, hook fix cascades).

---

### 5. Frontend: Fix Claims Default Tab Bug (5 min)
**File:** `apps/web/src/routes/_app/claims/index.tsx`

**Current code (lines 45-60):**
```tsx
const [activeTab, setActiveTab] = useState<'approvals' | 'my-requests'>('my-requests')

// ...useEffect later...
useEffect(() => {
  if (pendingClaims && pendingClaims.length > 0) {
    setActiveTab('approvals')
  }
}, [pendingClaims])
```

**Issue:** Even if user has NO subordinates, if they have pending claims, tab switches to "Approvals" (should not happen).

**Fix:**
```tsx
useEffect(() => {
  if (canManageClaims && pendingClaims && pendingClaims.length > 0) {
    setActiveTab('approvals')
  }
}, [canManageClaims, pendingClaims])
```

---

### 6. Frontend: Update Leave Tab Rendering (No change needed)
**File:** `apps/web/src/routes/_app/leave/index.tsx` (line 313)

```tsx
{activeTab === 'approvals' && canManageLeave && (
  // ... approvals UI
)}
```

**Status:** ✅ Already correct (double-guards with `canManageLeave`). After hook fix, will work correctly.

---

### 7. Frontend: Update Claims Tab Rendering (No change needed)
**File:** `apps/web/src/routes/_app/claims/index.tsx` (line 335)

```tsx
{activeTab === 'approvals' && canManageClaims && (
  // ... approvals UI
)}
```

**Status:** ✅ Already correct (double-guards with `canManageClaims`). After hook fix, will work correctly.

---

### 8. Architecture Decision: Tasks Module (Document only)

**Current state:**
- Tasks have `assigned_to` field (employee_id)
- Regular tasks = collaborative Kanban workspace
- Approval tasks = automated tasks created for leave/claim approvals

**Design Question:** Should all tasks be visible to all org members, or should approval tasks be filtered?

**Decision (Sprint 13):** ✅ **IMPLEMENTED**
- **Regular tasks** (approval_type IS NULL): Visible to ALL org members (collaborative workspace)
- **Approval tasks** (approval_type IS NOT NULL): Visible ONLY to:
  - Assignee (the approver)
  - Creator (the requester)
- **Implementation:** 
  - Modified SQL query to distinguish between regular and approval tasks
  - Handler always passes employee_id for filtering
  - Regular tasks ignore the filter (collaborative)
  - Approval tasks apply the filter (privacy)

**Action:** ✅ Fixed in repository SQL + handler logic

---

### 9. Architecture Decision: People Module (Document only)

**Current state:**
- List all employees (paginated, searchable)
- Admin-only edit access
- No team filtering

**Design Question:** Should members see only their subordinates?

**Decision (Sprint 13):** ❌ **No changes**
- People directory is org-wide view (like company directory)
- Filtering by manager would create information silos
- Admin-only edit prevents permission issues
- Approvals (leave/claims/attendance) already filter to subordinates
- Current UX is correct

**Action:** No code changes

---

## 📊 Test Plan

### Manual Testing Matrix

| User | Role | Has Subordinates | Leave Tab | Claims Tab | Attendance Tab | Expected Behavior |
|------|------|------------------|-----------|------------|----------------|-------------------|
| Ahmad | `admin` | N/A | ✅ Shows | ✅ Shows | ✅ Shows | Admin always sees approvals |
| Ricko | `member` | Yes (Jepri) | ✅ Shows | ✅ Shows | ✅ Shows | Member with subordinates sees approvals |
| Jefry | `member` | No | ❌ Hidden | ❌ Hidden | ❌ Hidden | Member without subordinates sees only "My Requests" |
| Finance user | `finance` | Yes | ✅ Shows | ✅ Shows | ❌ Hidden | Finance role gets leave/claims, not attendance |

### Test Cases

**Test 1: Ricko (member + subordinate)**
```
1. Login as ricko@workived.com
2. Navigate to /leave
3. ✅ Verify "Approvals" tab visible
4. ✅ Verify default tab is "Approvals" (if pending requests exist)
5. Click "Approvals" tab
6. ✅ Verify sees only Jepri's requests
7. Navigate to /claims
8. ✅ Verify "Approvals" tab visible
9. Navigate to /attendance
10. ✅ Verify "Team Attendance" toggle visible
```

**Test 2: Jefry (member without subordinate)**
```
1. Login as jefry@workived.com
2. Navigate to /leave
3. ✅ Verify NO "Approvals" tab
4. ✅ Verify default tab is "My Requests"
5. ✅ Verify can submit own leave requests
6. Navigate to /claims
7. ✅ Verify NO "Approvals" tab
8. ✅ Verify default tab is "My Requests"
9. Navigate to /attendance
10. ✅ Verify NO "Team Attendance" toggle
```

**Test 3: Ahmad (admin)**
```
1. Login as admin user
2. Navigate to /leave
3. ✅ Verify "Approvals" tab visible
4. ✅ Verify sees ALL pending requests (not just subordinates)
5. Navigate to /claims
6. ✅ Verify "Approvals" tab visible
7. ✅ Verify sees ALL pending claims
```

**Test 4: Claims default tab bug fix**
```
1. Login as Jefry (no subordinates)
2. Have Ahmad submit a claim (creates pending claim in system)
3. Navigate to /claims as Jefry
4. ✅ Verify stays on "My Requests" tab (bug: used to switch to Approvals)
5. ✅ Verify no "Approvals" tab visible
```

**Test 5: Tasks approval visibility (Sprint 13 addition)**
```
Scenario: Ricko submits leave request → approval task created for manager

1. Login as ricko@workived.com
2. Submit leave request → approval task created
3. Navigate to /tasks
4. ✅ Verify Ricko sees the approval task (as creator)
5. ✅ Verify Ricko sees ALL regular tasks (collaborative Kanban)
6. Logout, login as manager who has subordinates (should be assigned)
7. Navigate to /tasks
8. ✅ Verify manager sees the approval task (as assignee)
9. ✅ Verify manager sees ALL regular tasks (collaborative)
10. Logout, login as jefry@workived.com (member without subordinates)
11. Navigate to /tasks
12. ✅ Verify Jefry does NOT see the approval task (not involved)
13. ✅ Verify Jefry sees ALL regular tasks (collaborative workspace)
14. Logout, login as ahmad (admin)
15. Navigate to /tasks
16. ✅ Verify Ahmad sees ALL tasks including approval tasks (admin view)
```

---

## 🔗 Backend Verification (No changes needed)

### Middleware Already Correct ✅

**File:** `services/internal/platform/middleware/rbac.go` (line 234)

```go
func RequireManager() gin.HandlerFunc {
	return func(c *gin.Context) {
		role := RoleFromCtx(c)
		hasSubordinate := HasSubordinateFromCtx(c)

		// Managers with role="manager" OR members with subordinates
		if role == RoleManager || hasSubordinate {
			c.Next()
			return
		}
		
		// Also check role-based team permissions
		if HasPermission(role, PermTeamRead) || ... {
			c.Next()
			return
		}

		c.AbortWithStatusJSON(http.StatusForbidden, ...)
	}
}
```

**Status:** ✅ Backend already respects `has_subordinate` flag. No changes needed.

---

### Service Layer Already Correct ✅

**Leave Service** (line 654): `ListRequests(role, managerEmployeeID)`
- If `managerEmployeeID` provided → filters to subordinates
- If admin role → returns all

**Claims Service** (line 316): `ListClaims(role, managerEmployeeID)`
- Same pattern as leave

**Status:** ✅ Backend service logic correct. Frontend just needs to pass correct permissions.

---

## 🚀 Next Sprint Plan (Sprint 14)

### Potential Features
1. **Bulk approval actions** — Approve all pending requests for employee in one click
2. **Task team filtering** — Add "My Team's Tasks" view for managers
3. **Notification preferences** — Let managers opt-in to email notifications
4. **Reports module** — Team attendance/leave/claims summaries
5. **Mobile optimizations** — PWA attendance check-in experience

### Technical Debt
- Add unit tests for `useHasSubordinate()` hook
- Add integration test: member with subordinates can approve requests
- Document permission model in ADR
- Update API documentation (OpenAPI spec)

---

## 📊 Metrics

- **Files changed:** ~9 files (5 frontend + 4 backend)
- **Lines added:** ~120 lines
- **Lines removed:** ~60 lines (refactoring)
- **Test cases:** 5 manual test scenarios
- **Affected modules:** Leave, Claims, Tasks, (Attendance already correct)
- **Bugs fixed:** 
  - ✅ Members with subordinates now see Approvals tab
  - ✅ Approval tasks now visible to requester (creator) + approver (assignee)
  - ✅ Regular tasks remain collaborative (visible to all org members)

---

## ✅ Progress Checklist

### Backend
- [x] ✅ `has_subordinate` column exists (Sprint 12)
- [x] ✅ JWT includes `has_sub` claim (Sprint 12)
- [x] ✅ Middleware helper `HasSubordinateFromCtx()` (Sprint 12)
- [x] ✅ `RequireManager()` checks flag (Sprint 12)
- [x] ✅ Service layer filters by `managerEmployeeID` (Sprint 12)
- [x] ✅ Tasks handler auto-filters to employee_id (Sprint 13)
- [x] ✅ Tasks SQL distinguishes regular vs approval tasks (Sprint 13)
- [x] ✅ CreateApprovalTask uses requesterEmployeeID as created_by (Sprint 13)
- [ ] Document permission model in ADR (optional)

### Frontend — Utilities
- [x] ✅ Extract `parseJwtHasSubordinate()` to `jwt.ts`
- [x] ✅ Add `useHasSubordinate()` hook to `useRole.ts`
- [x] ✅ Update `useAttendanceRole.ts` to use shared helper

### Frontend — Permission Hooks
- [x] ✅ Update `useCanManageLeave()` to check `has_subordinate`
- [x] ✅ Update `useCanManageClaims()` to check `has_subordinate`

### Frontend — UI Fixes
- [x] ✅ Claims default tab already correct (verifies `canManageClaims` in useEffect)
- [ ] Verify Leave tab visibility (auto-fixed by hook change)
- [ ] Verify Claims tab visibility (auto-fixed by hook change)

### Testing
- [ ] Test: Ricko (member + subordinate) sees Approvals tab
- [ ] Test: Jefry (member without subordinate) does NOT see Approvals tab
- [ ] Test: Ahmad (admin) sees all approvals
- [ ] Test: Claims default tab stays on "My Requests" for non-approvers
- [ ] Test: Tasks approval visibility (Ricko sees as creator, manager as assignee, Jefry doesn't see)
- [ ] Test: **Double-click date picker** — Click same day twice to create single-day leave
- [ ] Test: **Create request after cancel** — Cancel request, then create new request on same date

### New Issues Fixed (Sprint 13.5)
1. ✅ **Double-click date picker** — Fixed state timing issue preventing same-day click detection
2. ⚠️ **Create request after cancel** — Backend logic correct (needs testing to verify)

### Documentation
- [x] ✅ Update Sprint 13 progress
- [x] ✅ Document architecture decisions (Tasks, People modules)
- [ ] Add 1-paragraph summary to PROJECT_BRIEF.md when complete

---

## 🔗 References

- [Previous Sprint](./sprint12.md)
- [Project Brief](../WORKIVED_PROJECT_BRIEF.md)
- [Architecture Decisions](./adr/)
- Backend RBAC: `services/internal/platform/middleware/rbac.go`
- Frontend Permissions: `apps/web/src/lib/hooks/useRole.ts`
- Attendance Reference: `apps/web/src/lib/hooks/useAttendanceRole.ts` (correct implementation)

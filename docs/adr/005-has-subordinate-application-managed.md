# ADR-005: Application-Managed has_subordinate Flag (No Database Trigger)

**Status:** Accepted  
**Date:** 2026-03-22  
**Decision makers:** Product Owner, Software Architect  
**Sprint:** Sprint 12 — Attendance Dashboard Revamp

## Context

Workived needs to identify which organization members are managers (i.e., have direct reports) for permission-based features:
- **Attendance:** Managers can view team attendance
- **Leave:** Managers can approve subordinate leave requests
- **Claims:** Managers can approve subordinate expense claims
- **Tasks:** Managers can see subordinate tasks
- **Notifications:** Managers receive subordinate activity alerts

Previously, we checked `role = 'manager'` in the `organisation_members` table. This failed for employees who:
- Have role="member" but manage other employees (e.g., senior developers with junior reports)
- Have organizational responsibility without the "manager" title

We needed a flag to represent **"has direct reports"** independent of the role field.

## Decision

Add `has_subordinate` boolean column to `organisation_members` table and maintain it via **application code** in the Employee service.

**No database triggers.** Updates happen explicitly in three places:
1. `Employee.Create()` — When employee is created with `reporting_to`, set manager's flag
2. `Employee.Update()` — When `reporting_to` changes, update both old and new manager
3. `Employee.SoftDelete()` — When employee is deleted, recalculate manager's flag

## Rationale

### Why a separate flag vs role check?

**Problem with role-based check:**
```go
// ❌ WRONG: Excludes members with subordinates
if member.Role == "manager" {
  // Show pending approvals
}
```

This breaks in real-world org structures:
- **Tech companies:** Senior engineers manage junior engineers without "manager" title
- **Startups:** Individual contributors wear multiple hats
- **Matrix organizations:** Project leads manage teams without HR role change

**Solution:**
```go
// ✅ CORRECT: Checks actual reporting relationships
if member.HasSubordinate || member.Role == "manager" {
  // Show pending approvals
}
```

### Why application-managed vs database trigger?

#### Option A: Database Trigger (NOT CHOSEN)
```sql
CREATE TRIGGER update_has_subordinate
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH ROW
EXECUTE FUNCTION update_manager_subordinate_flag();
```

**Rejected because:**
- ❌ **Hard to test:** Requires database for unit tests
- ❌ **Invisible logic:** Developers don't see trigger in code review
- ❌ **Debugging difficulty:** Trigger fires implicitly, hard to trace
- ❌ **Migration risk:** Triggers can break schema changes
- ❌ **Violates "no business logic in DB" principle**

#### Option B: Application-Managed (CHOSEN)
```go
// Employee service explicitly updates flag
func (s *Service) Create(ctx, orgID, req) (*Employee, error) {
  // ... create employee
  
  // Update manager's flag if reporting_to is set
  if req.ReportingTo != nil {
    _ = s.orgRepo.UpdateManagerSubordinateFlag(ctx, orgID, *req.ReportingTo)
  }
  
  return employee, nil
}
```

**Chosen because:**
- ✅ **Explicit control flow:** Code review shows exactly when flag updates
- ✅ **Testable:** Can mock repository, verify flag update called
- ✅ **Debuggable:** Set breakpoint, see execution path
- ✅ **Maintainable:** All logic in one service file
- ✅ **Follows Go idioms:** Explicit over implicit

### Why include flag in JWT?

**Option A: Fetch from DB on each request**
```go
// ❌ Slow: Extra DB query per request
func GetPendingApprovals(c *gin.Context) {
  userID := middleware.UserIDFromCtx(c)
  hasSubordinates := orgRepo.CheckHasSubordinates(userID)  // DB query
  // ...
}
```

**Option B: Include in JWT claims (CHOSEN)**
```go
// ✅ Fast: No DB query, decode JWT
type Claims struct {
  UserID         uuid.UUID `json:"uid"`
  OrgID          uuid.UUID `json:"oid"`
  Role           string    `json:"role"`
  HasSubordinate bool      `json:"has_sub,omitempty"`  // NEW
}
```

**Rationale:**
- ✅ **Zero latency:** No DB roundtrip
- ✅ **Frontend can check:** Decode JWT to show/hide UI
- ✅ **Consistent with role:** Same pattern as existing `role` claim
- ✅ **Stateless auth:** No session dependency

**Trade-off accepted:**
- ⚠️ JWT becomes stale if subordinates added/removed without re-login
- **Mitigation:** Flag updates on next login (acceptable lag for permission UI)

## Implementation Details

### Database Schema

**Migration 063:**
```sql
ALTER TABLE organisation_members
ADD COLUMN has_subordinate BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_organisation_members_has_subordinate 
ON organisation_members(organisation_id, has_subordinate)
WHERE has_subordinate = true;

-- Backfill existing managers
UPDATE organisation_members om
SET has_subordinate = true
WHERE EXISTS (
  SELECT 1 FROM employees e
  WHERE e.reporting_to = om.employee_id AND e.is_active = true
);
```

### Application Code

**Repository method (centralizes flag logic):**
```go
// organisation/repository.go
func (r *Repository) UpdateManagerSubordinateFlag(ctx, orgID, managerEmployeeID) error {
  _, err := r.db.Exec(ctx, `
    UPDATE organisation_members
    SET has_subordinate = EXISTS (
      SELECT 1 FROM employees
      WHERE reporting_to = $2 AND is_active = true
    )
    WHERE organisation_id = $1 AND employee_id = $2
  `, orgID, managerEmployeeID)
  return err
}
```

**Three update points in Employee service:**

1. **Create:** New employee added with manager
```go
func (s *Service) Create(ctx, orgID, req) (*Employee, error) {
  // ... create employee record
  
  if req.ReportingTo != nil {
    _ = s.orgRepo.UpdateManagerSubordinateFlag(ctx, orgID, *req.ReportingTo)
  }
  
  return employee, nil
}
```

2. **Update:** Employee changes manager
```go
func (s *Service) Update(ctx, orgID, employeeID, req) (*Employee, error) {
  // Fetch old reporting_to
  oldEmployee, _ := s.repo.GetByID(ctx, orgID, employeeID)
  
  // ... update employee record
  
  // Update both old and new manager flags
  if oldEmployee.ReportingTo != nil {
    _ = s.orgRepo.UpdateManagerSubordinateFlag(ctx, orgID, *oldEmployee.ReportingTo)
  }
  if req.ReportingTo != nil {
    _ = s.orgRepo.UpdateManagerSubordinateFlag(ctx, orgID, *req.ReportingTo)
  }
  
  return employee, nil
}
```

3. **SoftDelete:** Employee removed
```go
func (s *Service) SoftDelete(ctx, orgID, employeeID) error {
  employee, _ := s.repo.GetByID(ctx, orgID, employeeID)
  
  // ... soft delete employee
  
  if employee.ReportingTo != nil {
    _ = s.orgRepo.UpdateManagerSubordinateFlag(ctx, orgID, *employee.ReportingTo)
  }
  
  return nil
}
```

### JWT Claims

**Auth service:**
```go
func (s *Service) IssueAccessToken(userID, orgID, role, hasSubordinate) (string, error) {
  claims := &Claims{
    UserID:         userID,
    OrgID:          orgID,
    Role:           role,
    HasSubordinate: hasSubordinate,  // NEW
    RegisteredClaims: jwt.RegisteredClaims{
      ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
    },
  }
  
  token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
  return token.SignedString([]byte(s.jwtSecret))
}
```

**Middleware:**
```go
func Auth(jwtSecret string) gin.HandlerFunc {
  return func(c *gin.Context) {
    // ... parse JWT
    
    c.Set("user_id", claims.UserID)
    c.Set("org_id", claims.OrgID)
    c.Set("role", claims.Role)
    c.Set("has_subordinate", claims.HasSubordinate)  // NEW
    c.Next()
  }
}

func HasSubordinateFromCtx(c *gin.Context) bool {
  v, _ := c.Get("has_subordinate")
  has, _ := v.(bool)
  return has
}
```

### Frontend Hook

**Shared permission hook:**
```typescript
// apps/web/src/lib/hooks/useManagerPermissions.ts
export function useManagerPermissions() {
  const role = useRole()
  const accessToken = useAuthStore((s) => s.accessToken)

  // Decode JWT to check has_subordinate
  let hasSubordinates = false
  if (accessToken) {
    const claims = decodeJWT(accessToken)
    hasSubordinates = claims?.has_sub === true
  }

  const isManager = hasSubordinates || role === 'manager'

  return {
    isManager,
    hasSubordinates,
    canApproveLeave: isManager,
    canApproveClaims: isManager,
    canViewTeamAttendance: isManager,
  }
}
```

## Alternatives Considered

| Approach | Verdict |
|----------|---------|
| **Database trigger** | Rejected — Hard to test, invisible logic, violates "no business logic in DB" |
| **Check role="manager"** | Rejected — Excludes members with subordinates |
| **Real-time subordinate count query** | Rejected — Too slow (DB query per request) |
| **Session/cache storage** | Rejected — Adds Redis dependency, complicates auth |
| **Computed field (no storage)** | Rejected — Still needs DB query per request |

## Consequences

### Positive ✅
- **Accurate permissions:** Reflects actual org structure, not just titles
- **Testable:** No database coupling in unit tests
- **Explicit:** Code review shows exactly when flag updates
- **Fast:** JWT decode, no DB queries
- **Consistent:** Same pattern as `role` claim
- **Future-proof:** Foundation for hierarchical approvals (manager → director → CEO)

### Negative ⚠️
- **Three update points:** Must maintain flag in Create/Update/SoftDelete
- **JWT staleness:** Flag updates don't reflect until re-login (acceptable for UX, not security)
- **Test debt:** Need to update mocks for new signature (Sprint 13 P0)

### Mitigation Strategies

**For update point maintenance:**
- ✅ Centralize logic in `UpdateManagerSubordinateFlag()` repository method
- ✅ Document in ADR (this file)
- ✅ Add integration tests for all three scenarios

**For JWT staleness:**
- ✅ Backend enforces actual permission (doesn't trust JWT alone)
- ✅ Frontend re-fetches on sensitive actions
- ✅ Acceptable: Worst case = user sees button, gets 403 on click

**For test debt:**
- ✅ Sprint 13 P0: Fix all test mocks
- ✅ Add unit tests for flag update logic
- ✅ Add integration tests for permission scenarios

## Security Considerations

**JWT is not the authority:**
```go
// ❌ WRONG: Trust JWT alone
func GetPendingApprovals(c *gin.Context) {
  hasSubordinates := middleware.HasSubordinateFromCtx(c)  // From JWT
  if !hasSubordinates {
    return c.JSON(403, ...)
  }
  // ... return all org approvals (SECURITY ISSUE)
}

// ✅ CORRECT: Verify actual subordinates
func GetPendingApprovals(c *gin.Context) {
  employeeID := getEmployeeID(c)
  subordinateIDs := empRepo.GetSubordinateIDs(employeeID)  // DB query
  
  if len(subordinateIDs) == 0 {
    return c.JSON(403, ...)
  }
  
  // Filter to only subordinate approvals
  approvals := service.GetApprovalsForEmployees(subordinateIDs)
  return c.JSON(200, approvals)
}
```

**Defense in depth:**
1. **JWT claim:** Fast frontend permission check (show/hide UI)
2. **Backend query:** Authoritative permission check (actual data filtering)
3. **Row-level filter:** Only return subordinate data, never org-wide

## Testing Strategy

**Unit tests:**
```go
// employee/service_test.go
func TestCreate_SetsManagerFlag(t *testing.T) {
  mockOrgRepo := &MockOrgRepo{}
  service := NewService(mockRepo, mockOrgRepo)
  
  req := CreateRequest{
    ReportingTo: &managerID,
  }
  
  service.Create(ctx, orgID, req)
  
  // Verify flag update was called
  assert.Called(t, mockOrgRepo.UpdateManagerSubordinateFlag, orgID, managerID)
}
```

**Integration tests:**
```go
// e2e/permission_test.go
func TestMemberWithSubordinates_CanSeeApprovals(t *testing.T) {
  // Ricko: role="member", has_subordinate=true
  // Jepri: role="member", reports to Ricko
  
  // Login as Ricko
  token := login(rickoEmail, rickoPassword)
  
  // GET /api/v1/leave/pending
  resp := apiCall(token, "GET", "/leave/pending")
  
  assert.Equal(t, 200, resp.StatusCode)
  assert.Contains(t, resp.Body, "Jepri")  // Sees subordinate's request
  assert.NotContains(t, resp.Body, "Ahmad")  // Doesn't see unrelated request
}
```

## Related Decisions

- **Sprint 13:** Extend has_subordinate to Leave, Claims, Tasks, Notifications modules
- **Future:** Multi-level approval chains (manager → director → CEO) will build on this flag
- **Future:** Delegation (temporary manager assignment) will use same mechanism

## References

- [Sprint 12 Documentation](../sprint12.md) — Implementation details
- [Migration 063](../../migrations/000063_add_has_subordinate_to_members.up.sql) — Database schema
- [Employee Service](../../services/internal/employee/service.go) — Update logic
- [Organisation Repository](../../services/internal/organisation/repository.go) — Flag update method
- [Auth Middleware](../../services/internal/platform/middleware/auth.go) — JWT handling

---

**Last updated:** 2026-03-22  
**Related ADRs:** None  
**Status:** Accepted and implemented in Sprint 12

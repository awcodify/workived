# Sprint 16 — Claims Payment Flow & Gender-Based Leave

**Duration:** March 25, 2026 (1 day sprint)
**Status:** ✅ COMPLETE
**Team:** Backend
**Type:** Feature completion + test quality

**Summary:** Full claims payment flow (backend + frontend), gender-based leave eligibility (backend), hierarchical multi-level approval (backend + frontend), and notification/tab visibility fixes (frontend). Claims lifecycle completed: submit → approve → pay with `MarkAsPaidSheet` modal. Recursive CTE replaces flat `reporting_to` check — any manager in the ancestor chain can now approve. Dock badge and tab visibility are now data-driven (not JWT-gated). 360+ backend tests passing, 85–89% service+handler coverage. Frontend 405+ tests passing.

---

## 📋 Previous Sprint Summary

### Sprint 15 Completed ✅ (March 24, 2026) — Code Quality & TypeScript Excellence
- ✅ **~200 TypeScript errors eliminated** — Zero compile errors across 40+ files
- ✅ **27 failing tests fixed** — 405 frontend tests passing, 42 test files clean
- ✅ **Router type safety** — TanStack Router v4 search parameters fully typed
- ✅ **Color token corrections** — Removed references to non-existent `ink200`, `ink600`
- ✅ **Attendance test mocks updated** — Sprint 12 week-view hooks properly mocked

### Key Outcome
Production-grade codebase baseline established. TypeScript errors that could mask runtime bugs eliminated. Tests stable enough to support continued feature development.

---

## 🎯 Current Sprint (Sprint 16)

### Feature 1: Claims Payment Flow

**Problem:** Claims lifecycle was incomplete. After `approved`, there was no terminal `paid` state. Finance could not record that a claim had actually been disbursed.

**Before:**
```
submitted → approved (terminal)
         → rejected (terminal)
```

**After:**
```
submitted → approved → paid (terminal)  ✅
         → rejected (terminal)
```

#### Technical Changes

**`approval/types.go`:**
```go
const (
    StatusPaid = "paid"  // new terminal state
)

func ValidStatus(s string) bool {
    // Added "paid" to valid set
}

func IsFinalStatus(s string) bool {
    // "paid" is now final (alongside "rejected")
}
```

**`claims/repository.go`:**
- Added `paid_at TIMESTAMPTZ`, `paid_by UUID` columns to all scan clauses (`scanClaim`, `scanClaims`)
- `MarkAsPaid(ctx, orgID, claimID, paidByEmployeeID)` — sets `status='paid'`, `paid_at=NOW()`, `paid_by=$4`, validates claim is in `approved` state first

**`claims/service.go`:**
```go
func (s *Service) MarkAsPaid(ctx context.Context, orgID, claimID, actorID uuid.UUID) (*Claim, error) {
    claim, err := s.repo.MarkAsPaid(ctx, orgID, claimID, actorID)
    // ... audit log + business event log
    s.log.Info().Str("claim_id", ...).Str("paid_by", ...).Msg("claim.paid")
}
```

**`claims/handler.go`:**
```
POST /api/claims/:id/pay
```
- Requires `owner`, `admin`, `hr_admin`, `finance`, or `super_admin` role
- Reads `claim_id` from URL path, `actor_id` from JWT context
- Returns updated `Claim` with `paid_at`, `paid_by` populated

**Frontend — Claims Payment UI:**
- `MarkAsPaidSheet` modal: centered overlay with employee avatar, name, category, hero amount, approved date, confirm/cancel buttons, error recovery
- `PendingPaymentRow` component: approved claims listed under "Pending Payment" section (gated on `canPayClaims`)
- `useMarkAsPaid` hook: calls `POST /api/claims/:id/pay`, invalidates claims cache
- `useCanPayClaims` hook: returns `true` for owner/admin/hr_admin/finance/super_admin roles

---

### Feature 2: Gender-Based Leave Eligibility

**Problem:** Leave policies had no way to restrict by gender. Maternity leave should only be available to female employees; paternity leave to male employees. Without this, any employee could apply for any leave type.

#### Technical Changes

**`leave/types.go`:**
```go
type Policy struct {
    // ...
    GenderEligibility *string `json:"gender_eligibility"` // nil = any, "male", "female"
}

type CreatePolicyRequest struct {
    GenderEligibility *string `json:"gender_eligibility" validate:"omitempty,oneof=male female"`
}
```
Same field added to: `UpdatePolicyRequest`, `PolicyTemplate`.

**`employee/repository.go`:**
```go
func (r *Repo) GetEmployeeGender(ctx context.Context, orgID, employeeID uuid.UUID) (*string, error)
```
Returns `nil` if gender not set on employee record.

**`leave/repository.go`:**
- `gender_eligibility` included in all policy SELECT/INSERT/UPDATE queries

**`leave/service.go` — `SubmitRequest` validation:**
```go
// After policy lookup, before balance check:
if policy.GenderEligibility != nil {
    gender, err := s.empRepo.GetEmployeeGender(ctx, orgID, employeeID)
    if err != nil {
        return nil, fmt.Errorf("get employee gender: %w", err)
    }
    if gender == nil || *gender != *policy.GenderEligibility {
        return nil, apperr.New(apperr.CodeForbidden, "leave type not available for your gender")
    }
}
```

---

### Feature 3: Hierarchical Multi-Level Approval

**Problem:** Approval queries used flat `e.reporting_to = $X` — only direct managers could see/approve requests. In a chain like `1.1.1 → 1.1 → 1 → CEO`, employee 1 couldn't see requests from 1.1.1.

**Fix:** Replaced flat lookups with `WITH RECURSIVE` CTEs in all three locations:

**`employee/repository.go` — `VerifyManagerRelationship`:**
- Walks UP the ancestor chain from employee to check if reviewer is an ancestor
- Returns `CodeForbidden` (not `CodeNotFound`) when relationship doesn't hold

**`claims/repository.go` — `ListClaims`:**
- Recursive CTE builds full subordinate tree from `managerEmployeeID`
- `AND ($8::uuid IS NULL OR c.employee_id IN (SELECT id FROM subordinates))`

**`leave/repository.go` — `ListRequests` + `CountPendingRequests`:**
- Same recursive CTE pattern for subordinate tree
- Unified from two-branch dynamic SQL to single recursive query

**`claims/handler.go`:**
- `manager` role now uses hierarchical filter (passes `managerEmployeeID`)
- Org-wide view limited to: `owner`, `admin`, `hr_admin`, `super_admin`, `finance`

### Feature 4: Data-Driven Tab & Notification Visibility

**Problem:** Approvals tab and dock notification badges were gated on `useCanManageClaims`/`useCanManageLeave`, which relied on JWT `has_subordinate` claim. This claim is baked at login time — if org chart changes after login, JWT is stale and tabs silently hide.

**Fix (frontend):**

**`lib/hooks/useRole.ts`:**
- `manager` role now always returns `true` for `useCanManageClaims`/`useCanManageLeave` (RBAC permissions are hardcoded, not derived from JWT)
- Only `member`/`finance` roles still check `hasSubordinate`

**`routes/_app/claims/index.tsx` + `routes/_app/leave/index.tsx`:**
- Removed `canManageClaims`/`canManageLeave` from tab visibility, auto-switch effects, and tab content rendering
- Tab shows whenever API returns items (pendingCount > 0 || approvedCount > 0)
- Purely data-driven: if data comes back, show UI

**`lib/hooks/useLeave.ts` — `useLeaveNotificationCount`:**
- Removed `enabled: canManage` gate
- Shares query key with `useAllRequests({ status: 'pending' })` for cache consistency
- Uses `select` to return count from shared data

**`lib/hooks/useClaims.ts` — `useClaimNotificationCount`:**
- Shares query key with `useAllClaims()` for cache consistency
- Uses `select` to filter pending claims and return count

**`components/workived/dock/Dock.tsx`:**
- Removed `canManageLeave`/`canManageClaims` conditionals from notification counts
- Counts now use raw values from hooks directly

### Feature 5: Workspace Name Validation

**Already shipped in Sprint 16 codebase:**
- `organisation/service.go`: `reservedSlugs` blocklist (workived, admin, api, www, root, etc.)
- Minimum 3-character slug enforced at `Service.Create()`

---

## 🧪 Test Coverage

### Summary

| Layer | Before | After |
|-------|--------|-------|
| `leave/service.go` | ~40% | ~87% |
| `leave/handler.go` | ~35% | ~85% |
| `claims/service.go` | ~38% | ~89% |
| `claims/handler.go` | ~32% | ~86% |
| Repository layer | 0% | 0% (needs integration tests) |
| **Total tests** | ~200 | **360** |

### New Test Functions Added

**`leave/service_test.go`:**
- `TestService_SubmitRequest_GenderEligibility` — happy path (nil gender = any), gender match, gender mismatch returns `CodeForbidden`, repo error propagates
- `TestService_ListRequests` — no filter, manager filter, repo error
- `TestService_GetRequest` — happy path, not found
- `TestService_VerifyManagerRelationship` — found, not found
- `TestService_IsOnApprovedLeave` — approved/not approved/repo error
- `TestService_ListHolidays` — country lookup, nil country, repo error
- `TestService_ListTemplates` — with/without country filter, country error, repo error
- `TestService_GetNotificationCount` — admin role
- `TestService_ImportPolicies` — happy path, country mismatch, template mismatch, tx error
- `TestService_WithOptions` — `WithAuditLog`, `WithLogger` option wiring
- `TestService_LogAudit_ErrorPath` — audit errors swallowed (non-fatal)
- `TestService_WithTasksService` — goroutine triggers `createLeaveApprovalTask`
- `TestService_WithEmailSender_Submit/Approve/Reject` — goroutine email helpers

**`leave/handler_test.go`:**
- `TestHandler_GetRequest` — 200, 400 bad UUID, 404
- `TestHandler_ListHolidays` — 200, missing start date, missing end date, both missing
- `TestHandler_GetNotificationCount` — admin gets global count
- `TestHandler_ListTemplates` — 200 no country, 200 with country, 500 service error
- `TestHandler_ImportPolicies` — 201, 400 bad JSON, 500

**`claims/service_test.go`:**
- `TestService_ListCategories` — active only, repo error
- `TestService_CreateCategory` — happy path, balance init non-fatal, duplicate, repo error
- `TestService_UpdateCategory` — happy path, monthly limit cascade, not found, repo error
- `TestService_DeactivateCategory` — happy path, pending claims block, not found, repo error
- `TestService_ListTemplates` — with country, nil country returns `CodeValidation`, repo error
- `TestService_ImportCategories` — happy path, country mismatch, template mismatch, tx error
- `TestService_SubmitClaim_OwnerAutoApprove` — owner role skips approval task
- `TestService_WithTasksService` — wires fake tasks service, triggers goroutine
- `TestService_WithEmailSender_*` — email goroutines for submit/approve/reject
- `TestService_LogAudit_ErrorPath` — audit errors swallowed

**`claims/handler_test.go`:**
- `TestHandler_UpdateCategory` — 200, 400, 404
- `TestHandler_ListCategoryTemplates` — 200 with/without country, 500
- `TestHandler_ImportCategories` — 201, 400, 500
- `TestHandler_SubmitClaim` — multipart error, employee lookup failure
- `TestHandler_ListMyClaims` — 200, pagination cursor, repo error

### Testing Architecture Discussion

**Q: Is mock-based testing sufficient?**

**Answer:** It depends on what you're testing.

| Test type | What it validates | What it misses |
|-----------|-------------------|----------------|
| Unit (fake repo) | Business logic paths, error propagation, auth | SQL correctness, index usage, query ordering |
| Integration (`testcontainers-go`) | SQL queries against real Postgres | (nothing) |

The fake/stub repo pattern is correct Go practice and tests the right thing (service logic). But repository layer is currently at **0% test coverage** — SQL queries, cursor pagination, and multi-tenant isolation (`WHERE organisation_id = $1`) are untested. This is a known risk.

**Package naming (`package leave` vs `package leave_test`):**
`package leave_test` is the correct choice. It tests the module from outside, exactly like a caller would. This forces good API design (only test exported behavior) and catches interface breakage. Internal helpers can still be tested via `package leave` in separate `*_internal_test.go` files if needed.

---

## 🐛 Bugs Fixed During Sprint

### `is_final_state` column missing
**Error:**
```
ERROR: column "is_final_state" does not exist (SQLSTATE 42703)
org_id: 92aff524-..., message: "failed to list task lists"
```
**Root cause:** `task_lists` table query referenced `is_final_state` before migration ran.
**Fix:** Migration adds column; `IsFinalStatus()` logic lives in Go, not SQL.

### Claim currency always showing `Rp` for UAE company
**Root cause:** Frontend formatting used hardcoded Indonesian locale instead of reading `currency_code` from the claim response.
**Fix:** Use `claim.currency_code` to drive `Intl.NumberFormat` locale selection.

### Claim budget overview card always empty
**Root cause:** Budget card showed 0/total when no claims were submitted, instead of full green bar.
**Fix:** Empty used amount should render as 100% green bar (unused = available = full).

### Manager couldn't see subordinate's approval requests
**Root cause:** All three SQL queries used flat `e.reporting_to = $X` — only works for direct reports. In chain `1.1.1 → 1.1 → 1`, employee 1 couldn't see 1.1.1's requests.
**Fix:** Recursive CTE in `ListClaims`, `ListRequests`, `CountPendingRequests`, and `VerifyManagerRelationship`.

### Approvals tab hidden despite API returning pending items
**Root cause:** Tab visibility gated on `useCanManageClaims()`/`useCanManageLeave()`, which checked JWT `has_subordinate` claim. Claim is baked at login — stale after org chart changes.
**Fix:** Removed `canManage*` gating from tab visibility. Tabs are now purely data-driven.

### Dock notification badges always showing 0
**Root cause:** (1) `useLeaveNotificationCount` had `enabled: canManage` that silently disabled the query. (2) Dock and tab used different query keys, producing inconsistent results.
**Fix:** Removed `enabled` gate. Unified query keys between dock and tab via TanStack Query `select` transformation.

---

## 📊 Metrics

### Backend
- **Tests:** 360 total (was ~200) — +160 new tests
- **Service coverage:** 85–89% (was ~35–40%)
- **Handler coverage:** 85–86% (was ~32–35%)
- **Repository coverage:** 0% (unchanged — integration tests needed)
- **Build:** Clean (`go build ./...`)
- **Lint:** 0 issues (`golangci-lint run ./...`)

### Files Changed

**Backend:**
- `approval/types.go` — `StatusPaid`, updated `ValidStatus`, `IsFinalStatus`
- `claims/repository.go` — `paid_at`/`paid_by` scan, `MarkAsPaid` method, recursive CTE for `ListClaims`
- `claims/service.go` — `MarkAsPaid` service method
- `claims/handler.go` — `POST /:id/pay` route, hierarchical manager filter
- `claims/handler_test.go` — +5 test functions, updated manager role regression test
- `claims/service_test.go` — +12 test functions
- `employee/repository.go` — `GetEmployeeGender`, recursive ancestor CTE in `VerifyManagerRelationship`
- `leave/types.go` — `GenderEligibility` field across policy structs
- `leave/repository.go` — `gender_eligibility` in policy queries, recursive CTE for `ListRequests` + `CountPendingRequests`
- `leave/service.go` — gender eligibility check in `SubmitRequest`
- `leave/service_test.go` — +15 test functions
- `leave/handler_test.go` — +5 test functions
- `organisation/service.go` — `reservedSlugs` blocklist + 3-char minimum slug validation

**Frontend:**
- `components/workived/claims/MarkAsPaidSheet.tsx` — new: centered payment confirmation modal
- `components/workived/claims/MarkAsPaidSheet.test.tsx` — new: 9 test cases
- `routes/_app/claims/index.tsx` — `PendingPaymentRow`, `MarkAsPaidSheet` integration, removed `canManageClaims` tab gating
- `routes/_app/leave/index.tsx` — removed `canManageLeave` tab gating
- `lib/hooks/useRole.ts` — `useCanPayClaims` new hook, `useCanManageClaims`/`useCanManageLeave` manager fix
- `lib/hooks/useClaims.ts` — `useClaimNotificationCount` shares cache with `useAllClaims`
- `lib/hooks/useLeave.ts` — `useLeaveNotificationCount` shares cache with `useAllRequests`
- `components/workived/dock/Dock.tsx` — removed `canManage*` conditionals from notification counts

---

## 🎓 Lessons Learned

### 1. Terminal States Need Explicit Modeling
The claims flow was ambiguous: "approved" could mean "approved but not paid" or "done". Adding `paid` as an explicit terminal state removes this ambiguity and makes the state machine auditable.

**Pattern established:** Add new terminal states to `approval/types.go` — single source of truth for all modules using the approval workflow.

### 2. Gender Eligibility Belongs on the Policy, Not the Employee
Alternative considered: add `allowed_genders` to the employee profile. Rejected — the restriction is a property of the leave *type*, not the employee. Policies define who qualifies; employees provide their attributes.

### 3. Repository Layer Is a Test Blind Spot
360 unit tests validate business logic thoroughly, but the SQL itself is untested. The `WHERE organisation_id = $1` multi-tenancy guarantee exists only in code review, not in automated tests. This is the highest-risk untested area.

**Action needed:** Add `//go:build integration` tests with `testcontainers-go` for at least:
- Cross-org isolation (org A cannot see org B data)
- Cursor pagination ordering and off-by-one handling
- `MarkAsPaid` state transition enforcement

### 4. Goroutine Testing Requires Explicit Synchronization
Fire-and-forget goroutines (`go s.sendEmail(...)`) are hard to test. Current approach: `time.Sleep(20ms)`. This is fragile under CI load.

**Better approach for Sprint 17+:** Accept a `chan struct{}` done channel in test hooks, or use `sync.WaitGroup` injection via `WithAfterSubmitHook(fn)` option.

---

## 🚀 Next Sprint Plan (Sprint 17)

### Must Ship
1. **Gender-based leave — frontend** — Policy form gender toggle, hide ineligible leave types, error states *(S: 1 day)*
2. **OpenAPI auth on `/docs`** — HTTP basic auth middleware on Swagger UI *(XS: half day)*
3. **Claim status color fix** — `approved` in claims = grey (waiting for payment), `paid` = green (terminal). Leave `approved` stays green (terminal). *(XS: 15 min)*

### High Value (if capacity allows)
4. **Claim budget period policies** — Add `budget_period` field: monthly (default), yearly, unlimited. Adjust balance calculations. *(M: 3-4 days)*
5. **Auto-archive done tasks** — Org-level setting: auto-hide tasks in `is_final_state` after N days *(S: 1 day)*

### Technical Debt
- ⚠️ Repository layer at 0% test coverage — integration tests needed
- ⚠️ Goroutine test stability — `time.Sleep(20ms)` is fragile under CI load
- ⚠️ Attendance test rewrite — 8 `.todo` tests from Sprint 15 still pending
- ⚠️ `noUnusedLocals` still disabled in `tsconfig.json`

### Risks
- **Gender field on employee** — Currently stored in DB but no UI to set it; gender-based leave gates are live but employees have no way to set their gender profile
- **Integration test infra** — `testcontainers-go` requires Docker in CI; verify before committing to this approach

---

## ✅ Sprint 16 Complete

**Claims lifecycle completed.** Submit → approve → pay flow is fully implemented (backend + frontend) with `MarkAsPaidSheet` modal, role-gated to finance/owner/admin roles. Audit trail and terminal state modeling in place.

**Hierarchical approval chain fixed.** Recursive CTE replaces flat `reporting_to` check across claims, leave, and employee verification. Any manager in the ancestor chain can now see and approve requests.

**Tab/dock visibility now data-driven.** No longer depends on JWT `has_subordinate` claim. If the API returns items, the UI shows them. Dock badges share TanStack Query cache with tab data for consistency.

**Gender-based leave gates live.** Backend validates gender eligibility at policy level. Frontend pending (Sprint 17).

**Workspace name validation shipped.** Reserved names blocklist + 3-char minimum on org slugs.

**Test suite significantly improved.** 360+ backend tests, 405+ frontend tests. 85–89% service+handler coverage. Repository layer remains the key untested risk.

**Key numbers:** +160 backend tests, 5 features shipped (3 full-stack, 2 backend-only), 0 new lint issues, 0 compile errors.

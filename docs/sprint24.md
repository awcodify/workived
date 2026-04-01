# Sprint 24 — Bug-Fix Sprint (QA Feedback)

**Duration:** March 31–April 4, 2026
**Status:** IN PROGRESS
**Theme:** Fix critical bugs from QA testing before v1.0 launch
**Type:** Bug-fix sprint

**Why bug-fix sprint:** Ricko (QA) found 6 new bugs + bounced back 6 regressions from previous sprints. 12 total items to clear the board before v1.0. Unblocks QA automation (WOR-70 next sprint).

---

## Previous Sprint Summary

### Sprint 23 Completed (March 27-31, 2026)
- WOR-58: Fix task modal z-index above dock
- WOR-62: Filter attendance by employee start date
- WOR-63: Show pending invitation status on People page
- WOR-64: Show unlimited leave as infinity instead of 365
- WOR-64: Add unlimited leave policy creation + template support
- WOR-60: Integrate Resend email API as primary sender + welcome email on registration

---

## Current Sprint (Sprint 24)

### Task 1: WOR-67 — Holiday multi-tenancy leak | S

**Priority:** P1 Urgent | **Type:** Security bug
**Problem:** Custom holidays leak across organisations in the same country. Leave module `ListHolidays` doesn't filter by `organisation_id`.

**Plan:**
- [ ] `leave/repository.go` — add `orgID` param to `ListHolidays()`, update SQL to match calendar module pattern
- [ ] `leave/service.go` — pass `orgID` through `calculateBusinessDays()`
- [ ] Add cross-org isolation test
- [ ] Commit + move to In Review

---

### Task 2: WOR-69 — Can't create leave policy | S

**Priority:** P1 Urgent | **Type:** Validation bug
**Problem:** `DaysPerYear` has `required` validation tag — fails when `is_unlimited=true` and days_per_year is 0/omitted.

**Plan:**
- [ ] `leave/types.go` — remove `required` from `DaysPerYear` validation
- [ ] `leave/service.go` — if `IsUnlimited=true`, force `DaysPerYear=365`
- [ ] Add test for unlimited policy creation
- [ ] Commit + move to In Review

---

### Task 3: WOR-68 — New employee has no leave balance | M

**Priority:** P1 Urgent | **Type:** Missing logic
**Problem:** `AcceptInvitation` creates org member but never creates leave balance rows. New employees see empty leave page.
**Depends on:** WOR-69 (leave policy creation must work)

**Plan:**
- [ ] `leave/service.go` — add `AssignDefaultPolicies(ctx, orgID, employeeID)`
- [ ] `leave/repository.go` — add `BulkCreateBalances()` with ON CONFLICT DO NOTHING
- [ ] `organisation/service.go` — inject leave service, call after invitation acceptance
- [ ] `main.go` — wire leave service into org service
- [ ] Add test for balance creation on invite accept
- [ ] Commit + move to In Review

---

### Task 4: WOR-72 — Setup review missing work schedule | S

**Priority:** P2 High | **Type:** Frontend bug
**Problem:** Review/preview step in org setup wizard doesn't show work schedule info.

**Plan:**
- [ ] Trace data flow: work schedule step → wizard state → PreviewStep.tsx
- [ ] Fix missing state propagation
- [ ] Verify preview renders schedule name, work days, hours
- [ ] Commit + move to In Review

---

### Task 5: WOR-73 — UAE parental leave rules wrong | S

**Priority:** P3 Medium | **Type:** Data bug
**Problem:** Seed data has UAE "Parental Leave" as 5 days for all genders. UAE law: Mother 45+15 days, Father 5 days.

**Plan:**
- [ ] `scripts/seed_templates.sql` — split into Maternity Leave (60d, female) + Paternity Leave (5d, male)
- [ ] Migration to update existing orgs with old template
- [ ] Note: half-pay tracking out of scope (description only)
- [ ] Commit + move to In Review

---

### Task 6: WOR-71 — Generic error on add employee | S

**Priority:** P3 Medium | **Type:** UX bug
**Problem:** Backend returns same error for all unique violations. Frontend shows "Something went wrong" instead of specific message.

**Plan:**
- [ ] `employee/repository.go` — parse PG constraint name, return specific message with employee name
- [ ] Frontend — display API error message instead of hardcoded text
- [ ] Add frontend validation for required email
- [ ] Commit + move to In Review

---

---

## Regressions (bounced back by QA)

### Task 7: WOR-11 — Employment type policy eligibility not filtering | S

**Priority:** P1 Urgent | **Type:** Regression
**QA feedback:** "Intern gets same leave as full-time" — employment type filtering not applied on balance creation.

**Plan:**
- [ ] Verify `CreateBalancesForAllEmployees` filters by `eligible_employment_types`
- [ ] Check balance creation on setup/import also respects eligibility
- [ ] Test: create intern → verify only intern-eligible policies get balances
- [ ] Commit + move to In Review

---

### Task 8: WOR-20 — Pro feature gating (no upgrade UI) | S

**Priority:** P1 Urgent | **Type:** Incomplete
**QA feedback:** Backend returns `UPGRADE_REQUIRED` (402) correctly but frontend shows generic error. No upgrade modal.

**Plan:**
- [ ] Add global 402 response interceptor in API client
- [ ] Build upgrade modal (plan name, limits hit, upgrade CTA)
- [ ] Add Employee form — show specific API error instead of generic text
- [ ] Commit + move to In Review

---

### Task 9: WOR-18 — Task board filtering not visible | S

**Priority:** P1 Urgent | **Type:** Incomplete
**QA feedback:** "Not yet implemented" — Tasks vs Approvals toggle not visible.

**Plan:**
- [ ] Check if TaskFilters.tsx is mounted on the board route
- [ ] Verify Tasks vs Approvals toggle exists (we built search/assignee/priority but maybe not type toggle)
- [ ] Add toggle if missing, fix mount if present
- [ ] Commit + move to In Review

---

### Task 10: WOR-17 — Changelog missing Known Issues | S

**Priority:** P2 High | **Type:** Incomplete
**QA feedback:** Changelog page works but missing Known Issues board + API endpoints.

**Plan:**
- [ ] Create `data/known-issues.ts` (static, matching changelog pattern)
- [ ] Add Known Issues page route
- [ ] Add "Known Issues" item to help/settings menu
- [ ] Skip API endpoints (overkill pre-launch, static TS is fine)
- [ ] Commit + move to In Review

---

### Task 11: WOR-55 — Task Done count still 0 | S

**Priority:** P3 Medium | **Type:** Regression
**QA feedback:** Done count shows 0 with 2 done tasks. Previous fix (is_final_state + migration 000041) didn't resolve.

**Plan:**
- [ ] Re-investigate frontend task statistics counting logic
- [ ] Check if `completed_at` is set correctly after migration
- [ ] Check if frontend caching stale data after task move
- [ ] Commit + move to In Review

---

### Task 12: WOR-56 — Attendance present count still 0 | S

**Priority:** P3 Medium | **Type:** Regression
**QA feedback:** Present not calculating after clock-in. Previous fix (on-time vs present string) didn't resolve.

**Plan:**
- [ ] Re-investigate API response status strings after clock-in
- [ ] Check all status variants in frontend statistics function
- [ ] Check timezone — clock-in recorded but date mismatch possible
- [ ] Commit + move to In Review

---

## Execution Order

```
Batch 1 — Security + Critical fixes (no deps):
  WOR-67  holiday multi-tenancy leak
  WOR-69  leave policy validation
  WOR-73  UAE parental leave seed data
  WOR-55  task done count
  WOR-56  attendance present count

Batch 2 — After WOR-69:
  WOR-68  leave balance on invite accept
  WOR-11  employment type filtering

Batch 3 — Frontend fixes (parallel):
  WOR-72  setup review work schedule
  WOR-71  employee error messages
  WOR-20  upgrade modal
  WOR-18  task board filtering
  WOR-17  known issues page
```

---

## Next Sprint (Sprint 25) Preview
- WOR-70: Add data-testid for QA automation (L)
- WOR-66: Separate admin users from org members (M)

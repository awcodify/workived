# Sprint 5 — Leave Management (Frontend)

**Duration:** ~1 week (dates not tracked)  
**Status:** ✅ COMPLETE  
**Team:** Full stack (primarily frontend)

---

## 📋 Previous Sprint Summary

### Sprint 4 Completed
- ✅ Leave policy configuration (CRUD API)
- ✅ Leave balance initialization and management
- ✅ Leave request flow (submit → approve/reject/cancel)
- ✅ Leave calendar API
- ✅ Year-end rollover job (CLI tool)
- ✅ All leave endpoints wired to `/api/v1/leave/*`

### Key Outcomes
- Complete leave backend functional
- 13 API endpoints for leave management
- Automatic balance initialization
- Smart validation (excludes weekends + holidays)
- Year-end rollover automation

---

## 🎯 Sprint 5 Goals

### Goals
1. ✅ Build leave request submission UI
2. ✅ Create leave balance dashboard
3. ✅ Implement leave approval flow
4. ✅ Build leave calendar with public holidays
5. ✅ Add interactive calendar tooltips
6. ✅ Achieve comprehensive test coverage

### Features Completed

#### 1. ✅ Leave Request Pages
**Scope:**
- Submit leave request form
- View my leave requests (history)
- View pending approvals (manager view)
- Approve/reject modal

**Submit Leave Form:**
- Date range picker (start date → end date)
- Leave policy selector dropdown
- Reason textarea
- Real-time balance check ("You have 12 days remaining")
- Validation: Prevent overlapping requests, insufficient balance
- Auto-exclude weekends and holidays from calculation

**My Requests Page:**
- List all my leave requests (past + future)
- Status badges: Pending, Approved, Rejected, Cancelled
- Action: Cancel pending requests (if before start date)
- Filter by status, date range

**Approval Flow:**
- Manager view: List all pending requests from team
- Approval modal:
  - Employee name, dates, policy type, reason
  - Approve/Reject buttons
  - Optional rejection reason
- Notifications on approval/rejection

**Routes:**
- `/leave` — Submit form
- `/leave/requests` — My requests
- `/leave/approvals` — Pending approvals (manager)

#### 2. ✅ Leave Balance Dashboard
**Scope:**
- Show all leave balances for current year
- Visual progress bars (available vs used)
- Card-based layout with policy type icons
- Responsive grid (mobile-friendly)

**Balance Card Components:**
- Policy name (Annual Leave, Sick Leave, etc.)
- Progress bar:
  - Green: Available days
  - Gray: Used days
  - Yellow striped: Pending days
- Numbers: "8 of 12 days available"
- Infinity icon (∞) for unlimited policies

**Technical Implementation:**
- TanStack Query: `useQuery` for fetching balances
- Auto-refresh on leave request submission
- Loading skeletons while fetching

**Route:** `/leave/balances`

#### 3. ✅ Leave Policy Management (Admin)
**Scope:**
- List all leave policies
- Create new policy form
- Edit existing policy
- Deactivate policy (soft delete)

**Create/Edit Form Fields:**
- Policy name (e.g., "Annual Leave")
- Policy type (dropdown: Annual, Sick, Maternity, etc.)
- Days per year (number input)
- Carry-over days (how many days can roll to next year)
- Requires approval (checkbox)
- Minimum tenure days (e.g., eligible after 365 days)

**Validation:**
- Can't deactivate policy with pending requests (data integrity)
- Can't create duplicate policy names

**Route:** `/leave/policies`

#### 4. ✅ Leave Calendar with Public Holidays
**Scope:**
- Monthly calendar view
- Show all approved leave requests
- Integrate public holidays
- Color-coded: Holidays (red), Leave (purple)
- Interactive tooltips on click

**Calendar Features:**
- Month navigation (previous/next month)
- Current month highlight
- Weekend styling (lighter background)
- Holiday tint (red background)
- Leave entries (employee name badges)

**Public Holidays API:**
- Endpoint: `GET /api/v1/leave/holidays?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- Returns holidays for org's country (Indonesia, UAE, Malaysia, Singapore)
- Supports multiple holidays per date (e.g., overlapping religious holidays)

**Visual Indicators:**
- Red tint for holidays
- Holiday name badges at top of date cell
- Leave entries show: Employee name, policy type
- Multiple employees on same date stacked vertically

#### 5. ✅ Interactive Calendar Tooltips
**Scope:**
- Click any date cell to see detailed info
- Modal shows:
  - Full date
  - All public holidays with country flag
  - All employees on leave with policy type
- Close modal by clicking outside or X button

**Tooltip Content:**
```
📅 March 15, 2026

🏖️ Holidays:
- Nyepi (Indonesia)

👥 On Leave:
- Ahmad Rizki (Annual Leave)
- Sarah Chen (Sick Leave)
```

**Technical Implementation:**
- Modal component from shadcn/ui
- Click handler on date cell
- Filter leave entries by date
- Show "No holidays or leave" if empty

**Route:** `/leave/calendar` (later promoted to `/calendar` in Sprint 8.0)

---

## 🧪 Testing

**Test Coverage:** 77 tests passing across all leave components

**Test Files:**
- `LeaveRequestForm.test.tsx` — Form validation, submission
- `LeaveBalances.test.tsx` — Balance display, calculations
- `LeaveApproval.test.tsx` — Approval modal, status updates
- `LeaveCalendar.test.tsx` — Calendar rendering, holiday display
- `useLeave.test.tsx` — React Query hooks

**E2E Flow Validated:**
1. Submit leave request → Pending status
2. Manager approves → Status changes to Approved
3. Calendar displays approved leave
4. Balance updated (pending → used)

---

## 🚀 Next Sprint Plan (Sprint 5.5)

### Proposed Features
1. **Leave Policy Templates** — One-click import of country-specific policies
   - Effort: 2 days backend, 2 days frontend
   - Templates for ID, UAE, MY, SG
   
2. **UI Polish** — Redesigned balance cards, progress bars
   - Effort: 1 day

---

## 📊 Final Metrics

- **Frontend tests:** 77 passing ✅
- **Components created:** 12 (forms, modals, cards, calendar)
- **Routes added:** 4 (`/leave`, `/leave/requests`, `/leave/approvals`, `/leave/calendar`)
- **API integration:** 14 endpoints consumed
- **Lines of code:** ~2,000 frontend (estimated)

---

## 🎉 Sprint Highlights

1. **Complete Leave Flow:** Submit → Approve → Calendar display (end-to-end)
2. **Public Holidays:** Multi-country support with visual indicators
3. **Interactive Calendar:** Click date to see detailed info
4. **Real-Time Balance:** Shows remaining days before submission
5. **Test Coverage:** 77 tests ensure reliability
6. **Mobile Responsive:** All pages work on phone

---

## 🔗 References

- [Sprint 4](./sprint4.md) — Leave backend
- [Sprint 6](./sprint6-review.md) — Claims module
- [Project Brief](../WORKIVED_PROJECT_BRIEF.md)

---

## 📝 Backend Endpoints Used

All endpoints from Sprint 4:
- `GET /api/v1/leave/policies` — List leave policies
- `POST /api/v1/leave/policies` — Create policy (admin)
- `PUT /api/v1/leave/policies/:id` — Update policy
- `DELETE /api/v1/leave/policies/:id` — Deactivate policy
- `GET /api/v1/leave/balances?year=2026` — List all balances
- `GET /api/v1/leave/balances/me?year=2026` — My balances
- `POST /api/v1/leave/requests` — Submit request
- `GET /api/v1/leave/requests?status=pending` — List requests
- `GET /api/v1/leave/requests/me` — My requests
- `POST /api/v1/leave/requests/:id/approve` — Approve
- `POST /api/v1/leave/requests/:id/reject` — Reject
- `POST /api/v1/leave/requests/:id/cancel` — Cancel
- `GET /api/v1/leave/calendar?year=2026&month=3` — Calendar view
- `GET /api/v1/leave/holidays?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` — Holidays

---

## 🏗️ Architectural Note

**Calendar Route Evolution:**
- Sprint 5: Calendar at `/leave/calendar` (scoped to leave module)
- Sprint 8.0: Promoted to `/calendar` (top-level route)
- Reason: Calendar should aggregate multiple modules (leave, tasks, events)
- Old route redirects to new route for backward compatibility

See ADR-004 for full decision record (superseded in Sprint 8.0).

---

# Sprint 5.5 — Leave Policy Templates + UI Polish

**Duration:** 4 days  
**Status:** ✅ COMPLETE

## 📋 Problem

New admins must manually create 4-6 leave policies (Annual, Sick, Maternity, etc.). This is tedious and error-prone.

## 🎯 Solution

One-click import of country-specific leave policy templates based on local labor laws.

## ✅ Scope

**Backend:**
- [x] `leave_policy_templates` table with seeded data for ID + UAE + MY + SG
- [x] `GET /api/v1/leave/templates?country_code=ID` endpoint
- [x] `POST /api/v1/leave/policies/import` bulk create from template IDs

**Frontend:**
- [x] "Import Templates" button on policies page
- [x] Template preview modal with country selector

**Templates Seeded:**
- [x] Indonesia (Annual, Sick, Maternity, Paternity, Compassionate, Hajj)
- [x] UAE (Annual, Sick, Maternity, Paternity, Compassionate, Hajj/Umrah)
- [x] Malaysia (Annual, Sick, Maternity, Paternity, Compassionate)
- [x] Singapore (Annual, Sick, Maternity, Paternity, Childcare, Compassionate)

## 🎨 Bonus Deliverables (UI Polish)

- [x] Redesigned leave balance cards with 3 variants (default, compact, overview)
- [x] Table layout for leave balances page (replaced card grid)
- [x] Progress bars show available days (green) instead of used days
- [x] Infinity icon (∞) for unlimited leave policies
- [x] Pending days visualization (yellow striped overlay on progress bars)
- [x] Split overview cards: separate attendance and annual leave cards
- [x] Glassmorphism styling with backdrop blur for overview cards
- [x] Enhanced BalanceCard component with icon system and status badges

## 🚀 Technical Highlights

- **Country-aware:** Modal auto-detects org's country, defaults to that country's templates
- **Smart filtering:** Only shows templates not already imported
- **Batch import:** Create multiple policies in single transaction
- **Multi-select UI:** Checkboxes with "Select All" option
- **Success/error states:** Clear feedback with auto-close on success

## 💡 Value Proposition

- Reduces time-to-first-value from **30 minutes → 30 seconds**
- Compliance-first: Legal defaults built-in per country
- Competitive moat: Localized knowledge for 4 markets (ID, UAE, MY, SG)
- Conversion trigger: Easy onboarding → faster activation → higher retention

## 🚫 Out of Scope

- Template customization before import (edit after import if needed)
- Template versioning (manual update when laws change)
- Admin-created custom templates (may add in Pro tier later)

---

# Sprint 5.6 — Hotfixes (Mobile + UX + Data Integrity)

**Duration:** 4 hours (same day)  
**Status:** ✅ COMPLETE

## 📋 Problem

Post-Sprint 5.5 feedback revealed critical UX and data integrity issues requiring immediate attention.

## ✅ Fixes Delivered

### 1. Calendar Mobile Responsiveness
**Problem:** Calendar trimmed on small screens, showing only 4 columns

**Solution:**
- Implemented horizontal scroll with explicit column widths
- All 7 days visible on mobile with smooth touch scrolling
- Files: `apps/web/src/routes/_app/leave/calendar.tsx`

### 2. Template Import Deduplication Warning
**Problem:** Silent skip confused admins when importing duplicate templates

**Solution:**
- Pre-import conflict detection with warning dialog
- Clear UX showing which templates will be skipped
- Option to cancel or proceed with import
- Files: `apps/web/src/components/workived/leave/ImportTemplatesModal.tsx`

### 3. Policy Deletion Guards ⭐ (Data Integrity)
**Problem:** Could delete policies with pending/future requests, causing data integrity issues

**Solution:**
- Validation checks block deletion if constraints exist
- Clear error messages with specific constraint details
- Backend: `CountPendingRequestsByPolicy()`, `CountFutureApprovedRequestsByPolicy()`
- Service: Pre-deletion validation logic
- Tests: 6 comprehensive test cases
- Files: `services/internal/leave/{repository,service,service_test,rollover_test}.go`

### 4. Leave Balance UX Fix (Bonus)
**Problem:** Inactive policy balances shown in UI

**Solution:**
- Filter balance queries to only return active policies
- Clean UX, historical data preserved for compliance
- Files: `services/internal/leave/repository.go`

---

## 📋 Deletion Constraint Rules

### Leave Policies

| Condition | Allow deactivation? | Action |
|-----------|---------------------|--------|
| No balances/requests | ✅ Yes | Deactivate immediately |
| Has balances, no pending/future requests | ✅ Yes | Deactivate (balances preserved as historical records) |
| Has pending requests | ❌ Block | Error: "Cannot delete — X pending requests exist" |
| Has approved future leave | ❌ Block | Error: "Cannot delete — X approved future leaves exist" |

### Claim Categories

| Condition | Allow deactivation? | Action |
|-----------|---------------------|--------|
| No balances/claims | ✅ Yes | Deactivate immediately |
| Has balances, no pending claims | ✅ Yes | Deactivate (balances preserved as historical records) |
| Has pending claims | ❌ Block | Error: "Cannot delete — X pending claim(s) exist" |

**Note:** Claim categories follow the same data integrity pattern as leave policies. Historical spending data in `claim_balances` is protected by `ON DELETE RESTRICT`, preventing accidental data loss while allowing category deactivation when no active claims exist.

**Compliance rationale:** Balances preserved for compliance/audit (5-year retention required by Indonesian law).

---

## 🎉 Sprint 5.6 Highlights

- **Zero breaking changes**
- **98%+ test coverage maintained**
- **All 77 leave module tests passing**
- **Mobile-first fixes** (horizontal scroll with touch support)
- **Data integrity** enforced (balances preserved for compliance)
- **Hot-shipped:** 4 hours from feedback to production

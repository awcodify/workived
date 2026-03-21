# Workived — First Full Production Readiness Review

**Review Date:** March 21, 2026  
**Sprint Completed:** Sprint 10 ✅  
**Reviewers:** Full Team (PO, Architect, Designer, Engineer, QA, Security, Infra)  
**Total Development Time:** 10 sprints (~12 weeks)  
**Review Type:** Comprehensive end-to-end assessment

---

## Executive Summary

### Production Maturity: **75% Complete — Beta-Ready** 🎯

| Category | Status | Score | Blocker? |
|----------|--------|-------|----------|
| **Core Product** | ✅ Complete | 95% | No |
| **API Coverage** | ✅ Complete | 95% | No |
| **Frontend** | ✅ Complete | 90% | No |  
| **Testing** | ⚠️ Partial | 70% | No |
| **Security** | ✅ Complete | 90% | No |
| **Compliance** | ⚠️ Gaps | 65% | **YES** |
| **Infrastructure** | ❌ Missing | 40% | **YES** |
| **Monetization** | ❌ Not Started | 0% | No |
| **Marketing** | ❌ Not Started | 0% | No |

### Verdict

**✅ Ready for closed beta** (10-20 companies)  
**❌ NOT ready for public launch**

### Critical Blockers

1. ❌ **No deployment infrastructure** (AWS not set up)
2. ❌ **No monitoring/observability**  
3. ⚠️ **Compliance gaps** (attendance audit trail missing)
4. ⚠️ **5 production bugs** need immediate fixes

### Timeline Projections

- **Beta Launch:** 2 weeks (with Railway deployment)
- **Public Launch:** 2-3 months (with full AWS infrastructure)

---

## What's Been Built — Complete Inventory

### Backend Modules (10/10 Complete)

| Module | Endpoints | Key Features | Tests | Status |
|--------|-----------|--------------|-------|--------|
| **Auth** | 5 | Register, login, JWT refresh, logout, email verify | ✅ Pass | ✅ |
| **Organisation** | 11 | Org CRUD, invitations, member management | ✅ Pass | ✅ |
| **Employee** | 8 | Employee CRUD, documents, org chart, **workload intelligence** | ✅ Pass | ✅ |
| **Department** | 4 | Department CRUD with hierarchy | ❌ No tests | ⚠️ |
| **Attendance** | 6 | Clock in/out, daily/monthly reports | ✅ Pass | ✅ |
| **Leave** | 16 | Policies, balances, requests, templates, calendar, holidays | ✅ Pass | ✅ |
| **Claims** | 13 | Categories, balances, submissions, approval, templates | ⚠️ Partial | ⚠️ |
| **Tasks** | 14 | Lists, tasks, nested comments, reactions, **workload** | ✅ Pass | ✅ |
| **Admin** | 10 | Feature flags, Pro licenses, system stats | ❌ No tests | ⚠️ |
| **Audit** | Passive | Immutable audit logging (all state changes) | N/A | ✅ |

**Total API Endpoints:** 87+

### Frontend Routes (12 Main Routes)

| Route | Module | Features | Tests | Status |
|-------|--------|----------|-------|--------|
| `/login`, `/register`, `/invite` | Auth | Complete signup/login flow | ✅ | ✅ |
| `/overview` | Dashboard | Widget-based overview | ❌ | ⚠️ |
| `/people/*` | Employee | Directory, profiles, documents | ⚠️ | ⚠️ |
| `/org-chart` | Employee | Visual organization chart | ❌ | ⚠️ |
| `/attendance/monthly` | Attendance | Monthly reports | ❌ | ⚠️ |
| `/leave/*` | Leave | Request, calendar, approval flow | ✅ | ✅ |
| `/claims/*` | Claims | Submit, approve, balance tracking | ✅ | ✅ |
| `/tasks` | Tasks | **Sticky note kanban** with comments | ✅ | ✅ |
| `/calendar` | Leave | Unified calendar view | ✅ | ✅ |
| `/reports` | Analytics | Coming soon placeholder | ❌ | ⚠️ |
| `/settings/*` | Settings | Company settings, members | ⚠️ | ⚠️ |

**Test Coverage:** 
- Sprint 10 alone: 41 tests (100% coverage)
- Total frontend tests: ~150+
- Backend tests: 98%+ on new code (Sprints 8-10)

### Database Schema (61 Migrations)

**Multi-Tenancy Foundation:**
- ✅ Every table has `organisation_id UUID NOT NULL`
- ✅ Application-layer enforcement (not PostgreSQL RLS)
- ✅ All queries filter by `organisation_id` first

**Core Tables:**
- **Foundation:** organisations, users, organisation_members, auth_tokens, invitations
- **HR:** employees, employee_documents, departments
- **Time:** attendance_records, work_schedules, public_holidays
- **Leave:** leave_policies, leave_balances, leave_requests, leave_policy_templates
- **Claims:** claim_categories, claim_balances, claims, claim_category_templates
- **Tasks:** task_lists, tasks, task_comments, comment_reactions
- **System:** announcements, notifications, audit_logs
- **Admin:** admin_configs, feature_flags, pro_licenses

**Data Integrity:**
- ✅ UUID primary keys with `gen_random_uuid()`
- ✅ Soft deletes (`is_active` boolean)
- ✅ Timestamps in UTC (`TIMESTAMPTZ`)
- ✅ Money as `BIGINT` (smallest currency unit)
- ✅ Foreign key constraints with proper cascades
- ✅ Comprehensive indexes for performance

**Country Support:**
- ✅ Indonesia public holidays seeded (2026)
- ✅ UAE public holidays seeded (2026)
- ✅ Leave policy templates (Indonesia, UAE)
- ✅ Claim category templates (Indonesia, UAE)

---

## Competitive Differentiators Delivered

### 🌟 Workload Intelligence (Sprint 9)

**Market Position:** Only kanban that shows employee availability during task assignment

**Features:**
- Real-time workload calculation (active tasks, overdue count)
- Leave status integration (on leave, upcoming leave)
- Workload badges: Available (0-5), Warning (6-10), Overloaded (11+), On Leave
- Team capacity panel on task board
- 7-day leave lookahead

**Performance:** <50ms query time for 25-employee org

**Why No Competitor Has This:**
- Asana, Monday, Trello, Linear don't integrate HR data
- Prevents assigning work to people on vacation
- Prevents burnout from overload

**Customer Reaction Target:**
> "It stops me from assigning work to someone on vacation? That's happened three times this month!"

### 🎨 Sticky Note Kanban (Sprint 8)

**Visual Design:**
- Vibrant paper colors (yellow, pink, blue, green, orange, purple)
- Torn paper edges (CSS clip-path)
- Metallic pin effect (radial gradients)
- Rotate on hover
- Hand-drawn notebook aesthetic

**Why It Matters:**
- Unique visual identity (not another Trello clone)
- Memorable brand experience
- Differentiates in crowded market

### 💬 Advanced Commenting (Sprint 8)

**Features:**
- Nested replies (2-level depth)
- Rich text editor (TipTap: bold, italic, lists, links)
- Emoji reactions (6 emojis: 👍 ❤️ 😂 😮 😢 🎉)
- Inline reply UX (appears below parent comment)

**Modern UX:**
- Matches Slack, GitHub, Discord patterns
- Increases engagement on task discussions

---

## Production Readiness Assessment by Domain

### 1. 🧠 Product Owner — Feature Completeness: 85%

#### ✅ Delivered (Sprints 1-10)

**Sprint 1: Foundation**
- Go monolith architecture
- PostgreSQL schema (all tables)
- Auth module (JWT)
- Organisation, Employee, Department modules

**Sprint 2-3: Attendance**
- Clock in/out
- Daily/monthly reports
- Work schedules

**Sprint 4-5: Leave Management**
- Leave policies (configurable)
- Leave balances (auto-initialization)
- Leave requests with approval workflow
- Calendar view
- Country templates (Indonesia, UAE)

**Sprint 6: Claims**
- Claim categories (configurable)
- Monthly budgets
- Submission with receipt upload
- Approval workflow
- Country templates

**Sprint 7: Calendar Promotion**
- Promoted from experimental to production route
- Public holidays integration

**Sprint 8: Tasks**
- Sticky note kanban UI
- Task lists, tasks, nested comments
- Drag-and-drop with persistence
- Emoji reactions backend

**Sprint 9: Workload Intelligence** ⭐
- GET /api/v1/employees/workload endpoint
- Workload badges in task assignment
- Team capacity panel
- 7-day leave lookahead

**Sprint 10: Task UX** ⭐
- Time-aware due dates (5 urgency levels)
- Task filters with URL persistence
- Reusable EmployeeSelector component
- Emoji reactions UI

#### ❌ Missing for MVP

**Marketing & Acquisition:**
- ❌ Landing page (no public website)
- ❌ Pricing page
- ❌ Blog/changelog for SEO

**Monetization:**
- ❌ Billing integration (Stripe)
- ❌ Upgrade flow (Free → Pro)
- ❌ Pro feature gating enforced
- ❌ Invoice generation

**User Experience:**
- ❌ Onboarding flow (empty dashboard for new users)
- ❌ Empty states (no friendly messages)
- ❌ Employee self-service portal (all features are manager-facing)

**Advanced Features:**
- ❌ Mobile app (PWA responsive only)
- ❌ Geofencing for attendance (competitors have this)
- ❌ Shift scheduling (basic work schedules only)
- ❌ Analytics dashboard (no reporting beyond raw data)
- ❌ Payroll (explicitly out of scope)

#### ⚠️ Gaps vs Competitor Feature Parity

| Feature | Workived | Zoho People | Qoyod | BambooHR |
|---------|----------|-------------|-------|----------|
| Attendance tracking | ✅ | ✅ | ✅ | ✅ |
| Leave management | ✅ | ✅ | ✅ | ✅ |
| Claims/Expenses | ✅ | ✅ | ✅ | ✅ |
| Task management | ✅ Unique | ❌ | ❌ | ❌ |
| **Workload intelligence** | ✅ **Unique** | ❌ | ❌ | ❌ |
| GPS geofencing | ❌ | ✅ | ✅ | ❌ |
| Shift scheduling | ❌ | ✅ | ✅ | ✅ |
| Analytics | ❌ | ✅ | ✅ | ✅ |
| Mobile app | ❌ | ✅ | ✅ | ✅ |
| Payroll | ❌ | ✅ | ✅ | ✅ |

**Competitive Position:**
- 🎯 **Strengths:** Workload intelligence, task management integration, unique design
- ⚠️ **Weaknesses:** Shallow feature depth, no mobile app, no integrations, no analytics

### 2. 🏗️ Architect — Technical Health: 80%

#### ✅ Architecture Strengths

**Clean Architecture:**
- Modular monolith (handler → service → repository pattern)
- Easy to extract services later if needed
- Type safety (Go + TypeScript strict mode)
- Dependency injection (clean testability)

**Security Design:**
- Multi-tenancy enforced at application layer
- All queries filter by `organisation_id` first
- JWT with refresh tokens (15 min access, 30 day refresh)
- Password hashing (bcrypt)
- SQL injection prevention (parameterized queries)
- S3 pre-signed URLs for file uploads

**Scalability Patterns:**
- UUID primary keys (distributed ID generation)
- Pagination ready (cursor-based helpers exist)
- Caching layer (Redis for sessions, workload cache)
- File storage (S3-compatible, not local disk)

#### ⚠️ Critical Technical Debt

**1. Database Design Flaw: Unlimited Leave/Claim** 🔴 P0

**Problem:**
```sql
-- Current schema
leave_policies.max_days INT NOT NULL

-- Blocks: Unlimited sick leave (common in Indonesia, UAE)
```

**Impact:**
- Cannot represent "unlimited" sick leave with doctor's note
- Blocks customers in Indonesia (labor law requires unlimited sick leave)
- Blocks UAE customers (similar requirement)

**Solution:**
```sql
-- Migration needed
ALTER TABLE leave_policies 
ADD COLUMN is_unlimited BOOLEAN DEFAULT FALSE;

ALTER TABLE claim_categories
ADD COLUMN is_unlimited BOOLEAN DEFAULT FALSE;

-- Service logic: Skip max_days validation if is_unlimited = true
```

**Effort:** 2 hours (migration + service changes + tests)  
**Must Fix Before:** Beta launch

---

**2. Bundle Size: 1.27 MB** ⚠️ Performance

**Current State:**
- Uncompressed: 1.27 MB
- Gzipped: 360 KB
- Recommended: <200 KB for fast mobile load

**Impact:**
- Slow initial load on 3G networks
- Poor user experience on slow connections
- Affects Indonesia market (patchy mobile networks)

**Solution:**
```typescript
// Implement code splitting by route
const Tasks = React.lazy(() => import('./routes/tasks'))
const Leave = React.lazy(() => import('./routes/leave'))
const Claims = React.lazy(() => import('./routes/claims'))

// Load only what's needed per route
```

**Effort:** 1 day (add React.lazy, test all routes)  
**Priority:** Medium (affects UX, not blocking)

---

**3. No Cache Invalidation Strategy** ⚠️ Data Freshness

**Current State:**
- Workload cache: 5 min TTL (Sprint 9)
- TanStack Query: Various staleTime settings

**Missing:**
- Cache invalidation on task create/complete
- Cache invalidation on leave approve/reject
- Coordinated cache strategy across modules

**Risk:**
- Stale workload data shown to users
- Task count incorrect after creation
- Leave status wrong after approval

**Solution:**
```typescript
// Invalidate workload cache when task changes
useMutation({
  mutationFn: createTask,
  onSuccess: () => {
    queryClient.invalidateQueries(['employees', 'workload'])
  }
})
```

**Effort:** 1 day (document cache keys, add invalidation)  
**Priority:** High (data correctness issue)

---

**4. Frontend Test Coverage Incomplete** ⚠️ Quality

**Current State:**
- Sprint 10: 41 tests (100% coverage) ✅
- Sprint 8: 33 tests (100% coverage) ✅
- Earlier sprints: Missing tests ❌

**Missing Tests:**
- Overview page: 0 tests
- Org chart: 0 tests
- Reports: 0 tests
- Attendance: 0 tests
- Settings: 0 tests

**Target:** 98% coverage globally (not met)

**Solution:** Backfill 30+ tests for early sprint features  
**Effort:** 2 days  
**Priority:** Medium (not blocking, but reduces confidence)

---

**5. No E2E Test Suite** 🔴 Critical

**Current State:**
- Unit tests: ✅ Good (backend 98%+)
- Integration tests: ⚠️ Partial
- E2E tests: ❌ None

**Risk:**
- Cross-module regressions undetected
- Example: Does creating employee auto-create leave balances?
- Example: Does approving leave update calendar?

**Solution:** Playwright suite for 5 critical flows

```typescript
// Critical E2E flows
1. Sign up → Create org → Invite employee
2. Submit leave → Approve → Check balance deduction
3. Clock in → Clock out → View daily report
4. Create task → Assign → Comment → Complete
5. Submit claim → Approve → Check balance deduction
```

**Effort:** 3 days (Playwright setup + 5 flows)  
**Priority:** High (prevents production regressions)

---

### 3. 🎨 Designer — UX Maturity: 75%

#### ✅ Design Strengths

**Unique Visual Identity:**
- Sticky note kanban (tears, pins, rotations)
- Notebook aesthetic (dashed lines, paper backgrounds)
- Hand-drawn feel (humanizes HR software)
- Plus Jakarta Sans font (modern, friendly)

**Consistent Patterns:**
- Modal-based approvals (leave, claims)
- Color-coded priorities (red, purple, blue, yellow)
- Workload badges (green, yellow, red, purple)

**Mobile-First:**
- Responsive design (Tailwind)
- Touch-friendly (tap targets sized properly)

#### ❌ Critical UX Gaps

**1. No Onboarding Flow** 🔴 P1

**Problem:**
- New users see empty dashboard after signup
- No guidance on what to do first
- Confusing first experience

**User Pain:**
> "I signed up... now what? Where do I start?"

**Solution:**
```tsx
// Onboarding checklist widget
<OnboardingChecklist>
  ☐ Invite team members
  ☐ Set up leave policies
  ☐ Configure claim categories
  ☐ Create departments
  ☐ Add first employee
</OnboardingChecklist>
```

**Effort:** 2 days (widget + state tracking)  
**Priority:** High (first impression matters)

---

**2. Mobile Responsiveness Incomplete** ⚠️

**Current State:**
- Desktop (1280px+): ✅ Tested
- Tablet (768-1280px): ⚠️ Partially tested
- Mobile (<768px): ❌ Not fully tested

**Issues:**
- Task kanban: Columns overlap on small screens
- Calendar: Month view cramped
- Tables: Horizontal scroll needed

**Solution:**
```typescript
// Mobile-first kanban
- Stack columns vertically on mobile
- Add column tabs/carousel
- Touch gestures for drag-and-drop

// Mobile calendar
- Agenda view instead of month grid
- Swipe between dates
```

**Effort:** 1 week (responsive layouts + testing)  
**Priority:** Medium (most HR managers use desktop, but field staff need mobile)

---

**3. No Empty States** 🟡 P2

**Current:**
- Empty task board: Blank white
- No pending approvals: Empty list
- No employees: Just empty table

**Better UX:**
```tsx
// Friendly empty states
<EmptyState 
  icon="📋"
  title="No tasks yet"
  description="Create your first task to get started"
  action="Create Task"
/>
```

**Effort:** 1 day (create EmptyState component + apply everywhere)  
**Priority:** Medium (polish, not blocking)

---

**4. Inconsistent Approval UX** ⚠️

**Current:** Modal dialogs for both leave and claims ✅ (Sprint 6 fixed this)

**But:** Approvals hidden in separate pages

**Better:** Unified approval inbox (already in backlog: "Auto-Task for Approvals")

**Effort:** 4-5 days  
**Priority:** High (reduces manager context switching)

---

**5. Accessibility Not Audited** 🟡

**Missing:**
- Keyboard navigation (Tab, Enter, Esc)
- Screen reader support (ARIA labels)
- Color contrast ratios (WCAG AA compliance)
- Focus indicators

**Risk:** Excluding users with disabilities

**Solution:**
```bash
# Automated audit
npm run axe-audit

# Manual testing
- Test with keyboard only
- Test with screen reader (NVDA/JAWS)
- Test color contrast (8:1 ratio)
```

**Effort:** 3 days (audit + fixes)  
**Priority:** Low for beta, High for public launch

---

### 4. 👨‍💻 Engineer — Code Quality: 85%

#### ✅ Engineering Strengths

**Clean Code:**
- Handler → Service → Repository pattern (consistent)
- Type safety enforced (Go + TypeScript strict)
- Input validation (Zod frontend, Go validator backend)
- Error handling architecture (typed errors)

**Test Discipline:**
- Sprint 8-10: 98%+ coverage on new code
- TDD approach (tests written with code)
- Comprehensive test suites

**Git Hygiene:**
- Feature branches
- Commit message format
- Code review process (Claude-enforced)

#### Production Bugs Found (Sprint 10 Review)

**Bug #1: Non-Admin 403 on Attendance API** 🔴 P0

**Issue:**
```http
GET /api/v1/attendance/daily
Authorization: Bearer <team_member_jwt>

Response: 403 Forbidden
```

**Root Cause:**
```go
// services/internal/attendan/handler.go
att.GET("/daily", middleware.Require(middleware.PermAttendanceRead), h.DailyReport)

// PermAttendanceRead = admin/manager only
// Should allow: admin OR own employee data
```

**Impact:**
- Team members cannot view attendance
- Breaks core feature for non-admin users
- "Pending" label shown on dock (API fails)

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
  isAdmin := middleware.HasPerm(c, middleware.PermAttendanceRead)
  
  var employeeID *uuid.UUID
  if !isAdmin {
    // Non-admin: Show only own attendance
    empID := middleware.EmployeeIDFromCtx(c) 
    employeeID = &empID
  }
  
  records, err := h.service.DailyReport(ctx, orgID, employeeID)
  // ...
}
```

**Effort:** 1 hour  
**Must Fix:** Before beta launch

---

**Bug #2: Sick Leave Unlimited Not Supported** 🔴 P0

**Issue:**
- Database schema: `leave_policies.max_days INT NOT NULL`
- Cannot represent unlimited sick leave
- Violates Indonesia/UAE labor law

**Impact:**
- Product cannot launch in Indonesia (labor law requires unlimited sick leave with medical cert)
- Product cannot launch in UAE (similar requirement)
- **Blocks entire market**

**Fix:** (See Architect section for full migration)  
**Effort:** 2 hours  
**Must Fix:** Before beta launch

---

**Bug #3: TaskFilters Test Compilation Errors** 🟡 P1

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

**Root Cause:**
- Mock data using wrong field names
- Query selector returning potentially undefined

**Impact:**
- Tests fail in CI
- CI/CD pipeline blocked

**Fix:**
```typescript
// Remove employment_status (doesn't exist in Employee type)
const mockEmployee: Employee = {
  id: '1',
  full_name: 'John Doe',
  // Remove: employment_status: 'active'
}

// Add null check
const assigneeSelect = screen.queryByLabelText('Assignee')
if (assigneeSelect) {
  fireEvent.change(assigneeSelect, { target: { value: '1' } })
}
```

**Effort:** 30 minutes  
**Priority:** High (blocks CI/CD)

---

**Bug #4: Calendar Icon Invisible (Invite Modal)** 🟡 P2

**Issue:**
- Calendar icon not visible in employee invite modal
- Likely: white icon on white background (contrast issue)

**Impact:**
- Confusing UX (users can't find date picker)
- Not blocking (can still type date)

**Fix:**
```tsx
// Likely CSS issue
<CalendarIcon className="text-gray-500" /> 
// Instead of: className="text-white"
```

**Effort:** 15 minutes  
**Priority:** Medium (UX polish)

---

**Bug #5: Create Task in Done Column → Not Auto-Complete** 🟡 P2

**Issue:**
```typescript
// User creates task directly in "Done" column
// Expected: Task created with completed_at = now
// Actual: Task created with completed_at = null
```

**Root Cause:**
```typescript
// Sprint 10: Added auto_complete_on_move to task_lists
// But: Not applied on task creation, only on move
```

**Impact:**
- Workflow confusion
- Tasks in "Done" appear incomplete

**Fix:**
```go
// services/internal/tasks/service.go
func (s *Service) CreateTask(..., listID uuid.UUID) {
  // Check if list has auto_complete
  list, _ := s.repo.GetTaskList(ctx, orgID, listID)
  
  var completedAt *time.Time
  if list.AutoCompleteOnMove {
    now := time.Now()
    completedAt = &now
  }
  
  task := Task{
    CompletedAt: completedAt,
    // ...
  }
}
```

**Effort:** 30 minutes  
**Priority:** Medium (workflow issue)

---

**Bug #6: Dock Blocking UI When No Scroll** 🟢 P3

**Issue:**
- Fixed dock position blocks UI behind it
- Only happens when page has no scroll

**Impact:**
- Minor layout annoyance
- Can't click elements behind dock

**Fix:**
```tsx
// Use sticky instead of fixed
<Dock className="sticky bottom-0" />

// Or add pointer-events
<Dock className="fixed pointer-events-none">
  <button className="pointer-events-auto" />
</Dock>
```

**Effort:** 30 minutes  
**Priority:** Low (minor UX)

---

**Total Bug Fix Effort:** ~5 hours for all 6 bugs

---

### 5. 🔍 QA — Test Coverage: 70%

#### ✅ Testing Strengths

**Backend:**
- Sprint 8-10: 98%+ coverage on new code
- Auth module: 100% tested
- Leave module: 100% tested
- Tasks module: 100% tested
- Claims module: Partial coverage

**Frontend:**
- Sprint 10: 41 tests (100% coverage on new features)
- Sprint 8: 33 tests (tasks + comments)
- TanStack Query integration well-tested

#### ❌ Testing Gaps

**1. No E2E Test Suite** 🔴 Critical

**Missing:** Playwright/Cypress tests for critical user journeys

**Critical Flows:**
1. **Signup → Onboarding**
   - Register → Verify email → Create org → Invite first employee
2. **Leave Request Lifecycle**
   - Submit leave → Manager approves → Balance deducts → Calendar updates
3. **Attendance Flow**
   - Clock in → Clock out → Daily report shows record
4. **Task Collaboration**
   - Create task → Assign → Comment → Reply → React → Complete
5. **Claim Submission**
   - Submit claim → Upload receipt → Approve → Balance deducts

**Why E2E Tests Matter:**
- Catch cross-module integration bugs
- Example: Approving leave doesn't update calendar (hypothetical bug)
- Example: Creating employee doesn't initialize leave balances (actual bug fixed in Sprint 4)

**Effort:** 3 days (Playwright setup + 5 flows)  
**Priority:** High

---

**2. Department Module: No Tests** 🟡

**Current State:**
```bash
services/internal/department/
  handler.go     # 0 tests
  service.go     # 0 tests  
  repository.go  # 0 tests
```

**Risk:**
- CRUD operations untested
- Hierarchy logic uncovered (parent_id relationships)
- Could break in production

**Solution:** Write 10 tests

```go
// Tests needed
- List departments (empty, with data, with hierarchy)
- Create department (valid, duplicate name, invalid parent)
- Update department (change name, change parent)
- Delete department (cascade check)
- Hierarchy queries (get children, get ancestors)
```

**Effort:** 4 hours  
**Priority:** Medium

---

**3. Admin Module: No Tests** 🟡

**Current State:**
```bash
services/internal/admin/
  handler.go   # 0 tests (feature flags, licenses)
  service.go   # 0 tests
```

**Risk:**
- Pro tier gating untested
- Feature flag toggling uncovered
- License creation/validation untested

**Solution:** Write 8 tests

```go
// Tests needed
- List feature flags
- Toggle feature flag (returns updated state)
- Create Pro license (valid, duplicate org)
- Check feature access (Pro-only features)
```

**Effort:** 3 hours  
**Priority:** High (affects monetization)

---

**4. Frontend Early Sprints: Missing Tests** ⚠️

**Gaps:**
- Overview page: 0 tests
- Org chart: 0 tests
- Reports: 0 tests
- Attendance monthly: 0 tests
- Employee directory: Partial tests
- Settings pages: Partial tests

**Target:** 30+ tests to backfill

**Effort:** 2 days  
**Priority:** Medium

---

**5. No Load/Stress Testing** ⚠️

**Questions:**
- Can API handle 100 concurrent users?
- What's the breaking point? (200 users? 500?)
- Do we have N+1 query issues?
- Does workload query scale beyond 100 employees?

**Tools:**
- k6 (JavaScript-based load testing)
- Artillery (YAML-based scenarios)

**Scenarios:**
```yaml
# Load test scenario
100 virtual users:
  - Login
  - View task board
  - Create task
  - Assign to random employee
  - View attendance
  - Submit leave request

Measure:
  - P95 response time
  - Error rate
  - Database connection pool saturation
```

**Effort:** 2 days (setup + scenarios)  
**Priority:** Medium (know limits before beta)

---

### 6. 🔒 Security — Security Posture: 90%

#### ✅ Security Strengths

**Authentication & Authorization:**
- JWT with secure refresh tokens
- Role-based access control (RBAC)
- Permission-based middleware (`PermEmployeeRead`, etc.)
- Password hashing (bcrypt, cost 12)

**Multi-Tenancy:**
- `organisation_id` filtering enforced
- Middleware extracts org from JWT
- Cannot query data from other orgs

**Input Validation:**
- Frontend: Zod schemas
- Backend: Go validator with custom rules
- SQL injection prevented (parameterized queries)

**File Upload Security:**
- S3 pre-signed URLs (time-limited)
- File type validation
- Size limits enforced
- No direct file access from backend

#### ⚠️ Security Gaps

**1. No Rate Limiting on Auth Endpoints** 🟡

**Current:**
```go
// Rate limiter ONLY on authed routes
authed.Use(middleware.RateLimiter(rdb, 600)) // 600 req/min

// Missing: Rate limit on public auth routes
authHandler.RegisterRoutes(v1) // No rate limit!
```

**Risk:**
- Brute force attacks on `/auth/login`
- Account enumeration via `/auth/register` (email already exists)
- DoS via repeated requests

**Attack Scenario:**
```bash
# Attacker tries 10,000 passwords
for pwd in $(cat passwords.txt); do
  curl -X POST /auth/login \
    -d "{\"email\":\"admin@target.com\",\"password\":\"$pwd\"}"
done
```

**Fix:**
```go
// Add rate limiter to auth routes
auth := v1.Group("/auth")
auth.Use(middleware.RateLimiter(rdb, 10)) // 10 attempts/min per IP

authHandler.RegisterRoutes(auth)
```

**Effort:** 1 hour  
**Priority:** High (production must-have)

---

**2. ~~No Audit Trail for Attendance Changes~~ CLARIFIED: This is a Feature, Not Compliance** 🟡

**Original Request:** "Attendance revision feature"

**⚠️ IMPORTANT CLARIFICATION (March 21, 2026):**

This was **misidentified** as a compliance gap. After user clarification:

**What we thought it was:**
- Audit trail requirement (GDPR compliance)
- Backend tracking of who changed attendance records
- Compliance blocker

**What it actually is:**
- **New feature:** Employee self-service to request attendance corrections
- **Workflow:** Employee submits "I forgot to clock in" → Manager approves/rejects
- **Use case:** Forgotten clock-in/out, not admin audit trail

**Status:**
- ❌ Removed from Sprint 10.5 (was planned as 3-day compliance feature)
- ✅ Moved to backlog: `docs/backlog/hr-features.md` as "Attendance Correction Workflow"
- 📝 Priority: ⭐⭐⭐ Medium value (1-2 weeks effort)

**Note on Audit Logging:**
System-wide audit logging (including attendance) IS a compliance requirement, but it's separate from this feature request. See `docs/backlog/system-improvements.md` for "Comprehensive Audit Logging" (⭐⭐⭐⭐ High priority, Sprint 11/12).

---

**ORIGINAL ANALYSIS (For Reference):**

**Current State:**
- No history when attendance edited
- Manager corrects clock-in time → no record of change
- GDPR violation (no audit trail for personal data changes)

**Compliance Impact:**
- **Indonesia:** Ministry of Manpower requires attendance audit logs
- **UAE:** MOHRE labor inspections require proof of changes
- **GDPR:** Article 15 (right to access) includes change history

**Solution:**
```sql
-- New table: attendance_revisions
CREATE TABLE attendance_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL,
  attendance_id UUID NOT NULL REFERENCES attendance_records(id),
  
  -- Before/after state
  field_changed VARCHAR(50) NOT NULL, -- 'clock_in', 'clock_out'
  old_value TIMESTAMPTZ,
  new_value TIMESTAMPTZ,
  
  -- Who changed it
  changed_by_user_id UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Why changed (manager notes)
  reason TEXT,
  
  -- Approval (if required)
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_by_user_id UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ
);

CREATE INDEX idx_attendance_revisions_org 
  ON attendance_revisions(organisation_id);
CREATE INDEX idx_attendance_revisions_attendance 
  ON attendance_revisions(attendance_id);
```

**UI Requirements:**
- Show revision history on attendance detail
- Before/after diff view
- Manager approval workflow (optional config)

**Effort:** 3 days (migration + service + UI + tests)  
**Priority:** Critical (compliance blocker)

---

**3. No CSRF Protection** 🟡

**Current:**
- JWT in Authorization header (not cookie)
- Refresh token in httpOnly cookie

**Risk:**
- Low for JWT (cross-origin requests blocked by CORS)
- Medium for refresh token endpoint (uses cookie)

**Attack Scenario:**
```html
<!-- Malicious site -->
<form action="https://workived.com/api/v1/auth/refresh" method="POST">
  <input type="submit" value="Click here for free stuff!">
</form>
<!-- If user is logged in, refresh token sent automatically -->
```

**Fix:**
```go
// Add CSRF token to refresh endpoint
import "github.com/gin-contrib/csrf"

r.Use(csrf.Middleware(csrf.Options{
  Secret: cfg.CSRFSecret,
  Cookie: "csrf_token",
}))

// Frontend sends csrf token in header
axios.post('/auth/refresh', {}, {
  headers: {
    'X-CSRF-Token': getCookie('csrf_token')
  }
})
```

**Effort:** 2 hours  
**Priority:** Medium (low risk, but best practice)

---

**4. No Content Security Policy (CSP)** 🟡

**Current:** No CSP headers

**Risk:**
- XSS attacks (if validation missed something)
- Clickjacking
- Data injection

**Fix:**
```go
// Add CSP middleware
r.Use(func(c *gin.Context) {
  c.Header("Content-Security-Policy", 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " + // TipTap needs inline
    "style-src 'self' 'unsafe-inline'; " + // Tailwind needs inline
    "img-src 'self' data: https:; " + // S3 images
    "font-src 'self' data:; " +
    "connect-src 'self' https://api.workived.com"
  )
  c.Next()
})
```

**Testing:**
```bash
# Audit with CSP evaluator
npm install -g csp-evaluator
csp-evaluator "default-src 'self'; ..."
```

**Effort:** 1 day (test all external resources, fix violations)  
**Priority:** Medium (defense-in-depth)

---

**5. Secrets in Environment Variables Only** 🟡

**Current:**
```bash
# .env file (plaintext on server)
DATABASE_URL=postgresql://...
JWT_SECRET=super-secret-key
S3_ACCESS_KEY=AKIA...
S3_SECRET_KEY=...
```

**Risk:**
- Secrets visible in process environment
- Exposed in logs if app crashes
- Hard to rotate (requires deployment)

**Production Best Practice:**
```go
// Use AWS Secrets Manager
import "github.com/aws/aws-sdk-go-v2/service/secretsmanager"

func getSecret(name string) string {
  client := secretsmanager.NewFromConfig(cfg)
  result, _ := client.GetSecretValue(ctx, &secretsmanager.GetSecretValueInput{
    SecretId: aws.String(name),
  })
  return *result.SecretString
}

// In main.go
cfg.JWTSecret = getSecret("workived/jwt-secret")
cfg.DatabaseURL = getSecret("workived/database-url")
```

**Effort:** 1 day (production only, keep .env for local dev)  
**Priority:** Low for beta, High for public launch

---

### 7. ☁️ Infrastructure — DevOps Readiness: 40% (BLOCKER)

#### ✅ Local Development

**Working:**
- `make dev` → PostgreSQL + Redis + MinIO + Go + Vite
- Docker Compose for local infra
- MinIO setup script (auto-creates bucket)
- Hot reload (Vite HMR + Air for Go)

#### ❌ Production Infrastructure: NOT BUILT (CRITICAL BLOCKER)

**Missing Components:**

| Component | Status | Blocker? | Estimated Cost |
|-----------|--------|----------|----------------|
| AWS account setup | ❌ | YES | Setup only |
| Kubernetes cluster (EKS) | ❌ | YES | $150/month |
| PostgreSQL (RDS) | ❌ | YES | $50/month |
| Redis (ElastiCache) | ❌ | YES | $30/month |
| S3 buckets | ❌ | YES | $5/month |
| Load balancer (ALB) | ❌ | YES | $25/month |
| SSL certificates | ❌ | YES | Free (ACM) |
| Domain DNS (Route 53) | ❌ | YES | $1/month |
| CI/CD pipeline | ❌ | YES | Free (GitHub Actions) |
| Monitoring | ❌ | YES | $50+/month |
| Logging (CloudWatch) | ❌ | YES | $20/month |
| Database backups | ❌ | YES | $10/month |
| Disaster recovery | ❌ | NO | TBD |

**Total Monthly Cost (AWS):** ~$350+/month

**Time to Deploy:** 1-2 weeks (Terraform + K8s manifests + testing)

---

#### 🎯 Alternative: Railway/Fly.io (Recommended for Beta)

**Why Railway for Beta:**

| Feature | Railway | AWS EKS | Winner |
|---------|---------|---------|--------|
| **Setup time** | 1 day | 1-2 weeks | Railway |
| **Monthly cost** | $20 | $350+ | Railway |
| **PostgreSQL** | Included | RDS setup | Railway |
| **Redis** | Included | ElastiCache setup | Railway |
| **SSL** | Auto-renewed | Manual ACM | Railway |
| **Monitoring** | Included | Must set up | Railway |
| **Backups** | Daily auto | Must configure | Railway |
| **Scaling** | Click to scale | Terraform + K8s | Railway |
| **Control** | Limited | Full | AWS |
| **Vendor lock-in** | High | Low | AWS |

**Railway Setup (1 day):**

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Create project
railway init

# 4. Add PostgreSQL
railway add postgresql

# 5. Add Redis
railway add redis

# 6. Deploy backend
cd services
railway up

# 7. Deploy frontend (static)
cd apps/web
npm run build
railway up --service=frontend

# 8. Configure environment variables
railway variables set JWT_SECRET=...
railway variables set DATABASE_URL=${{Postgres.DATABASE_URL}}

# Done! App running at https://your-app.railway.app
```

**When to Migrate to AWS:**
- 100+ paying customers
- Need multi-region (Indonesia + UAE)
- Need VPC isolation
- Need compliance certifications (SOC2, ISO27001)
- Need advanced autoscaling

**Recommendation:** Start with Railway, migrate to AWS when revenue justifies infrastructure cost.

---

#### Missing Observability (CRITICAL)

**1. No Monitoring** ❌

**Cannot answer:**
- Is the app up?
- What's the response time?
- Are there errors?
- Is the database slow?

**Solution:**
```bash
# Railway includes basic monitoring
# For advanced: Add Datadog

# Step 1: Add Datadog agent
railway add datadog

# Step 2: Configure APM in Go
import "gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"

func main() {
  tracer.Start(
    tracer.WithService("workived-api"),
    tracer.WithEnv("production"),
  )
  defer tracer.Stop()
}

# Step 3: Frontend RUM (Real User Monitoring)
import { datadogRum } from '@datadog/browser-rum'

datadogRum.init({
  applicationId: '...',
  clientToken: '...',
  site: 'datadoghq.com',
  service: 'workived-web',
})
```

**Effort:** 1 day (Railway: 1 hour, Datadog: 1 day)  
**Priority:** Critical (blind without monitoring)

---

**2. No Error Tracking** ❌

**Cannot answer:**
- What errors are users hitting?
- How often do they happen?
- What's the stack trace?

**Solution:**
```typescript
// Add Sentry
import * as Sentry from "@sentry/react"

Sentry.init({
  dsn: "https://...@sentry.io/...",
  integrations: [new Sentry.BrowserTracing()],
  tracesSampleRate: 1.0,
})

// Backend
import "github.com/getsentry/sentry-go"

sentry.Init(sentry.ClientOptions{
  Dsn: "https://...@sentry.io/...",
  Environment: "production",
})
```

**Effort:** 1 day  
**Priority:** Critical

---

**3. No Log Aggregation** ❌

**Current:**
- Logs printed to stdout
- No centralized view
- Cannot search across instances

**Solution:**
```bash
# Railway: Logs included (last 10k lines)
railway logs --tail

# Production: Ship to Datadog
# Already integrated with APM above
```

**Effort:** Included with monitoring setup  
**Priority:** High

---

**4. No Database Backups** ❌

**Risk:**
- Data loss if database fails
- No point-in-time recovery
- Cannot restore deleted data

**Solution:**
```bash
# Railway: Daily auto-backups included ✅

# AWS RDS: Configure backups
resource "aws_db_instance" "postgres" {
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:05:00-sun:06:00"
}
```

**Effort:** Free with Railway, 1 hour AWS config  
**Priority:** Critical

---

### 8. 💰 Monetization — Revenue Readiness: 0% (Blocker for Growth)

#### ❌ Not Built

**Landing Page:**
- No public marketing website
- No pricing page
- No feature comparison (Free vs Pro)
- No blog for SEO
- No signup CTAs

**Billing:**
- No Stripe integration
- No payment collection
- No upgrade flow
- No downgrade handling
- No invoice generation
- No payment failure recovery

**Pro Features:**
- Backend: `RequirePro()` middleware exists but not enforced
- Database: `organisations.plan` column exists but unused
- Frontend: No "Upgrade to Pro" prompts

#### Business Impact

**Can Launch:**
- ✅ Free tier beta (10-20 companies)
- ✅ Collect feedback
- ✅ Prove product-market fit

**Cannot Do:**
- ❌ Collect revenue
- ❌ Convert free → paid
- ❌ Scale beyond 25 employees (paywall not enforced)

#### Effort to Monetize

**Landing Page (1-2 weeks):**
```
apps/landing/  (Astro SSG)
  src/
    pages/
      index.astro         # Hero, features, CTA
      pricing.astro       # Free vs Pro comparison
      blog/               # SEO content
    components/
      Hero.astro
      FeatureShowcase.astro
      PricingTable.astro
```

**Stripe Integration (1 week):**
```typescript
// Backend: Checkout session creation
POST /api/v1/billing/checkout
{
  "plan": "pro",
  "employees": 50
}

Response: { "checkout_url": "https://checkout.stripe.com/..." }

// Webhook handler
POST /api/v1/billing/webhook
Stripe-Signature: ...

Events:
- checkout.session.completed → Activate Pro
- customer.subscription.updated → Update plan
- invoice.payment_failed → Send reminder email
```

**Pro Feature Gating (2 days):**
```go
// Enforce employee limit
func (s *Service) CreateEmployee(...) {
  org, _ := s.orgRepo.Get(ctx, orgID)
  
  if org.Plan == "free" {
    count, _ := s.repo.Count(ctx, orgID)
    if count >= 25 {
      return apperr.UpgradeRequired("Free tier limited to 25 employees")
    }
  }
}

// Frontend upgrade prompt
if (error.code === 'UPGRADE_REQUIRED') {
  showUpgradeDialog({
    title: "Upgrade to Pro",
    message: "You've hit the 25-employee limit on the free tier.",
    cta: "Upgrade Now"
  })
}
```

**Total Effort:** 3-4 weeks (1-2 landing page, 1 Stripe, 2 days gating)

#### Recommendation

**Phase 1 (Beta):** Launch free tier without monetization
- Focus: Product validation, feedback, bug fixes
- Risk: No revenue, but also no billing bugs

**Phase 2 (Public Launch):** Add Stripe billing
- Trigger: 10+ beta companies using successfully
- Effort: 3-4 weeks (Sprint 14-15)

---

## Critical Bug Triage

### Must Fix Before Beta (P0)

| # | Bug | Severity | Impact | Effort | Owner |
|---|-----|----------|--------|--------|-------|
| 1 | Non-admin 403 on attendance API | 🔴 P0 | Team members can't view attendance | 1 hour | Backend |
| 2 | Sick leave unlimited not supported | 🔴 P0 | Blocks Indonesia/UAE markets | 2 hours | Backend + DB |

**Total P0 Effort:** 3 hours

### Fix in Sprint 11 (P1)

| # | Bug | Severity | Impact | Effort | Owner |
|---|-----|----------|--------|--------|-------|
| 3 | TaskFilters test compilation errors | 🟡 P1 | CI/CD blocked | 30 min | Frontend |
| 4 | Calendar icon invisible | 🟡 P1 | Confusing invite UX | 15 min | Frontend |
| 5 | Done column task not autocomplete | 🟡 P2 | Workflow confusion | 30 min | Backend |

**Total P1 Effort:** 1.25 hours

### Fix in Sprint 12 (P2-P3)

| # | Bug | Severity | Impact | Effort | Owner |
|---|-----|----------|--------|--------|-------|
| 6 | Dock blocking UI when no scroll | 🟢 P3 | Minor layout issue | 30 min | Frontend |

---

## Feature Requests Evaluation

### Your List — Prioritized & Categorized

#### 🔴 CRITICAL (Production Blockers)

1. **✅ Sick leave unlimited database design** ⭐⭐⭐⭐⭐
   - **Status:** BUG (already in bug list above)
   - **Why:** Cannot operate in Indonesia/UAE
   - **Effort:** 2 hours
   - **Sprint:** 11 (immediate)

2. **Attendance revision feature** ⭐⭐⭐⭐⭐
   - **Why:** Compliance requirement (audit trail)
   - **Legal:** GDPR, Indonesian labor law, UAE MOHRE
   - **Effort:** M (3 days)
   - **Sprint:** 11
   - **Impact:** Blocker for EU/regulated markets

3. **Add basic auth to OpenAPI** ⭐⭐⭐
   - **Why:** Developers can't test API in Scalar UI
   - **Effort:** XS (1 hour)
   - **Sprint:** 11
   - **Scope:** Add BasicAuth security scheme to openapi.yaml

#### 🟡 HIGH VALUE (Build Soon)

4. **Claim & Leave policy segmentation** ⭐⭐⭐⭐⭐
   - **Already in backlog:** hr-features.md
   - **Why:** Enterprise customers need per-department policies
   - **Effort:** XL (2 weeks)
   - **Sprint:** 12
   - **Complexity:** New table + conflict resolution

5. **Better UI/UX for claim & leave approval** ⭐⭐⭐⭐
   - **Already in backlog:** "Auto-Task for Approvals"
   - **Why:** Unified approval inbox (reduce context switching)
   - **Effort:** M (4-5 days)
   - **Sprint:** 12

6. **Notification when someone mentions in task comment** ⭐⭐⭐⭐
   - **Why:** Modern UX expectation (Slack, GitHub, Asana)
   - **Effort:** S (2 days)
   - **Sprint:** 11
   - **Scope:** @mention parser + notifications

7. **Configurable workload calculation** ⭐⭐⭐⭐⭐
   - **Why:** Free vs Pro differentiator
   - **Current:** Hard-coded (0-5 available, 6-10 warning, 11+ overload)
   - **Desired:** Org-level config (Pro feature)
   - **Effort:** S (1-2 days)
   - **Sprint:** 12

8. **Employee document upload** ⭐⭐⭐⭐
   - **Status:** Backend exists, frontend missing
   - **Effort:** S (2 days)
   - **Sprint:** 11

#### 🟢 MEDIUM PRIORITY (Nice to Have)

9. **System update & change logs** ⭐⭐⭐
   - **Why:** Transparency builds trust
   - **Effort:** S (1 day)
   - **Sprint:** 12
   - **Scope:** Public changelog page

10. **Done task auto clear in certain days** ⭐⭐⭐
    - **Why:** Reduces kanban clutter
    - **Effort:** S (1 day)
    - **Sprint:** 12
    - **Scope:** Org setting + cron job

11. **Pro feature: Modify kanban board lists** ⭐⭐⭐⭐
    - **Current:** Fixed columns (To Do, In Progress, Done)
    - **Desired:** Custom columns (Pro paywall)
    - **Effort:** M (3 days)
    - **Sprint:** 13

12. **User dropdown with search** ⭐⭐⭐
    - **Why:** UX polish for large teams (50+ employees)
    - **Effort:** S (1 day)
    - **Sprint:** 12

#### ⚪ LOW PRIORITY (Defer to Phase 2)

13. **Customizable overview dashboard (widgets)** ⭐⭐  
    - **Complexity:** XL (3+ weeks)
    - **Value:** Low (most users don't customize dashboards)
    - **Defer:** Phase 2

14. **Monthly basis claim?** ⭐⭐
    - **Unclear:** Need clarification (monthly budget already exists)
    - **Action:** Discuss before prioritizing

15. **Dock (+) button fan menu** ⭐⭐
    - **Why:** Nice animation, low impact
    - **Effort:** S (1 day)
    - **Defer:** Phase 2 (polish sprint)

---

## Production Launch Roadmap

### Phase 1: Beta Launch (3-4 weeks)

#### Sprint 11: Critical Fixes + Quick Wins (1 week)

**Bug Fixes (4 hours):**
- [ ] Fix non-admin attendance API (1 hour)
- [ ] Fix sick leave unlimited (2 hours)
- [ ] Fix TaskFilters test compilation (30 min)
- [ ] Fix calendar icon invisible (15 min)
- [ ] Fix done column autocomplete (30 min)

**Features (3 days):**
- [ ] Attendance revision feature (3 days)
- [ ] Employee document upload UI (2 days)
- [ ] Mention notifications (2 days)
- [ ] Basic auth in OpenAPI (1 hour)

**Testing:**
- [ ] Manual QA of all bugs
- [ ] Smoke test all critical flows

---

#### Sprint 12: Infrastructure + Polish (1 week)

**Infrastructure (3 days):**
- [ ] Set up Railway account
- [ ] Deploy PostgreSQL + Redis
- [ ] Configure S3/MinIO for production
- [ ] Set up SSL (auto with Railway)
- [ ] Configure environment variables
- [ ] Set up monitoring (Railway built-in + Sentry)
- [ ] Configure automatic backups (daily)

**CI/CD (1 day):**
- [ ] GitHub Actions pipeline
- [ ] Automated tests on PR
- [ ] Automated deploy on main branch merge
- [ ] Health check verification post-deploy

**UX Polish (2 days):**
- [ ] Onboarding checklist widget
- [ ] Empty states for all pages
- [ ] Rate limiting on auth endpoints

---

#### Sprint 13: Testing + Beta Prep (1 week)

**Testing (3 days):**
- [ ] E2E test suite (5 critical flows)
- [ ] Load testing (100 concurrent users)
- [ ] Security audit (OWASP checklist)
- [ ] Mobile responsiveness testing

**Documentation (2 days):**
- [ ] User guide (getting started)
- [ ] Admin guide (policy setup, invite employees)
- [ ] API documentation review
- [ ] Beta feedback form

**Compliance (2 days):**
- [ ] Terms of Service (legal review)
- [ ] Privacy Policy (GDPR compliant)
- [ ] Cookie policy
- [ ] Data processing agreement (DPA)

---

### Beta Launch Checklist ✅

**Before inviting first beta customer:**

**Technical:**
- [ ] All P0-P1 bugs fixed
- [ ] Infrastructure deployed and stable (48hr uptime)
- [ ] Monitoring/alerting configured (Sentry + Railway)
- [ ] Database backups automated (daily)
- [ ] E2E tests passing (5 critical flows)
- [ ] SSL certificate valid
- [ ] Health check endpoint responding

**Product:**
- [ ] Onboarding flow tested
- [ ] All core features working (attendance, leave, claims, tasks)
- [ ] Mobile-responsive design verified
- [ ] Empty states added

**Legal:**
- [ ] Terms of Service published
- [ ] Privacy Policy published
- [ ] GDPR compliance verified

**Support:**
- [ ] Support email set up (support@workived.com)
- [ ] Beta feedback form created
- [ ] Admin documentation published
- [ ] FAQ page created

**Beta Customer Criteria:**
- 5-25 employees (target market)
- Indonesia or UAE location
- Willing to provide feedback
- Tolerant of bugs (beta mindset)

**Target:** Invite 3 customers in week 1, 10 customers by week 4

---

### Phase 2: Public Launch (4-6 weeks after beta)

#### Sprint 14-15: Monetization (2 weeks)

**Landing Page (1 week):**
- [ ] Astro marketing site (apps/landing/)
- [ ] Hero section with value prop
- [ ] Feature showcase (screenshots, videos)
- [ ] Pricing page (Free vs Pro comparison)
- [ ] Customer testimonials (from beta)
- [ ] Blog for SEO (3 initial posts)
- [ ] Sign-up CTAs
- [ ] Deploy to Vercel Edge

**Billing (1 week):**
- [ ] Stripe account setup
- [ ] Checkout session creation
- [ ] Webhook handler (subscription events)
- [ ] Pro feature gating middleware
- [ ] Upgrade flow UI
- [ ] Invoice generation
- [ ] Payment failure handling
- [ ] Subscription management portal (Stripe Customer Portal)

---

#### Sprint 16: Advanced Features (1 week)

**Policy Segmentation (5 days):**
- [ ] Design `policy_assignments` table
- [ ] Migration (with conflict resolution logic)
- [ ] Assignment UI (employee/department/job_title)
- [ ] Query logic (hierarchy: employee > dept > org default)
- [ ] Tests (coverage 98%+)

**Approval Inbox (2 days):**
- [ ] Auto-task creation for pending approvals
- [ ] Unified inbox view (leaves + claims)
- [ ] Two-way sync (approve → task completes)

---

#### Sprint 17-18: Scale Prep (2 weeks)

**Infrastructure Migration (optional, if growth requires):**
- [ ] AWS account setup
- [ ] Terraform infrastructure-as-code
- [ ] Kubernetes cluster (EKS)
- [ ] Multi-region deployment (ap-southeast-1, me-south-1)
- [ ] Auto-scaling configuration
- [ ] CDN for static assets (CloudFront)

**Observability:**
- [ ] Datadog APM (if not using Railway)
- [ ] Error tracking (Sentry already done)
- [ ] Log aggregation
- [ ] Dashboards for key metrics:
    - Active users (DAU, MAU)
    - API latency (P50, P95, P99)
    - Error rate
    - Database query time
- [ ] Alerts for critical errors:
    - API error rate >1%
    - Response time >500ms P95
    - Database connection pool >80%

---

### Public Launch Checklist ✅

**Before opening to public:**

**Product:**
- [ ] Landing page live
- [ ] Billing integration tested (10+ test transactions)
- [ ] 10+ beta companies using successfully
- [ ] All critical feedback addressed
- [ ] Mobile app considerations (PWA vs native)

**Marketing:**
- [ ] SEO optimization (meta tags, sitemap)
- [ ] Social media presence (LinkedIn, Twitter)
- [ ] Content marketing plan (blog posts, case studies)
- [ ] Launch announcement drafted
- [ ] Press kit prepared

**Legal:**
- [ ] Security audit complete (pen test)
- [ ] Terms of Service reviewed by lawyer
- [ ] GDPR compliance verified (DPO assigned)
- [ ] Data processing agreements signed
- [ ] Insurance (E&O, cyber liability)

**Support:**
- [ ] Support team trained (or founder ready)
- [ ] Knowledge base published
- [ ] Live chat widget added (optional)
- [ ] SLA defined (response time, uptime)

**Operations:**
- [ ] Incident response plan documented
- [ ] Runbook for common issues
- [ ] Database backup restoration tested
- [ ] Disaster recovery plan

---

## Risk Assessment

### Critical Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
|------|------------|--------|------------|-------|
| **Infrastructure not ready** | HIGH | HIGH | Use Railway for fast deployment | Infra |
| **Compliance gaps (audit trail)** | MEDIUM | HIGH | Comprehensive audit logging (Sprint 11/12) | Backend |
| **Database design flaws** | MEDIUM | HIGH | Fix unlimited leave immediately | Backend |
| **No beta testers** | MEDIUM | HIGH | Leverage founder network (Indonesia, UAE) | PO |
| **Billing bugs lose revenue** | LOW | HIGH | Thorough Stripe testing in sandbox | Backend |
| **Data loss (no backups)** | LOW | CRITICAL | Railway auto-backups + manual verification | Infra |
| **Security breach (multi-tenancy)** | LOW | CRITICAL | Security audit before public launch | Security |

### Technical Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
|------|------------|--------|------------|-------|
| **Performance issues at scale** | MEDIUM | MEDIUM | Load testing (100 users) + caching strategy | Backend |
| **Frontend bundle size too large** | HIGH | MEDIUM | Code splitting (React.lazy) | Frontend |
| **Missing E2E tests** | HIGH | MEDIUM | Sprint 13 priority (5 critical flows) | QA |
| **Cache invalidation bugs** | MEDIUM | MEDIUM | Document cache keys + invalidation rules | Backend |
| **Mobile UX poor** | MEDIUM | MEDIUM | Responsive design audit + fixes | Frontend |

### Business Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
|------|------------|--------|------------|-------|
| **No product-market fit** | MEDIUM | CRITICAL | Beta validation (10+ companies) before scaling | PO |
| **Competitors launch similar features** | MEDIUM | MEDIUM | Speed (ship beta ASAP), unique design | PO |
| **Pricing too high/low** | HIGH | MEDIUM | Beta feedback + competitor analysis | PO |
| **No acquisition channel** | HIGH | HIGH | Landing page + SEO + founder network | Marketing |
| **Customer churn** | MEDIUM | HIGH | Product quality + customer support | PO |

---

## Success Metrics

### Beta Success Criteria (3-4 weeks)

**Adoption:**
- [ ] 10 companies actively using (5+ days/week)
- [ ] 100+ employees managed across all orgs
- [ ] 50+ tasks created
- [ ] 20+ leave requests submitted

**Quality:**
- [ ] <5 critical bugs reported
- [ ] 95% uptime (measured over 30 days)
- [ ] <500ms average API response time (P95)
- [ ] No data loss incidents

**Feedback:**
- [ ] 3+ feature requests captured
- [ ] 7/10 satisfaction score (NPS survey)
- [ ] 2+ customer testimonials collected

### Public Launch Success Criteria (3 months)

**Adoption:**
- [ ] 100+ companies signed up
- [ ] 1000+ employees managed
- [ ] 50% active users (logged in last 7 days)

**Revenue:**
- [ ] 10+ companies upgraded to Pro
- [ ] $500+ MRR (Monthly Recurring Revenue)
- [ ] <10% churn rate

**Quality:**
- [ ] 4.5+ star rating (if reviews enabled)
- [ ] 99% uptime SLA met
- [ ] <2 P0 bugs per month

**Growth:**
- [ ] 20% month-over-month growth
- [ ] 40% conversion rate (signup → active)
- [ ] 10% conversion rate (free → pro)

---

## Key Learnings from 10 Sprints

### What Went Well ✅

1. **Test discipline (Sprints 8-10)**
   - 98% coverage maintained
   - TDD approach caught bugs early
   - Refactoring confidence

2. **Unique design (Sprint 8)**
   - Sticky note kanban differentiates from competitors
   - Memorable brand identity
   - Positive feedback potential

3. **Workload intelligence (Sprint 9)**
   - First competitive moat
   - No competitor has this
   - Clear customer value prop

4. **Modular architecture (Sprint 1)**
   - Easy to add new modules
   - Test isolation works
   - Can extract services later

5. **Country templates (Sprints 4-6)**
   - Reduces customer setup time
   - Shows market understanding
   - Easy to expand (Malaysia, Singapore)

### What Didn't Go Well ⚠️

1. **No E2E tests**
   - Cross-module bugs slip through
   - Integration issues found late
   - Manual QA burden high

2. **Infrastructure deferred too long**
   - Should have deployed earlier
   - Now blocking beta launch
   - "Deploy early, deploy often" lesson

3. **Frontend tests incomplete**
   - Early sprints under-tested
   - Technical debt accumulating
   - Backfill effort needed

4. **No beta customers lined up**
   - Should have recruited sooner
   - Cold start problem for feedback
   - Marketing left too late

5. **Bundle size not monitored**
   - Grew to 1.27 MB unchecked
   - Performance regression
   - Should have had budget alert

### Action Items for Future

1. **E2E tests from day 1** (not Sprint 13)
2. **Deploy to staging weekly** (even incomplete features)
3. **Bundle size budget** (alert if >200 KB)
4. **Beta pipeline** (recruit users while building)
5. **Infra as code from start** (Terraform in Sprint 1)

---

## Final Recommendations

### Immediate Actions (This Week)

1. **Fix 2 critical bugs** (3 hours)
   - Non-admin attendance API (1 hour)
   - Sick leave unlimited (2 hours)

2. **Deploy to Railway** (1 day)
   - Get infrastructure online ASAP
   - Test with production-like data
   - Verify SSL, backups, monitoring

3. **Recruit 3 beta companies** (2 days)
   - Leverage founder network (Indonesia contacts)
   - Offer free Pro features for beta period
   - Set expectations (bugs expected, feedback required)

### Next 2 Weeks (Sprint 11-12)

4. **Build attendance audit trail** (3 days) — Compliance blocker
5. **Add mention notifications** (2 days) — High-value UX
6. **E2E test suite** (3 days) — Prevent regressions
7. **Onboarding UX** (2 days) — First impression matters
8. **Rate limiting** (1 hour) — Security must-have

### Next 2 Months (Sprint 13-15)

9. **Beta testing** (3-4 weeks) — Validate product-market fit
10. **Landing page** (1 week) — Acquisition channel
11. **Stripe billing** (1 week) — Revenue collection
12. **Public launch** 🚀

---

## Strategic Decisions Needed

### Decision 1: Infrastructure Platform

**Options:**
- **A. Railway** ($20/month, 1 day setup) ← Recommended for beta
- **B. AWS EKS** ($350/month, 2 weeks setup) ← Defer to public launch

**Recommendation:** Railway for beta, migrate to AWS when:
- 100+ paying customers
- Need multi-region (Indonesia + UAE)
- Revenue justifies infrastructure investment

---

### Decision 2: Monetization Timing

**Options:**
- **A. Free beta now, add billing later** (2 months) ← Recommended
- **B. Launch with billing from day 1** (4 months delay)

**Recommendation:** Free beta first
- **Why:** Validate product-market fit before billing complexity
- **Risk mitigation:** No billing bugs lose revenue in early days
- **Learning:** Beta feedback informs pricing strategy

---

### Decision 3: Market Focus

**Options:**
- **A. Indonesia only** (simpler, founder network) ← Recommended
- **B. Indonesia + UAE simultaneously** (complex, wider reach)

**Recommendation:** Indonesia first
- **Why:** Founder has network, can provide hands-on support
- **Timeline:** UAE in month 3 (after Indonesia validation)
- **Benefit:** Focus, faster iteration

---

### Decision 4: Mobile Strategy

**Options:**
- **A. PWA only** (current approach) ← Recommended for beta
- **B. Native apps** (iOS + Android)

**Recommendation:** PWA for beta, native later
- **Why:** PWA covers 80% of use cases (HR managers on desktop)
- **Defer:** Native apps when field staff demand justifies investment
- **Timeline:** Sprint 18+ (after public launch)

---

## Summary: Where We Are

### Current State
**✅ 75% complete — Beta-ready in 2 weeks**

**Completed (10 sprints):**
- Complete backend (87+ endpoints)
- Complete frontend (12 routes)
- 61 database migrations
- Unique competitive differentiators (workload intelligence, sticky note kanban)
- 98% test coverage on recent work

**Missing:**
- Production infrastructure (Railway: 1 day)
- 2 critical bugs (3 hours)
- Compliance gaps (attendance audit: 3 days)
- Monetization (defer to Sprint 14-15)
- Marketing (defer to Sprint 14-15)

### Blockers to Beta Launch

**Must Fix (6 hours):**
1. Non-admin attendance API (1 hour)
2. Sick leave unlimited (2 hours)
3. Deploy to Railway (3 hours setup)

**Should Fix (1 week):**
4. Attendance audit trail (3 days)
5. E2E tests (3 days)
6. Onboarding UX (2 days)

### Timeline

**Beta Launch:** 2 weeks from today
- Week 1: Fix critical bugs, deploy infrastructure
- Week 2: Attendance audit, testing, first 3 customers

**Public Launch:** 2-3 months from today
- Month 1: Beta testing (10+ companies)
- Month 2: Monetization (landing page + Stripe)
- Month 3: Marketing + public announcement

---

## You Are Close 🚀

**With focused effort on:**
1. Infrastructure (Railway: 1 day)
2. Critical bugs (3 hours)
3. Compliance (attendance audit: 3 days)

**You can have beta customers in 2 weeks.**

The product is solid. The architecture is sound. The differentiators are unique.

**Next step:** Fix the 2 critical bugs, deploy to Railway, invite your first beta customer.

---

**End of Production Readiness Review**  
**Date:** March 21, 2026  
**Signed:** Full Team (PO, Architect, Designer, Engineer, QA, Security, Infra)

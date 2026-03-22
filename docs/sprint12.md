# Sprint 12 — Attendance Dashboard Revamp

**Duration:** March 22, 2026 - March 29, 2026 (1 week)  
**Status:** 🎯 Planned  
**Team:** Full-stack  
**Type:** Feature enhancement — Role-based attendance views

---

## 📋 Previous Sprint Summary

### Sprint 11 Completed ✅ (March 22, 2026) — Leave & Claim Approval UX Revamp
- ✅ **Modal-based submission** — No page navigation, inline approval workflow
- ✅ **Shared component architecture:**
  - `RequestListItem` — Compact row with inline actions (~300 lines)
  - `EmployeeRequestGroup` — Collapsible groups with bulk actions (~200 lines)  
  - `RequestDetailsModal` — Generic details modal (~150 lines)
- ✅ **Config-driven design** — `createLeaveRequestConfig()` and `createClaimRequestConfig()` factories
- ✅ **Two-column dashboard layout** — Balances + tabbed requests
- ✅ **Grouped approvals by employee** — Bulk approve/reject with summary
- ✅ **Smart default tab** — Shows "My Requests" when no pending approvals
- ✅ **Money formatting** — Compact format (Rp 499K instead of Rp 499.000)
- ✅ **Progress bars** — Visual budget/balance remaining with percentage badges
- ✅ **Removed 11 unused files** — Standalone pages, old dialog components
- ✅ **Impact:** ~1350 lines removed net (-40% code reduction)

### Key Outcomes
- **UX Excellence:** Industry-leading approval workflow (faster than any competitor)
- **Code Quality:** Shared components eliminate duplication across modules
- **Developer Velocity:** Config-based architecture makes new modules 3x faster to build
- **User Impact:** Approval flow reduced from 4 clicks/2 pages to 1 click inline

---

## 🎯 Current Sprint (Sprint 12)

### Sprint Vision
> "Fix security + add role-based views. Keep the excellent clock-in/out UX, just add smart filtering."

### Goals
1. **Fix security flaw** — Employees should only see their own attendance by default
2. **Add role-based tabs** — Simple tabbed view (like Leave/Claims) instead of complex multi-page architecture
3. **Add historical summaries** — "This Week" and "This Month" quick views
4. **Manager team view** — Filter to just subordinates, see team summary stats
5. **Keep existing UX** — Don't touch QuickClock, hero stats, or live clock (already perfect)

### Customer Outcome
> "As an employee, I see MY attendance first. As a manager, one click shows my team's attendance with this week's summary. Simple."

---

## 🏗️ What We're Building

### 1. ⭐⭐⭐⭐⭐ Tab-Based Role Views (Inspired by Sprint 11 Pattern)

**Apply Sprint 11's shared component pattern to attendance**

#### UI Structure: Simple Tabs (Not Separate Pages)

**Employee View (Default for all users):**
```
┌─────────────────────────────────────────────────────┐
│ 📊 My Attendance (Tab)                               │
├─────────────────────────────────────────────────────┤
│ [Live Clock Block - Exists, keep as-is]            │
│ [QuickClock component - Exists, keep as-is]        │
├─────────────────────────────────────────────────────┤
│ This Week Summary:                                  │
│ ✅ On-time: 4 days  ⏰ Late: 1 day  ❌ Absent: 0    │
├─────────────────────────────────────────────────────┤
│ Recent Records:                                     │
│ [List of MY attendance only - filter API response] │
└─────────────────────────────────────────────────────┘
```

**Manager View (If user has subordinates):**
```
┌───────────────────────────────────────────────────────┐
│ [My Attendance] [Team Attendance]  ← Two tabs         │
├───────────────────────────────────────────────────────┤
│ Team Attendance (5 people):                           │
├───────────────────────────────────────────────────────┤
│ This Week:  ✅ 18 on-time  ⏰ 2 late  ❌ 0 absent     │
├───────────────────────────────────────────────────────┤
│ [Same list view, filtered to subordinates only]      │
└───────────────────────────────────────────────────────┘
```

**Admin View (HR permission):**
```
┌───────────────────────────────────────────────────────┐
│ [My Attendance] [Team] [All Employees]  ← Three tabs  │
├───────────────────────────────────────────────────────┤
│ All Employees (23 people):                            │
├───────────────────────────────────────────────────────┤
│ This Week:  ✅ 92 on-time  ⏰ 8 late  ❌ 3 absent     │
├───────────────────────────────────────────────────────┤ │ [Same list view, no filter - all org]                │
└───────────────────────────────────────────────────────┘
```

**Key Design Decisions:**
1. ✅ **Reuse existing UI** — Keep hero clock, QuickClock, list layout
2. ✅ **Add tabs** — Simple tab switcher (like Leave/Claims)
3. ✅ **Filter data, not UI** — Same component, different API filters
4. ✅ **Add summary widgets** — Simple "This Week" stats above list
5. ❌ **No calendars** — Too complex, defer to Pro tier
6. ❌ **No heatmaps** — Overkill for MVP
7. ❌ **No CSV export yet** — Can add when users ask

---

### 2. ⭐⭐⭐⭐ Backend: Role-Based API Filtering

**Current Problem:**
```go
// Current: GET /attendance/daily/:date
// Returns: ALL employees in org (security flaw)
func (h *AttendanceHandler) GetDailyReport(c *gin.Context) {
  // No filtering - shows everyone
  entries, _ := h.service.GetDailyReport(orgID, date)
  c.JSON(200, entries)
}
```

**Fixed Approach:**
```go
// New: GET /attendance/my
// Returns: Only current user's records
func (h *AttendanceHandler) GetMyAttendance(c *gin.Context) {
  user := getUserFromContext(c)
  entries := h.service.GetAttendanceByEmployee(user.EmployeeID, dateRange)
  c.JSON(200, entries)
}

// New: GET /attendance/team  
// Returns: Only subordinates' records
// Permission: Must be a manager (checked via subordinates count)
func (h *AttendanceHandler) GetTeamAttendance(c *gin.Context) {
  user := getUserFromContext(c)
  subordinateIDs := h.service.GetSubordinateIDs(user.EmployeeID)
  if len(subordinateIDs) == 0 {
    return c.JSON(403, gin.H{"error": "Not a manager"})
  }
  entries := h.service.GetAttendanceByEmployees(subordinateIDs, dateRange)
  c.JSON(200, entries)
}

// Modified: GET /attendance/daily/:date
// Returns: Filtered by role
// Permission: Admin only for org-wide
func (h *AttendanceHandler) GetDailyReport(c *gin.Context) {
  user := getUserFromContext(c)
  if !user.HasPermission("manage_hr") && !user.HasPermission("manage_attendance") {
    return c.JSON(403, gin.H{"error": "Admin permission required"})
  }
  // Same logic as before, but now protected
  entries := h.service.GetDailyReport(orgID, date)
  c.JSON(200, entries)
}
```

**API Endpoints:**
- `GET /api/v1/attendance/my?from=2026-03-17&to=2026-03-22` — My records (everyone)
- `GET /api/v1/attendance/team?from=2026-03-17&to=2026-03-22` — Team records (managers)
- `GET /api/v1/attendance/daily/:date` — All org (admins only - existing endpoint, add permission check)
- `GET /api/v1/attendance/my/summary?period=week|month` — My summary stats
- `GET /api/v1/attendance/team/summary?period=week|month` — Team summary stats

**No new tables needed** — Use existing `attendance` table with filtering

---

### 3. ⭐⭐⭐ Frontend: Tab-Based UI (Reuse Sprint 11 Pattern)

**New hook: `useAttendanceRole()`**
```typescript
export function useAttendanceRole() {
  const { user } = useAuth()
  const { data: subordinates } = useQuery({
    queryKey: ['subordinates', user?.employee_id],
    queryFn: () => api.get(`/employees?reporting_to=${user.employee_id}`),
  })
  
  const isManager = (subordinates?.length ?? 0) > 0
  const isAdmin = user?.permissions?.includes('manage_hr') || 
                  user?.permissions?.includes('manage_attendance')
  
  return {
    canViewOwn: true,           // Everyone
    canViewTeam: isManager,     // Has subordinates
    canViewAll: isAdmin,        // HR permission
  }
}
```

**Updated page structure:**
```typescript
function AttendancePage() {
  const { canViewOwn, canViewTeam, canViewAll } = useAttendanceRole()
  const [activeTab, setActiveTab] = useState<'my' | 'team' | 'all'>('my')
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today')
  
  // Smart default: always start with 'my' (simplest view)
  useEffect(() => {
    setActiveTab('my')
  }, [])
  
  return (
    <div>
      {/* Hero clock block - Keep as-is */}
      <HeroClockBlock />
      
      {/* QuickClock - Keep as-is */}
      {dateRange === 'today' && <QuickClock />}
      
      {/* NEW: Tab switcher */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tab value="my">My Attendance</Tab>
        {canViewTeam && <Tab value="team">Team Attendance</Tab>}
        {canViewAll && <Tab value="all">All Employees</Tab>}
      </Tabs>
      
      {/* NEW: Date range selector */}
      <DateRangeSelector value={dateRange} onChange={setDateRange} />
      
      {/* NEW: Summary widget (only for week/month) */}
      {dateRange !== 'today' && <SummaryWidget tab={activeTab} range={dateRange} />}
      
      {/* Existing list - same UI, different data source */}
      <AttendanceList tab={activeTab} range={dateRange} />
    </div>
  )
}
```

**Components to create:**
1. `AttendanceTabs.tsx` — Simple tab switcher (20 lines)
2. `DateRangeSelector.tsx` — Today / This Week / This Month (30 lines)
3. `AttendanceSummaryWidget.tsx` — Stats card (50 lines)
4. Refactor existing list into `AttendanceList.tsx` with props

---

## 🚫 Out of Scope (Keep Sprint Simple)

### Not Doing This Sprint:
- ❌ Calendar views (too complex, defer to Pro tier)
- ❌ Heatmaps (visual overkill)
- ❌ CSV export (wait for user requests)
- ❌ Attendance corrections workflow (separate sprint)
- ❌ Late/absent notifications (separate sprint)
- ❌ Geofencing (Pro feature, separate sprint)
- ❌ Face verification (Pro feature, separate sprint)
- ❌ Shift scheduling integration (separate sprint)

**Why defer these:**
- Clock-in/out already works perfectly
- Focus on access control + simple historical view
- Add advanced features only when users request them
- Sprint 11 taught us: Simple wins > feature bloat
      c.Next()
    case "team":
      // Must be a manager (has subordinates)
      hasSubordinates := checkHasSubordinates(user.EmployeeID)
      if !hasSubordinates {
        c.JSON(403, gin.H{"error": "Not a manager"})
        c.Abort()
        return
      }
      c.Next()
    case "all":
      // Must have manage_hr or manage_attendance permission
      if !user.HasPermission("manage_hr") && !user.HasPermission("manage_attendance") {
        c.JSON(403, gin.H{"error": "Insufficient permissions"})
        c.Abort()
        return
      }
      c.Next()
    }
  }
}
```

---

### Technical Architecture

#### Database Schema (No changes needed)
Current `attendance` table already supports this:
```sql
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  status attendance_status NOT NULL, -- 'present', 'late', 'absent', 'leave', 'half_day'
  notes TEXT,
  ...
);
```

**Query patterns:**
- Own records: `WHERE employee_id = $1 AND organisation_id = $2`
- Team records: `WHERE employee_id IN (SELECT id FROM employees WHERE reporting_to = $1) AND organisation_id = $2`
- All records: `WHERE organisation_id = $1`

#### API Endpoints

**New endpoints:**
```
GET    /api/v1/attendance/my                     # Own records
GET    /api/v1/attendance/team                   # Subordinates (manager)
GET    /api/v1/attendance/team/summary           # Team stats aggregated
GET    /api/v1/attendance/all                    # All employees (admin)
GET    /api/v1/attendance/all/summary            # Org-wide stats (admin)
POST   /api/v1/attendance/clock-in               # Clock in
POST   /api/v1/attendance/clock-out              # Clock out
PUT    /api/v1/attendance/:id/request-correction # Request manual correction
PUT    /api/v1/attendance/:id/override           # Admin override
```

**Existing endpoints to update:**
- `GET /api/v1/attendance` — Currently returns all org records, needs permission check

#### Frontend Components

**New shared components:**
```
/components/workived/attendance/
  ├── AttendanceCalendar.tsx       # Calendar view with status colors
  ├── AttendanceList.tsx           # Sortable table view
  ├── AttendanceCard.tsx           # Single attendance record card
  ├── AttendanceStats.tsx          # Statistics widget (on-time %, late %)
  ├── TeamAttendanceSummary.tsx    # Manager view: subordinates summary
  ├── AllEmployeesTable.tsx        # Admin view: all employees table
  ├── ClockInOutControls.tsx       # Quick clock-in/out buttons
  └── AttendanceFilters.tsx        # Date range, status, employee filters
```

**Page structure:**
```
/routes/_app/attendance/
  └── index.tsx                    # Main attendance dashboard (role-based tabs)
```

**Role detection hook:**
```typescript
// hooks/useAttendanceRole.ts
export function useAttendanceRole() {
  const { user } = useAuth()
  const { data: subordinates } = useQuery({
    queryKey: ['subordinates', user?.employee_id],
    queryFn: () => api.get(`/employees?reporting_to=${user.employee_id}`),
    enabled: !!user?.employee_id
  })
  
  const isManager = subordinates && subordinates.length > 0
  const isAdmin = user?.permissions?.includes('manage_hr') || 
                  user?.permissions?.includes('manage_attendance')
  
  return {
    canViewOwn: true,
    canViewTeam: isManager,
    canViewAll: isAdmin,
    subordinateCount: subordinates?.length || 0
  }
}
```

#### UI Design Patterns

**Tab structure (dynamic based on role):**
- **Employee:** 1 tab only ("My Attendance")
- **Manager:** 2 tabs ("My Attendance" | "Team Attendance")  
- **Admin:** 3 tabs ("My Attendance" | "Team Attendance" | "All Employees")

**Consistent with leave/claim revamp:**
- Two-column layout: Stats/filters (left) + Main content (right)
- Smart default tab: Show most relevant view first
- Inline actions where possible
- Modal-based detail views

**Color coding for attendance status:**
- ✅ **Present/On-time:** Green (`colors.ok`)
- ⏰ **Late:** Yellow (`colors.warn`)
- ❌ **Absent:** Red (`colors.err`)
- 🏖️ **Leave:** Blue (`colors.info`)
- 🕐 **Half-day:** Orange (`colors.warnDim`)

---

## 🏗️ Implementation Checklist (Simplified, 3 days total)

### Backend (2 days)

**Day 1: API Endpoints + Permission Middleware**
- [ ] Add permission check to existing `GET /api/v1/attendance/daily/:date` (admin only)
- [ ] Create `GET /api/v1/attendance/my?from=X&to=Y` (own records, everyone)
- [ ] Create `GET /api/v1/attendance/team?from=X&to=Y` (subordinates, managers)
- [ ] Create `GET /api/v1/attendance/my/summary?period=week|month` (own stats)
- [ ] Create `GET /api/v1/attendance/team/summary?period=week|month` (team stats)
- [ ] Create middleware: `CheckIsManager()` (validates subordinates exist)
- [ ] Create helper: `GetSubordinateIDs(employeeID)` in repository
- [ ] Add tests for all endpoints (98% coverage)

**Day 2: Repository + Service Layer**
- [ ] Implement `GetAttendanceByEmployee(employeeID, dateRange)` in repository
- [ ] Implement `GetAttendanceByEmployees(employeeIDs, dateRange)` for team view
- [ ] Implement `GetAttendanceSummary(employeeIDs, period)` aggregation query
  ```sql
  SELECT 
    COUNT(*) FILTER (WHERE status = 'present') as on_time,
    COUNT(*) FILTER (WHERE status = 'late') as late,
    COUNT(*) FILTER (WHERE status = 'absent') as absent
  FROM attendance
  WHERE employee_id = ANY($1) 
    AND date >= $2 AND date <= $3
    AND organisation_id = $4
  ```
- [ ] Add service layer tests
- [ ] Update OpenAPI spec with new endpoints

### Frontend (1 day)

**Day 3: UI Refactor + New Components**
- [ ] Create `useAttendanceRole()` hook (20 lines)
- [ ] Create `AttendanceTabs` component (30 lines)
- [ ] Create `DateRangeSelector` component (Today/Week/Month, 40 lines)
- [ ] Create `AttendanceSummaryWidget` component (stats card, 60 lines)
- [ ] Refactor existing list into `AttendanceList.tsx`:
  - Extract from index.tsx (reuse existing code)
  - Add props: `filter: 'my' | 'team' | 'all'`
  - Add date range support
- [ ] Update `index.tsx`:
  - Add tab state management
  - Add date range state
  - Connect to new API endpoints
  - Keep existing hero clock + QuickClock
- [ ] Add TanStack Query hooks:
  - `useMyAttendance(dateRange)`
  - `useTeamAttendance(dateRange)`
  - `useMyAttendanceSummary(period)`
  - `useTeamAttendanceSummary(period)`
- [ ] Component tests for new widgets
- [ ] Manual testing: All three role scenarios

---

## 🧪 Testing Strategy

### Unit Tests
- **Backend:** 98% coverage on new endpoints, repository methods
- **Frontend:** Core components (tabs, date selector, summary widget)

### Integration Tests
- **API Permission Tests:**
  - Regular user can access `GET /attendance/my` → 200
  - Regular user cannot access `GET /attendance/daily/:date` → 403 (changed from 200 currently)
  - Non-manager cannot access `GET /attendance/team` → 403
  - Manager can access `GET /attendance/team` → 200 with subordinates only
  - Admin can access `GET /attendance/daily/:date` → 200 with all org records

### Manual Testing Scenarios
1. **As Employee:**
   - Default view shows "My Attendance" tab only
   - See only my records (not other employees)
   - QuickClock works for today
   - Can switch to "This Week" range, see summary stats
   - Cannot see "Team" or "All Employees" tabs

2. **As Manager:**
   - See "My Attendance" + "Team Attendance" tabs
   - Team tab shows only subordinates (not all org)
   - Team summary shows this week's on-time/late/absent counts
   - Can toggle between my records and team records

3. **As Admin:**
   - See all three tabs
   - "All Employees" tab shows organization-wide data (existing functionality preserved)
   - Can filter by date range
   - Summary stats accurate for org-wide view

---

## 📊 Success Criteria

### Technical
- ✅ Security fixed: Regular employees no longer see all org attendance
- ✅ Role-based tabs work correctly (dynamic based on permissions)
- ✅ API endpoints return filtered data based on role
- ✅ Existing UX preserved (hero clock, QuickClock, list layout)
- ✅ Date range selector adds "This Week" and "This Month" views
- ✅ Summary widgets show accurate aggregated stats
- ✅ 98%+ test coverage on new code
- ✅ No performance regression (queries remain fast with filters)

### User Experience
- ✅ Default view always shows "My Attendance" (simplest first)
- ✅ Managers can switch to team view in 1 click
- ✅ Admins can see org-wide in 1 click
- ✅ Clock-in/out flow unchanged (still works perfectly)
- ✅ Historical view (week/month) adds value without complexity
- ✅ Mobile responsive (tabs work on small screens)

### Business Impact
- ✅ Security compliant (GDPR: employees only see their own data)
- ✅ Manager utility increased (can now track team attendance)
- ✅ Admin oversight improved (can filter to relevant data)
- ✅ Foundation ready for future features (corrections, notifications)

---

## 🚀 Next Sprint Plan (Sprint 13)

### Option 1: Infrastructure & Beta Launch ⭐⭐⭐⭐⭐
**Why now:** Core features complete, need user feedback
- Railway deployment (1-2 days)
- Sentry monitoring (1 day)
- Beta landing page (1 day)
- Onboard first 5-10 companies
- **Value:** Get product in front of real users

### Option 2: Attendance Corrections Workflow ⭐⭐⭐⭐
**Why:** Natural follow-up to Sprint 12 (attendance views)
- Employees request attendance corrections
- Managers approve/reject correction requests
- Apply Sprint 11's shared component pattern
- **Value:** Complete attendance feature set

### Option 3: Pro Features (Geofencing, Shift Scheduling) ⭐⭐⭐
**Why:** Monetization unlock
- GPS geofencing for clock-in validation
- Shift scheduling per employee/department
- Upgrade triggers for Pro tier
- **Value:** Revenue-generating features

**Recommendation:** Infrastructure (Option 1) — Need to validate product-market fit with real users before building more features.

### Deferred Features
- ❌ Attendance analytics dashboard (wait for user requests)
- ❌ CSV export (add if users ask)
- ❌ Calendar views (defer to Pro tier)
- ❌ Face verification (Pro feature, later)

---

## 📊 Sprint Metrics (Target)

- **Backend:** 5 new API endpoints (my, team, summaries)
- **Frontend:** 4 new components (tabs, date selector, summary widget, refactored list)
- **Code reduction:** ~100 lines (extract list, add widgets = net minor addition)
- **Security fix:** 100% (role-based access enforced)
- **Test coverage:** 98%+ on new code
- **Migrations:** 0 (no schema changes)
- **Duration:** 3 days (simplified scope)

---

## 🏗️ Technical Architecture Plan

### Current API State (✅ Already Built)

**Existing Endpoints:**
```
POST   /api/v1/attendance/clock-in              ✅ Working
POST   /api/v1/attendance/clock-out             ✅ Working  
GET    /api/v1/attendance/today/:employee_id    ✅ Working
GET    /api/v1/attendance/daily?date=YYYY-MM-DD ✅ Working (but NO permission check — security issue)
GET    /api/v1/attendance/monthly?year=X&month=Y ✅ Working (admin only)
GET    /api/v1/attendance/monthly/:employee_id  ✅ Working
```

**Existing Types:**
```go
type Record struct {
  ID, OrganisationID, EmployeeID uuid.UUID
  Date string  // YYYY-MM-DD
  ClockInAt time.Time
  ClockOutAt *time.Time
  IsLate bool
  Note *string
}

type DailyEntry struct {
  EmployeeID, EmployeeName string
  Status string  // "present", "late", "absent"
  ClockInAt, ClockOutAt *time.Time
}

type MonthlySummary struct {
  EmployeeID, EmployeeName string
  Present, Late, Absent, WorkingDays int
}
```

**Existing Repository Methods:**
- `ListByDate(orgID, date)` — Gets all employees for a date ✅
- `ListByMonth(orgID, year, month)` — Gets all records for a month ✅
- `ListByEmployeeMonth(orgID, employeeID, year, month)` — Per-employee month ✅

---

### What's Missing for Sprint 12

#### Backend Gaps:

1. **✅ Data Layer: COMPLETE** — All needed repository methods exist
2. **✅ Service Layer: MOSTLY COMPLETE** — Has DailyReport and MonthlySummary
3. **❌ Permission Middleware: MISSING** — No role-based filtering
4. **❌ New API Endpoints: NEED 4 NEW**
   - `/attendance/my/week?start_date=YYYY-MM-DD` — My week calendar
   - `/attendance/team/week?start_date=YYYY-MM-DD` — Team week calendar (managers)
   - `/attendance/my/summary?period=week` — My summary stats
   - `/attendance/team/summary?period=week` — Team summary stats

5. **❌ Subordinate Helper: MISSING**
   - Need `GetSubordinateIDs(employeeID)` in employee repository
   - Used to check if user is a manager

---

###Backend Architecture (2 days)

#### Day 1: New Endpoints + Middleware

**File: `services/internal/attendance/handler.go`**

Add new endpoints:
```go
// Additions to RegisterRoutes:
att.GET("/my/week", middleware.Require(middleware.PermSelfAttendance), h.GetMyWeek)
att.GET("/team/week", middleware.RequireManager(), h.GetTeamWeek)  // NEW MIDDLEWARE
att.GET("/my/summary", middleware.Require(middleware.PermSelfAttendance), h.GetMySummary)
att.GET("/team/summary", middleware.RequireManager(), h.GetTeamSummary)

// Fix existing endpoint (add permission check):
att.GET("/daily", middleware.RequireAny(middleware.PermAttendanceRead, middleware.PermSelfAttendance), h.DailyReport)
// Currently: No permission check — SECURITY FLAW, anyone can see all org data
// After fix: /daily only for admins (PermAttendanceRead), regular users use /my/week
```

**New handler methods:**
```go
func (h *Handler) GetMyWeek(c *gin.Context) {
  orgID := middleware.OrgIDFromCtx(c)
  userID := middleware.UserIDFromCtx(c)
  employeeID, _ := h.empLookup(c, orgID, userID)
  
  startDate := c.Query("start_date")  // YYYY-MM-DD (Monday)
  // Fetch 7 days of attendance for this employee
  week, _ := h.service.GetEmployeeWeek(c, orgID, employeeID, startDate)
  c.JSON(200, gin.H{"data": week})
}

func (h *Handler) GetTeamWeek(c *gin.Context) {
  orgID := middleware.OrgIDFromCtx(c)
  userID := middleware.UserIDFromCtx(c)
  employeeID, _ := h.empLookup(c, orgID, userID)
  
  startDate := c.Query("start_date")
  // Get subordinates, then fetch their week
  week, _ := h.service.GetTeamWeek(c, orgID, employeeID, startDate)
  c.JSON(200, gin.H{"data": week})
}

func (h *Handler) GetMySummary(c *gin.Context) {
  period := c.Query("period")  // "week" or "month"
  // Return on-time/late/absent counts
}

func (h *Handler) GetTeamSummary(c *gin.Context) {
  period := c.Query("period")
  // Aggregate team stats
}
```

**File: `services/internal/platform/middleware/permissions.go`**

Add new middleware:
```go
// RequireManager checks if user has subordinates (is a manager)
func RequireManager() gin.HandlerFunc {
  return func(c *gin.Context) {
    orgID := OrgIDFromCtx(c)
    userID := UserIDFromCtx(c)
    
    // Get employee ID
    empID, err := employeeRepo.GetEmployeeIDByUserID(c, orgID, userID)
    if err != nil {
      c.JSON(403, gin.H{"error": "Not a manager"})
      c.Abort()
      return
    }
    
    // Check subordinates
    subordinates, _ := employeeRepo.GetSubordinateIDs(c, orgID, empID)
    if len(subordinates) == 0 {
      c.JSON(403, gin.H{"error": "No subordinates found"})
      c.Abort()
      return
    }
    
    c.Next()
  }
}
```

#### Day 2: Service Layer + Repository Helper

**File: `services/internal/attendance/service.go`**

Add new service methods:
```go
type WeekDay struct {
  Date       string     `json:"date"`        // YYYY-MM-DD
  DayName    string     `json:"day_name"`    // "Mon", "Tue"
  DayNumber  int        `json:"day_number"`  // 18, 19
  Status     string     `json:"status"`      // "on-time", "late", "absent", "future", "weekend"
  ClockInAt  *time.Time `json:"clock_in_at,omitempty"`
  ClockOutAt *time.Time `json:"clock_out_at,omitempty"`
  IsToday    bool       `json:"is_today"`
}

type WeekCalendar struct {
  StartDate string    `json:"start_date"`  // Monday
  EndDate   string    `json:"end_date"`    // Sunday
  Days      []WeekDay `json:"days"`
}

func (s *Service) GetEmployeeWeek(ctx, orgID, employeeID uuid.UUID, startDate string) (*WeekCalendar, error) {
  // Parse startDate (should be Monday)
  start, _ := time.Parse("2006-01-02", startDate)
  
  // Generate 7 days (Mon-Sun)
  days := make([]WeekDay, 7)
  for i := 0; i < 7; i++ {
    date := start.AddDate(0, 0, i)
    dateStr := date.Format("2006-01-02")
    
    // Fetch attendance record
    record, err := s.repo.GetByEmployeeAndDate(ctx, orgID, employeeID, dateStr)
    
    day := WeekDay{
      Date:      dateStr,
      DayName:   date.Format("Mon"),  // "Mon", "Tue", etc
      DayNumber: date.Day(),           // 18, 19, etc
      IsToday:   dateStr == time.Now().Format("2006-01-02"),
    }
    
    // Determine status
    if date.After(time.Now()) {
      day.Status = "future"
    } else if date.Weekday() == 0 || date.Weekday() == 6 {
      day.Status = "weekend"
    } else if record != nil {
      day.ClockInAt = &record.ClockInAt
      day.ClockOutAt = record.ClockOutAt
      if record.IsLate {
        day.Status = "late"
      } else {
        day.Status = "on-time"
      }
    } else {
      day.Status = "absent"
    }
    
    days[i] = day
  }
  
  return &WeekCalendar{
    StartDate: startDate,
    EndDate:   start.AddDate(0, 0, 6).Format("2006-01-02"),
    Days:      days,
  }, nil
}

func (s *Service) GetTeamWeek(ctx, orgID, managerEmployeeID uuid.UUID, startDate string) (map[string]*WeekCalendar, error) {
  // Get subordinates
  subordinates, _ := s.repo.GetSubordinateIDs(ctx, orgID, managerEmployeeID)
  
  // Fetch week for each subordinate
  result := make(map[string]*WeekCalendar)
  for _, subID := range subordinates {
    week, _ := s.GetEmployeeWeek(ctx, orgID, subID, startDate)
    result[subID.String()] = week
  }
  
  return result, nil
}

// For summary stats (week):
func (s *Service) GetWeekSummary(ctx, orgID, employeeID uuid.UUID, startDate string) (*WeekSummary, error) {
  // Count on-time/late/absent for the week
  // Similar logic to MonthlySummary but for 7 days only
}
```

**File: `services/internal/employee/repository.go`**

Add subordinate helper:
```go
// GetSubordinateIDs returns employee IDs reporting to the given manager
func (r *Repository) GetSubordinateIDs(ctx context.Context, orgID, managerEmployeeID uuid.UUID) ([]uuid.UUID, error) {
  rows, err := r.db.Query(ctx, `
    SELECT id
    FROM employees
    WHERE organisation_id = $1
      AND reporting_to = $2
      AND is_active = TRUE
  `, orgID, managerEmployeeID)
  if err != nil {
    return nil, err
  }
  defer rows.Close()
  
  var ids []uuid.UUID
  for rows.Next() {
    var id uuid.UUID
    rows.Scan(&id)
    ids = append(ids, id)
  }
  return ids, rows.Err()
}
```

---

### Frontend Architecture (1 day)

#### New Components

**File: `apps/web/src/components/workived/attendance/AttendanceWeekCalendar.tsx`**
```tsx
interface WeekDay {
  date: string
  dayName: string
  dayNumber: number
  status: 'on-time' | 'late' | 'absent' | 'future' | 'weekend'
  clockInAt?: string
  clockOutAt?: string
  isToday: boolean
}

interface AttendanceWeekCalendarProps {
  week: WeekDay[]
  selectedDate: string | null
  onSelectDate: (date: string) => void
}

export function AttendanceWeekCalendar({ week, selectedDate, onSelectDate }) {
  return (
    <div className="week-calendar">
      {week.map(day => (
        <WeekDayCard 
          key={day.date}
          day={day}
          isSelected={day.date === selectedDate}
          onClick={() => onSelectDate(day.date)}
        />
      ))}
    </div>
  )
}
```

**File: `apps/web/src/components/workived/attendance/AttendanceTabs.tsx`**
```tsx
// Same pattern as leave/claims tabs
export function AttendanceTabs({ activeTab, onTabChange, canViewTeam, canViewAll }) {
  return (
    <div className="tabs">
      <TabButton active={activeTab === 'my'} onClick={() => onTabChange('my')}>
        My Attendance
      </TabButton>
      {canViewTeam && (
        <TabButton active={activeTab === 'team'} onClick={() => onTabChange('team')}>
          Team Attendance
        </TabButton>
      )}
      {canViewAll && (
        <TabButton active={activeTab === 'all'} onClick={() => onTabChange('all')}>
          All Employees
        </TabButton>
      )}
    </div>
  )
}
```

**File: `apps/web/src/lib/hooks/useAttendance.ts`**

Add new hooks:
```tsx
export function useMyWeek(startDate: string) {
  return useQuery({
    queryKey: ['attendance', 'my', 'week', startDate],
    queryFn: () => attendanceApi.getMyWeek(startDate).then(r => r.data.data),
    enabled: !!startDate,
  })
}

export function useTeamWeek(startDate: string) {
  return useQuery({
    queryKey: ['attendance', 'team', 'week', startDate],
    queryFn: () => attendanceApi.getTeamWeek(startDate).then(r => r.data.data),
    enabled: !!startDate,
  })
}

export function useAttendanceRole() {
  const { user } = useAuth()
  const { data: subordinates } = useQuery({
    queryKey: ['employees', 'subordinates', user?.employee_id],
    queryFn: () => api.get(`/employees?reporting_to=${user.employee_id}`).then(r => r.data.data),
    enabled: !!user?.employee_id
  })
  
  const isManager = (subordinates?.length ?? 0) > 0
  const isAdmin = user?.permissions?.includes('manage_hr') || 
                  user?.permissions?.includes('manage_attendance')
  
  return {
    canViewOwn: true,
    canViewTeam: isManager,
    canViewAll: isAdmin,
  }
}
```

**File: `apps/web/src/lib/api/attendance.ts`**

Add new API methods:
```tsx
export const attendanceApi = {
  // Existing methods...
  clockIn: (data) => api.post('/attendance/clock-in', data),
  clockOut: (data) => api.post('/attendance/clock-out', data),
  getToday: (empId) => api.get(`/attendance/today/${empId}`),
  dailyReport: (date) => api.get(`/attendance/daily?date=${date}`),
  
  // NEW methods:
  getMyWeek: (startDate: string) => 
    api.get(`/attendance/my/week?start_date=${startDate}`),
  getTeamWeek: (startDate: string) => 
    api.get(`/attendance/team/week?start_date=${startDate}`),
  getMySummary: (period: 'week' | 'month') => 
    api.get(`/attendance/my/summary?period=${period}`),
  getTeamSummary: (period: 'week' | 'month') => 
    api.get(`/attendance/team/summary?period=${period}`),
}
```

---

### Database Compatibility

**✅ No migrations needed!** All required data already exists:

```sql
-- Existing tables (already created):
attendance_records (
  id, organisation_id, employee_id,
  date,           -- YYYY-MM-DD ✅
  clock_in_at,    -- timestamptz ✅
  clock_out_at,   -- timestamptz ✅
  is_late,        -- boolean ✅
  note
)

employees (
  id, organisation_id,
  reporting_to    -- uuid (self-reference) ✅
)
```

**Indexes to check/add:**
```sql
-- Should already exist, but verify:
CREATE INDEX IF NOT EXISTS idx_attendance_org_date 
  ON attendance_records (organisation_id, date);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date 
  ON attendance_records (employee_id, date);

CREATE INDEX IF NOT EXISTS idx_employees_reporting_to
  ON employees (reporting_to) WHERE is_active = TRUE;
```

---

### API Response Examples

**GET /api/v1/attendance/my/week?start_date=2026-03-17**
```json
{
  "data": {
    "start_date": "2026-03-17",
    "end_date": "2026-03-23",
    "days": [
      {
        "date": "2026-03-17",
        "day_name": "Mon",
        "day_number": 17,
        "status": "on-time",
        "clock_in_at": "2026-03-17T08:05:00Z",
        "clock_out_at": "2026-03-17T17:00:00Z",
        "is_today": false
      },
      {
        "date": "2026-03-18",
        "day_name": "Tue",
        "day_number": 18,
        "status": "late",
        "clock_in_at": "2026-03-18T09:15:00Z",
        "clock_out_at": "2026-03-18T18:00:00Z",  
        "is_today": false
      },
      {
        "date": "2026-03-19",
        "day_name": "Wed",
        "day_number": 19,
        "status": "absent",
        "clock_in_at": null,
        "clock_out_at": null,
        "is_today": false
      },
      {
        "date": "2026-03-22",
        "day_name": "Sat",
        "day_number": 22,
        "status": "weekend",
        "is_today": true
      },
      {
        "date": "2026-03-24",
        "day_name": "Mon",
        "day_number": 24,
        "status": "future",
        "is_today": false
      }
    ]
  }
}
```

**GET /api/v1/attendance/team/week?start_date=2026-03-17** (Manager view)
```json
{
  "data": {
    "employees": [
      {
        "employee_id": "uuid-1",
        "employee_name": "Ricko",
        "week": {
          "start_date": "2026-03-17",
          "days": [...]  // Same format as /my/week
        }
      },
      {
        "employee_id": "uuid-2",
        "employee_name": "Sarah",
        "week": { "days": [...] }
      }
    ],
    "summary": {
      "total_on_time": 8,
      "total_late": 2,
      "total_absent": 1
    }
  }
}
```

---

## ✅ Architecture Review Checklist

### Backend Readiness
- ✅ Database schema: Complete (attendance_records + employees.reporting_to)
- ✅ Repository methods: Complete (ListByDate, ListByMonth, ListByEmployeeMonth)
- ⚠️ Service layer: Mostly complete, need GetEmployeeWeek + GetTeamWeek
- ❌ API handlers: Need 4 new endpoints
- ❌ Middleware: Need RequireManager() check
- ❌ Permission fix: /daily endpoint currently unprotected

### Frontend Readiness
- ✅ Clock-in/out: Already perfect (QuickClock component)
- ✅ Hero stats: Already built
- ✅ Design system: Consistent with leave/claims
- ❌ Week calendar component: Need to build
- ❌ Tabs component: Need to build (copy from leave pattern)
- ❌ Role detection hook: Need to build
- ❌ New API hooks: Need 4 new hooks

### Security Review
- 🚨 **Critical:** `/attendance/daily` has NO permission check → anyone can see all org data
- ✅ Clock-in/out protected by `PermSelfAttendance`
- ✅ Monthly reports protected by `PermAttendanceRead`
- ❌ Need `RequireManager()` middleware for team endpoints

---

## 🎯 Implementation Priority

### Phase 1: Fix Security (0.5 day)
1. Add permission check to `/attendance/daily` (admin only)
2. Add `RequireManager()` middleware
3. Add `GetSubordinateIDs()` repository method
4. Test: Regular users cannot access `/daily`, managers verified

### Phase 2: Backend Week Endpoints (1 day)
1. Add `/my/week` and `/team/week` endpoints
2. Implement `GetEmployeeWeek()` and `GetTeamWeek()` service methods
3. Add route handlers
4. Integration tests
5. Update OpenAPI spec

### Phase 3: Frontend Components (1 day)
1. Build `AttendanceWeekCalendar` component (3 hours)
2. Build `AttendanceTabs` component (copy from leave, 1 hour)
3. Create `useAttendanceRole()` hook (1 hour)
4. Update `index.tsx` with tabs + week calendar (2 hours)
5. Add new API hooks (1 hour)
6. Manual testing all roles (1 hour)

### Phase 4: Polish & Summary Stats (0.5 day - Optional)
1. Add summary widgets (on-time/late/absent counts)
2. Week navigation buttons (previous/next week)
3. Mobile responsive testing
4. Performance optimization (memoization)

---

## 🎪 Risk Assessment

### Low Risk ✅
- Database schema complete
- Repository methods exist
- Design pattern proven (Sprint 11)
- No breaking changes to existing features

### Medium Risk ⚠️
- RequireManager() middleware logic (subordinate check)
- Week calculation edge cases (month boundaries, timezones)
- Mobile horizontal scroll UX (need testing)

### High Risk 🚨
- Security fix on `/daily` endpoint (breaking change for admins)
  - **Mitigation:** Add permission check, document in release notes
  - Frontend already checks permissions, so likely no impact

---

## 📋 Definition of Done

### Backend
- [ ] 4 new API endpoints working
- [ ] Permission middleware protecting endpoints
- [ ] Security fix on `/daily` endpoint deployed
- [ ] Integration tests passing (98% coverage)
- [ ] OpenAPI spec updated

### Frontend
- [ ] Week calendar component renders correctly
- [ ] Tabs switch between my/team/all views
- [ ] Role-based visibility working (employees see 1 tab, managers see 2, admins see 3)
- [ ] Mobile horizontal scroll smooth
- [ ] Clock-in/out still works (no regressions)

### Testing
- [ ] Manual test: Employee sees only own week
- [ ] Manual test: Manager sees own + team weeks
- [ ] Manual test: Admin sees all employees
- [ ] Manual test: Non-manager cannot access `/team/week` → 403
- [ ] Manual test: Regular user cannot access `/daily` → 403 (new)

---

## 🔍 Retrospective (Post-Sprint)

### What Went Well
_To be filled after sprint completion_

### What Could Be Improved
_To be filled after sprint completion_

### Lessons from Sprint 11 Applied
- ✅ Keep existing UX that works (hero clock, QuickClock)
- ✅ Add tabs, not new pages
- ✅ Reuse patterns (similar to Leave/Claims tabs)
- ✅ Focus on real problems (security flaw, not feature bloat)
- ✅ Defer complex features (calendars, heatmaps)

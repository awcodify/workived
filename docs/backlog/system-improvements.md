# System Improvements Backlog

Platform improvements, UX polish, and operational excellence features.

---

## ⭐⭐⭐⭐ Comprehensive Audit Logging
**Status:** 📋 Backlog (Sprint 11 or 12)  
**Effort:** M (3-5 days)  
**Value:** System-wide compliance (GDPR, labor law) + security forensics

**Description:**
Expand existing `audit_logs` table to capture ALL state-changing actions across all modules. Used for compliance (GDPR Article 15, labor inspections), security forensics, and debugging.

**User Story:**
> As an HR admin, I need to see who changed an employee's salary history or deleted a leave policy, so I can audit changes during labor inspections or investigate security incidents.

**Problem:**
- Currently: Only some modules log audit events (ad-hoc implementation)
- Missing: Attendance, employees, leave policies, claim categories, departments, work schedules
- Compliance risk: Cannot prove who changed what for GDPR/labor law audits

**Features:**
- **Log all state changes** across modules:
  - Employees: created, updated (salary, job title, department), deactivated
  - Attendance: clock-in/out corrections (any change to attendance_records)
  - Leave: policy created/updated/deleted, request submitted/approved/rejected/cancelled
  - Claims: category created/updated/deleted, claim submitted/approved/rejected
  - Departments: created, updated, deleted
  - Work schedules: created, updated, deleted
  - Public holidays: created, updated, deleted
  - Tasks: created, completed, deleted, assignee changed
  - Users: invited, role changed, deactivated

- **Capture:**
  - Event type (e.g., "employee_salary_updated", "leave_request_approved")
  - Timestamp (UTC)
  - Actor: Who did it (user_id, employee_id if applicable)
  - Subject: What was changed (employee_id, leave_request_id, etc.)
  - Before/after values (JSON): {"old": {"salary": 5000000}, "new": {"salary": 5500000}}
  - Reason (optional): Manager explanation for sensitive changes
  - IP address + user agent (security forensics)

- **Query API:**
  - GET /api/v1/audit-logs?entity_type=employee&entity_id=xxx (all changes to one employee)
  - GET /api/v1/audit-logs?user_id=xxx (all actions by one user)
  - GET /api/v1/audit-logs?event_type=salary_updated (all salary changes)
  - GET /api/v1/audit-logs?start_date=2026-01-01&end_date=2026-03-31 (Q1 audit)
  - Pagination, filtering, CSV export

- **UI:**
  - Employee detail page → "Audit History" tab
  - Leave request detail → "Change Log" section
  - Admin panel → "Audit Logs" (system-wide search)
  - Revision timeline component (reusable across modules)

**Why it matters:**
- **Compliance:** GDPR Article 15 (right to access), Indonesia/UAE labor law (audit trail for wage changes)
- **Security:** Forensics after data breach or unauthorized access
- **Accountability:** Prevents "who deleted this?" mysteries
- **Debugging:** Trace why data changed unexpectedly

**Dependencies:**
- `audit_logs` table already exists (Sprint 6) — needs expansion
- Centralized audit service (services/internal/audit package exists)

**Technical scope:**
- **Database:**
  - Expand `audit_logs` table:
    - Add: ip_address, user_agent, before_value, after_value (JSONB)
    - Index: (entity_type, entity_id), (user_id, created_at DESC)
- **Backend:**
  - Centralized AuditService.Log() method (already exists, needs standardization)
  - Hook into all service methods that change state:
    - attendance.UpdateAttendance() → log attendance_updated
    - employees.Update() → log employee_updated
    - leave.ApproveRequest() → log leave_request_approved
    - etc.
  - GET /api/v1/audit-logs endpoint (filtering, pagination, CSV export)
- **Frontend:**
  - Reusable AuditTimeline component (timeline UI)
  - Employee page → Audit History tab
  - Admin panel → Audit Logs search (table with filters)
- **Testing:**
  - 20+ backend tests (one per service hook, query endpoint)
  - 10 frontend tests (timeline component, filters, export)

**Effort breakdown:**
- 2 days backend (service hooks, query API, tests)
- 2 days frontend (timeline component, audit logs page, tests)
- 1 day testing + CSV export

**Edge cases:**
- Bulk updates (e.g., annual leave allocation for all employees) → Log one summary event or 25 individual events?
- Soft deletes → Log as "deactivated" not "deleted"
- Automated system changes (cron jobs) → Log with system user_id
- Large JSON values (e.g., document content) → Truncate or summarize

**Security considerations:**
- Audit logs are IMMUTABLE (no UPDATE/DELETE operations allowed)
- Only admins can view audit logs
- Sensitive fields (passwords, API keys) → Never log, show as "[REDACTED]"
- Data retention: Keep audit logs for 3 years (compliance requirement)

**Future enhancements:**
- Real-time audit dashboard (anomaly detection)
- Slack alerts for sensitive changes (salary > 20% increase)
- Compliance reports (export for labor inspections)
- Diff visualization (side-by-side before/after)

**Implementation priority:**
- Phase 1 (Sprint 11): Employees, attendance, leave (highest compliance risk)
- Phase 2 (Sprint 12): Claims, tasks, departments (medium risk)
- Phase 3 (Sprint 13): Admin panel UI + CSV export

---

## ⭐⭐⭐⭐⭐ Task Board View Filtering (Tasks vs Approvals)
**Status:** 📋 Backlog (Post-Sprint 10)  
**Effort:** S (1-2 days)  
**Value:** Reduce cognitive load by separating project work from HR approvals

**Description:**
Add view controls to task board to filter between project tasks and approval tasks.

**Problem:**
Sprint 10 unified project tasks and HR approvals on one kanban board. While this prevents missed approvals, it creates cognitive overhead:
- **Project tasks:** Ongoing work, strategic planning, team coordination (flow state)
- **HR approvals:** Quick 2-minute decisions, compliance-driven (interruption work)

Mixing these forces context switching and reduces focus.

**User Story:**
> As a manager, I want to toggle between "Tasks Only" and "Approvals Only" views, so I can focus on project work without HR approval noise, but still have a unified view when I need it.

**Solution: Smart Filtering**

Add view controls to task board header:
```
[Task Board Header]
View: [All Work ▾] [Tasks Only] [Approvals Only]
```

**Features:**
- **Three view modes:**
  - **All Work** — Shows everything (tasks + approvals) [default for admins]
  - **Tasks Only** — Hides approval tasks [default for team members]
  - **Approvals Only** — Shows only pending leave/claim approvals

- **Smart defaults:**
  - Admins/managers → "All Work" (need visibility)
  - Team members → "Tasks Only" (can't act on approvals anyway)

- **Persistent preference:**
  - Remember user's last selection in localStorage
  - Restore on page load

- **URL state:**
  - `/tasks?view=approvals` (shareable, bookmarkable)
  - Deep linking support

- **Empty states:**
  - "Tasks Only" + no regular tasks → "No tasks yet. Create one to get started."
  - "Approvals Only" + no approvals → "🎉 All caught up! No pending approvals."

**Technical Implementation:**

**Frontend (1-2 days):**

1. **Add filter control component:**
   ```tsx
   <FilterDropdown value={view} onChange={setView}>
     <option value="all">📋 All Work</option>
     <option value="tasks">✅ Tasks Only</option>
     <option value="approvals">⏰ Approvals Only</option>
   </FilterDropdown>
   ```

2. **Filter logic in task list:**
   ```tsx
   const filteredTasks = useMemo(() => {
     return tasks.filter(task => {
       if (view === 'tasks') return !task.approval_type
       if (view === 'approvals') return task.approval_type
       return true // 'all'
     })
   }, [tasks, view])
   ```

3. **URL state management:**
   ```tsx
   const [searchParams, setSearchParams] = useSearchParams()
   const view = searchParams.get('view') || defaultView
   ```

4. **Persist preference:**
   ```tsx
   useEffect(() => {
     localStorage.setItem('taskBoardView', view)
   }, [view])
   ```

**Why This Approach (vs Separate Boards):**
- ✅ Preserves Sprint 10 work (no waste)
- ✅ User choice (flexibility)
- ✅ Minimal implementation (1-2 days vs 3-4 for separate boards)
- ✅ No double infrastructure (one board, multiple views)

**Testing:**
- [ ] View switcher renders correctly
- [ ] "Tasks Only" hides approval tasks
- [ ] "Approvals Only" shows only approval tasks
- [ ] "All Work" shows everything
- [ ] URL state updates on view change
- [ ] Preference persists across sessions
- [ ] Smart defaults work for different roles

**Dependencies:**
- Requires Sprint 10 (approval tasks) to be complete ✅

**Follow-up (Future):**
- Add badge counts: "Tasks (12) | Approvals (3)"
- Keyboard shortcuts: `T` for tasks, `A` for approvals
- Role-based hiding: Team members never see "Approvals" option

---

## ⭐⭐⭐⭐ System Transparency (Changelog + Known Issues)
**Status:** 📋 Backlog (Sprint 10+)  
**Effort:** M (5 days)  
**Value:** Build trust through transparency

**Description:**
Show users what's being worked on and what issues are known.

**User Story:**
> As a user, I want to see what features were recently added and what bugs are known, so I know the product is actively maintained and my issue isn't being ignored.

**Features:**

**Changelog:**
- "What's New" modal on dashboard (dismissible, version-tracked)
- Markdown-based changelog stored in database or S3
- Shows: New features, bug fixes, known issues
- Update frequency: Bi-weekly releases
- Endpoint: `GET /api/v1/system/changelog`

**Known Issues Board:**
- Link in help menu → Modal showing active issues
- Admin can mark issues as: Investigating / Fixing / Resolved
- User-facing description + estimated fix date
- Endpoint: `GET /api/v1/system/known-issues`

**Why it matters:**
- Transparency builds trust (especially important for small startups)
- Reduces support burden ("Is this a bug?" → "Yes, we know, fixing it")
- Shows active development (reassures users product isn't abandonware)

**Dependencies:**
- None

**Technical scope:**
- Database: `changelogs` and `known_issues` tables
- Backend: CRUD endpoints
- Frontend: Modal components + notification badge
- Admin: Simple form to add changelog entries

---

## ⭐⭐⭐⭐⭐ Role Assignment & Management (WOR-TBD)
**Status:** 📋 Backlog  
**Effort:** M (3-5 days)  
**Value:** Unblock multi-user orgs — Ahmad can't delegate without this

**Description:**
Allow admins/owners to assign and change roles for organisation members. Currently, every invited member joins as `member` with no way to change their role after joining.

**Problem:**
- Backend has full RBAC (6 roles: owner, admin, member + pro: hr_admin, manager, finance)
- Frontend hardcodes `role: 'member'` on invite — no role selector
- No UI exists to change a member's role after they join
- Owner transfer API exists but has no UI
- **Result:** Ahmad can't delegate HR tasks, finance access, or admin duties to anyone

**User Stories:**

> As an owner, I want to select a role when inviting a team member, so they get the right permissions from day one.

> As an owner/admin, I want to change an existing member's role from their profile page, so I can delegate responsibilities as the company grows.

> As an owner, I want to transfer ownership to another admin, so I can step back from day-to-day operations.

**Scope — Free Tier:**
| Feature | Detail |
|---------|--------|
| Role selector on invite | Dropdown: admin, member |
| Role badge on People list | Shows current role next to name |
| Change role from profile | Owner/admin can change another member's role |
| Owner transfer | UI for existing `TransferOwnership` API |
| Safety guards | Can't demote yourself, can't have 0 owners, can't change own role |

**Scope — Pro Tier (gated by existing `ProRoles` map):**
| Feature | Detail |
|---------|--------|
| Pro role selector on invite | Additional roles: hr_admin, manager, finance |
| Pro role change | Upgrade prompt when selecting a pro role on free tier |

**Cut (not in scope):**
- Custom roles / custom permissions
- Role change history UI (audit_logs already captures it automatically)
- Bulk role assignment
- Role-based dashboard customization
- Role hierarchy visualization

**Technical Notes:**
- Backend `PATCH /api/v1/members/:id` already supports role updates
- `InviteMemberRequest` validates: `oneof=admin member hr_admin manager finance`
- `ProRoles` map in `middleware/rbac.go` already gates hr_admin, manager, finance
- `TransferOwnership` handler exists — just needs frontend
- Permission check: only `owner` and `admin` can change roles; only `owner` can transfer ownership

**Effort Breakdown:**
- 0.5d — Invite dialog: add role selector dropdown
- 1d — Profile page: role change section with confirmation dialog
- 0.5d — People list: role badge column
- 0.5d — Owner transfer UI (modal with confirmation)
- 0.5d — Safety guards (can't demote self, last owner check)
- 1d — Tests (frontend + backend edge cases)

**Monetisation:**
- **Pro upgrade driver**: Free tier has 3 roles (owner/admin/member). The moment Ahmad needs hr_admin or manager → Pro upgrade trigger
- Show "Pro" badge next to locked roles in dropdown

**Dependencies:**
- None (backend RBAC already complete)

**Edge Cases:**
- Last owner tries to demote themselves → Block with error
- Owner transfers to member (not admin) → Block, must be admin first
- Deactivated employee with admin role → Role preserved if reactivated
- Free tier user selects hr_admin → Show upgrade prompt

---

## ⭐⭐⭐ Announcements Module
**Status:** 📋 Backlog (deferred from Sprint 8)  
**Effort:** M (3 days)  
**Value:** Company-wide communication channel

**Description:**
Post company announcements visible to all employees.

**User Story:**
> As an admin, I want to post company announcements (e.g., "Office closed tomorrow"), so everyone sees important updates when they log in.

**Features:**
- Create/edit announcements
- Pin/unpin (pinned shows at top)
- Rich text editor (TipTap)
- Show on overview dashboard
- Mark as read tracking
- Notification badge for unread announcements

**Why it matters:**
- Currently: No built-in communication channel
- Small companies use WhatsApp groups (messages get lost)
- Centralized, persistent, searchable

**Dependencies:**
- Migration already exists (`announcements` table)

**Technical scope:**
- Backend: Wire up existing migration (`announcements` table)
- Service: handler, service, repository, types
- Frontend: Announcement list + create/edit form
- Effort: 2 days backend, 1 day frontend

---

## ⭐⭐⭐ Reports with Real Data
**Status:** 📋 Backlog (deferred from Sprint 8)  
**Effort:** M (4 days)  
**Value:** Replace dummy data with analytics

**Description:**
Build real analytics queries for Reports page.

**User Story:**
> As a manager, I want to see attendance and leave trends, so I can spot patterns (e.g., everyone takes leave in December).

**Features:**

**Attendance Report:**
- On-time rate (%) by month
- Late rate (%) by month
- Absent count by month
- Top 5 most punctual employees
- Trend chart (line graph)

**Leave Report:**
- Days taken vs days entitled (by policy type)
- Leave utilization rate (%)
- Busiest leave months (bar chart)

**Claims Report:**
- Spending by category (bar chart)
- Budget vs actual comparison
- Approval rate (%)
- Top spending employees

**Why it matters:**
- Reports page currently uses dummy data
- Managers need insights for planning (e.g., hire more if attendance dropping)

**Dependencies:**
- None (all data already exists)

**Technical scope:**
- Backend: Aggregate query endpoints
- Frontend: Connect charts to real data
- Caching: Redis cache for expensive queries (5min TTL)

---

## ⭐⭐⭐ Task Filters & Search
**Status:** 📋 Backlog (Sprint 10+)  
**Effort:** S (2 days)  
**Value:** Find tasks quickly in large boards

**Description:**
Filter and search tasks by assignee, priority, status, due date.

**User Story:**
> As a manager with 50+ tasks, I want to filter by assignee and overdue, so I can quickly see what's blocking my team.

**Features:**
- Filter by:
  - Assignee (multi-select dropdown)
  - Priority (Low, Medium, High, Critical)
  - Status (To Do, In Progress, Done)
  - Due date (Overdue, Due today, Due this week, No due date)
- Text search (title, description)
- Combined filters (AND logic)
- Clear all filters button
- Filter state persisted in URL (shareable links)

**Why it matters:**
- Kanban boards get messy with 30+ tasks
- Need quick access to "my tasks" or "overdue"
- Standard feature in competitors (Trello, Asana)

**Dependencies:**
- Tasks module (✅ Done)

**Technical scope:**
- Backend: Update `GET /api/v1/tasks` to accept filter params
- Frontend: Filter UI component + query param state management

---

## ⭐⭐ Better Mobile Experience
**Status:** 📋 Backlog  
**Effort:** L (1-2 weeks)  
**Value:** Improve usability on phones

**Description:**
Optimize key flows for mobile (clock-in, leave approval, task viewing).

**User Story:**
> As a manager, I want to approve leave requests on my phone during commute, so I don't block my team while I'm away from desk.

**Features:**
- Mobile-optimized layouts for:
  - Clock-in/out (large buttons)
  - Leave approval modal (thumb-friendly)
  - Task kanban (horizontal scroll, no drag-and-drop on mobile)
  - Notifications (swipe to dismiss)
- Bottom navigation on mobile (replace dock)
- Touch-friendly hit targets (48px minimum)

**Why it matters:**
- 60% of users are managers on phones (morning clock-in check)
- Current: Desktop-first design, hard to use on mobile
- Approvals should be fast (don't want to wait until back at desk)

**Dependencies:**
- None (just UI work)

**Technical scope:**
- Frontend: Responsive component variants
- Testing: Manual testing on real devices (iPhone, Android)

**Approach:**
- Start with most-used flows (clock-in, approvals)
- Progressive enhancement (don't break desktop)

---

## ⭐⭐ Customizable Dashboard (OPTIONAL)
**Status:** 📋 Backlog (low priority)  
**Effort:** L (1 week)  
**Value:** Personalized overview

**Description:**
Let users show/hide widgets on dashboard.

**User Story:**
> As an employee, I want to hide the claims widget because I never submit claims, so my dashboard shows only what I care about.

**Features:**

**Option 1 (Simple):**
- Fixed layout with show/hide toggles
- Widget types: Attendance, Leave balance, Pending approvals, Recent claims
- User preferences stored: `{ widgets: { attendance: true, claims: false } }`
- No drag-and-drop

**Option 2 (Complex):**
- Drag-and-drop widget reordering (react-dnd)
- Resize widgets (grid system)
- Layout persistence per user

**Why it matters:**
- Different users care about different things
- Reduces clutter (employees don't need admin widgets)

**Decision:**
- **Start with Option 1 (simple)**
- Only build Option 2 if users request it
- ROI unclear — most users are fine with default layout

**Dependencies:**
- None

**Technical scope:**
- Option 1: 2 days (preferences API + UI toggles)
- Option 2: 5 days (drag-and-drop library + grid system)

**Status:** Low priority — only build if customer demand exists

---

## ⭐⭐⭐ Emoji Reactions UI
**Status:** 📋 Backlog (Sprint 10)  
**Effort:** XS (1 day)  
**Value:** Complete the reaction feature

**Description:**
Add UI for emoji reactions on task comments (backend already done in Sprint 8).

**User Story:**
> As a team member, I want to react with 👍 to comments, so I can acknowledge without writing "thanks" every time.

**Features:**
- Emoji picker below each comment
- Show reaction counts (👍 3, ❤️ 2)
- Highlight reactions user has added
- Click to toggle reaction on/off

**Why it matters:**
- Backend already complete (Sprint 8)
- Just need frontend UI
- Small feature, high delight

**Dependencies:**
- Tasks module (✅ Done — backend reactions API exists)

**Technical scope:**
- Frontend: Emoji picker component + reaction display
- Use existing `GET/POST /api/v1/tasks/:id/comments/:cid/reactions` endpoints

---

## ⭐ UX Polish (Placeholder)
**Status:** 📋 Backlog  
**Effort:** TBD  
**Value:** Address friction points

**Description:**
Collect and fix UX issues identified through user feedback and analytics.

**Data-driven approach:**
- Track drop-off points (analytics)
- User feedback surveys
- Session recordings (optional)

**Examples of possible improvements:**
- Simplify multi-step forms (reduce clicks)
- Better error messages (already improved in Sprint 7)
- Keyboard shortcuts for power users
- Improved mobile navigation

**Status:** Placeholder — populate based on real user feedback

**Dependencies:**
- Analytics instrumentation (not yet built)

**Approach:**
- Build analytics first (track key flows)
- Collect feedback for 2-4 weeks
- Prioritize top 3 friction points

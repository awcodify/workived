# System Improvements Backlog

Platform improvements, UX polish, and operational excellence features.

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

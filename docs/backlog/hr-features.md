# HR-Aware Features Backlog

Features that leverage employee data to create competitive differentiation.

---

## ⭐⭐⭐⭐⭐ Workload Intelligence
**Status:** 🎯 Planned (Sprint 9)  
**Effort:** M (4 days)  
**Value:** Only kanban that shows employee availability during task assignment

**Description:**
Show employee workload, leave status, and task count in assignment dropdown.

**User Story:**
> As a manager, I want to see who's available and not overloaded when assigning tasks, so I don't accidentally assign work to someone on leave or already swamped.

**Features:**
- Task count per employee
- Leave status indicator (on leave, upcoming leave)
- Workload badges (available, warning, overloaded)
- Sort by availability

**Why it matters:**
- Prevents burnout
- Respects leave
- Fair work distribution
- Competitors don't have this (Asana, Monday, Trello)

**Dependencies:**
- Tasks module (✅ Done in Sprint 8)
- Leave module (✅ Done)

**Technical scope:**
- Backend: `GET /api/v1/employees/workload` endpoint
- Frontend: Enhanced employee selector component
- No new migrations needed

See [docs/sprint9.md](../sprint9.md) for detailed implementation plan.

---

## ⭐⭐⭐⭐⭐ Auto-Task for Pending Approvals
**Status:** 📋 Backlog  
**Effort:** M (4-5 days)  
**Value:** Unified work inbox - No more checking multiple places for approvals

**Description:**
Automatically create tasks for managers when leave/claim requests need approval. Approvals sync back to task completion.

**User Story:**
> As a manager, I want pending approvals to show up as tasks on my kanban, so I have a single place to manage all my work (tasks + approvals) instead of checking leaves and claims separately.

**Features:**
- Auto-create task when leave/claim submitted
- Task title: "Approve Leave: John Doe (Mar 25-27)" or "Approve Claim: Jane Smith – Travel ($250)"
- Assign to organization admin (current approval flow)
- Link back: Click task → Opens approval modal directly
- Two-way sync: Approved/rejected in modal → Task auto-completes
- Cancelled request → Task deleted
- Due date: 3 days from submission (configurable)
- Priority: urgent if due date approaching

**Why it matters:**
- **Single inbox:** No more context switching between Tasks/Leaves/Claims
- **Nothing missed:** Approvals visible on daily kanban view
- **Better metrics:** Track approval bottlenecks with task time data
- **Workload-aware:** Approval work now counted in team capacity
- **Accountability:** Activity log shows when manager saw/acted on request
- **Competitive edge:** No other tool unifies HR approvals with task management

**Dependencies:**
- Workload intelligence (Sprint 9) - Approvals count toward manager workload
- Leave requests module (✅ Done)
- Claims module (✅ Done)
- Tasks module (✅ Done in Sprint 8)

**Technical scope:**
- Backend:
  - Hook into leave/claim creation service
  - Auto-create task with `approval_type`, `approval_id` metadata
  - Hook into approval service to sync task completion
  - Add `tasks.approval_type` and `tasks.approval_id` nullable fields
- Frontend:
  - Task card recognizes approval tasks (distinct icon/styling)
  - Click opens approval modal instead of task detail
  - Show approval status in task card
- Effort: 2 days backend hooks, 2 days frontend integration, 1 day testing

**Edge cases to handle:**
- Manager deletes task but request still pending → Prevent deletion (show warning)
- Request cancelled after task created → Auto-delete task
- Multiple admins → Assign to all? Or first to act completes?
- Task reassigned to non-admin → Prevent or allow with warning?

**Future enhancements (Phase 2):**
- Batch approval from kanban (approve multiple at once)
- Department head assignment (not just org admin)
- Approval templates for recurring approvals
- Average approval time metric per manager

**Validation needed:**
- Ask 5 current users: "How do you remember to approve requests?"
- If "I check every morning" or "I forget" → High priority
- If "Slack notifications work fine" → Lower priority

---

## ⭐⭐⭐⭐ Time Zone Aware Due Dates
**Status:** 📋 Backlog (proposed for Sprint 10)  
**Effort:** S (3 days)  
**Value:** Show "Due in 3h" not "Due Mar 21" for distributed teams

**Description:**
Display relative due dates based on employee timezone. Flag tasks assigned outside work hours.

**User Story:**
> As a manager with a distributed team, I want due dates to show relative time ("Due in 3h") so everyone sees deadlines in their own context.

**Features:**
- Relative time display ("Due in 3h", "Overdue by 2h")
- Timezone-aware "Due Friday" (converts to employee's timezone)
- Flag tasks assigned outside employee's work hours
- Smart suggestions: "Sarah's workday starts in 6h"

**Why it matters:**
- Better for distributed teams (Dubai + Jakarta)
- Prevents confusion ("Due Friday" means different times)
- Shows consideration for work-life balance

**Dependencies:**
- Workload intelligence (Sprint 9)
- Uses existing `organisations.timezone` field

**Technical scope:**
- Backend: Add timezone conversion logic
- Frontend: Relative time formatting component
- Effort: 1 day backend, 2 days frontend

---

## ⭐⭐⭐⭐⭐ Performance Insights
**Status:** 📋 Backlog (Sprint 10+)  
**Effort:** L (8 days)  
**Value:** Task completion stats for performance reviews

**Description:**
Show quarterly task completion metrics. Export to PDF for performance documentation.

**User Story:**
> As a manager, I want to see what each employee accomplished this quarter, so I can have data-backed performance reviews instead of guessing.

**Features:**
- Tasks completed (count)
- Average completion time
- On-time rate (%)
- Most active projects
- Export to PDF
- Opt-in privacy controls

**Critical requirements:**
- **Privacy first:** Organization-level toggle (enable/disable)
- Employee always sees own stats
- Manager permission required per org
- No surveillance features (no real-time tracking, no idle time)

**Why it matters:**
- Annual reviews are currently guesswork
- Small companies struggle to document performance
- Competitors don't tie tasks to HR records
- Helps with promotions, bonuses, improvement plans

**Dependencies:**
- Tasks module (✅ Done)
- Privacy policy review needed

**Technical scope:**
- Backend: Aggregation queries on tasks table
- Frontend: Stats dashboard + PDF export
- Database: Add `privacy_settings` table (opt-in per org)
- Effort: 3 days backend, 3 days frontend, 2 days privacy UX

---

## ⭐⭐⭐⭐ Policy Segmentation
**Status:** 📋 Backlog  
**Effort:** L (1-2 weeks)  
**Value:** Enable mid-size companies (26-75 employees)

**Description:**
Allow different leave policies for different departments or individual employees.

**User Story:**
> As an HR admin, I want to assign different leave policies to departments (e.g., executives get more days), so I don't need to create separate organizations.

**Features:**
- Policy assignment at org, department, or employee level
- Cascade logic: Org → Department → Employee (most specific wins)
- UI for bulk assignment
- Migration tool for existing policies

**Why it matters:**
- Current system: One policy = all employees
- Blocks mid-size customers who need tiered policies
- Standard HR practice (executives, contractors, part-time have different entitlements)

**Dependencies:**
- None (can build now)

**Technical scope:**
- Database: Add `leave_policy_assignments` table
- Backend: Update balance initialization to respect assignments
- Frontend: Policy assignment UI
- Migrations: Data migration for existing policies

**Risks:**
- Complex: Need to handle edge cases (employee switches departments mid-year)
- Testing: Many scenarios to validate

---

## ⭐⭐⭐⭐ Employee Documents Module
**Status:** 📋 Backlog  
**Effort:** M (1 week)  
**Value:** Store contracts, IDs, certificates with expiry tracking

**Description:**
Upload and manage employee documents with access control and expiry alerts.

**User Story:**
> As an HR admin, I want to upload employee contracts and track expiry dates, so I get reminded to renew work permits before they expire.

**Features:**
- Document upload (PDF, images)
- Document types: Contract, Work permit, Passport, Certificates
- Expiry date tracking
- Notification 30 days before expiry
- Access control (admin only, employee can view own)
- Download/preview

**Why it matters:**
- Compliance requirement (especially UAE work permits)
- Currently: Companies use Google Drive or paper files
- Reduces admin burden (automatic reminders)

**Dependencies:**
- S3/MinIO integration (✅ Done in Sprint 6)

**Technical scope:**
- Database: `employee_documents` table already exists (✅ Migration done)
- Backend: CRUD endpoints + expiry check job
- Frontend: Document management UI + upload component

---

## ⭐⭐⭐ Claim Receipts on Tasks
**Status:** 📋 Backlog (low priority)  
**Effort:** S (2 days)  
**Value:** Link project expenses to tasks

**Description:**
Attach expense claims directly to tasks for project cost tracking.

**User Story:**
> As a project manager, I want to see which expenses are tied to which tasks, so I can track project spending accurately.

**Features:**
- Attach claim to task (many-to-one: one claim can be on one task)
- Task detail shows attached claims
- 💰 Badge on task if claim attached
- Finance report: Spending by task/project

**Why it matters:**
- Small companies struggle with project cost tracking
- Connects project work → actual spending
- Helps with client billing (track reimbursable expenses)

**Dependencies:**
- Tasks module (✅ Done)
- Claims module (✅ Done)

**Technical scope:**
- Database: Add `task_id` column to `claims` table
- Backend: Update claim creation to accept optional task_id
- Frontend: Task selector in claim form, claim list on task detail

---

## ⭐⭐⭐ Auto-Assign Rules
**Status:** 📋 Backlog (low priority)  
**Effort:** M (5 days)  
**Value:** Automate repetitive task assignments

**Description:**
Create rules to automatically assign tasks based on department, role, or round-robin.

**User Story:**
> As a manager, I want "Design Review" tasks to auto-assign to the Design department, so I don't have to manually assign every time.

**Features:**
- Rule types:
  - Department-based (all "Design Review" → Design dept)
  - Role-based (all "Code Review" → Senior Developers)
  - Round-robin (distribute evenly across team)
- Rule builder UI
- Rule preview (show who would be assigned)
- Enable/disable rules

**Why it matters:**
- Reduces repetitive work
- Faster task creation
- Fair distribution (round-robin)

**Dependencies:**
- Workload intelligence (Sprint 9) — to avoid overloading someone

**Technical scope:**
- Database: `task_assignment_rules` table
- Backend: Rule engine + matching logic
- Frontend: Rule builder UI (complex)

**Risks:**
- Complex UI (rule builder needs good UX)
- Edge cases (what if no one matches rule?)

---

## ⭐⭐ Attendance + Tasks Integration
**Status:** 📋 Backlog (low priority)  
**Effort:** S (2 days)  
**Value:** Coverage visibility for small teams

**Description:**
Show urgent tasks for employees marked absent. One-click reassign substitute.

**User Story:**
> As a manager, when someone marks absent sick, I want to see their urgent tasks due today, so I can quickly reassign to someone available.

**Features:**
- Dashboard widget: "Ahmad marked absent today (sick). He has 2 urgent tasks due today."
- One-click reassign with notification to substitute
- Timeline shows task handoffs during absences

**Why it matters:**
- Small teams need coverage planning
- Prevents tasks falling through cracks when someone is sick

**Dependencies:**
- Workload intelligence (Sprint 9)
- Attendance module (✅ Done)

**Technical scope:**
- Backend: Query tasks for absent employees
- Frontend: Dashboard widget + reassign flow

**Status:** Low priority — only valuable for teams under 15 people

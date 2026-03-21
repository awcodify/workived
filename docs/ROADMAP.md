# Product Roadmap Radar

**Last Updated:** March 21, 2026  
**Current Sprint:** Sprint 9 (Planning — Workload Intelligence)

---

## Current Sprint (Sprint 9)

### 🎯 Workload Intelligence ⭐⭐⭐⭐⭐
**Status:** 📋 Planning | **Effort:** 4 days | **Priority:** High

**Value Proposition:**
- Only kanban that shows employee availability during task assignment
- Prevents assigning work to people on leave
- Shows current task load per person
- Fair workload distribution

**Implementation:**
```
Task assignment dropdown enhancement:
┌─────────────────────────────────────┐
│ Assign to:                          │
├─────────────────────────────────────┤
│ ✅ Sarah Chen                       │
│    3 tasks • Available              │
│                                     │
│ ⚠️ Ahmad Rizki                      │
│    8 tasks • On leave Mar 25-27    │
│                                     │
│ 🔴 Priya Sharma                     │
│    12 tasks • 3 overdue             │
└─────────────────────────────────────┘
```

**Data Sources:**
- `leave_requests` - approved leave
- `public_holidays` - country-specific holidays  
- `work_schedules` - employee work patterns
- `tasks` - current assignments and completion status

**Technical Scope:**
- Backend: New endpoint `/api/v1/employees/workload`
- Query: Aggregate task counts, check leave overlap, work schedule
- Frontend: Enhanced employee selector component
- Effort: API 2d, Frontend 2d

---

## Sprint 10+ Candidates

**For detailed backlog with all features, see:**
- `docs/backlog/hr-features.md` — 8 HR-aware features
- `docs/backlog/system-improvements.md` — 7 platform improvements
- `docs/backlog/monetization.md` — 8 Pro features + billing
- `docs/backlog/advanced.md` — 7 Phase 2 features

### Top 3 Next Sprint Candidates

### Time Zone Aware Due Dates ⭐⭐⭐⭐
**Priority: Medium | Effort: 3 days**

**Value:**
- Show "Due in 3h" not "Due Mar 21" 
- Flag tasks assigned outside employee's work hours
- Smart suggestions based on timezone context

**Data:** `organisations.timezone`, `employees` (implied location)

**Effort:** API 1d, Frontend 2d

### Performance Insights ⭐⭐⭐⭐⭐
**Priority: High | Effort: 8 days (privacy UX needed)**

**Value:**
- Quarterly task completion stats for reviews
- Export to PDF for performance documentation
- Opt-in privacy controls

**Critical Requirements:**
- Organization-level toggle (enable/disable)
- Employee always sees own stats
- Manager permission required
- No surveillance features

**Effort:** API 3d, Frontend 3d, Privacy UX 2d

### Other Candidates

**From HR Features Backlog:**
- **Claim Receipts on Tasks** ⭐⭐⭐ (2d) — Link expenses to project work
- **Auto-Assign Rules** ⭐⭐⭐ (5d) — Department-based auto-assignment, round-robin
- **Policy Segmentation** ⭐⭐⭐⭐ (8d) — Different policies per department/employee
- **Employee Documents Module** ⭐⭐⭐⭐ (5d) — Upload, expiry tracking

**From System Improvements Backlog:**
- **System Transparency** ⭐⭐⭐⭐ (3d) — Changelog + known issues board
- **Task Filters** ⭐⭐⭐ (2d) — By assignee, status, due date
- **Better Mobile Experience** ⭐⭐ (8d) — Native-feeling mobile UI

**From Monetization Backlog:**
- **Landing Page** ⭐⭐⭐⭐⭐ (5d) — Marketing site for acquisition
- **Pro Feature Gating** ⭐⭐⭐⭐⭐ (3d) — Paywalls for GPS, custom policies
- **Billing Integration** ⭐⭐⭐⭐⭐ (8d) — Stripe/Paddle for subscriptions

---

## Competitive Differentiation

**Market Position:** "Task management that knows your team"

**vs Competitors:**
- **Asana/Monday:** Generic task tools, no HR context
- **Linear:** Fast but no workload/leave awareness  
- **Trello:** Simple boards, no team intelligence

**Our Moat:** Employee data integration (leave, schedules, timezones, workload)

**Key Differentiators:**
1. HR-aware task assignment (Sprint 9)
2. Workload intelligence preventing burnout
3. Compliance-first (leave, attendance, claims in one place)
4. Multi-country from day 1 (ID, UAE, MY, SG)

---

**Last Updated:** March 21, 2026  
**Current Status:** Sprint 9 planning in progress  
**Next Review:** After Sprint 9 completion  
**Backlog Location:** `docs/backlog/*.md` (hr-features, system-improvements, monetization, advanced)

# ADR-004: Defer Unified Calendar to Sprint 9+

**Status:** Accepted  
**Date:** 2026-03-20  
**Decision makers:** Product Owner, Architect

---

## Context

During Sprint 5 (Leave frontend), we built `/leave/calendar` showing:
- Public holidays for org's country
- Employees on leave for each date
- Interactive tooltips with full date details

**Question raised:** Should we build a **general-purpose `/calendar` page** now that aggregates:
- Leave requests
- Tasks (when we build them)
- Claims deadlines
- Company events/announcements
- Employee birthdays
- Public holidays

This would create a single source of truth for all time-based information across modules.

---

## Decision

**Keep `/leave/calendar` scoped to leave module for now. Defer unified calendar to Sprint 9+ (when Tasks module is built).**

**Current implementation:**
- Route: `/leave/calendar` (within leave module)
- Data: Public holidays + leave requests only
- Interaction: Click date → see holidays + who's on leave

**Future unification (Sprint 9+):**
- Route: `/calendar` (top-level, aggregates all modules)
- Data: Leave + tasks + claims + events + holidays
- Interaction: Click date → see all activities for that day
- Module-specific calendars can remain as filtered views or redirect to unified calendar

---

## Rationale

### Why defer (phased approach wins):

1. **YAGNI (You Aren't Gonna Need It)**
   - We don't have Tasks or Events modules yet
   - Claims don't have calendar semantics yet (submission dates != deadlines)
   - Building unified calendar now = premature abstraction

2. **Leave is the wedge — ship it fast**
   - Sprint 5 leave frontend is feature-complete
   - Scope creep delays validation of core value prop
   - Calendar unification is UI convenience, not core functionality

3. **Low refactor cost later**
   - Moving from `/leave/calendar` → `/calendar` is just routing + data aggregation
   - No schema changes needed (each module already has date fields)
   - Frontend components can be reused (CalendarGrid, DateTooltip)

4. **Sprint 6 is Claims**
   - Adding calendar scope now delays revenue-critical features
   - Claims module needs backend + frontend + S3 upload flow

5. **Tasks module is CONDITIONAL**
   - Only build if customers explicitly request it (per ADR-002)
   - If we don't build Tasks, unified calendar has even less value

### When to build unified calendar:

**Triggers (any of these):**
- Tasks module is built and has date-based entries
- Customer requests "see everything happening this week"
- Analytics show users toggling between /leave/calendar and /tasks frequently

**Prerequisites:**
- At least 2 modules with calendar-relevant data (currently: only Leave qualifies)
- User feedback validates the need for aggregate view

---

## Consequences

### ✅ Benefits:
- Faster time-to-market for Leave feature (Sprint 5 complete)
- Avoid premature engineering (YAGNI principle upheld)
- Simpler codebase until we prove multi-module calendar value
- Doesn't block Sprint 6 (Claims)

### ⚠️ Trade-offs:
- Users see leave-specific calendar only (but that's all they need now)
- Slight refactor cost in Sprint 9+ (but minimal - just routing + aggregation)
- Potential user confusion if they expect unified view (unlikely until Tasks exist)

### 🔄 Migration Path (Sprint 9+):

1. **Backend changes:**
   - Create `GET /api/v1/calendar?start_date=X&end_date=Y`
   - Aggregate: leave requests, tasks, claims, announcements
   - Return unified structure: `{ date, events: [{ type, title, module, ... }] }`

2. **Frontend changes:**
   - Create `/calendar` route with same CalendarGrid component
   - Update tooltip to show grouped activities by type
   - Add module filters (show/hide Leave, Tasks, Claims)
   - Keep `/leave/calendar` as alias or redirect

3. **Data model (no changes needed):**
   - Each module already has date fields
   - No new tables required
   - Just query multiple tables and merge in API layer

---

## Alternatives Considered

### Alternative 1: Build unified `/calendar` in Sprint 5
**Rejected** — Premature. We only have 1 module (Leave) with calendar data. Building abstraction for N=1 is over-engineering.

### Alternative 2: Build unified calendar when Claims is added (Sprint 6)
**Rejected** — Claims don't have strong calendar semantics. Submission date != deadline. Would force artificial calendar view onto claims flow.

### Alternative 3: Never build unified calendar, keep module-specific views
**Rejected** — Once Tasks exist, users will want aggregate view. Switching between `/leave/calendar` and `/tasks/calendar` is poor UX.

---

## Status

**Accepted** — Current: `/leave/calendar` scoped to leave module  
**Next review:** Sprint 9 (when Tasks module discussion begins)

---

## References

- Sprint 5 implementation: `apps/web/src/routes/_app/leave/calendar.tsx`
- Public holidays API: `services/internal/leave/handler.go:ListHolidays`
- Related: ADR-002 (Tasks module is conditional, not guaranteed)

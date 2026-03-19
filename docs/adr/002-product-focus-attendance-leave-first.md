# ADR-002: Product Focus — Attendance + Leave First, Tasks Later

**Status:** Accepted  
**Date:** 2026-03-20  
**Decision makers:** Product Owner, Architect

---

## Context

The original product vision positioned Workived as an "HR and operations superapp" with 5 core modules:
1. Employee management
2. Attendance
3. Leave
4. Claims & reimbursement
5. Task management

**Risk identified:** Building 5 modules in parallel risks becoming mediocre at everything instead of exceptional at one core workflow.

**Competing priorities:**
- Attendance + Leave = compliance-driven, daily usage, strong upgrade triggers
- Tasks = crowded market (Trello, Asana, ClickUp), low switching cost, not HR-critical
- Claims = important but lower frequency than attendance/leave

---

## Decision

**Focus MVP and initial growth on Attendance + Leave as the core wedge.**

Build order:
1. **Sprint 1-3:** Auth + Employee management + Attendance (DONE)
2. **Sprint 4-5:** Leave management (policies, requests, approvals, balances)
3. **Sprint 6:** Claims (basic flow only — submit, approve, receipt upload)
4. **Sprint 7+:** Tasks (deprioritized — build only if customers explicitly demand it)

---

## Rationale

### Why Attendance + Leave is the strongest wedge:

1. **Pain is immediate and daily**
   - Attendance tracking = every working day
   - Leave requests = frequent (monthly average)
   - Tasks = sporadic, optional

2. **Compliance-driven = sticky**
   - Labour law requires attendance records (Indonesia: 5 years, UAE: 1 year minimum)
   - Leave entitlement is legally mandated
   - Tasks have no regulatory requirement

3. **Natural upgrade triggers**
   - Free tier: manual clock-in
   - Pro tier: GPS geofencing, shift scheduling, overtime auto-calc
   - Clear value gap customers feel immediately

4. **Less competitive pressure**
   - General task management is saturated (Trello, Asana, Monday, ClickUp, Notion)
   - HR-specific attendance tools for SMBs in ID/AE are underserved
   - Most existing tools are enterprise-focused or outdated

### Why Tasks is deprioritized:

- Low switching cost (customers already use Trello/Asana)
- Not a core HR pain point
- Crowded space requires marketing spend to differentiate
- Feature parity takes significant dev time (subtasks, dependencies, time tracking, Gantt)

---

## Consequences

### Good
- Deeper, better Attendance + Leave experience
- Clear product positioning: "Compliance-first HR for SMBs"
- Faster time to product-market fit on core wedge
- Engineering focus = fewer context switches

### Bad / Trade-offs
- Lose "all-in-one" positioning initially
- May lose customers who want integrated task management from day 1
- Smaller TAM initially (attendance-first vs general ops)

### Neutral
- Can still add Tasks later if customer pull is strong
- Task management can be Phase 2 expansion after core is rock-solid

---

## Implementation

### Update project brief:
- Reframe "superapp" positioning to "Attendance + Leave for SMBs" in elevator pitch
- Move Tasks to Sprint 7+ (conditional — build if validated demand)
- Keep Claims at Sprint 6 (important but tertiary to attendance/leave)

### Sprint re-prioritization:
```
Sprint 1-3: Auth + Employees + Attendance ✅ DONE
Sprint 4-5: Leave (full flow)
Sprint 6:   Claims (basic only)
Sprint 7:   Landing page + PWA + Marketing (not Tasks)
Sprint 8+:  Pro features (GPS, custom leave types, analytics)
Sprint ?:   Tasks (if customer demand validates it)
```

---

## References

- Original product brief: Section 3 (Product Modules)
- Positioning feedback: 2026-03-20 strategic review

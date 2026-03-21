---
description: Plan a sprint — create sprint file with PO priorities, Architect risks, scoped stories
---

**Sprint Planning Workflow (established March 21, 2026)**

**MANDATORY STEPS:**

1. **Review backlog:**
   - Check `docs/backlog/*.md` for prioritized features:
     - `hr-features.md` — HR-aware features
     - `system-improvements.md` — Platform improvements
     - `monetization.md` — Pro features, billing
     - `advanced.md` — Phase 2 features
   - Select features based on priority (⭐⭐⭐⭐⭐ first) and effort

2. **Read previous sprint:**
   - Load `docs/sprint{N-1}.md` to understand what was just completed
   - Note any blockers, technical debt, or incomplete work

3. **Create new sprint file:**
   - Use template from `docs/sprint-template.md`
   - Create `docs/sprint{N}.md` with:
     - Previous sprint summary (what was completed)
     - Current sprint goals and features (from backlog)
     - Next sprint plan
   - **DO NOT update PROJECT_BRIEF.md** during planning

4. **Plan sprint content:**

**Goal (one sentence):** Single most important outcome?

**🧠 PO priorities:**
- What matters to Ahmad? What pain does this relieve?
- What creates competitive differentiation?
- What drives monetization or reduces churn?

**🏗️ Architect review:**
- Technical constraints, prerequisite decisions, risks?
- Data model changes needed?
- Performance/scaling concerns?

**Stories table:**
| # | Story (As a founder, I can...) | Role | Size | Priority |
|---|--------------------------------|------|------|----------|
| 1 | ...                            | BE   | M    | P0       |

**Size:** S=half day, M=1-2 days, L=3+ (split if L)
**Priority:** P0=must have, P1=should have, P2=nice to have
**Role:** BE=backend, FE=frontend, DB=database, FULL=full stack

**Out of scope:** 
- [Item] — Reason: [deferred/too large/not validated]

**Definition of done:**
- All endpoints tested (98%+ coverage)
- Migrations reversible
- No hardcoded country rules
- Audit log for state changes
- Multi-tenancy validated (org_id checks)
- OpenAPI documentation updated
- Sprint file updated with actual outcomes

4. **After sprint completes:**
   - Mark sprint file as ✅ COMPLETE
   - Mark features as ✅ Done in appropriate `docs/backlog/*.md` file
   - Update PROJECT_BRIEF.md with 1-paragraph summary + link to sprint file
   - Create next sprint planning file

$ARGUMENTS

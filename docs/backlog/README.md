# Product Backlog

This folder contains feature ideas and future work organized by theme.

## Backlog Organization

**Priority levels:**
- ⭐⭐⭐⭐⭐ — Critical competitive differentiator
- ⭐⭐⭐⭐ — High value, should build soon
- ⭐⭐⭐ — Medium value, nice to have
- ⭐⭐ — Low priority, build if time/demand
- ⭐ — Deferred, revisit later

**Effort estimates:**
- S = 1-2 days
- M = 3-5 days
- L = 1-2 weeks
- XL = 3+ weeks

**Status:**
- 📋 Backlog — Not yet prioritized for a sprint
- 🎯 Planned — Assigned to upcoming sprint
- 🚧 In Progress — Currently being built
- ✅ Done — Shipped to production
- ❌ Rejected — Decided not to build (with reason)

## Files

- [hr-features.md](./hr-features.md) — HR-aware features (workload intelligence, policy segmentation, documents)
- [system-improvements.md](./system-improvements.md) — Platform improvements (transparency, analytics, mobile)
- [monetization.md](./monetization.md) — Pro features, billing, upgrade flows
- [advanced.md](./advanced.md) — Phase 2 features (payroll, analytics, employee portal)

## Workflow

1. **Feature idea** → PO evaluates with `/po` command
2. **Approved** → Add to appropriate backlog file with priority + effort
3. **Sprint planning** → Move from backlog to `docs/sprint{N}.md`
4. **Sprint complete** → Mark as ✅ Done in backlog file

See `docs/product-roadmap-radar.md` for current sprint priorities.

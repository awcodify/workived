# Workived — Claude Code Team Instructions

You are the **entire product team** for Workived. You switch roles based on what is needed.
---

## Default behaviour (no role specified)

When no role is specified, you default to **Software Engineer** for implementation tasks,
and **automatically switch roles** when the question warrants it:

- "Should we build X?" → PO first, then Engineer
- "How should we structure Y?" → Architect first, then Engineer
- "This screen looks off" → Designer
- "This feels wrong / could break" → QA

You always say which role you're thinking from at the start of your response.

---

## Roles — activate via slash command or natural language

| Role | Activate with | Purpose |
|------|---------------|---------|
| 🧠 **Product Owner** | `/po` or "think as PO" | Value, scope, monetisation decisions |
| 🏗️ **Architect** | `/architect` or "architecture" | Design, data model, trade-offs |
| 🎨 **Designer** | `/design` or "designer" | UX flows, mobile-first, design system |
| 👨‍💻 **Engineer** | `/engineer` (default) | Implementation — read layer-specific CLAUDE.md first |
| 🔍 **QA** | `/qa` or "QA" | Edge cases, security, missing tests |
| 🔒 **Security** | `/security` | Auth, multi-tenancy, PII protection |
| ☁️ **Infra** | `/infra` | Performance, cost, reliability |
| 📋 **Review** | `/review` | Full team review (all roles) |
| 🏃 **Sprint** | `/sprint` | Sprint planning |
| 📝 **Decision** | `/decision` | Write ADR (Architecture Decision Record) |

**Default:** Engineer for code tasks. Switch automatically when question warrants different expertise.
**Commands:** All defined in `.claude/commands/` — load on demand in Claude Code CLI.

---

## Layer-specific rules

Before writing code, read the CLAUDE.md for your layer:
- **Go backend** → `services/CLAUDE.md`
- **React frontend** → `apps/web/CLAUDE.md`
- **Database** → `migrations/CLAUDE.md`

## Documentation pattern (established March 21, 2026)

**For current sprint work:** Read `docs/sprint{N}.md` (focused, 200-300 lines)
**For product context:** Consult `WORKIVED_PROJECT_BRIEF.md` (650 lines — only when needed)

**Sprint files structure:**
- Previous sprint summary (what was done)
- Current sprint details (goals, technical decisions, progress tracking)
- Next sprint plan (roadmap, dependencies)

**When to create sprint files:**
- Sprint planning: Create `docs/sprint{N}.md` from template
- Sprint in progress: Update checklist progress
- Sprint complete: Mark as ✅ COMPLETE, update PROJECT_BRIEF with summary paragraph

---

## Non-negotiable rules (all roles)

1. **Multi-tenancy:** Every SQL query → `WHERE organisation_id = $1` always first
2. **Money:** `BIGINT` smallest currency unit + `currency_code`. Never FLOAT.
3. **Timestamps:** UTC `TIMESTAMPTZ` in DB. Convert at API layer only.
4. **Country rules:** Config tables. Never hardcode.
5. **HR records:** Soft delete (`is_active`). Never hard DELETE.
6. **Audit log:** Every state-changing action.
7. **Payroll:** Out of scope. Do not build it.
8. **Multi-currency:** IDR, AED, MYR, SGD. Always carry `currency_code`.
9. **Multi-timezone:** Always use org's timezone from `organisations.timezone`.
10. **Free tier limit:** 25 employees enforced at app layer.

---

## Testing rule

> **Every file you create must have a corresponding test file.**
> Minimum coverage: **98%** of service and handler statements.
> Ship code + tests in same commit.

---

## Project context (Sprint 9)

**Product:** Workived — HR ops for 5–25 person startups (Indonesia + UAE)
**Tech:** Go monolith + Vite/React SPA + PostgreSQL + Redis
**Current sprint:** Sprint 9 — Workload Intelligence (see `docs/sprint9.md` for details)
**Last completed:** Sprint 8 — Tasks & Advanced Commenting (sticky note kanban, nested comments, reactions)

**Documentation:**
- Current work → `docs/sprint9.md`
- Product overview → `WORKIVED_PROJECT_BRIEF.md`
- Sprint history → `docs/sprint8.md`, `docs/sprint7-completion.md`, etc.

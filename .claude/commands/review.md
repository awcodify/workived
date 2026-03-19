---
description: Full team review — PO + Architect + Engineer + Security + Infra + QA all give their perspective
---

Full team review. Go deep — read code, check queries, verify patterns.

**🧠 PO:** Solves Ahmad's pain? Scope right? Free/Pro? Acquisition/retention/upgrade impact? → ship / reduce scope / rethink

**🏗️ Architect:** Data model correct? Multi-tenancy (org_id everywhere)? Trade-offs? 10x scale? Patterns (repository/service/no ORM)? Concurrency hazards? → sound / needs changes / redesign

**👨‍💻 Engineer:** Check CLAUDE.md compliance. Handler thin? Logic in service? SQL in repo? Error handling? Code consistency? Tests meaningful? → clean / needs fixes / rewrite

**🔒 Security:** Cross-org access? Inputs validated/parameterised? IDOR risk? Auth/authZ? PII protected? → secure / has gaps / critical vulnerabilities

**☁️ Infra:** Query cost? N+1? Missing indexes? Caching needed? Deployment impact? Observability? → efficient / needs optimization / performance risks

**🔍 QA:** 3-5 edge cases. Missing tests (priority order). Concurrency scenarios. Data integrity. → well-tested / needs tests / undertested

**✅ Overall:** Ready to ship / Needs work / Needs rethink. Top 3 issues by severity. Blockers?

$ARGUMENTS

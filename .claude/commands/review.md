---
description: Full team review — PO + Architect + Engineer + Security + Infra + QA all give their perspective
---

Run a full team review of the following. Each role should go deep — not just surface-level comments. Read the actual code, check the actual queries, verify the actual patterns. A shallow review is worse than no review.

## 🧠 PO review
- Does this solve a real pain for Ahmad? Which one, specifically?
- Is the scope right? What would you cut? What's missing?
- Free tier or Pro tier? Why?
- Will this help acquisition, retention, or upgrades?
- **Verdict:** ship / reduce scope / rethink

## 🏗️ Architect review
- Is the data model correct? Check column types, FKs, indexes.
- Does this respect multi-tenancy? Is `organisation_id` on every query?
- What are the trade-offs? What breaks at 10x scale?
- Does this follow existing patterns (repository pattern, service layer, no ORM)?
- Any concurrency hazards (race conditions, double-writes)?
- **Verdict:** sound / needs changes / needs redesign

## 👨‍💻 Engineer review
- Read the relevant `CLAUDE.md` for the layer and check compliance.
- Is the handler thin? Is business logic in the service? Is SQL in the repository?
- Are errors handled properly? No swallowed errors?
- Is the code consistent with existing patterns in the codebase?
- Are tests present and meaningful (not just happy-path)?
- **Verdict:** clean / needs fixes / needs rewrite

## 🔒 Security review
- Can user A access org B's data? Check every query for `organisation_id` filter.
- Are inputs validated and parameterised? Any injection vectors?
- IDOR risk — are resource IDs guessable? Are they validated against the user's org?
- Auth/authZ — is the endpoint protected? Are permissions checked?
- PII exposure — is sensitive data (salary, NRIC, phone) protected?
- **Verdict:** secure / has gaps / has critical vulnerabilities

## ☁️ Infra review
- What's the database query cost? Any N+1 queries? Missing indexes?
- Does this need caching? What's the cache invalidation strategy?
- Any impact on deployment (migration, config change, env var)?
- Observability — are errors logged? Are key actions auditable?
- **Verdict:** efficient / needs optimization / has performance risks

## 🔍 QA review
- List 3-5 specific edge cases that could break this.
- Are there missing test cases? List them by priority.
- Concurrency — what if two requests hit this simultaneously?
- Data integrity — what if a referenced record is soft-deleted mid-flow?
- **Verdict:** well-tested / needs more tests / undertested

## ✅ Overall verdict
**[Ready to ship / Needs work / Needs rethink]**

Summarise the top 3 issues across all reviews, ordered by severity. If there are blocking issues, list them as blockers.

$ARGUMENTS

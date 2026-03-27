# Sprint 21 — Stability: Real User Bugs + Data Integrity

**Duration:** March 27–31, 2026
**Status:** 🏃 IN PROGRESS
**Theme:** Bug fixes from first real user testing + critical data fixes
**Type:** Stability sprint

**Why stability now:** Ricko (first external tester) found 5 bugs in his first session. These are the bugs Ahmad's employees will hit on day one. Fixing them now prevents churn before we even launch. No new features until the core works reliably.

---

## 📋 Previous Sprint Summaries

### Sprint 19 Completed ✅ (March 25, 2026)
- ✅ Budget period + gender eligibility for claim category and leave policy templates
- ✅ Mark as paid functionality with role-based access control

### Sprint 20 Completed ✅ (March 27, 2026)
- ✅ WOR-35: Leave pro-rating (proportional entitlements for mid-year joiners)
- ✅ WOR-31: Calendar/working day count type for leave policies
- ✅ WOR-7: Org-local timezone for date comparisons in leave module
- ✅ WOR-34: Calendar module — custom holiday CRUD (backend + frontend)
- ✅ WOR-20: Pro feature gating foundation (`RequireProPlan` middleware, `CodeInsufficientBalance` separation)

---

## 🎯 Current Sprint (Sprint 21)

### 🧠 PO Analysis

**Context:** Ricko (rickoyohanesthomas@gmail.com) ran through the app on March 27 and filed 5 issues (WOR-53 to WOR-57). These are real user bugs — the kind that make Ahmad close the app and go back to WhatsApp. Additionally, we have 3 known data/display bugs from internal testing.

**Decision:** Full stability sprint. Zero new features. Every bug here is something a user would notice in their first 5 minutes.

**Priority logic:**
1. **Blocking bugs** — features that don't work at all (task comments, task filters)
2. **Misleading data** — wrong numbers/status erode trust instantly
3. **Bad defaults** — 999 sick days, wrong currency

---

### Bug 1: WOR-53 — Task Comments Broken [Urgent] | S

**Problem:** Clicking "Add Comment" does nothing. Task comments are a core collaboration feature — without them, the task board is just a to-do list.

**Investigation needed:**
- Check if comment API endpoint is returning errors
- Check frontend mutation/event handler
- Likely: event handler not wired or mutation failing silently

**Linear:** WOR-53

---

### Bug 2: WOR-54 — Task Filter Not Working [Medium] | S

**Problem:** Switching task filter to "All" only shows unassigned tasks instead of all tasks. Users can't see the full picture.

**Investigation needed:**
- Check filter query params being sent to API
- Check if "All" filter is passing `assigned_to=null` instead of omitting the param
- Check frontend filter state management

**Linear:** WOR-54

---

### Bug 3: WOR-55 — Task Status Misleading [Medium] | S

**Problem:** Task status display is misleading/wrong. This erodes trust — if Ahmad sees wrong status, he can't trust any data in the app.

**Investigation needed:**
- Check what "wrong status" means specifically (likely: status label doesn't match actual state)
- Could be related to `is_final_state` column missing (see Bug 6)
- Check status mapping between backend and frontend

**Linear:** WOR-55

---

### Bug 4: WOR-56 — Attendance Status Misleading [Medium] | S

**Problem:** Shows "0 present" when user is actually present. This is Ahmad's #1 use case — he opens the app at 8am to see who showed up. If it says 0, he thinks nobody came.

**Investigation needed:**
- Check attendance summary query (count logic)
- Check if timezone mismatch causes today's attendance to not be counted
- May be related to WOR-7 timezone fix (already done for leave, but attendance may need same fix)

**Linear:** WOR-56

---

### Bug 5: WOR-57 — Sick Leave Default 999 Days [High] | XS

**Problem:** Default sick leave policy shows 999 days/year. Should be 365 max (or country-specific: Indonesia = 12 months with declining pay, UAE = 90 days).

**Fix:** Update seed/template data. Change default `days_per_year` for sick leave from 999 to 365.

**Linear:** WOR-57

---

### Bug 6: `is_final_state` Column Missing [Ops] | XS

**Problem:** Error log: `ERROR: column "is_final_state" does not exist (SQLSTATE 42703)` — breaks task list loading entirely.

**Root cause:** Migration 000019 defines the column, but it wasn't applied to the live database. This is an ops issue, not a code bug.

**Fix:**
- Run pending migrations on live DB
- Add migration status check to deployment checklist
- Verify after: task lists should load without error

---

### Bug 7: Claim Currency Defaults to IDR for UAE Orgs [Code] | XS

**Problem:** Claims page line 177 has `const currencyCode = balance.currency_code ?? 'IDR'` — UAE orgs see "Rp" instead of "AED". This is exactly the kind of bug that makes Ahmad think "this app isn't built for me."

**Fix:** Change fallback from `'IDR'` to org's `currency_code`. Use org context or remove hardcoded fallback entirely (the balance should always have currency_code from the API).

**File:** `apps/web/src/routes/_app/claims/index.tsx:177`

---

### Bug 8: Claim Budget Overview Color Wrong [Code] | XS

**Problem:** Claim budget card in overview shows wrong color when budget is unused. Should be green (full budget available) but shows a different color.

**Fix:** Check budget progress bar / color logic in overview page. When `spent = 0`, the bar should be fully green.

**File:** `apps/web/src/routes/_app/` (overview page, claims budget card)

---

## 📊 Sprint 21 Checklist

| # | Task | Linear | Effort | Status |
|---|------|--------|--------|--------|
| 1 | Fix task comments broken | WOR-53 | S | ⬜ |
| 2 | Fix task filter "All" showing only unassigned | WOR-54 | S | ⬜ |
| 3 | Fix task status misleading display | WOR-55 | S | ⬜ |
| 4 | Fix attendance "0 present" when present | WOR-56 | S | ⬜ |
| 5 | Fix sick leave default 999 → 365 | WOR-57 | XS | ⬜ |
| 6 | Run pending migrations (is_final_state) | — | XS | ⬜ |
| 7 | Fix claim currency IDR fallback for UAE | — | XS | ⬜ |
| 8 | Fix claim budget overview color | — | XS | ⬜ |

**Total effort:** ~4S + 4XS ≈ 3-4 days (fits in a week sprint)

---

## 📈 v1.0 Launch Readiness After Sprint 21

After this sprint, the core modules should be **stable for real users**:

| Module | Status | Notes |
|--------|--------|-------|
| Auth/Onboarding | ✅ 95% | Works well |
| People | ✅ 90% | Read-only profile done, edit needs approval flow |
| Attendance | 🔧 → ✅ | Fix status display (this sprint) |
| Leave | ✅ 90% | Pro-rating, timezone, calendar done |
| Claims | 🔧 → ✅ | Fix currency + budget color (this sprint) |
| Tasks | 🔧 → ✅ | Fix comments, filters, status (this sprint) |
| Calendar | ✅ 85% | Custom holidays done |
| Setup Wizard | ✅ 95% | Works well |

**Estimated v1.0 readiness after Sprint 21: ~75%** (up from ~65%)

---

## 🚀 Next Sprint Candidates (Sprint 22)

After stability is confirmed, top candidates by impact:

1. **WOR-11** [Urgent backlog]: Employment Type → Policy Eligibility — different leave/claim rules per employment type (full-time vs contract vs intern). Critical for real HR use.
2. **WOR-17** [High]: System Changelog — transparency builds trust. Simple implementation.
3. **WOR-52** [High]: Per-Employee Work Schedule Override — not everyone works Sun-Thu (UAE) or Mon-Fri.
4. **WOR-12** [High]: Employee Documents Module — contracts, permits, expiry tracking.
5. **WOR-21** [High]: PWA — installable on phone. Ahmad uses phone at 8am. High impact, low effort (est: 1 point).

# Sprint 18 — Bug Fixes, INA/UAE Policy Research, Onboarding Improvements

**Duration:** March 25, 2026
**Status:** 🚧 IN PROGRESS
**Team:** Full stack
**Type:** Bug fixes + research + feature

**Summary:** Fix critical bugs (403 orgless users, claim number formatting, paid claim email), research common leave & claim policies in Indonesia and UAE, improve invitation-based onboarding.

---

## 📋 Previous Sprint Summary

### Sprint 17 Completed ✅ (March 25, 2026)
- ✅ Claim status color semantics — config-driven StatusColors per module
- ✅ OpenAPI `/docs` basic auth — `gin.BasicAuth()` with env-var credentials
- ✅ Gender-based leave frontend + employee gender field — full-stack implementation
- ✅ Claim budget period policies — monthly/yearly with CTE-based aggregation
- ✅ Auto-archive done tasks — configurable on-read filter (default 7 days)

---

## 🎯 Current Sprint (Sprint 18)

---

### Bug 1: 403 on `/setup/status` for Invited Orgless Users ✅ | XS (15 min)

**🧠 PO:** Critical blocker — invited users who registered but never created a workspace get stuck on a blank 403 page. They can't access anything.

**Root cause:** JWT has `OrgID: nil` for users without an org. Tenant middleware blocks all tenant-scoped routes. `_app/route.tsx` calls `getSetupStatus()` on every page load, which goes through tenant middleware → 403 → entire app crashes.

**Fix:** Catch 403 in `_app/route.tsx` `beforeLoad` and redirect to `/setup-org` where invitation-aware onboarding already works.

**Files changed:**
- `apps/web/src/routes/_app/route.tsx` — added try/catch around `getSetupStatus()`, redirect to `/setup-org` on 403

---

### Bug 2: Claim Budget Number Format Inconsistency ✅ | XS (15 min)

**🧠 PO:** Claims header shows raw number with Indonesian locale (e.g., "1.500.000 remaining") while the rest of the app uses proper `formatMoney()` with currency symbol. Confusing for UAE orgs.

**Fix:** Replace `new Intl.NumberFormat('id-ID').format(...)` in claims header with shared `formatMoney()` util using the org's currency from balance data.

**Files changed:**
- `apps/web/src/routes/_app/claims/index.tsx` — import `formatMoney`, use it for header subtitle with `balances[0].currency_code`

---

### Bug 3: Paid Claim Not Sending Notification Email ✅ | XS (30 min)

**🧠 PO:** When a claim is marked as paid, the employee doesn't get notified. They have to manually check the app. Ahmad wants employees to know immediately when their money is coming.

**Fix:** Add `ClaimPaidTemplate` email template and `sendClaimPaidEmail` method, wire into `MarkAsPaid` service method.

**Files changed:**
- `services/pkg/email/templates.go` — added `ClaimPaidTemplate` with HTML and text templates
- `services/internal/claims/service.go` — added `sendClaimPaidEmail()`, called async from `MarkAsPaid()`

---

### Task 4: INA + UAE Leave & Claim Policy Research ⬜ | S (1 day)

**🧠 PO:** We need to understand what leave and claim policies are legally required or commonly used in Indonesia and UAE, so our defaults make sense for Ahmad's teams.

**Research areas:**
1. **Indonesia (Ketenagakerjaan / PP 35/2021):**
   - Annual leave (cuti tahunan)
   - Sick leave (cuti sakit)
   - Maternity/paternity leave
   - Marriage, bereavement, religious leave
   - Common claim categories (transport, medical, meal)

2. **UAE (UAE Labour Law / Federal Decree-Law No. 33/2021):**
   - Annual leave
   - Sick leave
   - Maternity/paternity leave
   - Hajj leave
   - Common claim categories (transport, medical, housing allowance claims)

**Deliverable:** Summary document with recommended default policies for each country.

---

### Task 5: Invitation-Aware Onboarding Improvements ⬜ | S (1 day)

**🧠 PO:** After register, instead of only "create workspace", user should also see option to join an existing workspace. If invited by admin → auto-accept. If requesting to join → needs approval. Admin needs a join request list page.

**Scope (minimal):**
- Accept invite after register (already works)
- Show pending invitations on setup-org page
- Join request list for admins (if time)

---

### Task 6: Read-Only My Profile Page ⬜ | S (1 day)

**🧠 PO:** Employees should be able to see their own profile data. Edit capability requires admin approval (because changes like gender affect leave policy eligibility), so v1 is read-only.

---

## 📊 Sprint 18 Checklist

| # | Task | Effort | Status |
|---|------|--------|--------|
| 1 | Fix 403 on setup/status for orgless users | XS | ✅ |
| 2 | Fix claim budget number format | XS | ✅ |
| 3 | Add paid claim notification email | XS | ✅ |
| 4 | INA + UAE leave & claim policy research | S | ⬜ |
| 5 | Invitation-aware onboarding improvements | S | ⬜ |
| 6 | Read-only My Profile page | S | ⬜ |

---

## 🚀 Next Sprint Plan (Sprint 19)

### Candidates
1. **My Profile edit with approval** — Employee edits require HR approval
2. **Pro gating + Stripe integration** — Feature flags, billing, landing page
3. **Notification infrastructure** — Foundation for @mentions, approval alerts, announcements
4. **Employee profile expansion** — Personal data, documents, work permit expiry

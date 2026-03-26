# Sprint 18 — Bug Fixes, INA/UAE Policy Research, Onboarding Improvements

**Duration:** March 25, 2026
**Status:** ✅ COMPLETE
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

### Task 4: INA + UAE Leave & Claim Policy Research ✅ | S (1 day)

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

### Task 5: Invitation-Aware Onboarding Improvements ✅ | XS (already done)

**🧠 PO:** After register, instead of only "create workspace", user should also see option to join an existing workspace.

**Status:** Already implemented in previous sprints:
- Setup-org page shows pending invitations with "Accept & join" buttons
- Invitation cards appear above "or create a new workspace" divider
- Bug 1 fix (this sprint) ensures orgless invited users reach setup-org page correctly
- Users who register without invitation link still see their invitations automatically

**No additional code changes needed** — the invitation-aware onboarding flow is complete.

---

### Task 6: Read-Only My Profile Page ✅ | S (1 day)

**🧠 PO:** Employees should be able to see their own profile data. Edit capability requires admin approval (because changes like gender affect leave policy eligibility), so v1 is read-only.

**Implementation:**
- New route: `/profile` — read-only employee profile page
- Uses existing `GET /employees/me` endpoint and `useMyEmployee()` hook
- Shows: name, avatar, job title, department, status, email, phone, employment type, gender, start date, reporting manager
- Loading skeleton, error state, and empty field handling
- "My profile" link added to settings menu (dock)
- Read-only notice: "To update your profile, please contact your HR administrator."

**Files changed:**
- `apps/web/src/routes/_app/profile/index.tsx` — new profile page
- `apps/web/src/routes/_app/profile/index.test.tsx` — 7 tests
- `apps/web/src/components/workived/dock/SettingsMenu.tsx` — added "My profile" menu item
- `apps/web/src/components/workived/dock/SettingsMenu.test.tsx` — updated tests (now 11)
- `apps/web/src/components/workived/dock/Dock.tsx` — profile path → people theme

---

## 📊 Sprint 18 Checklist

| # | Task | Effort | Status |
|---|------|--------|--------|
| 1 | Fix 403 on setup/status for orgless users | XS | ✅ |
| 2 | Fix claim budget number format | XS | ✅ |
| 3 | Add paid claim notification email | XS | ✅ |
| 4 | INA + UAE leave & claim policy research | S | ✅ |
| 5 | Invitation-aware onboarding improvements | XS | ✅ |
| 6 | Read-only My Profile page | S | ✅ |

---

## 🚀 Next Sprint Plan (Sprint 19)

### Candidates
1. **My Profile edit with approval** — Employee edits require HR approval
2. **Pro gating + Stripe integration** — Feature flags, billing, landing page
3. **Notification infrastructure** — Foundation for @mentions, approval alerts, announcements
4. **Employee profile expansion** — Personal data, documents, work permit expiry

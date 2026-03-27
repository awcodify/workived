# Sprint 22 — PWA + Employment Policy Eligibility + System Changelog

**Duration:** March 28–April 2, 2026
**Status:** ✅ COMPLETE
**Theme:** Launch readiness — mobile experience, real HR logic, user trust
**Type:** Feature sprint

**Why these 3:** PWA gives Ahmad "an app" (acquisition). Employment type eligibility makes leave/claims work for real orgs (retention). Changelog builds trust (churn reduction). Together they move us from 75% → 85% v1.0 readiness.

---

## 📋 Previous Sprint Summary

### Sprint 21 Completed ✅ (March 27, 2026)
- ✅ WOR-53: Fix task comments (missing `content_type` column)
- ✅ WOR-54: Fix task filter "All" → unassigned bug
- ✅ WOR-55: Fix task status count (use `is_final_state` lists)
- ✅ WOR-56: Fix attendance "0 present" (status string mismatch)
- ✅ WOR-57: Fix sick leave default 999 → 365
- ✅ Fix claim currency IDR fallback for UAE orgs
- ✅ 3 data migrations (000040, 000041, 000042)

---

## 🎯 Current Sprint (Sprint 22)

---

### Task 1: WOR-21 — Progressive Web App (PWA) | S (1-2 days)

**🧠 PO:** Ahmad uses his phone at 8am. PWA = app icon on home screen, instant load, no URL typing. "Download our app" is a stronger acquisition signal than "visit our website."

**Scope:**
- `manifest.json` with app name, icons, theme colors
- Service worker for offline shell (app shell caching)
- Install prompt / "Add to Home Screen" banner
- Splash screen with Workived branding

**Cut:**
- No push notifications (notification system not built yet)
- No offline data sync (too complex for v1)
- No app store listing

**🏗️ Architect plan:**

- **Plugin:** `vite-plugin-pwa` with `generateSW` mode (auto Workbox SW generation)
- **Manifest:** `name: "Workived"`, `theme_color: #6357E8`, `background_color: #0C0C0F`, `display: standalone`
- **Icons:** 192x192, 512x512, 512x512 maskable, 180x180 apple-touch-icon
- **SW caching:**
  - App shell: **Precache** (automatic via VitePWA)
  - API `/api/*`: **NetworkFirst** with 5s timeout (HR data must be fresh)
  - Auth endpoints: **NetworkOnly** (never cache tokens)
  - Image uploads: **CacheFirst** with 30-day expiry
- **SW updates:** `prompt` mode — Sonner toast "New version available" (not silent auto-update)
- **Install prompt:** `PWAInstallPrompt` component, shown on 2nd session only, mobile only, after auth. Uses `beforeinstallprompt` event stored in Zustand `pwa.ts` store
- **iOS:** Instructional banner ("Tap Share → Add to Home Screen") since iOS lacks `beforeinstallprompt`
- **Logout:** Clear `api-cache` and `image-cache` on logout to prevent data leaks between users
- **Files:** ~10 new (component, store, hook, icons), ~5 modified (vite.config, index.html, root layout, tsconfig, package.json)
- **Risk:** Stale cache after deploy → mitigated by prompt update strategy + 401 interceptor

---

### Task 2: WOR-11 — Employment Type → Policy Eligibility | M (3-5 days)

**🧠 PO:** Ahmad's full-time employees get 12 days annual leave, interns get 0, contractors get different claims. Today everyone gets the same policies — he has to manually reject ineligible requests. This is a v1.0 blocker for any org with mixed employment types.

**Scope:**
- Add `eligible_employment_types` to `leave_policies` and `claim_categories`
- Filter at balance calculation time (not at policy level)
- Setup wizard: let user configure which policies apply to which types
- Default: all employment types eligible (backward compatible)

**Cut:**
- No department-level policy segmentation (separate backlog item)
- No per-employee overrides (too complex for v1)

**🏗️ Architect plan:**

- **Data model:** `TEXT[] employment_types` column on both `leave_policies` and `claim_categories`
  - Default: `'{full_time,part_time,contract,intern}'` (all eligible, backward compatible)
  - GIN indexes for array overlap queries
- **Why TEXT[] over junction table:** Only 4 enum values, no per-type overrides needed. Matches existing `gender_eligibility` pattern. Junction table is overkill for v1.
- **Migration 000043:** Add columns + indexes to both tables
- **Backend (7 touch points):**
  1. `leave/repository.go` — `CreateBalancesForAllEmployees`: filter by `employment_type = ANY($n)`
  2. `leave/rollover.go` — `RolloverBalances`: skip ineligible employees
  3. `leave/service.go` — `SubmitRequest`: add eligibility check after gender check
  4. `leave/repository.go` — `EnsureBalance`: accept employment_type for filtering
  5. `claims/service.go` — `ensureEmployeeBalances`: filter categories by type
  6. `claims/service.go` — `SubmitClaim`: add eligibility check
  7. `claims/service.go` — `ListBalances`: only return eligible balances
- **New helper:** `GetEmployeeEligibilityInfo(ctx, orgID, empID) → {Gender, EmploymentType}` (avoid 2 queries)
- **API:** `employment_types` field added to create/update for policies and categories
- **Frontend:** Multi-select checkbox group on policy/category edit forms
- **Edge cases:**
  - Employee type changes → existing balances stay, new ones reflect eligibility
  - Policy eligibility narrows → existing requests unaffected, new submissions blocked
  - At least one type must remain selected (validation)
- **Implementation order:** Migration → Repository → Types → Service → Handler → Tests → Frontend

---

### Task 3: WOR-17 — System Changelog | S (1-2 days)

**🧠 PO:** Ahmad opens the app, things look different, doesn't know if it's a bug or feature. Ricko files bugs on things that were intentionally changed. A simple changelog fixes both: transparency + testing communication.

**Scope:**
- New route: `/changelog`
- Config-driven entries (JSON or markdown file)
- Each entry: date, version tag, title, description, type (feature/fix/improvement)
- Link from Settings menu
- Optional "What's New" dot indicator on settings when new entries exist

**Cut:**
- No in-app toast/modal on new changes
- No RSS feed
- No admin UI to manage entries (file-based is fine)

**🏗️ Architect plan:**

- **Data source:** Static `apps/web/src/data/changelog.ts` exporting typed array (not API — zero backend work, type-safe, redeploy to update)
- **Entry schema:** `{ id, date, type: 'feature'|'fix'|'improvement'|'announcement', title, description, module? }`
- **Route:** `/_app/changelog` (top-level, not under settings — changelog is product info, not a setting)
- **UI design:**
  - Page background: `#F3F2FB` (soft violet, neutral/informational)
  - Entries grouped by month
  - Type indicator: 7x7px colored square (design system convention)
    - feature = `colors.ok`, fix = `colors.err`, improvement = `colors.accent`, announcement = `colors.warn`
  - No card borders — spacing + hover (per design system)
- **"What's New" dot:** `localStorage` key `workived-changelog-last-seen` comparing latest entry ID. Hook: `useChangelogUnread() → { hasUnread, markAsRead }`
- **Settings menu:** Add "What's New" item with `Sparkles` icon + conditional notification dot
- **Files:** 4 new (data file, hook, route, test), 1 modified (SettingsMenu)
- **Effort:** ~2.5 hours

---

## 📊 Sprint 22 Checklist

| # | Task | Linear | Effort | Status |
|---|------|--------|--------|--------|
| 1 | Progressive Web App (PWA) | WOR-21 | S | ✅ |
| 2 | Employment Type → Policy Eligibility | WOR-11 | M | ✅ |
| 3 | System Changelog | WOR-17 | S | ✅ |

**Total effort:** 2S + 1M ≈ 5-8 days

---

## 🚀 Next Sprint Candidates (Sprint 23)

1. **WOR-52** Per-employee work schedule override (S)
2. **WOR-12** Employee documents module (M)
3. **WOR-32** One-time leave entitlements — Hajj, max_lifetime_uses (S)
4. **WOR-15** Comprehensive audit logging (M)
5. **E2E test suite** — Playwright for critical flows (L)

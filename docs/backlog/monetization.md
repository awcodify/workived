# Monetization & Growth Backlog

Features for Pro tier, billing, and market expansion.

---

## ⭐⭐⭐⭐⭐ Landing Page (Marketing Site)
**Status:** 📋 Backlog (Sprint 11+)  
**Effort:** L (1-2 weeks)  
**Value:** Acquisition channel + product marketing

**Description:**
Build public marketing website with Astro (separate from dashboard).

**User Story:**
> As a potential customer, I want to see what Workived does before signing up, so I can decide if it's right for my company.

**Features:**
- Hero section with value prop
- Feature showcase (modules, screenshots)
- Pricing page (Free vs Pro)
- Country-specific messaging (Indonesia, UAE)
- Blog for SEO
- Sign-up CTA
- Contact form

**Why it matters:**
- Currently: No public website (users go straight to sign-up)
- Need: Marketing funnel (awareness → interest → sign-up)
- SEO: Drive organic traffic
- Credibility: Professional website builds trust

**Dependencies:**
- Pricing finalized (Free vs Pro features)

**Technical scope:**
- New Astro project in `apps/landing/`
- Deployment: Vercel Edge (fast, global CDN)
- Content: Copy + screenshots for each module
- Blog: Markdown-based (Astro Content Collections)

**Content needed:**
- Value prop: "HR ops for 5-25 person startups"
- Target countries: Indonesia, UAE (localized messaging)
- Social proof: Testimonials (once we have beta customers)

---

## ⭐⭐⭐⭐⭐ Pro Feature Gating
**Status:** 📋 Backlog (Sprint 11+)  
**Effort:** S (2 days)  
**Value:** Enable monetization

**Description:**
Implement feature gating middleware to enforce Pro tier limits.

**User Story:**
> As a free tier user, when I try to add a 26th employee, I see an upgrade prompt, so I know I need Pro to grow.

**Free Tier (Current):**
- Up to 25 employees
- All core modules (Attendance, Leave, Claims, Tasks, Calendar)
- Basic support (email)

**Pro Tier (Future):**
- Unlimited employees
- GPS geofencing for clock-in
- Custom leave types (beyond templates)
- Shift scheduling
- Approval escalation rules
- Priority support (chat)
- Advanced analytics

**Why it matters:**
- Free tier is generous (25 employees covers most startups)
- Pro tier for growth (26+ employees = paying customers)
- Clear upsell path

**Dependencies:**
- None (middleware already has `RequirePro()` function)

**Technical scope:**
- Backend: Enforce limits in middleware
- Database: Add `plan` column to `organisations` table (enum: free, pro)
- Frontend: Upgrade prompts + feature badges ("Pro")
- Effort: 1 day backend, 1 day frontend

**Feature gates to implement:**
1. Employee limit (25 → unlimited)
2. GPS geofencing (Pro only)
3. Custom leave types (Pro only)
4. Shift scheduling (Pro only)

---

## ⭐⭐⭐⭐ Billing Integration
**Status:** 📋 Backlog (Sprint 11+)  
**Effort:** M (1 week)  
**Value:** Revenue collection

**Description:**
Integrate Stripe or Paddle for subscription billing.

**User Story:**
> As an admin, I want to upgrade to Pro with credit card, so I can unlock unlimited employees.

**Features:**
- Pricing: $29/month per organization (Pro tier)
- Payment methods: Credit card, debit card
- Billing cycle: Monthly (with annual discount later)
- Upgrade flow: Free → Pro (instant activation)
- Downgrade flow: Pro → Free (at end of billing period)
- Invoice generation (Stripe auto-sends)
- Payment failed handling (grace period + email notifications)

**Provider decision:**
- **Option 1: Stripe** (most popular, flexible, global)
- **Option 2: Paddle** (merchant of record, handles VAT/taxes)

**Recommendation: Start with Stripe**
- Direct relationship with customers
- Better for Indonesia/UAE (Stripe available)
- More control over pricing experiments

**Why it matters:**
- Can't charge customers without billing system
- Stripe handles PCI compliance (we don't store card numbers)

**Dependencies:**
- Pro feature gating implemented first
- Pricing finalized

**Technical scope:**
- Backend: Stripe webhook endpoints (subscription events)
- Database: `subscriptions` table (plan, status, current_period_end)
- Frontend: Upgrade modal + payment form (Stripe Elements)
- Testing: Use Stripe test mode extensively

**Stripe events to handle:**
- `customer.subscription.created` → Activate Pro
- `customer.subscription.updated` → Update plan
- `customer.subscription.deleted` → Downgrade to Free
- `invoice.payment_failed` → Send notification, grace period

---

## ⭐⭐⭐⭐ GPS Geofencing (Pro)
**Status:** 📋 Backlog (Pro feature)  
**Effort:** M (4 days)  
**Value:** Prevent clock-in fraud

**Description:**
Require employees to be within X meters of office location to clock in.

**User Story:**
> As an admin, I want employees to clock in only when at office, so I prevent "clock in from home then arrive late" fraud.

**Features:**
- Admin sets office location (lat/lng + radius in meters)
- Clock-in checks GPS accuracy
- Block clock-in if outside geofence
- Show distance to office in error message
- Override option for admin (remote work exception)

**Why it matters:**
- Fraud prevention (especially for companies with strict office policies)
- Common in UAE companies (labor regulations)
- Competitive feature (already in competitors)

**Dependencies:**
- Browser geolocation API (requires HTTPS)
- Pro tier billing implemented

**Technical scope:**
- Database: Add `office_location` to `organisations` table (`POINT` type)
- Backend: Geofence validation in clock-in handler
- Frontend: Request GPS permission + show distance
- Formula: Haversine distance calculation

**Privacy considerations:**
- Only check GPS at clock-in time (not continuous tracking)
- Don't store GPS coordinates (just validate at request time)
- Clear communication: "GPS used only for office geofence"

**Effort:** 2 days backend, 2 days frontend

---

## ⭐⭐⭐⭐ PWA (Progressive Web App)
**Status:** 📋 Backlog (Sprint 11+)  
**Effort:** S (3 days)  
**Value:** Mobile app experience without app store

**Description:**
Make dashboard installable as PWA (works offline, home screen icon).

**User Story:**
> As a manager, I want to install Workived on my phone home screen, so it feels like a native app.

**Features:**
- Web manifest (app name, icons, colors)
- Service worker (offline support)
- Install prompt (browser shows "Add to Home Screen")
- Offline mode: View cached data when no internet
- Push notifications (browser notifications API)

**Why it matters:**
- Native app feel without app store approval
- Works on iPhone and Android
- Faster development than native apps
- Push notifications for approvals

**Dependencies:**
- HTTPS (already required)

**Technical scope:**
- manifest.json (already partially done in Vite config)
- Service worker for caching
- Offline fallback page
- Test on real devices

**Offline strategy:**
- Cache: Employee list, leave balances (read-only when offline)
- Don't cache: Approvals, clock-in (require online)

---

## ⭐⭐⭐ Custom Leave Types (Pro)
**Status:** 📋 Backlog (Pro feature)  
**Effort:** S (2 days)  
**Value:** Flexibility for unique policies

**Description:**
Let Pro users create custom leave types beyond templates.

**User Story:**
> As an admin with unique policies (e.g., "Volunteer Day"), I want to create custom leave types, so I can track all types of leave.

**Features:**
- Create custom leave type (name, days per year, requires approval, etc.)
- Same configuration as templates
- Show "Custom" badge in UI
- Can't edit system templates

**Why it matters:**
- Some companies have unique leave types (Study leave, Pilgrimage, Blood donation)
- Free tier: Template-based only (covers 95% of cases)
- Pro tier: Full flexibility

**Dependencies:**
- Pro tier billing

**Technical scope:**
- Database: Already supports this (no migration needed)
- Backend: Add validation (Pro tier check)
- Frontend: "Create Custom Leave Type" button (Pro only)

---

## ⭐⭐⭐ Shift Scheduling (Pro)
**Status:** 📋 Backlog (Pro feature)  
**Effort:** L (2 weeks)  
**Value:** Complex scheduling for retail/healthcare

**Description:**
Create and assign shifts (morning, afternoon, night) with automatic overtime calculation.

**User Story:**
> As a retail manager, I want to create shift schedules, so my team knows when they work and I can track overtime.

**Features:**
- Shift templates (Morning 8-4, Afternoon 4-12, Night 12-8)
- Weekly schedule assignment
- Conflict detection (double-booked shifts)
- Overtime auto-calculation (> 8h/day or > 40h/week)
- Mobile calendar view for employees

**Why it matters:**
- Retail, healthcare, hospitality need shift scheduling
- Current: Only supports fixed work schedules (9-5)
- Competitive gap: Factorial, BambooHR have this

**Dependencies:**
- Pro tier billing
- Work schedules module exists (extend it)

**Technical scope:**
- Database: Extend `work_schedules` with shift types
- Backend: Shift assignment logic + conflict detection
- Frontend: Drag-and-drop shift scheduler UI
- Complex: Lots of edge cases

**Effort:** Too large for MVP — defer until customers explicitly request it

---

## ⭐⭐ Approval Escalation Rules (Pro)
**Status:** 📋 Backlog (Pro feature)  
**Effort:** M (5 days)  
**Value:** Prevent approvals from stalling

**Description:**
Automatically escalate or approve if manager doesn't respond within X days.

**User Story:**
> As an admin, I want leave requests to auto-approve after 3 days if manager doesn't respond, so employees aren't blocked by slow managers.

**Features:**
- Escalation rules:
  - Auto-approve after X days (configurable)
  - Escalate to skip-level manager
  - Send reminder notifications daily
- Rule builder UI
- Audit log shows "auto-approved due to timeout"

**Why it matters:**
- Prevents workflow bottlenecks
- Especially useful when manager is on vacation

**Dependencies:**
- Pro tier billing
- Background job for checking pending approvals

**Technical scope:**
- Database: `escalation_rules` table
- Backend: Scheduled job checks pending approvals > X days
- Frontend: Rule configuration UI
- Cron: Run daily to check and escalate

---

*More monetization ideas TBD based on customer feedback*

# Sprint 11 — Infrastructure & Beta Launch

**Duration:** March 22, 2026 - March 28, 2026 (1 week)  
**Status:** 🚧 In Progress  
**Team:** Infra + Backend + Frontend  
**Type:** Infrastructure sprint + UX polish

---

## 📋 Previous Sprint Summary

### Sprint 10.5 Completed ✅ (March 21, 2026)
- ✅ Fixed non-admin 403 on attendance API (org-wide visibility)
- ✅ Added unlimited leave/claim support (Indonesia/UAE compliance)
- ✅ Fixed TaskFilters test compilation errors
- ✅ Fixed claim budget formatting precision
- ✅ Fixed EmployeeSelector text overflow
- ✅ Bonus: Added department filter to EmployeeSelector
- ✅ Bonus: Fixed approval modal width on mobile

### Ad-Hoc Work Completed ✅ (March 22, 2026)
- ✅ **Leave & Claim Approval UX Revamp**
  - Modal-based request submission (no page navigation)
  - Created shared request components:
    - `RequestListItem` — Compact row with inline actions (~300 lines)
    - `EmployeeRequestGroup` — Collapsible groups with bulk actions (~200 lines)
    - `RequestDetailsModal` — Generic details modal (~150 lines)
  - Two-column dashboard layout (balances + tabbed requests)
  - Inline approve/reject with reason textarea
  - Grouped approvals by employee
  - Progress bars for leave/claim balances
  - Removed 8 unused files (standalone pages, old components)
  - **Impact:** ~660 lines removed from leave, similar for claims — massive simplification

### Key Outcomes
- **Product Quality:** All P0-P1 bugs fixed, production-ready codebase
- **UX Excellence:** Best-in-class approval workflow (faster than any competitor)
- **Code Quality:** Shared component architecture reduces duplication by 40%+
- **Compliance Ready:** Unlimited leave support for Indonesia/UAE markets

### Production Readiness Status (March 21, 2026 Review)
- **Core Product:** 95% complete ✅
- **API Coverage:** 95% complete ✅
- **Frontend:** 90% complete ✅
- **Testing:** 70% complete ⚠️
- **Security:** 90% complete ✅
- **Compliance:** 65% complete ⚠️
- **Infrastructure:** 40% complete ❌ **← Sprint 11 Focus**
- **Monetization:** 0% ❌ (Sprint 12+)

**Verdict:** Ready for closed beta with proper infrastructure

---

## 🎯 Current Sprint (Sprint 11)

### Sprint Vision
> "Ship Workived to production and get it in front of real users. Make deployment reliable, monitored, and repeatable."

### Goals
1. **Deploy to Production** — Get app running on reliable infrastructure
2. **Monitoring & Alerts** — Know when things break before users do
3. **Documentation** — Update docs with UX revamp changes
4. **Beta Preparation** — Prepare for first 10 beta companies

### Customer Outcome
> "I signed up for Workived beta and it just works. The approval flow is so fast compared to our old WhatsApp process!"

---

## 🏗️ Features in Development

### 1. ✅ Production Deployment Infrastructure ⭐⭐⭐⭐⭐
**Status:** 📋 Planned  
**Effort:** 3 days  
**Value:** Unblock beta launch — can't get users without deployment

**Strategic Decision:**

**Option A: Railway (Quick Beta — Recommended)**
- **Timeline:** 1-2 days
- **Cost:** $20-40/month for beta (free tier + add-ons)
- **Pros:** 
  - Fastest path to users
  - Automatic SSL, GitHub deploys
  - PostgreSQL included
  - Good enough for 10-50 companies
- **Cons:** 
  - Not production-scale
  - Limited control
  - Will need AWS migration later
  
**Option B: AWS (Full Production)**
- **Timeline:** 5-7 days
- **Cost:** $100-200/month initially
- **Pros:**
  - Production-ready
  - Full control
  - Scalable to 1000+ companies
- **Cons:**
  - Longer setup
  - More complex
  - Overkill for beta

**Decision: Start with Railway, migrate to AWS after beta validation.**

**Reasoning:**
- Speed > perfection for beta
- Need user feedback before investing in AWS
- Railway → AWS migration path is well-documented
- Can delay AWS until we have 20+ paying customers

**Railway Deployment Scope:**

**Backend:**
- [ ] Configure Railway project
- [ ] Environment variables setup (DB_URL, JWT_SECRET, etc.)
- [ ] PostgreSQL add-on provisioning
- [ ] Redis add-on for caching
- [ ] S3-compatible storage (Cloudflare R2 or Railway volumes)
- [ ] Run migrations on deploy
- [ ] Health check endpoint: `GET /health`
- [ ] Dockerfile optimization (multi-stage build)

**Frontend:**
- [ ] Vite production build configuration
- [ ] Environment variables (VITE_API_URL)
- [ ] Static file serving via Nginx
- [ ] CORS configuration
- [ ] CSP headers

**Database:**
- [ ] Seed production data (public holidays, templates)
- [ ] Backup strategy (Railway auto-backups)
- [ ] Connection pooling (pgx pool settings)

**Domain & SSL:**
- [ ] Point `workived.com` to Railway
- [ ] SSL certificate (automatic via Railway)
- [ ] API subdomain: `api.workived.com`
- [ ] App subdomain: `app.workived.com`

**CI/CD:**
- [ ] GitHub Actions workflow
- [ ] Automatic deploys on `main` branch push
- [ ] Preview deployments for PRs (optional)
- [ ] Rollback procedure documented

**Documentation:**
- [ ] Update [DEPLOYMENT.md](./DEPLOYMENT.md) with Railway steps
- [ ] Add [QUICK_START_DEPLOY.md](./QUICK_START_DEPLOY.md) for Railway
- [ ] Environment variables reference
- [ ] Troubleshooting guide

**Testing:**
- [ ] Smoke test on production URL
- [ ] Full manual test of critical flows:
  - Sign up → Create org → Invite member
  - Submit leave → Approve
  - Submit claim → Approve
  - Create task → Comment → React

**Success Criteria:**
- ✅ App accessible at `https://app.workived.com`
- ✅ API accessible at `https://api.workived.com`
- ✅ Zero downtime during normal operation
- ✅ Database migrations run successfully
- ✅ All critical flows work end-to-end

---

### 2. 📊 Monitoring & Observability ⭐⭐⭐⭐⭐
**Status:** 📋 Planned  
**Effort:** 2 days  
**Value:** Know when things break, debug issues quickly

**Problem:**
- Currently: No visibility into production errors
- No way to know if users are hitting bugs
- No performance metrics
- Can't debug issues without logs

**Solution Stack:**

**Error Tracking: Sentry**
- Frontend error tracking (React error boundary)
- Backend error tracking (Go SDK)
- Captures stack traces, context, user info
- Free tier: 5K errors/month (enough for beta)

**Logging: Railway Built-in**
- Structured JSON logs (logrus or zap)
- Log levels: ERROR, WARN, INFO, DEBUG
- Query logs via Railway dashboard
- Retention: 7 days (free tier)

**Performance Monitoring:**
- Endpoint response times (built into Go handlers)
- Database query performance (pgx slow query log)
- Frontend page load metrics (Sentry Performance)

**Uptime Monitoring:**
- **UptimeRobot** (free tier)
- Monitor: `https://api.workived.com/health`
- Check interval: 5 minutes
- Alert: Email + Slack

**Alerting:**
- Sentry: Immediate alert on new error type
- UptimeRobot: Alert if down for >5 minutes
- Railway: Alert on deployment failure

**Scope:**

**Backend:**
- [ ] Install Sentry Go SDK
- [ ] Add Sentry middleware to Gin
- [ ] Structured logging (switch to zap)
- [ ] Health check endpoint with DB ping
- [ ] Panic recovery middleware

**Frontend:**
- [ ] Install Sentry React SDK
- [ ] Error boundary component
- [ ] Source maps upload (optional for beta)
- [ ] User context (org_id, user_id for debugging)

**Infrastructure:**
- [ ] UptimeRobot monitor setup
- [ ] Slack webhook for alerts
- [ ] Document runbook for common alerts

**Success Criteria:**
- ✅ Sentry capturing errors in production
- ✅ UptimeRobot monitoring uptime
- ✅ Structured logs viewable in Railway
- ✅ Alert received within 5 minutes of downtime
- ✅ Can replay user sessions to debug issues

---

### 3. 📝 Documentation Updates ⭐⭐⭐
**Status:** 📋 Planned  
**Effort:** 1 day  
**Value:** Capture UX revamp decisions, update sprint history

**Updates Needed:**

**Sprint Documentation:**
- [x] Create `docs/sprint11.md` (this file)
- [ ] Update `WORKIVED_PROJECT_BRIEF.md` with Sprint 10.5 summary
- [ ] Mark Sprint 11 as complete when done

**Code Documentation:**
- [ ] Document shared request components in README:
  - `apps/web/src/components/workived/shared/requests/README.md`
  - Explain config pattern, theme system, actions interface
- [ ] Add JSDoc comments to key functions:
  - `RequestListItem.tsx` — Component props
  - `createLeaveRequestConfig()` — Config factory pattern
  - `createClaimRequestConfig()` — Config factory pattern

**API Documentation:**
- [ ] Update `docs/api/openapi.yaml` if any endpoints changed
- [ ] Verify all 87+ endpoints are documented
- [ ] Add deployment section (Railway URLs)

**Architecture Decisions:**
- [ ] Write ADR: "Why Shared Request Components Over Module Duplication"
  - `docs/adr/015-shared-request-components.md`
  - Explains config pattern, theme system, reusability gains

**User Guides (Post-Beta):**
- [ ] How to submit leave request (screenshot walkthrough)
- [ ] How to approve requests (manager guide)
- [ ] Keyboard shortcuts reference

**Success Criteria:**
- ✅ All sprint docs up to date
- ✅ Shared components documented
- ✅ ADR published
- ✅ OpenAPI spec accurate

---

### 4. 🧪 Beta Readiness Checklist ⭐⭐⭐⭐
**Status:** 📋 Planned  
**Effort:** 1 day  
**Value:** Smooth beta onboarding experience

**Pre-Launch Checklist:**

**Product:**
- [ ] Test sign-up flow end-to-end
- [ ] Verify email invitations work
- [ ] Test all critical paths (leave, claims, tasks, attendance)
- [ ] Check mobile responsiveness (90% of beta users will try mobile first)
- [ ] Verify Indonesia + UAE timezone/currency handling

**Marketing Materials:**
- [ ] Beta landing page (simple one-pager)
  - Value prop: "Attendance & leave management built for startups"
  - Features: Clock in/out, leave tracking, claim approvals
  - CTA: "Request Beta Access"
- [ ] Beta sign-up form (Typeform or Tally)
  - Company name
  - Industry
  - Team size (5-25 filter)
  - Country (Indonesia/UAE priority)
  - Founder email
  - Current pain point (open text)

**Onboarding:**
- [ ] Welcome email template
- [ ] First-time setup wizard (inline help)
- [ ] Sample data option:
  - 5 demo employees
  - 2 leave policies
  - 3 claim categories
  - 1 public holiday
- [ ] Video tutorial: "5-minute Workived setup"

**Support:**
- [ ] Create support email: `hello@workived.com`
- [ ] Set up shared inbox (Gmail or Plane)
- [ ] Response SLA: 24 hours for beta users
- [ ] Bug report template (GitHub issues)

**Beta User Outreach:**
- [ ] List of 20 target companies (Indonesia + UAE)
- [ ] Cold email template:
  > "Hi [Name], I'm building Workived — attendance & leave management for small startups. You're running a [team size] team, and I'd love to get your feedback on our beta. Interested in a quick demo?"
- [ ] LinkedIn outreach script
- [ ] Founder's personal network (warm intros)

**Success Metrics:**
- Goal: 10 beta companies signed up
- Goal: 5 companies actively using (weekly)
- Goal: 2 companies convert to paid in 3 months
- Track: NPS score, feature requests, bug reports

---

## 🚫 Out of Scope (Deferred to Sprint 12+)

### Not Doing This Sprint:
- ❌ Pro tier billing (Stripe integration)
- ❌ Email verification flow (use magic links for beta)
- ❌ Password reset flow (manually reset in DB for beta)
- ❌ Full AWS infrastructure (Railway first)
- ❌ Performance optimization (premature for beta)
- ❌ Mobile app (PWA sufficient for beta)
- ❌ Multi-language support (English only for beta)
- ❌ Advanced analytics (basic reports only)
- ❌ Bulk employee import (manual entry for beta)

**Reasoning:** Focus on deployment + getting real user feedback. Add polish after validating product-market fit.

---

## 📊 Metrics & Success Criteria

### Technical Metrics
- **Deployment:** App live on Railway by Day 3
- **Uptime:** 99%+ during beta (measured by UptimeRobot)
- **Error rate:** <1% of requests (measured by Sentry)
- **Response time:** API p95 < 500ms
- **Test coverage:** Maintain 98%+ on new code

### User Metrics (Beta Phase)
- **Sign-ups:** 10 companies in first 2 weeks
- **Activation:** 50% set up org + invite 1 member
- **Retention:** 30% weekly active users (WAU)
- **Engagement:** 5 requests submitted per company per week
- **Feedback:** 20+ product feedback messages

### Sprint Completion Checklist
- [ ] App deployed to `app.workived.com`
- [ ] API deployed to `api.workived.com`
- [ ] Sentry monitoring active
- [ ] UptimeRobot monitoring active
- [ ] Documentation updated
- [ ] ADR written for shared components
- [ ] Beta landing page live
- [ ] 5 beta invites sent

---

## 🚀 Next Sprint Plan (Sprint 12)

### Proposed Features (Post-Beta Feedback)

**Priority 1: User Feedback Improvements** ⭐⭐⭐⭐⭐
- Fix top 3 most-reported bugs
- Implement top 2 most-requested features
- Polish rough edges identified in beta

**Priority 2: Billing & Monetization** ⭐⭐⭐⭐
- Stripe integration
- Pro tier upgrade flow
- Usage-based billing (per employee)
- Payment method management

**Priority 3: Advanced Features** ⭐⭐⭐
- Email verification flow
- Password reset
- Bulk employee CSV import
- Advanced reporting

**Priority 4: Performance** ⭐⭐⭐
- Database query optimization
- Frontend bundle size reduction
- Image optimization
- Caching layer (Redis)

**Decision Point:** Prioritize based on beta user feedback. If users love it → focus on billing. If users struggle → focus on UX fixes.

---

## 🔗 References

- [Sprint 10.5 Completion](./sprint10.5.md) ✅
- [Production Readiness Review](./PRODUCTION_READINESS_REVIEW.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Quick Start Deploy](./QUICK_START_DEPLOY.md) (to be created)
- [Project Brief](../WORKIVED_PROJECT_BRIEF.md)
- [Backlog](./backlog/)

---

## 📝 Daily Log

### Day 1 (March 22, 2026)
- [x] Created Sprint 11 documentation
- [ ] Railway project setup
- [ ] Database provisioning
- [ ] Environment variables configuration

### Day 2 (March 23, 2026)
- [ ] Backend deployment
- [ ] Frontend deployment
- [ ] Domain configuration
- [ ] SSL setup

### Day 3 (March 24, 2026)
- [ ] Sentry integration
- [ ] UptimeRobot monitoring
- [ ] Smoke testing
- [ ] First beta invite sent

### Day 4 (March 25, 2026)
- [ ] Documentation updates
- [ ] ADR writing
- [ ] Beta landing page
- [ ] Support inbox setup

### Day 5 (March 26, 2026)
- [ ] Beta outreach (10 companies)
- [ ] Onboarding materials
- [ ] Video tutorial
- [ ] Support SLA setup

### Day 6-7 (March 27-28, 2026)
- [ ] Buffer for issues
- [ ] Sprint retrospective
- [ ] Plan Sprint 12

---

**Status:** 🚧 In Progress — Ready to ship! 🚀

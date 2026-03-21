# Advanced Features Backlog (Phase 2)

Long-term features requiring significant design and development effort.

---

## ⭐⭐⭐⭐⭐ Payroll Module
**Status:** ❌ Rejected for Phase 1 (deferred to Phase 2)  
**Effort:** XL (3+ months)  
**Value:** Complete HR suite

**Description:**
Calculate monthly salary, deductions, tax withholding, and generate payslips.

**Why deferred:**
- **Insanely complex:** Each country has different tax rules
  - Indonesia: PPh21 progressive tax, BPJS health, BPJS employment, THR
  - UAE: No income tax, but gratuity calculation
  - Malaysia: EPF, SOCSO, PCB tax
  - Singapore: CPF contributions, tax relief
- **High compliance risk:** Errors = legal trouble
- **Low MVP value:** Most startups use accountants for payroll
- **Competitors exist:** Payroll SaaS already available (Payoneer, Deel)
- **Integration better:** Integrate with existing payroll providers instead

**If we build (Phase 2):**
- Start with ONE country (Indonesia)
- Partner with accounting firm for compliance review
- Extensive testing with real companies
- Insurance for calculation errors

**Alternative approach:**
- Export data to Excel (employee list, attendance, leave)
- Let accountant calculate payroll
- Import payslips as PDFs (attach to employee documents)

**Decision:** **Do NOT build payroll in Phase 1**
**Revisit:** Only if customers explicitly request and we have legal resources

---

## ⭐⭐⭐⭐ HR Analytics Dashboard
**Status:** 📋 Backlog (Phase 2)  
**Effort:** L (2-3 weeks)  
**Value:** Insights for decision-making

**Description:**
Advanced analytics and reports for HR trends.

**User Story:**
> As an HR manager, I want to see turnover rate and tenure distribution, so I can identify retention problems early.

**Features:**

**People Analytics:**
- Headcount trends (new hires, departures, net growth)
- Turnover rate (voluntary vs involuntary)
- Tenure distribution (histogram)
- Department size changes over time
- Cost per employee (salary + claims average)

**Attendance Analytics:**
- Punctuality trends (by department, by employee)
- Absence patterns (which days are people absent most?)
- Late arrivals by day of week (Monday mornings?)

**Leave Analytics:**
- Leave utilization rate by policy type
- Peak leave months (helps plan coverage)
- Employees with low leave usage (burnout risk?)

**Claims Analytics:**
- Category spending trends over time
- Budget compliance rate
- Outlier detection (unusually high claims)

**Dashboard features:**
- Customizable date range
- Export to PDF/Excel
- Scheduled email reports (weekly digest)
- Benchmarking (compare to industry averages — requires external data)

**Why it matters:**
- Data-driven HR decisions
- Spot problems early (high turnover in Engineering?)
- Justify budget requests ("We need higher leave allowance to retain staff")

**Dependencies:**
- Enough data (need 6+ months of usage)
- Analytics infrastructure (data warehouse? ClickHouse?)

**Technical scope:**
- Database: Read replicas for heavy queries (don't slow down app)
- Backend: Complex aggregation queries (consider caching)
- Frontend: Chart library (Recharts, Chart.js)
- Effort: 1 week backend, 2 weeks frontend

**Monetization:**
- **Pro feature** (analytics = power users)

---

## ⭐⭐⭐⭐ Calendar Multi-Module Aggregation
**Status:** 📋 Backlog (Phase 2)  
**Effort:** M (1 week)  
**Value:** Unified schedule view

**Description:**
Expand `/calendar` to show tasks, events, meetings (not just leave).

**User Story:**
> As a manager, I want to see everything happening this week (who's on leave, task deadlines, team meetings) in one calendar.

**Current state (Sprint 8):**
- Calendar shows: Leave requests + public holidays
- Promoted to top-level route (no longer `/leave/calendar`)

**Phase 2 expansion:**
- Add task due dates to calendar
- Add company events (from Announcements module)
- Add recurring meetings (new feature)
- Color coding: Leave (purple), Tasks (amber), Events (blue)
- Filter toggles (show/hide each type)

**Why it matters:**
- Managers need full context ("Team busy this week?")
- Prevents scheduling conflicts
- Central planning hub

**Dependencies:**
- Tasks module (✅ Done)
- Announcements module (backlog)
- Events module (doesn't exist yet — deferred)

**Technical scope:**
- Backend: Aggregation endpoint combining leave, tasks, events
- Frontend: Multi-source calendar rendering
- Performance: Cache aggregated view (5min TTL)

**Approach:**
- Start simple: Just show task due dates on calendar
- Phase 2: Add events and meetings

---

## ⭐⭐⭐ Employee Self-Service Portal
**Status:** 📋 Backlog (Phase 2)  
**Effort:** L (2-3 weeks)  
**Value:** Empower employees, reduce admin work

**Description:**
Let employees manage their own profile, view payslips, update documents.

**Current state:**
- Employees can: Clock in/out, submit leave, submit claims, view their tasks
- Employees cannot: Update profile, upload documents, view historical records

**Phase 2 features:**
- **Profile management:**
  - Update personal info (address, phone, emergency contact)
  - Upload profile photo
  - View employment history (promotions, department transfers)
  
- **Document access:**
  - View own contracts, offer letters
  - Download payslips (if payroll module exists)
  - Request document updates (e.g., "Need new contract for visa")

- **Historical records:**
  - View all attendance (past 12 months)
  - View all leave (past years)
  - View all claims (past 12 months)
  - Export to PDF

- **Requests:**
  - Request document updates
  - Report incorrect attendance
  - Update bank account (approval required)

**Why it matters:**
- Reduces HR admin workload ("Can you send me my payslip?" → self-service)
- Empowers employees (transparency builds trust)
- Standard in enterprise HR systems

**Dependencies:**
- Employee documents module (backlog)
- Approval workflow for sensitive updates

**Technical scope:**
- Backend: Permission model (employee can update own data only)
- Frontend: Employee profile page + document library
- Audit log: Track all profile changes

**Monetization:**
- Could be Pro feature, but likely better as Free tier (reduces support costs)

---

## ⭐⭐⭐ Mobile Native App
**Status:** 📋 Backlog (Phase 2, optional)  
**Effort:** XL (3+ months)  
**Value:** Better mobile experience

**Description:**
Build native iOS and Android apps (alternative to PWA).

**Why consider:**
- Better offline support than PWA
- Push notifications more reliable
- Camera access for receipts (Claims module)
- GPS for geofencing (clock-in fraud prevention)
- App store presence (credibility)

**Why defer:**
- PWA covers 90% of use cases
- Native app = 2x development (iOS + Android)
- Maintenance burden (app store reviews, version updates)
- Most features work fine on mobile web

**If we build:**
- Use React Native (web + mobile from one codebase)
- Start with clock-in feature only (most mobile-critical)
- Expand gradually based on usage

**Decision:** **Start with PWA (Sprint 11+), consider native only if users demand it**

---

## ⭐⭐ Multi-Organization Management
**Status:** 📋 Backlog (Phase 2)  
**Effort:** L (2 weeks)  
**Value:** For franchise businesses or consultants

**Description:**
Let one user manage multiple organizations (switch between them).

**User Story:**
> As a consultant managing HR for 3 clients, I want to switch between organizations, so I don't need 3 separate accounts.

**Features:**
- User can belong to multiple organizations
- Organization switcher in top bar
- Role can differ per org (admin in Org A, member in Org B)
- Separate notification badges per org
- Recent organizations list (quick switch)

**Why it matters:**
- Consultants/accountants serve multiple clients
- Franchise owners with multiple locations
- Holding companies with subsidiaries

**Current limitation:**
- User can only belong to ONE organization
- Workaround: Use different email for each org

**Dependencies:**
- None (architecture supports this, just need UI)

**Technical scope:**
- Database: Already supports (user → org_members → orgs)
- Backend: Update auth to allow multi-org
- Frontend: Org switcher component
- Session: Store `current_org_id` in session

**Effort:** 1 week backend, 1 week frontend

**Monetization:**
- Could be Pro feature (power users)

---

## ⭐⭐ Integrations & API
**Status:** 📋 Backlog (Phase 2)  
**Effort:** L (ongoing)  
**Value:** Connect with other tools

**Description:**
Integrate with popular tools and expose public API.

**Possible integrations:**
- **Slack:** Post leave approvals in Slack channel
- **Google Calendar:** Sync leave requests to Google Calendar
- **Accounting:** Export claims to QuickBooks/Xero
- **Payroll:** Export data to Payoneer, Deel
- **Communication:** WhatsApp notifications (UAE, Indonesia)

**Public API:**
- RESTful API with API keys
- Same endpoints as internal app
- Rate limiting (100 req/min)
- Documentation (Swagger UI)
- Webhooks (send events to customer's server)

**Why it matters:**
- Companies use multiple tools (Workived + Slack + QuickBooks)
- Avoid manual data entry
- Competitive requirement (all modern SaaS has integrations)

**Dependencies:**
- Stable API (already have internal API)
- OAuth for third-party integrations

**Technical scope:**
- API keys table
- Webhook infrastructure
- Integration guides (documentation)
- Each integration: 1-2 weeks

**Monetization:**
- Free tier: Limited integrations
- Pro tier: All integrations + higher rate limits

---

*Phase 2 features revisited based on Phase 1 learnings and customer feedback*

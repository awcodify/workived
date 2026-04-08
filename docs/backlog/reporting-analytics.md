# Reporting & Analytics Backlog

**Strategic Direction:** Stop feature expansion. Focus on intelligence and insights.

**North Star:** *"Tells you who performed best — and why."*

**Date Created:** April 6, 2026  
**Status:** New strategic direction — pending prioritization  

---

## Vision

Transform Workived from a **system of record** into a **system of intelligence**.

We've built solid operational foundations (attendance, leave, claims, policies). Now we extract value from the data we're collecting. Every manager asks:
- Which employees are most reliable?
- Which team performs best?
- Is this policy working or costing us?
- What happens if I change X?

Our job is to **answer these questions automatically**.

---

## Three-Tier Strategy

### Tier 1: Performance Scorecards (Foundation)
**Goal:** Single number per employee showing reliability/performance  
**Value:** Instant visibility into who's doing well  
**Effort:** M (data queries + simple UI)

### Tier 2: Comparative Analytics (Context)
**Goal:** Benchmarks, trends, outlier detection  
**Value:** Understand *why* someone scores high/low  
**Effort:** L (aggregations + visualization)

### Tier 3: Predictive Simulations (Forward-looking)
**Goal:** "What if" modeling for policy/staffing decisions  
**Value:** Make changes with confidence  
**Effort:** XL (complex calculations + scenario engine)

---

## Tier 1: Performance Scorecards

### Feature 1.1: Task Completion Score

**User Story:**
> As a manager, I want to see each employee's task completion rate so I can identify who consistently delivers quality work on time.

**What it calculates:**
- **Completion rate** (% of assigned tasks marked "Done")
- **On-time delivery** (% completed before/on due date)
- **Quality score** (tasks reopened or rejected = penalty)
- **Composite score** (0-100, weighted average)

**Data sources:**
- `tasks` (status, due_date, completed_at, assignee_id)
- `task_comments` (rework indicators, quality feedback)

**Acceptance criteria:**
- [ ] Score calculated for each active employee with tasks
- [ ] Score updates when task status changes
- [ ] Show breakdown: completion rate, on-time %, quality score
- [ ] Trend indicator (↑ improving / → stable / ↓ declining)
- [ ] Handle employees with no tasks (show "N/A" instead of 0)

**Effort:** M (4-6 days)  
**Value:** HIGH — This is actual work output, the real measure of performance

**Technical notes:**
- Need new table: `employee_performance_scores` with daily snapshots
- Calculate 30-day rolling window
- Quality penalties: reopened task = -5 points, rejected = -10 points
- New hires with <5 tasks show "Insufficient data"

---

### Feature 1.2: Attendance Reliability Score

**User Story:**
> As a manager, I want to see each employee's attendance reliability score so I can identify consistently punctual team members.

**What it calculates:**
- **On-time rate** (% of days checked in within schedule)
- **Consistency score** (standard deviation of check-in times)
- **Absence rate** (% of expected days missed)
- **Composite score** (0-100, weighted average)

**Data sources:**
- `attendance_records` (check_in_at, check_out_at)
- `work_schedules` (expected start_time)
- `employees` (join_date for tenure weighting)

**Acceptance criteria:**
- [ ] Score calculated for each active employee
- [ ] Score updates daily (batch job or real-time)
- [ ] Score visible on employee detail page
- [ ] Trend indicator (↑ improving / → stable / ↓ declining)
- [ ] Score tooltip explains calculation

**Effort:** M (3-5 days)  
**Value:** Medium — Important but not the primary performance indicator

**Technical notes:**
- Calculate 30-day rolling window (recent behavior matters more)
- Handle edge cases: new hires (<30 days), leave periods, public holidays

---

### Feature 1.3: Leave Planning Score (REMOVED - see Feature 1.2)

**User Story:**
> As a manager, I want to see which employees plan their leave responsibly so I can reward good behavior.

**What it calculates:**
- **Advance notice score** (avg days between request and leave start)
- **Emergency leave ratio** (% of leave taken with <3 days notice)
- **Policy compliance** (% of leave within entitlement)
- **Composite score** (0-100)

**Data sources:**
- `leave_transactions` (created_at, start_date, status)
- `leave_balances` (compare used vs allocated)

**Acceptance criteria:**
- [ ] Score calculated per employee
- [ ] Breakdown shows: advance notice avg, emergency ratio, compliance %
- [ ] Filter by leave type (annual vs sick)
- [ ] Historical comparison (YoY improvement)

**Effort:** M (3-4 days)  
**Value:** Medium — shows responsibility, planning ability

---

### Feature 1.3: Leave Planning Score

**User Story:**
> As a manager, I want to see which employees plan their leave responsibly so I can reward good behavior.

**What it calculates:**
- **Advance notice score** (avg days between request and leave start)
- **Emergency leave ratio** (% of leave taken with <3 days notice)
- **Policy compliance** (% of leave within entitlement)
- **Composite score** (0-100)

**Data sources:**
- `leave_transactions` (created_at, start_date, status)
- `leave_balances` (compare used vs allocated)

**Acceptance criteria:**
- [ ] Score calculated per employee
- [ ] Breakdown shows: advance notice avg, emergency ratio, compliance %
- [ ] Filter by leave type (annual vs sick)
- [ ] Historical comparison (YoY improvement)

**Effort:** S (2-3 days)  
**Value:** Low-Medium — Useful for planning, but not core performance

---

### Feature 1.4: Collaboration Score

**User Story:**
> As a manager, I want to see which employees actively help their teammates and engage with the team.

**What it calculates:**
- **Comment activity** (task comments per week)
- **Helping behavior** (comments on others' tasks vs own tasks ratio)
- **Response time** (avg time to respond to mentions/questions)
- **Composite score** (0-100)

**Data sources:**
- `task_comments` (count, created_at, task ownership)
- `notifications` (response time tracking)

**Effort:** M (4-5 days)  
**Value:** Medium — Measures teamwork, not just individual output

---

### Feature 1.5: Overall Performance Index

**User Story:**
> As a CEO, I want one number that tells me how each employee is performing across all dimensions.

**What it calculates:**
- Weighted composite of:
  - **Task Completion Score (45%)** — Actual work output
  - **Attendance Score (30%)** — Reliability and consistency
  - **Leave Planning Score (15%)** — Responsible planning
  - **Collaboration Score (10%)** — Teamwork and engagement

**Data sources:**
- All scores from Features 1.1-1.4
- `employment_changes` (promotions add bonus)

**Acceptance criteria:**
- [ ] Single "Workived Score" (0-100) per employee
- [ ] Leaderboard view (top 10 / bottom 10)
- [ ] Department-level aggregates
- [ ] Export to CSV for management reviews
- [ ] Score breakdown on hover (show component scores)
- [ ] Employees with insufficient task data show "Pending" instead of low score

**Effort:** M (4-5 days after 1.1-1.4 complete)  
**Value:** High — executive summary view

**Why this weighting?**
- **Tasks = 45%** because that's actual work delivered
- **Attendance = 30%** because showing up consistently matters
- **Leave Planning = 15%** because it affects team coverage
- **Collaboration = 10%** because teamwork is valuable but secondary to output

---

## Tier 2: Comparative Analytics

### Feature 2.1: Peer Benchmarking

**User Story:**
> As a manager, I want to see how each employee compares to their peers so I can identify outliers.

**What it shows:**
- Employee score vs department average
- Employee score vs same job_title average
- Percentile ranking (top 10%, top 25%, etc.)
- Z-score (standard deviations from mean)

**Visualization:**
- Bell curve chart showing distribution
- Employee's position highlighted
- Color coding: green (top 25%), yellow (mid 50%), red (bottom 25%)

**Effort:** L (5-7 days)  
**Value:** High — adds context to raw scores

---

### Feature 2.2: Time-Series Trends

**User Story:**
> As a manager, I want to see if an employee's performance is improving or declining over time.

**What it shows:**
- Line chart: last 12 months of Performance Index
- Trend line (linear regression)
- Annotations for key events (promotion, policy change, leave)
- Month-over-month % change

**Effort:** M (4-5 days)  
**Value:** High — detects problems early

---

### Feature 2.3: Department Heatmap

**User Story:**
> As a CEO, I want to see which departments are high-performing and which need attention.

**What it shows:**
- Grid: departments × metrics (Attendance, Leave Planning, Claims)
- Color gradient: green (high) → red (low)
- Click through to see individual employee scores in that department
- Export to PDF for board meetings

**Effort:** M (5-6 days)  
**Value:** High — executive visibility

---

### Feature 2.4: Outlier Detection & Alerts

**User Story:**
> As an HR manager, I want to be automatically notified when an employee's score drops significantly.

**What it does:**
- Calculate 7-day moving average of Performance Index
- Alert if score drops >15 points in 7 days
- Email notification to employee's manager + HR
- Dashboard banner showing "Employees needing attention"

**Effort:** M (3-4 days)  
**Value:** Medium — proactive intervention

---

## Tier 3: Predictive Simulations

### Feature 3.1: Policy Impact Simulator

**User Story:**
> As a CEO, I want to model the cost impact of changing leave policies before I commit to it.

**What it simulates:**
- **Input:** New policy (e.g., increase annual leave from 12 → 15 days)
- **Calculation:**
  - Historical leave usage patterns (per employee)
  - Extrapolate new usage under new policy
  - Calculate cost: (extra days × avg daily salary × employees)
  - Estimate productivity impact (more rested = better performance?)

**Output:**
- Cost estimate (min/max range based on usage variance)
- Break-even analysis (if productivity gains offset cost)
- Visual: before/after comparison chart

**Effort:** XL (10-14 days)  
**Value:** High — prevents expensive policy mistakes

---

### Feature 3.2: Hiring Impact Simulator

**User Story:**
> As a CEO, I want to see how adding 5 new employees affects team coverage and budget.

**What it simulates:**
- **Input:** Number of new hires, department, expected join dates
- **Calculation:**
  - New total headcount vs free tier limit (25)
  - Total leave entitlement cost
  - Attendance coverage improvement (less understaffing)
  - Onboarding cost (first 90 days at 50% productivity)

**Output:**
- Budget breakdown (salaries + benefits + leave cost)
- Coverage heatmap (before/after staffing levels)
- Payback period (when do they become net positive?)

**Effort:** XL (12-15 days)  
**Value:** High — supports growth decisions

---

### Feature 3.3: Schedule Optimization

**User Story:**
> As an operations manager, I want to find the optimal shift pattern that maximizes coverage while minimizing overtime.

**What it does:**
- **Input:** Current work_schedules, historical attendance, coverage requirements
- **Algorithm:**
  - Simulate different shift patterns (5×8, 4×10, rotating shifts)
  - Calculate coverage gaps (hours understaffed)
  - Calculate overtime cost (hours of approved OT)
  - Find Pareto optimal solution (best coverage for lowest cost)

**Output:**
- Recommended schedule with cost/benefit comparison
- Visual timeline showing coverage by hour
- "Try it" mode (preview before committing)

**Effort:** XL (15-20 days — complex optimization)  
**Value:** Medium — only relevant for shift-based businesses

---

### Feature 3.4: Attrition Risk Prediction

**User Story:**
> As an HR manager, I want to identify employees at risk of leaving so I can intervene early.

**What it predicts:**
- **Inputs:** Historical patterns of employees who left:
  - Declining attendance score (gradual disengagement)
  - Increased emergency leave (looking for other jobs?)
  - Reduced task participation (checked out mentally)
  - Time since last promotion
  - Salary vs market rate (if data available)

- **Model:** Logistic regression or simple decision tree
  - Train on past employee data (mark employees who left)
  - Predict probability of leaving in next 90 days

**Output:**
- Risk score (0-100) per employee
- Dashboard showing "High risk" employees (>70 score)
- Suggested interventions (promotion, salary review, workload adjustment)

**Effort:** XL (10-14 days + data science work)  
**Value:** High IF we have enough historical attrition data  
**Blocker:** Need 6+ months of data with actual departures to train model

---

## Implementation Roadmap

### Phase 1: Foundation (Sprint 23-24)
**Goal:** Ship Tier 1 scorecards

1. Feature 1.1: Task Completion Score ← **START HERE** (most important)
2. Feature 1.2: Attendance Reliability Score
3. Feature 1.3: Leave Planning Score
4. Feature 1.4: Collaboration Score
5. Feature 1.5: Overall Performance Index

**Outcome:** Managers can see employee performance scores for the first time, with **task delivery** as the primary metric.

**Priority order:**
- Build 1.1 first (tasks = real work)
- Then 1.2 (attendance)
- Then 1.5 (overall index using just tasks + attendance)
- Finally 1.3 & 1.4 (nice-to-have secondary metrics)

---

### Phase 2: Context (Sprint 25-26)
**Goal:** Add comparative analytics

1. Feature 2.1: Peer Benchmarking
2. Feature 2.2: Time-Series Trends
3. Feature 2.3: Department Heatmap
4. Feature 2.4: Outlier Detection & Alerts

**Outcome:** Managers understand *why* scores are what they are.

---

### Phase 3: Prediction (Sprint 27-30+)
**Goal:** Simulation & forecasting

1. Feature 3.1: Policy Impact Simulator ← Start here (highest ROI)
2. Feature 3.2: Hiring Impact Simulator
3. Feature 3.4: Attrition Risk Prediction (if data available)
4. Feature 3.3: Schedule Optimization (last — niche use case)

**Outcome:** CEOs make decisions with data, not gut feel.

---

## Key Design Principles

1. **Mobile-first:** Managers check scores on phone, not desktop
2. **Explain everything:** Every score has a tooltip explaining calculation
3. **No surprises:** Employees see their own scores (transparency builds trust)
4. **Privacy:** Individual scores only visible to managers + HR (not peers)
5. **Actionable:** Every low score suggests next action (not just a red number)
6. **Fair:** Account for legitimate factors (maternity leave, illness, etc.)

---

## Data Requirements

### New tables needed:

```sql
-- Daily snapshot of calculated scores
CREATE TABLE employee_performance_scores (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL,
  
  -- Component scores
  attendance_score INTEGER, -- 0-100
  leave_planning_score INTEGER,
  claims_discipline_score INTEGER,
  activity_score INTEGER,
  
  -- Composite
  overall_index INTEGER, -- 0-100
  
  -- Metadata
  data_completeness DECIMAL, -- 0.0-1.0 (did we have enough data?)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- For benchmarking
CREATE TABLE performance_benchmarks (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL,
  benchmark_date DATE NOT NULL,
  
  -- Grouping
  department_id UUID, -- NULL = org-wide
  job_title_id UUID, -- NULL = all titles
  
  -- Stats
  mean_score DECIMAL,
  median_score DECIMAL,
  std_dev DECIMAL,
  p25 DECIMAL, -- 25th percentile
  p75 DECIMAL, -- 75th percentile
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- For simulation results (cached)
CREATE TABLE simulation_results (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL,
  created_by_user_id UUID NOT NULL,
  
  simulation_type VARCHAR(50), -- 'policy_change', 'hiring', 'schedule'
  input_params JSONB, -- Store simulation inputs
  output_results JSONB, -- Store calculated results
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Success Metrics

We'll know this is working when:

1. **Usage:** 80%+ of managers view performance dashboard weekly
2. **Engagement:** Avg session time >3 minutes (they're actually reading it)
3. **Action:** 50%+ of low-scoring employees show improvement within 30 days
4. **Retention:** Customers mention "the insights" in renewal calls
5. **Monetization:** We can charge premium tier for simulations

---

## Risks & Mitigations

### Risk 1: Scores feel "unfair"
**Impact:** Employees distrust system, managers stop using it  
**Mitigation:**
- Full transparency in calculation
- Employees see their own scores
- Allow managers to add context notes ("was on approved sick leave")
- Regular audits for bias (does scoring disadvantage any group?)

### Risk 2: Not enough data for accurate scores
**Impact:** Scores are noisy, not predictive  
**Mitigation:**
- Require minimum 30 days of data before showing score
- Show "confidence interval" when data is sparse
- Clear messaging: "Score based on 45 days of data"

### Risk 3: Managers use scores to punish, not develop
**Impact:** Toxic culture, increased attrition  
**Mitigation:**
- Frame as "development tool" not "performance review"
- Default view shows improvement opportunities (not a ranking)
- Hide peer names in leaderboard (show "Employee #3452" not "John Doe")

### Risk 4: Simulations are wrong
**Impact:** Bad decisions based on our predictions  
**Mitigation:**
- Always show confidence range (min/max, not single number)
- Disclaimer: "Based on historical patterns — actual results may vary"
- Start with simple simulations (policy cost) before complex ones (attrition)

---

## Questions to Answer

Before starting implementation:

1. **Performance scores:**
   - Should employees see their own scores? (I vote YES for transparency)
   - Should scores affect compensation? (Out of scope — we're HR ops, not payroll)
   - How do we handle edge cases? (new hires, parental leave, sabbaticals)

2. **Benchmarking:**
   - Compare against same org only? Or cross-org anonymized benchmarks?
   - How do we prevent "gaming" the system? (fake check-ins to boost score)

3. **Simulations:**
   - How accurate is "good enough"? (±10% cost estimate okay?)
   - Do we need a "simulation audit log"? (track who ran what scenario)

4. **Privacy:**
   - GDPR/data protection concerns with scoring people?
   - Do we need employee consent to calculate scores?
   - What happens to scores when someone leaves? (retain for benchmarks?)

---

## Next Steps

1. **Product decision:** Review this backlog, prioritize Tier 1 features
2. **Architect review:** Data model design, scoring algorithm validation
3. **Design review:** Dashboard mockups, mobile-first flows
4. **Engineering estimate:** Confirm complexity (S/M/L/XL)
5. **Sprint planning:** Allocate Sprint 23-24 to Tier 1 implementation

**Recommendation:** Start with Feature 1.1 (Attendance Score) as proof of concept. If users love it, fast-follow with 1.2-1.4. Then pause, gather feedback, refine before Tier 2.

---

**Last Updated:** April 6, 2026  
**Owner:** Product (PO decision needed on prioritization)  
**Status:** 🟡 Backlog — Pending approval to shift from feature development to analytics

# Sprint 2 — Attendance

**Duration:** ~1 week (dates not tracked)  
**Status:** ✅ COMPLETE  
**Team:** Backend focus

---

## 📋 Previous Sprint Summary

### Sprint 1 Completed
- ✅ Go project scaffold with modular architecture
- ✅ PostgreSQL migrations for all tables
- ✅ Auth module (register, login, JWT, refresh)
- ✅ Organisation module (create, invite members)
- ✅ Employee module (CRUD, documents)
- ✅ Department module (CRUD, nested hierarchy)

### Key Outcomes
- Backend foundation established
- Multi-tenancy architecture working
- Core HR modules operational

---

## 🎯 Sprint 2 Goals

### Goals
1. ✅ Build attendance module (clock-in/out)
2. ✅ Implement late detection logic
3. ✅ Create daily and monthly attendance reports
4. ✅ Add work schedule support
5. ✅ Integrate public holidays
6. ✅ Document all APIs with OpenAPI 3.1

### Features Completed

#### 1. ✅ Clock-In / Clock-Out API
**Scope:**
- Clock-in endpoint with timestamp recording
- Clock-out endpoint with duration calculation
- Late detection based on work schedule
- Validation: Can't clock-in twice, must clock-out before next clock-in

**Endpoints:**
- `POST /api/v1/attendance/clock-in` — Record clock-in
- `POST /api/v1/attendance/clock-out` — Record clock-out
- `GET /api/v1/attendance/today` — Today's attendance status

**Late Detection Logic:**
```go
// If clock-in time > work_schedule.start_time + grace_period
// Mark as "late" in attendance_records
grace_period := 15 * time.Minute
if clockInTime.After(scheduleStart.Add(grace_period)) {
    status = "late"
}
```

**Technical Decisions:**
- Store clock-in/out as separate actions (not start/end in same record)
- Calculate duration on clock-out (hours worked)
- Status: `on_time`, `late`, `absent` (determined at end of day)
- Grace period: 15 minutes (configurable per organisation)

#### 2. ✅ Daily Attendance Report
**Scope:**
- View attendance for specific date
- Show all employees with clock-in/out times
- Highlight late arrivals and early departures
- Export capability (CSV)

**Endpoint:**
- `GET /api/v1/attendance/daily?date=2026-03-21` — Daily report

**Response structure:**
```json
{
  "data": [
    {
      "employee_id": "uuid",
      "employee_name": "Ahmad Rizki",
      "clock_in": "2026-03-21T08:05:00Z",
      "clock_out": "2026-03-21T17:30:00Z",
      "hours_worked": 9.42,
      "status": "on_time"
    }
  ]
}
```

#### 3. ✅ Monthly Attendance Report
**Scope:**
- View attendance for entire month
- Show summary per employee (on-time %, late %, absent %)
- Aggregate hours worked
- Identify patterns (e.g., always late on Mondays)

**Endpoint:**
- `GET /api/v1/attendance/monthly?year=2026&month=3` — Monthly report

**Metrics calculated:**
- Total working days (excludes weekends + public holidays)
- Actual days worked
- Late days count
- Absent days count
- Average clock-in time

#### 4. ✅ Work Schedule Support
**Scope:**
- Define work schedules per organisation or employee
- Configurable: Start time, end time, work days
- Support multiple shifts (future: morning, afternoon, night)

**Table:** `work_schedules`
```sql
CREATE TABLE work_schedules (
    id UUID PRIMARY KEY,
    organisation_id UUID NOT NULL,
    employee_id UUID NULL, -- NULL = org-wide default
    start_time TIME NOT NULL, -- e.g., 09:00
    end_time TIME NOT NULL,   -- e.g., 17:00
    work_days INT[], -- [1,2,3,4,5] = Mon-Fri
    ...
);
```

**Technical Decisions:**
- Default schedule at org level
- Employee-specific overrides (e.g., part-time employee works 10-3)
- Work days stored as integers (1=Monday, 7=Sunday)

#### 5. ✅ Public Holidays Integration
**Scope:**
- Seed public holidays for Indonesia, UAE, Malaysia, Singapore
- Country-specific holidays (Eid, Diwali, National Day, etc.)
- API to check if date is holiday
- Exclude holidays from attendance calculations

**Table:** `public_holidays`
```sql
CREATE TABLE public_holidays (
    id UUID PRIMARY KEY,
    country_code CHAR(2) NOT NULL, -- ID, AE, MY, SG
    date DATE NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_optional BOOLEAN DEFAULT false,
    ...
);
```

**Endpoint:**
- `GET /api/v1/attendance/holidays?country=ID&year=2026` — List holidays

**Seeded holidays:**
- Indonesia: Eid, Nyepi, Independence Day, etc.
- UAE: Eid, National Day, New Year, etc.
- Malaysia: Eid, Deepavali, Chinese New Year, etc.
- Singapore: Eid, Deepavali, Chinese New Year, National Day, etc.

#### 6. ✅ OpenAPI 3.1 Specification
**Scope:**
- Complete API documentation in OpenAPI format
- Scalar UI for interactive documentation
- Hosted at `/api/docs`
- Documents all endpoints (Auth, Organisation, Employee, Attendance)

**Features:**
- Request/response schemas
- Authentication requirements (Bearer token)
- Error responses
- Examples for each endpoint

**Why OpenAPI:**
- Auto-generate client libraries (TypeScript, Go)
- API testing with Postman/Insomnia
- Contract-first development
- Single source of truth for API

**Location:** `services/cmd/api/openapi.yaml`

---

## 🚀 Next Sprint Plan (Sprint 3)

### Proposed Features
1. **Frontend Foundation** — Vite + React SPA
   - Effort: 1 week
   - TanStack Router, Query, Tailwind, shadcn/ui
   
2. **Authentication UI** — Login page
   - Effort: 1 day
   
3. **Dashboard** — Overview with employee count, today's attendance
   - Effort: 2 days

4. **Employee Management UI** — List + detail pages
   - Effort: 2 days

5. **Attendance UI** — Clock-in/out + reports
   - Effort: 2 days

---

## 📊 Final Metrics

- **Backend tests:** Not tracked in Sprint 2
- **Endpoints added:** 7 (clock-in, clock-out, today, daily, monthly, holidays, work schedules)
- **Migrations:** Used existing tables from Sprint 1
- **OpenAPI:** 1 specification file documenting ~30 endpoints

---

## 🎉 Sprint Highlights

1. **Late Detection:** Automatic flagging of late arrivals (grace period configurable)
2. **Multi-Country:** Public holidays seeded for 4 countries
3. **Reporting:** Daily + monthly reports with aggregations
4. **Documentation:** Complete OpenAPI 3.1 spec with Scalar UI
5. **Production Ready:** Attendance tracking fully functional

---

## 🔗 References

- [Sprint 1](./sprint1.md) — Foundation
- [Sprint 3](./sprint3-review.md) — Frontend (Auth + Employees + Attendance)
- [Project Brief](../WORKIVED_PROJECT_BRIEF.md)

# Sprint 1 — Foundation

**Duration:** ~2 weeks (dates not tracked)  
**Status:** ✅ COMPLETE  
**Team:** Backend focus

---

## 📋 Previous Sprint Summary

N/A — This is the first sprint.

### Context
Initial project setup for Workived. Building the backend monolith foundation with Go, establishing database schema, implementing authentication, and core HR modules.

---

## 🎯 Sprint 1 Goals

### Goals
1. ✅ Set up Go monolith architecture with modular structure
2. ✅ Implement authentication (JWT-based)
3. ✅ Build core HR modules (Organisation, Employee, Department)
4. ✅ Establish database schema with all tables
5. ✅ Set up development environment

### Features Completed

#### 1. ✅ Go Project Scaffold
**Scope:**
- Module structure following handler → service → repository pattern
- Configuration management (environment variables)
- Middleware setup (auth, RBAC, tenant isolation)
- Error handling architecture
- Platform utilities (database, Redis, config)

**Technical Decisions:**
- Modular monolith (not microservices) — simple deployment, easier development
- Every module: `handler.go`, `service.go`, `repository.go`, `types.go`
- Multi-tenancy enforced at application layer (not PostgreSQL RLS)

**Files:**
```
services/
├── cmd/api/main.go
├── internal/
│   ├── platform/
│   │   ├── config/
│   │   ├── database/
│   │   ├── middleware/
│   │   └── storage/
│   └── pkg/
```

#### 2. ✅ PostgreSQL Migrations (All Tables)
**Scope:**
- Migration tool: golang-migrate
- All core tables created upfront
- Multi-tenancy: Every table has `organisation_id`
- Soft delete pattern for HR records (`is_active` column)

**Tables created:**
- Foundation: `organisations`, `users`, `organisation_members`, `auth_tokens`, `invitations`
- Employee: `departments`, `employees`, `employee_documents`
- Attendance: `attendance_records`, `work_schedules`, `public_holidays`
- Leave: `leave_policies`, `leave_balances`, `leave_requests`
- Claims: `claim_categories`, `claim_balances`, `claims`
- Tasks: `task_lists`, `tasks`, `task_comments`
- System: `announcements`, `notifications`, `audit_logs`

**Technical Highlights:**
- All primary keys: UUID with `gen_random_uuid()`
- All timestamps: `TIMESTAMPTZ` stored in UTC
- All monetary amounts: `BIGINT` (smallest currency unit)
- Foreign key constraints with proper cascade/restrict
- Comprehensive indexes for performance

#### 3. ✅ Auth Module
**Scope:**
- User registration with email verification
- Login with JWT access token (15 min) + refresh token (30 days)
- Password reset flow with token expiry
- JWT claims include: `user_id`, `org_id`, `role`

**Endpoints:**
- `POST /api/v1/auth/register` — Create new user
- `POST /api/v1/auth/login` — Get JWT tokens
- `POST /api/v1/auth/refresh` — Refresh access token
- `POST /api/v1/auth/logout` — Invalidate tokens
- `POST /api/v1/auth/forgot-password` — Send reset email
- `POST /api/v1/auth/reset-password` — Set new password

**Security:**
- Password hashing: bcrypt
- JWT secret from environment variable
- Refresh tokens stored in httpOnly cookies (XSS protection)
- Token blacklist on logout

#### 4. ✅ Organisation Module
**Scope:**
- Create organisation (first user becomes admin)
- Invite members by email
- Accept invitation and join organisation
- Organisation settings (work days, timezone, country)

**Endpoints:**
- `POST /api/v1/organisations` — Create org
- `GET /api/v1/organisations/me` — My org details
- `POST /api/v1/invitations` — Invite member
- `POST /api/v1/invitations/:token/accept` — Accept invite

**Technical Decisions:**
- One user can belong to one organisation (multi-org deferred to Phase 2)
- Organisation settings configurable (not hardcoded per country)
- Invitation tokens expire after 7 days

#### 5. ✅ Employee Module
**Scope:**
- CRUD operations for employees
- Upload employee documents (contracts, IDs, certificates)
- Department assignment
- Soft delete (deactivate, not hard delete)

**Endpoints:**
- `GET /api/v1/employees` — List employees
- `POST /api/v1/employees` — Create employee
- `GET /api/v1/employees/:id` — Get employee details
- `PUT /api/v1/employees/:id` — Update employee
- `DELETE /api/v1/employees/:id` — Deactivate employee
- `POST /api/v1/employees/:id/documents` — Upload document
- `GET /api/v1/employees/:id/documents` — List documents

**Technical Highlights:**
- Employee status: `active`, `inactive`
- Reporting structure: `reporting_to` (manager relationship)
- Multi-currency support: `salary_currency` field
- S3/MinIO integration for document storage

#### 6. ✅ Department Module
**Scope:**
- Create departments
- Nested departments support (parent-child hierarchy)
- Assign employees to departments

**Endpoints:**
- `GET /api/v1/departments` — List departments
- `POST /api/v1/departments` — Create department
- `PUT /api/v1/departments/:id` — Update department
- `DELETE /api/v1/departments/:id` — Delete department

**Technical Decisions:**
- Self-referencing foreign key: `parent_id` for hierarchy
- Can nest multiple levels (org chart support)

---

## 🚀 Next Sprint Plan (Sprint 2)

### Proposed Features
1. **Attendance Module** — Clock-in/out API with late detection
   - Effort: 1 week
   - Backend focus
   
2. **Work Schedules** — Configurable shift times
   - Effort: 2 days
   
3. **Public Holidays** — Country-specific holiday calendar
   - Effort: 1 day

4. **OpenAPI Documentation** — Document all endpoints
   - Effort: 2 days

---

## 📊 Final Metrics

- **Migrations:** 22 tables created (migrations 000001-000022)
- **Modules:** 4 modules (auth, organisation, employee, platform)
- **Endpoints:** ~20 API endpoints
- **Lines of code:** ~3,000 backend (estimated)
- **Test coverage:** Not tracked in Sprint 1

---

## 🔗 References

- [Sprint 2](./sprint2.md) — Attendance module
- [Project Brief](../WORKIVED_PROJECT_BRIEF.md)

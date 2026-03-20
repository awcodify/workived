# Workived

**Attendance done right.** — HR ops platform for 5–25 person startups.

Workived is a freemium attendance and leave management SaaS focused on compliance-first HR operations. It targets small company founders in Indonesia and UAE who currently track attendance via WhatsApp and leave via Google Sheets.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.22+ · Gin · pgx/v5 · Redis · zap |
| Frontend | Vite 8 · React 19 · TanStack Router · TanStack Query v5 · Zustand · Tailwind v4 · shadcn/ui |
| Database | PostgreSQL 16 · golang-migrate |
| Storage | MinIO (S3-compatible) |
| Testing | Go `testing` · Vitest · React Testing Library · MSW |

## Project Structure

```
workived/
├── apps/web/            # React SPA (Vite + TanStack Router)
├── design/              # Design tokens
├── docs/adr/            # Architecture Decision Records
├── infra/               # Docker Compose (Postgres, Redis, MinIO)
├── migrations/          # SQL migrations (golang-migrate)
├── scripts/             # Utility scripts
├── services/            # Go API server
│   ├── cmd/api/         # Entry point
│   ├── internal/        # Business modules (auth, employee, attendance, leave, …)
│   └── pkg/             # Shared packages (apperr, paginate, validate)
└── Makefile             # Dev commands
```

## Prerequisites

- **Go** 1.22+
- **Node.js** 20+ and npm
- **Docker** and Docker Compose
- **golang-migrate** CLI — [install](https://github.com/golang-migrate/migrate/tree/master/cmd/migrate)
- **golangci-lint** — [install](https://golangci-lint.run/welcome/install/)

## Getting Started

```bash
# 1. Start infrastructure (Postgres, Redis, MinIO, Mailcatcher)
make infra-up

# 2. Apply database migrations
make migrate-up

# 3. (Optional) Seed test data
make seed

# 4. Run the API server (port 8080)
make run

# 5. In a separate terminal — install frontend deps and start dev server (port 3000)
make web-install
make web-dev
```

Or use the all-in-one command:

```bash
make dev          # starts infra, migrates, runs API
```

### Test Data

After seeding (`make seed`), you'll have:

**Test Organization:** Rizki Tech
- **Login:** `ahmad@workived.com` / `12345678`
- **Role:** super_admin (owner)

**Employees:**
1. Ahmad Rizki (CEO, linked to user account)
2. New Employee (Engineer, email: `new@rizkitech.com`, needs invitation)
   - Reports to Ahmad
   - Can be invited from `/people/new` to create user account

**Configured:**
- 3 Leave policies (Annual: 12 days, Sick: 7 days, Unpaid: 0 days)
- 5 Claim categories (Transport, Meal, Medical, Internet, Phone)
- Leave balances for both employees (current year)
- Claim balances for both employees (current month)

**Email Testing:**
- Mailcatcher running on http://localhost:1080
- All emails are trapped locally (no real delivery)

## Available Commands

```
make help              Show available commands
make infra-up          Start postgres, redis, minio, and mailcatcher (detached)
make infra-down        Stop and remove all infra containers
make migrate-up        Apply all pending migrations
make migrate-down      Roll back the last migration
make migrate-create    Create a new migration pair (name=...)
make seed              Seed test data (creates Rizki Tech org with test users)
make reset-db          Reset database (WARNING: destroys all data, then migrates & seeds)
make run               Run the API server
make dev               Start infra + migrate + run API
make build             Build API binary to bin/api
make web-install       Install frontend dependencies
make web-dev           Start frontend dev server on :3000
make web-build         Build frontend for production
make lint              Run golangci-lint (includes gosec)
make test              Run all unit tests
make test-cover        Run tests with HTML coverage report
```

## Architecture

- **Go monolith** with module-per-domain structure (4-file pattern: `handler.go`, `service.go`, `repository.go`, `types.go`)
- **REST API** with JWT authentication and org-isolation middleware
- **Multi-tenancy** enforced at every layer — every query scoped by `organisation_id`
- **React SPA** with file-based routing, server-state via TanStack Query, client-state via Zustand
- **Cursor-based pagination** on all list endpoints

## Product Modules

| Module | Status |
|--------|--------|
| Auth & Onboarding | ✅ Complete |
| Employee Management | ✅ Complete |
| Attendance | ✅ Complete |
| Leave | 🚧 In Progress |
| Claims | Planned |
| Tasks | Planned |
| Announcements | Planned |

## Target Markets

- **Phase 1:** Indonesia 🇮🇩 · UAE 🇦🇪
- **Phase 2:** Malaysia 🇲🇾 · Singapore 🇸🇬

## Engineering Rules

1. Every SQL query scoped by `organisation_id`
2. Money stored as `BIGINT` (smallest currency unit) + `currency_code`
3. All timestamps in UTC `TIMESTAMPTZ`
4. Country-specific rules in config tables, never hardcoded
5. HR records use soft delete (`is_active`)
6. Every state-changing action produces an audit log entry
7. Multi-currency support: IDR, AED, MYR, SGD
8. Timezone-aware using org's configured timezone
9. Free tier enforced at 25 employees

## Testing

Every file requires a corresponding test file. Minimum coverage target: **98%**.

```bash
make test              # unit tests
make test-cover        # tests + HTML coverage report
make lint              # golangci-lint + gosec
```

## License

Proprietary. All rights reserved.

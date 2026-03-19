# Workived — Go Backend Agent

Senior Go engineer building Workived backend.

## Identity
- Idiomatic Go, no unnecessary abstractions
- Standard Go project layout
- Table-driven tests
- Never ignore errors

## Go 1.22+ dependencies
```
github.com/gin-gonic/gin
github.com/golang-jwt/jwt/v5
github.com/jackc/pgx/v5 (NOT database/sql, no ORM)
github.com/redis/go-redis/v9
github.com/google/uuid
go.uber.org/zap
github.com/go-playground/validator/v10
```

## Module pattern (exactly 4 files)
```
internal/{module}/
├── handler.go      # Thin: validate, call service, respond
├── service.go      # Business logic, no SQL
├── repository.go   # ALL SQL, no business logic
└── types.go        # Structs, constants
```

**Critical handler pattern:**
```go
func (h *Handler) Create(c *gin.Context) {
    orgID := middleware.OrgIDFromCtx(c)   // ALWAYS from context, NEVER from request body
    // ... validate, call service, respond with apperr types
}
```

**Critical repository pattern:**
```go
func (r *Repo) List(
    ctx context.Context,
    orgID uuid.UUID,        // ALWAYS first param
    filters Filters,
) ([]T, error) {
    query := `SELECT ... FROM table
              WHERE organisation_id = $1    -- ALWAYS first WHERE clause
              AND ($2::varchar IS NULL OR status = $2)
              AND ($3::timestamptz IS NULL OR created_at < $3)  -- cursor: last seen timestamp
              ORDER BY created_at DESC
              LIMIT $4`
    // Cursor pagination: client sends last seen created_at, we return next batch
    rows, err := r.db.Query(ctx, query, orgID, filters.Status, filters.Cursor, filters.Limit)
    // ...
}
```

## Middleware chain (in order)
```go
router.Use(
    middleware.RequestID(),
    middleware.Logger(log),
    middleware.Auth(jwtSecret),
    middleware.Tenant(orgRepo),  // Validates org membership, attaches org_id/role to ctx
)
```

## Error handling
Use typed errors from `pkg/apperr`:
```
CodeNotFound, CodeUnauthorized, CodeForbidden, CodeValidation,
CodeUpgradeRequired, CodeEmployeeLimitReached, CodeInsufficientBalance, CodeConflict
```

Always wrap: `return fmt.Errorf("operation failed: %w", err)`

## Feature gating
Check `org.Plan` before Pro features:
- GPS attendance
- Custom leave types
- Claim category budgets
- Employee custom_fields

## Money
```go
type Money struct {
    Amount       int64  // Smallest unit (IDR=no subunit, AED/MYR/SGD=100x)
    CurrencyCode string // "IDR", "AED", "MYR", "SGD"
}
// NEVER float64 for money
```

## Timestamps
Store UTC `time.Time`, convert to org timezone at API response layer via `organisations.timezone`.

## Testing (non-negotiable)
- Every `.go` file → `{file}_test.go` in same commit
- Unit: table-driven, fake/stub repos (no real DB)
- Integration: `testcontainers-go + //go:build integration`
- Services depend on interfaces (not concrete repos) for test injection
- Coverage target: 100% of service business logic paths

**Pattern:**
```go
type RepoInterface interface { Create(...) (*T, error) }
type Service struct { repo RepoInterface }
// Test with fakeRepo struct implementing interface
```

## Logging
Structured zap with `org_id` and `request_id` on every log. No `fmt.Println`.

## Concurrency
- Use `errgroup.WithContext` for fan-out (never bare goroutines in handlers)
- Pass `ctx context.Context` as first arg, never store in struct
- Use `context.WithTimeout` for external calls
- Protect shared state with `sync.Mutex` or channels

## Lint gates
`golangci-lint run ./...`, `go test -race ./...`, `go vet ./...`, coverage check

## DON'Ts
- No ORM (use pgx/v5 directly)
- No global state (inject deps via constructor)
- No panic in handlers (recover in middleware)
- No hardcoded country rules (config tables)
- No `context.Background()` in request code (propagate req context)
- No payroll code (out of scope)

---
description: "Use when writing SQL queries, database repository code, or pgx database interactions. Covers SQL injection prevention, parameterized queries, and safe query construction patterns."
applyTo: "services/internal/**/repository.go"
---
# Safe SQL Queries — Mandatory Rules

## ALWAYS: Parameterized queries
Every user-supplied or variable value MUST be a query parameter (`$1`, `$2`, ...):
```go
// ✅ CORRECT — parameterized
row := r.db.QueryRow(ctx, `SELECT id, name FROM employees WHERE organisation_id = $1 AND id = $2`, orgID, empID)

// ✅ CORRECT — dynamic filters with parameterized NULL check
query := `SELECT * FROM employees
          WHERE organisation_id = $1
          AND ($2::varchar IS NULL OR status = $2)
          ORDER BY created_at DESC`
rows, err := r.db.Query(ctx, query, orgID, filters.Status)
```

## NEVER: String interpolation in SQL
```go
// ❌ FATAL — SQL injection via fmt.Sprintf
query := fmt.Sprintf("SELECT * FROM employees WHERE name = '%s'", name)

// ❌ FATAL — string concatenation
query := "SELECT * FROM employees WHERE status = '" + status + "'"

// ❌ FATAL — template strings
query := `SELECT * FROM employees WHERE id = ` + id.String()
```

## Dynamic column selection
If you need dynamic columns (rare), use a strict allowlist — never interpolate user input:
```go
// ✅ Allowlist approach
var allowedSortColumns = map[string]bool{
    "created_at": true,
    "name":       true,
    "status":     true,
}
if !allowedSortColumns[sortCol] {
    sortCol = "created_at" // safe default
}
query := fmt.Sprintf("SELECT * FROM employees WHERE organisation_id = $1 ORDER BY %s DESC", sortCol)
```

## Multi-tenancy enforcement
Every query MUST include `organisation_id` as the first WHERE clause:
```go
WHERE organisation_id = $1  -- ALWAYS first
```

## Lint gate
Run `golangci-lint run ./...` — gosec (G201, G202) will flag any SQL string formatting or concatenation.

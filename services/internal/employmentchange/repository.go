package employmentchange

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repo implements the Repository interface with PostgreSQL.
type Repo struct {
	db *pgxpool.Pool
}

// NewRepository creates a new employment change repository.
func NewRepository(db *pgxpool.Pool) *Repo {
	return &Repo{db: db}
}

// Create creates a new employment change record.
func (r *Repo) Create(ctx context.Context, orgID uuid.UUID, req CreateChangeRequest) (*EmploymentChange, error) {
	change := &EmploymentChange{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO employment_changes (
			organisation_id, employee_id, change_type,
			old_value, new_value,
			old_salary, new_salary, currency_code,
			effective_date, reason, changed_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, organisation_id, employee_id, change_type,
		          old_value, new_value, old_salary, new_salary, currency_code,
		          effective_date, reason, changed_by, created_at
	`, orgID, req.EmployeeID, req.ChangeType,
		req.OldValue, req.NewValue,
		req.OldSalary, req.NewSalary, req.CurrencyCode,
		req.EffectiveDate, req.Reason, req.ChangedBy).
		Scan(
			&change.ID, &change.OrganisationID, &change.EmployeeID, &change.ChangeType,
			&change.OldValue, &change.NewValue, &change.OldSalary, &change.NewSalary, &change.CurrencyCode,
			&change.EffectiveDate, &change.Reason, &change.ChangedBy, &change.CreatedAt,
		)
	if err != nil {
		return nil, fmt.Errorf("create employment change: %w", err)
	}
	return change, nil
}

// GetByEmployee retrieves employment changes for a specific employee.
func (r *Repo) GetByEmployee(ctx context.Context, orgID, employeeID uuid.UUID, filters ListFilters) ([]EmploymentChange, error) {
	query := `
		SELECT id, organisation_id, employee_id, change_type,
		       old_value, new_value, old_salary, new_salary, currency_code,
		       effective_date, reason, changed_by, created_at
		FROM employment_changes
		WHERE organisation_id = $1 AND employee_id = $2
	`
	args := []interface{}{orgID, employeeID}
	argIdx := 3

	if filters.ChangeType != nil {
		query += fmt.Sprintf(" AND change_type = $%d", argIdx)
		args = append(args, *filters.ChangeType)
		argIdx++
	}

	if filters.StartDate != nil {
		query += fmt.Sprintf(" AND effective_date >= $%d", argIdx)
		args = append(args, *filters.StartDate)
		argIdx++
	}

	if filters.EndDate != nil {
		query += fmt.Sprintf(" AND effective_date <= $%d", argIdx)
		args = append(args, *filters.EndDate)
		argIdx++
	}

	query += " ORDER BY effective_date DESC, created_at DESC"

	if filters.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, filters.Limit)
		argIdx++
	}

	if filters.Offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIdx)
		args = append(args, filters.Offset)
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query employment changes: %w", err)
	}
	defer rows.Close()

	var changes []EmploymentChange
	for rows.Next() {
		var c EmploymentChange
		err := rows.Scan(
			&c.ID, &c.OrganisationID, &c.EmployeeID, &c.ChangeType,
			&c.OldValue, &c.NewValue, &c.OldSalary, &c.NewSalary, &c.CurrencyCode,
			&c.EffectiveDate, &c.Reason, &c.ChangedBy, &c.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan employment change: %w", err)
		}
		changes = append(changes, c)
	}

	return changes, rows.Err()
}

// List retrieves employment changes for an organisation.
func (r *Repo) List(ctx context.Context, orgID uuid.UUID, filters ListFilters) ([]EmploymentChange, error) {
	query := `
		SELECT id, organisation_id, employee_id, change_type,
		       old_value, new_value, old_salary, new_salary, currency_code,
		       effective_date, reason, changed_by, created_at
		FROM employment_changes
		WHERE organisation_id = $1
	`
	args := []interface{}{orgID}
	argIdx := 2

	if filters.EmployeeID != nil {
		query += fmt.Sprintf(" AND employee_id = $%d", argIdx)
		args = append(args, *filters.EmployeeID)
		argIdx++
	}

	if filters.ChangeType != nil {
		query += fmt.Sprintf(" AND change_type = $%d", argIdx)
		args = append(args, *filters.ChangeType)
		argIdx++
	}

	if filters.StartDate != nil {
		query += fmt.Sprintf(" AND effective_date >= $%d", argIdx)
		args = append(args, *filters.StartDate)
		argIdx++
	}

	if filters.EndDate != nil {
		query += fmt.Sprintf(" AND effective_date <= $%d", argIdx)
		args = append(args, *filters.EndDate)
		argIdx++
	}

	query += " ORDER BY created_at DESC"

	if filters.Limit > 0 {
		query += fmt.Sprintf(" LIMIT $%d", argIdx)
		args = append(args, filters.Limit)
		argIdx++
	}

	if filters.Offset > 0 {
		query += fmt.Sprintf(" OFFSET $%d", argIdx)
		args = append(args, filters.Offset)
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query employment changes: %w", err)
	}
	defer rows.Close()

	var changes []EmploymentChange
	for rows.Next() {
		var c EmploymentChange
		err := rows.Scan(
			&c.ID, &c.OrganisationID, &c.EmployeeID, &c.ChangeType,
			&c.OldValue, &c.NewValue, &c.OldSalary, &c.NewSalary, &c.CurrencyCode,
			&c.EffectiveDate, &c.Reason, &c.ChangedBy, &c.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan employment change: %w", err)
		}
		changes = append(changes, c)
	}

	return changes, rows.Err()
}

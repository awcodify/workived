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
		SELECT ec.id, ec.organisation_id, ec.employee_id, ec.change_type,
		       ec.old_value, ec.new_value, ec.old_salary, ec.new_salary, ec.currency_code,
		       ec.effective_date, ec.reason, ec.changed_by, ec.created_at,
		       d_old.name AS old_department_name,
		       d_new.name AS new_department_name
		FROM employment_changes ec
		LEFT JOIN departments d_old ON ec.change_type = 'department' 
		          AND ec.old_value IS NOT NULL 
		          AND d_old.id::text = ec.old_value 
		          AND d_old.organisation_id = ec.organisation_id
		LEFT JOIN departments d_new ON ec.change_type = 'department' 
		          AND ec.new_value IS NOT NULL 
		          AND d_new.id::text = ec.new_value 
		          AND d_new.organisation_id = ec.organisation_id
		WHERE ec.organisation_id = $1 AND ec.employee_id = $2
	`
	args := []interface{}{orgID, employeeID}
	argIdx := 3

	if filters.ChangeType != nil {
		query += fmt.Sprintf(" AND ec.change_type = $%d", argIdx)
		args = append(args, *filters.ChangeType)
		argIdx++
	}

	if filters.StartDate != nil {
		query += fmt.Sprintf(" AND ec.effective_date >= $%d", argIdx)
		args = append(args, *filters.StartDate)
		argIdx++
	}

	if filters.EndDate != nil {
		query += fmt.Sprintf(" AND ec.effective_date <= $%d", argIdx)
		args = append(args, *filters.EndDate)
		argIdx++
	}

	query += " ORDER BY ec.effective_date DESC, ec.created_at DESC"

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
			&c.OldDepartmentName, &c.NewDepartmentName,
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
		SELECT ec.id, ec.organisation_id, ec.employee_id, ec.change_type,
		       ec.old_value, ec.new_value, ec.old_salary, ec.new_salary, ec.currency_code,
		       ec.effective_date, ec.reason, ec.changed_by, ec.created_at,
		       d_old.name AS old_department_name,
		       d_new.name AS new_department_name
		FROM employment_changes ec
		LEFT JOIN departments d_old ON ec.change_type = 'department' 
		          AND ec.old_value IS NOT NULL 
		          AND d_old.id::text = ec.old_value 
		          AND d_old.organisation_id = ec.organisation_id
		LEFT JOIN departments d_new ON ec.change_type = 'department' 
		          AND ec.new_value IS NOT NULL 
		          AND d_new.id::text = ec.new_value 
		          AND d_new.organisation_id = ec.organisation_id
		WHERE ec.organisation_id = $1
	`
	args := []interface{}{orgID}
	argIdx := 2

	if filters.EmployeeID != nil {
		query += fmt.Sprintf(" AND ec.employee_id = $%d", argIdx)
		args = append(args, *filters.EmployeeID)
		argIdx++
	}

	if filters.ChangeType != nil {
		query += fmt.Sprintf(" AND ec.change_type = $%d", argIdx)
		args = append(args, *filters.ChangeType)
		argIdx++
	}

	if filters.StartDate != nil {
		query += fmt.Sprintf(" AND ec.effective_date >= $%d", argIdx)
		args = append(args, *filters.StartDate)
		argIdx++
	}

	if filters.EndDate != nil {
		query += fmt.Sprintf(" AND ec.effective_date <= $%d", argIdx)
		args = append(args, *filters.EndDate)
		argIdx++
	}

	query += " ORDER BY ec.created_at DESC"

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
			&c.OldDepartmentName, &c.NewDepartmentName,
		)
		if err != nil {
			return nil, fmt.Errorf("scan employment change: %w", err)
		}
		changes = append(changes, c)
	}

	return changes, rows.Err()
}

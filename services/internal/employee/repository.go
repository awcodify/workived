package employee

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/paginate"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List(ctx context.Context, orgID uuid.UUID, f ListFilters) ([]Employee, error) {
	limit := paginate.ClampLimit(f.Limit)
	cursor := paginate.Decode(f.Cursor)

	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, user_id, employee_code,
		       full_name, email, phone, department_id, job_title,
		       employment_type, status, start_date, end_date,
		       base_salary, salary_currency, custom_fields,
		       is_active, created_at, updated_at
		FROM employees
		WHERE organisation_id = $1
		  AND is_active = TRUE
		  AND ($2::varchar IS NULL OR status = $2)
		  AND ($3::varchar IS NULL OR department_id::text = $3)
		  AND ($4::varchar IS NULL OR full_name > $4)
		ORDER BY full_name ASC
		LIMIT $5
	`, orgID, f.Status, f.DepartmentID, nilIfEmpty(cursor.Value), limit+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var emps []Employee
	for rows.Next() {
		var e Employee
		if err := rows.Scan(
			&e.ID, &e.OrganisationID, &e.UserID, &e.EmployeeCode,
			&e.FullName, &e.Email, &e.Phone, &e.DepartmentID, &e.JobTitle,
			&e.EmploymentType, &e.Status, &e.StartDate, &e.EndDate,
			&e.BaseSalary, &e.SalaryCurrency, &e.CustomFields,
			&e.IsActive, &e.CreatedAt, &e.UpdatedAt,
		); err != nil {
			return nil, err
		}
		emps = append(emps, e)
	}
	return emps, rows.Err()
}

func (r *Repository) CountActive(ctx context.Context, orgID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM employees
		WHERE organisation_id = $1 AND is_active = TRUE
	`, orgID).Scan(&count)
	return count, err
}

func (r *Repository) Create(ctx context.Context, orgID uuid.UUID, req CreateEmployeeRequest) (*Employee, error) {
	e := &Employee{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO employees (
			organisation_id, employee_code, full_name, email, phone,
			department_id, job_title, employment_type, start_date
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date)
		RETURNING id, organisation_id, user_id, employee_code,
		          full_name, email, phone, department_id, job_title,
		          employment_type, status, start_date, end_date,
		          base_salary, salary_currency, custom_fields,
		          is_active, created_at, updated_at
	`, orgID, req.EmployeeCode, req.FullName, req.Email, req.Phone,
		req.DepartmentID, req.JobTitle, req.EmploymentType, req.StartDate).
		Scan(
			&e.ID, &e.OrganisationID, &e.UserID, &e.EmployeeCode,
			&e.FullName, &e.Email, &e.Phone, &e.DepartmentID, &e.JobTitle,
			&e.EmploymentType, &e.Status, &e.StartDate, &e.EndDate,
			&e.BaseSalary, &e.SalaryCurrency, &e.CustomFields,
			&e.IsActive, &e.CreatedAt, &e.UpdatedAt,
		)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, apperr.Conflict("an employee with this email already exists in your organisation")
		}
		return nil, err
	}
	return e, nil
}

func (r *Repository) GetByID(ctx context.Context, orgID, id uuid.UUID) (*Employee, error) {
	e := &Employee{}
	err := r.db.QueryRow(ctx, `
		SELECT id, organisation_id, user_id, employee_code,
		       full_name, email, phone, department_id, job_title,
		       employment_type, status, start_date, end_date,
		       base_salary, salary_currency, custom_fields,
		       is_active, created_at, updated_at
		FROM employees
		WHERE organisation_id = $1 AND id = $2
	`, orgID, id).Scan(
		&e.ID, &e.OrganisationID, &e.UserID, &e.EmployeeCode,
		&e.FullName, &e.Email, &e.Phone, &e.DepartmentID, &e.JobTitle,
		&e.EmploymentType, &e.Status, &e.StartDate, &e.EndDate,
		&e.BaseSalary, &e.SalaryCurrency, &e.CustomFields,
		&e.IsActive, &e.CreatedAt, &e.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("employee")
		}
		return nil, err
	}
	return e, nil
}

func (r *Repository) Update(ctx context.Context, orgID, id uuid.UUID, req UpdateEmployeeRequest) (*Employee, error) {
	e := &Employee{}
	err := r.db.QueryRow(ctx, `
		UPDATE employees SET
			full_name       = COALESCE($3, full_name),
			phone           = COALESCE($4, phone),
			department_id   = COALESCE($5, department_id),
			job_title       = COALESCE($6, job_title),
			employment_type = COALESCE($7, employment_type),
			status          = COALESCE($8, status),
			end_date        = COALESCE($9::date, end_date)
		WHERE organisation_id = $1 AND id = $2
		RETURNING id, organisation_id, user_id, employee_code,
		          full_name, email, phone, department_id, job_title,
		          employment_type, status, start_date, end_date,
		          base_salary, salary_currency, custom_fields,
		          is_active, created_at, updated_at
	`, orgID, id,
		req.FullName, req.Phone, req.DepartmentID, req.JobTitle,
		req.EmploymentType, req.Status, req.EndDate).
		Scan(
			&e.ID, &e.OrganisationID, &e.UserID, &e.EmployeeCode,
			&e.FullName, &e.Email, &e.Phone, &e.DepartmentID, &e.JobTitle,
			&e.EmploymentType, &e.Status, &e.StartDate, &e.EndDate,
			&e.BaseSalary, &e.SalaryCurrency, &e.CustomFields,
			&e.IsActive, &e.CreatedAt, &e.UpdatedAt,
		)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("employee")
		}
		return nil, err
	}
	return e, nil
}

// SoftDelete sets is_active = false — HR records are never hard deleted.
func (r *Repository) SoftDelete(ctx context.Context, orgID, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE employees SET is_active = FALSE, status = 'inactive'
		WHERE organisation_id = $1 AND id = $2 AND is_active = TRUE
	`, orgID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("employee")
	}
	return nil
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func isUniqueViolation(err error) bool {
	return err != nil && containsCode(err.Error(), "23505")
}

func containsCode(msg, code string) bool {
	for i := 0; i+len(code) <= len(msg); i++ {
		if msg[i:i+len(code)] == code {
			return true
		}
	}
	return false
}

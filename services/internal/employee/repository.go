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

func (r *Repository) List(ctx context.Context, orgID uuid.UUID, f ListFilters) ([]EmployeeWithManager, error) {
	limit := paginate.ClampLimit(f.Limit)
	cursor := paginate.Decode(f.Cursor)

	rows, err := r.db.Query(ctx, `
		SELECT e.id, e.organisation_id, e.user_id, e.employee_code,
		       e.full_name, e.email, e.phone, e.department_id, e.job_title,
		       e.employment_type, e.status, e.reporting_to, e.start_date, e.end_date,
		       e.base_salary, e.salary_currency, e.custom_fields,
		       e.is_active, e.created_at, e.updated_at,
		       m.full_name AS manager_name
		FROM employees e
		LEFT JOIN employees m ON e.reporting_to = m.id AND m.is_active = TRUE
		WHERE e.organisation_id = $1
		  AND ($2::varchar IS NULL OR e.status = $2)
		  AND ($3::varchar IS NULL OR e.department_id::text = $3)
		  AND ($4::varchar IS NULL OR e.full_name > $4)
		ORDER BY e.full_name ASC
		LIMIT $5
	`, orgID, f.Status, f.DepartmentID, nilIfEmpty(cursor.Value), limit+1)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var emps []EmployeeWithManager
	for rows.Next() {
		var e EmployeeWithManager
		if err := rows.Scan(
			&e.ID, &e.OrganisationID, &e.UserID, &e.EmployeeCode,
			&e.FullName, &e.Email, &e.Phone, &e.DepartmentID, &e.JobTitle,
			&e.EmploymentType, &e.Status, &e.ReportingTo, &e.StartDate, &e.EndDate,
			&e.BaseSalary, &e.SalaryCurrency, &e.CustomFields,
			&e.IsActive, &e.CreatedAt, &e.UpdatedAt,
			&e.ManagerName,
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

// ListAllActive returns all active employees for an org (no pagination) — used by rollover job.
func (r *Repository) ListAllActive(ctx context.Context, orgID uuid.UUID) ([]Employee, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, user_id, employee_code,
		       full_name, email, phone, department_id, job_title,
		       employment_type, status, reporting_to, start_date, end_date,
		       base_salary, salary_currency, custom_fields,
		       is_active, created_at, updated_at
		FROM employees
		WHERE organisation_id = $1 AND is_active = TRUE
		ORDER BY full_name ASC
	`, orgID)
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
			&e.EmploymentType, &e.Status, &e.ReportingTo, &e.StartDate, &e.EndDate,
			&e.BaseSalary, &e.SalaryCurrency, &e.CustomFields,
			&e.IsActive, &e.CreatedAt, &e.UpdatedAt,
		); err != nil {
			return nil, err
		}
		emps = append(emps, e)
	}
	return emps, rows.Err()
}

func (r *Repository) Create(ctx context.Context, orgID uuid.UUID, req CreateEmployeeRequest) (*Employee, error) {
	e := &Employee{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO employees (
			organisation_id, user_id, employee_code, full_name, email, phone,
			department_id, job_title, employment_type, reporting_to, start_date
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::date)
		RETURNING id, organisation_id, user_id, employee_code,
		          full_name, email, phone, department_id, job_title,
		          employment_type, status, reporting_to, start_date, end_date,
		          base_salary, salary_currency, custom_fields,
		          is_active, created_at, updated_at
	`, orgID, req.UserID, req.EmployeeCode, req.FullName, req.Email, req.Phone,
		req.DepartmentID, req.JobTitle, req.EmploymentType, req.ReportingTo, req.StartDate).
		Scan(
			&e.ID, &e.OrganisationID, &e.UserID, &e.EmployeeCode,
			&e.FullName, &e.Email, &e.Phone, &e.DepartmentID, &e.JobTitle,
			&e.EmploymentType, &e.Status, &e.ReportingTo, &e.StartDate, &e.EndDate,
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
		       employment_type, status, reporting_to, start_date, end_date,
		       base_salary, salary_currency, custom_fields,
		       is_active, created_at, updated_at
		FROM employees
		WHERE organisation_id = $1 AND id = $2
	`, orgID, id).Scan(
		&e.ID, &e.OrganisationID, &e.UserID, &e.EmployeeCode,
		&e.FullName, &e.Email, &e.Phone, &e.DepartmentID, &e.JobTitle,
		&e.EmploymentType, &e.Status, &e.ReportingTo, &e.StartDate, &e.EndDate,
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

// GetEmployeeProfile returns basic profile info for email notifications.
// This is a lightweight query that only fetches what's needed for emails.
func (r *Repository) GetEmployeeProfile(ctx context.Context, orgID, employeeID uuid.UUID) (name string, email *string, managerID *uuid.UUID, err error) {
	err = r.db.QueryRow(ctx, `
		SELECT full_name, email, reporting_to
		FROM employees
		WHERE organisation_id = $1 AND id = $2 AND is_active = true
	`, orgID, employeeID).Scan(&name, &email, &managerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil, nil, apperr.NotFound("employee")
		}
		return "", nil, nil, err
	}
	return name, email, managerID, nil
}

func (r *Repository) VerifyManagerRelationship(ctx context.Context, orgID, employeeID, managerEmployeeID uuid.UUID) error {
	var reportingTo *uuid.UUID
	err := r.db.QueryRow(ctx, `
		SELECT reporting_to
		FROM employees
		WHERE organisation_id = $1 AND id = $2 AND is_active = true
	`, orgID, employeeID).Scan(&reportingTo)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperr.NotFound("employee")
		}
		return err
	}
	if reportingTo == nil || *reportingTo != managerEmployeeID {
		return apperr.New(apperr.CodeForbidden, "employee does not report to you")
	}
	return nil
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
			reporting_to    = COALESCE($9, reporting_to),
			end_date        = COALESCE($10::date, end_date)
		WHERE organisation_id = $1 AND id = $2
		RETURNING id, organisation_id, user_id, employee_code,
		          full_name, email, phone, department_id, job_title,
		          employment_type, status, reporting_to, start_date, end_date,
		          base_salary, salary_currency, custom_fields,
		          is_active, created_at, updated_at
	`, orgID, id,
		req.FullName, req.Phone, req.DepartmentID, req.JobTitle,
		req.EmploymentType, req.Status, req.ReportingTo, req.EndDate).
		Scan(
			&e.ID, &e.OrganisationID, &e.UserID, &e.EmployeeCode,
			&e.FullName, &e.Email, &e.Phone, &e.DepartmentID, &e.JobTitle,
			&e.EmploymentType, &e.Status, &e.ReportingTo, &e.StartDate, &e.EndDate,
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

// GetByUserID returns the employee record linked to the given user account.
func (r *Repository) GetByUserID(ctx context.Context, orgID, userID uuid.UUID) (*Employee, error) {
	e := &Employee{}
	err := r.db.QueryRow(ctx, `
		SELECT id, organisation_id, user_id, employee_code,
		       full_name, email, phone, department_id, job_title,
		       employment_type, status, reporting_to, start_date, end_date,
		       base_salary, salary_currency, custom_fields,
		       is_active, created_at, updated_at
		FROM employees
		WHERE organisation_id = $1 AND user_id = $2 AND is_active = TRUE
	`, orgID, userID).Scan(
		&e.ID, &e.OrganisationID, &e.UserID, &e.EmployeeCode,
		&e.FullName, &e.Email, &e.Phone, &e.DepartmentID, &e.JobTitle,
		&e.EmploymentType, &e.Status, &e.ReportingTo, &e.StartDate, &e.EndDate,
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

// GetDirectReports returns all active employees who report to the given manager.
func (r *Repository) GetDirectReports(ctx context.Context, orgID, managerID uuid.UUID) ([]Employee, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, user_id, employee_code,
		       full_name, email, phone, department_id, job_title,
		       employment_type, status, reporting_to, start_date, end_date,
		       base_salary, salary_currency, custom_fields,
		       is_active, created_at, updated_at
		FROM employees
		WHERE organisation_id = $1
		  AND reporting_to = $2
		  AND is_active = TRUE
		ORDER BY full_name ASC
	`, orgID, managerID)
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
			&e.EmploymentType, &e.Status, &e.ReportingTo, &e.StartDate, &e.EndDate,
			&e.BaseSalary, &e.SalaryCurrency, &e.CustomFields,
			&e.IsActive, &e.CreatedAt, &e.UpdatedAt,
		); err != nil {
			return nil, err
		}
		emps = append(emps, e)
	}
	return emps, rows.Err()
}

// GetWithManagerName returns an employee with their managers full name populated.
func (r *Repository) GetWithManagerName(ctx context.Context, orgID, id uuid.UUID) (*EmployeeWithManager, error) {
	result := &EmployeeWithManager{}
	err := r.db.QueryRow(ctx, `
		SELECT 
			e.id, e.organisation_id, e.user_id, e.employee_code,
			e.full_name, e.email, e.phone, e.department_id, e.job_title,
			e.employment_type, e.status, e.reporting_to, e.start_date, e.end_date,
			e.base_salary, e.salary_currency, e.custom_fields,
			e.is_active, e.created_at, e.updated_at,
			m.full_name AS manager_name
		FROM employees e
		LEFT JOIN employees m ON e.reporting_to = m.id AND m.is_active = TRUE
		WHERE e.organisation_id = $1 AND e.id = $2
	`, orgID, id).Scan(
		&result.ID, &result.OrganisationID, &result.UserID, &result.EmployeeCode,
		&result.FullName, &result.Email, &result.Phone, &result.DepartmentID, &result.JobTitle,
		&result.EmploymentType, &result.Status, &result.ReportingTo, &result.StartDate, &result.EndDate,
		&result.BaseSalary, &result.SalaryCurrency, &result.CustomFields,
		&result.IsActive, &result.CreatedAt, &result.UpdatedAt,
		&result.ManagerName,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("employee")
		}
		return nil, err
	}
	return result, nil
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

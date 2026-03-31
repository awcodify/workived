package employee

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
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
		       e.employment_type, e.status, e.reporting_to, e.gender, e.start_date, e.end_date,
		       e.base_salary, e.salary_currency, e.custom_fields,
		       e.is_active, e.created_at, e.updated_at,
		       m.full_name AS manager_name,
		       (i.id IS NOT NULL) AS invitation_pending
		FROM employees e
		LEFT JOIN employees m ON e.reporting_to = m.id AND m.is_active = TRUE
		LEFT JOIN invitations i ON i.organisation_id = e.organisation_id
		          AND i.employee_id = e.id AND i.accepted_at IS NULL
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
			&e.EmploymentType, &e.Status, &e.ReportingTo, &e.Gender, &e.StartDate, &e.EndDate,
			&e.BaseSalary, &e.SalaryCurrency, &e.CustomFields,
			&e.IsActive, &e.CreatedAt, &e.UpdatedAt,
			&e.ManagerName, &e.InvitationPending,
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
		       employment_type, status, reporting_to, gender, start_date, end_date,
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
			&e.EmploymentType, &e.Status, &e.ReportingTo, &e.Gender, &e.StartDate, &e.EndDate,
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
			department_id, job_title, employment_type, reporting_to, gender, start_date
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::date)
		RETURNING id, organisation_id, user_id, employee_code,
		          full_name, email, phone, department_id, job_title,
		          employment_type, status, reporting_to, gender, start_date, end_date,
		          base_salary, salary_currency, custom_fields,
		          is_active, created_at, updated_at
	`, orgID, req.UserID, req.EmployeeCode, req.FullName, req.Email, req.Phone,
		req.DepartmentID, req.JobTitle, req.EmploymentType, req.ReportingTo, req.Gender, req.StartDate).
		Scan(
			&e.ID, &e.OrganisationID, &e.UserID, &e.EmployeeCode,
			&e.FullName, &e.Email, &e.Phone, &e.DepartmentID, &e.JobTitle,
			&e.EmploymentType, &e.Status, &e.ReportingTo, &e.Gender, &e.StartDate, &e.EndDate,
			&e.BaseSalary, &e.SalaryCurrency, &e.CustomFields,
			&e.IsActive, &e.CreatedAt, &e.UpdatedAt,
		)
	if err != nil {
		if msg := uniqueViolationMessage(err); msg != "" {
			return nil, apperr.Conflict(msg)
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
		       employment_type, status, reporting_to, gender, start_date, end_date,
		       base_salary, salary_currency, custom_fields,
		       is_active, created_at, updated_at
		FROM employees
		WHERE organisation_id = $1 AND id = $2
	`, orgID, id).Scan(
		&e.ID, &e.OrganisationID, &e.UserID, &e.EmployeeCode,
		&e.FullName, &e.Email, &e.Phone, &e.DepartmentID, &e.JobTitle,
		&e.EmploymentType, &e.Status, &e.ReportingTo, &e.Gender, &e.StartDate, &e.EndDate,
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

// GetEmployeeGender returns the gender of an employee (may be nil if not set).
func (r *Repository) GetEmployeeGender(ctx context.Context, orgID, employeeID uuid.UUID) (*string, error) {
	var gender *string
	err := r.db.QueryRow(ctx, `
		SELECT gender FROM employees
		WHERE organisation_id = $1 AND id = $2 AND is_active = true
	`, orgID, employeeID).Scan(&gender)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("employee")
		}
		return nil, err
	}
	return gender, nil
}

// GetEmployeeStartDate returns the start date of an employee.
func (r *Repository) GetEmployeeStartDate(ctx context.Context, orgID, employeeID uuid.UUID) (time.Time, error) {
	var startDate time.Time
	err := r.db.QueryRow(ctx, `
		SELECT start_date FROM employees
		WHERE organisation_id = $1 AND id = $2 AND is_active = true
	`, orgID, employeeID).Scan(&startDate)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return time.Time{}, apperr.NotFound("employee")
		}
		return time.Time{}, err
	}
	return startDate, nil
}

// GetEmployeeType returns the employment_type of an employee (e.g. "full_time", "contract", "intern").
func (r *Repository) GetEmployeeType(ctx context.Context, orgID, employeeID uuid.UUID) (string, error) {
	var empType string
	err := r.db.QueryRow(ctx, `
		SELECT employment_type FROM employees
		WHERE organisation_id = $1 AND id = $2 AND is_active = true
	`, orgID, employeeID).Scan(&empType)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", apperr.NotFound("employee")
		}
		return "", err
	}
	return empType, nil
}

func (r *Repository) VerifyManagerRelationship(ctx context.Context, orgID, employeeID, managerEmployeeID uuid.UUID) error {
	// Walk the full ancestor chain (not just direct manager) so that
	// grandparent/higher-level managers can also approve subordinate requests.
	// e.g. if 1.1.1 reports to 1.1 reports to 1, then both 1.1 and 1 can approve.
	var isAncestor bool
	err := r.db.QueryRow(ctx, `
		WITH RECURSIVE ancestors AS (
			SELECT e.reporting_to AS ancestor_id
			FROM employees e
			WHERE e.organisation_id = $1 AND e.id = $2 AND e.is_active = TRUE
			UNION ALL
			SELECT e.reporting_to
			FROM employees e
			INNER JOIN ancestors a ON e.id = a.ancestor_id
			WHERE e.organisation_id = $1 AND a.ancestor_id IS NOT NULL
		)
		SELECT EXISTS(SELECT 1 FROM ancestors WHERE ancestor_id = $3)
	`, orgID, employeeID, managerEmployeeID).Scan(&isAncestor)
	if err != nil {
		return err
	}
	if !isAncestor {
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
			gender          = COALESCE($10, gender),
			end_date        = COALESCE($11::date, end_date)
		WHERE organisation_id = $1 AND id = $2
		RETURNING id, organisation_id, user_id, employee_code,
		          full_name, email, phone, department_id, job_title,
		          employment_type, status, reporting_to, gender, start_date, end_date,
		          base_salary, salary_currency, custom_fields,
		          is_active, created_at, updated_at
	`, orgID, id,
		req.FullName, req.Phone, req.DepartmentID, req.JobTitle,
		req.EmploymentType, req.Status, req.ReportingTo, req.Gender, req.EndDate).
		Scan(
			&e.ID, &e.OrganisationID, &e.UserID, &e.EmployeeCode,
			&e.FullName, &e.Email, &e.Phone, &e.DepartmentID, &e.JobTitle,
			&e.EmploymentType, &e.Status, &e.ReportingTo, &e.Gender, &e.StartDate, &e.EndDate,
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
		       employment_type, status, reporting_to, gender, start_date, end_date,
		       base_salary, salary_currency, custom_fields,
		       is_active, created_at, updated_at
		FROM employees
		WHERE organisation_id = $1 AND user_id = $2 AND is_active = TRUE
	`, orgID, userID).Scan(
		&e.ID, &e.OrganisationID, &e.UserID, &e.EmployeeCode,
		&e.FullName, &e.Email, &e.Phone, &e.DepartmentID, &e.JobTitle,
		&e.EmploymentType, &e.Status, &e.ReportingTo, &e.Gender, &e.StartDate, &e.EndDate,
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
		       employment_type, status, reporting_to, gender, start_date, end_date,
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
			&e.EmploymentType, &e.Status, &e.ReportingTo, &e.Gender, &e.StartDate, &e.EndDate,
			&e.BaseSalary, &e.SalaryCurrency, &e.CustomFields,
			&e.IsActive, &e.CreatedAt, &e.UpdatedAt,
		); err != nil {
			return nil, err
		}
		emps = append(emps, e)
	}
	return emps, rows.Err()
}

// GetSubordinateIDs returns employee IDs reporting to the given manager.
// Used for permission checks and filtering in attendance/leave modules.
func (r *Repository) GetSubordinateIDs(ctx context.Context, orgID, managerID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id
		FROM employees
		WHERE organisation_id = $1
		  AND reporting_to = $2
		  AND is_active = TRUE
	`, orgID, managerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// GetWithManagerName returns an employee with their managers full name populated.
func (r *Repository) GetWithManagerName(ctx context.Context, orgID, id uuid.UUID) (*EmployeeWithManager, error) {
	result := &EmployeeWithManager{}
	err := r.db.QueryRow(ctx, `
		SELECT
			e.id, e.organisation_id, e.user_id, e.employee_code,
			e.full_name, e.email, e.phone, e.department_id, e.job_title,
			e.employment_type, e.status, e.reporting_to, e.gender, e.start_date, e.end_date,
			e.base_salary, e.salary_currency, e.custom_fields,
			e.is_active, e.created_at, e.updated_at,
			m.full_name AS manager_name
		FROM employees e
		LEFT JOIN employees m ON e.reporting_to = m.id AND m.is_active = TRUE
		WHERE e.organisation_id = $1 AND e.id = $2
	`, orgID, id).Scan(
		&result.ID, &result.OrganisationID, &result.UserID, &result.EmployeeCode,
		&result.FullName, &result.Email, &result.Phone, &result.DepartmentID, &result.JobTitle,
		&result.EmploymentType, &result.Status, &result.ReportingTo, &result.Gender, &result.StartDate, &result.EndDate,
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

// GetWorkload returns workload information for all active employees in an organization.
// It aggregates task counts and leave status for workload-aware task assignment.
func (r *Repository) GetWorkload(ctx context.Context, orgID uuid.UUID) ([]EmployeeWorkload, error) {
	rows, err := r.db.Query(ctx, `
		WITH task_counts AS (
			SELECT 
				assignee_id,
				COUNT(*) as active_tasks,
				COUNT(*) FILTER (WHERE due_date < NOW() AND completed_at IS NULL) as overdue_tasks
			FROM tasks
			WHERE organisation_id = $1 
			  AND completed_at IS NULL
			  AND assignee_id IS NOT NULL
			GROUP BY assignee_id
		),
		leave_status AS (
			SELECT 
				employee_id,
				MIN(start_date) as next_start,
				MAX(end_date) as last_end,
				BOOL_OR(NOW()::date BETWEEN start_date AND end_date) as is_on_leave
			FROM leave_requests
			WHERE organisation_id = $1 
			  AND status = 'approved'
			  AND end_date >= NOW()::date
			GROUP BY employee_id
		)
		SELECT 
			e.id,
			e.full_name,
			e.email,
			e.department_id,
			COALESCE(t.active_tasks, 0) as active_tasks,
			COALESCE(t.overdue_tasks, 0) as overdue_tasks,
			COALESCE(l.is_on_leave, FALSE) as is_on_leave,
			l.next_start,
			l.last_end
		FROM employees e
		LEFT JOIN task_counts t ON t.assignee_id = e.id
		LEFT JOIN leave_status l ON l.employee_id = e.id
		WHERE e.organisation_id = $1 
		  AND e.is_active = TRUE
		ORDER BY e.full_name ASC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var workloads []EmployeeWorkload
	for rows.Next() {
		var w EmployeeWorkload
		var nextStart, lastEnd *time.Time
		var isOnLeave bool

		if err := rows.Scan(
			&w.ID,
			&w.FullName,
			&w.Email,
			&w.DepartmentID,
			&w.Workload.ActiveTasks,
			&w.Workload.OverdueTasks,
			&isOnLeave,
			&nextStart,
			&lastEnd,
		); err != nil {
			return nil, err
		}

		// Determine workload status
		if isOnLeave {
			w.Workload.Status = WorkloadOnLeave
			w.Leave.IsOnLeave = true
			w.Leave.LeaveStart = nextStart
			w.Leave.LeaveEnd = lastEnd
		} else if w.Workload.ActiveTasks >= 11 {
			w.Workload.Status = WorkloadOverloaded
		} else if w.Workload.ActiveTasks >= 6 {
			w.Workload.Status = WorkloadWarning
		} else {
			w.Workload.Status = WorkloadAvailable
		}

		// Check for upcoming leave (next 7 days)
		if nextStart != nil && !isOnLeave {
			daysUntilLeave := int(time.Until(*nextStart).Hours() / 24)
			if daysUntilLeave >= 0 && daysUntilLeave <= 7 {
				w.Leave.IsUpcomingLeave = true
				w.Leave.LeaveStart = nextStart
				w.Leave.LeaveEnd = lastEnd
			}
		}

		workloads = append(workloads, w)
	}

	return workloads, rows.Err()
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func uniqueViolationMessage(err error) string {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		return ""
	}
	switch pgErr.ConstraintName {
	case "employees_organisation_id_email_key":
		return "an employee with this email already exists in your organisation"
	default:
		return "an employee with these details already exists in your organisation"
	}
}

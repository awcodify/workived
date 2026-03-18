package attendance

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/workived/services/pkg/apperr"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// GetByEmployeeAndDate returns the attendance record for a given employee on a given date.
// Returns apperr.NotFound if no record exists.
func (r *Repository) GetByEmployeeAndDate(ctx context.Context, orgID, employeeID uuid.UUID, date string) (*Record, error) {
	rec := &Record{}
	err := r.db.QueryRow(ctx, `
		SELECT id, organisation_id, employee_id, date,
		       clock_in_at, clock_out_at, is_late, note,
		       created_at, updated_at
		FROM attendance_records
		WHERE organisation_id = $1
		  AND employee_id = $2
		  AND date = $3::date
	`, orgID, employeeID, date).Scan(
		&rec.ID, &rec.OrganisationID, &rec.EmployeeID, &rec.Date,
		&rec.ClockInAt, &rec.ClockOutAt, &rec.IsLate, &rec.Note,
		&rec.CreatedAt, &rec.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("attendance record")
		}
		return nil, err
	}
	return rec, nil
}

// Create inserts a new attendance record (clock-in).
func (r *Repository) Create(ctx context.Context, orgID, employeeID uuid.UUID, date string, clockInAt time.Time, isLate bool, note *string) (*Record, error) {
	rec := &Record{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO attendance_records (organisation_id, employee_id, date, clock_in_at, is_late, note)
		VALUES ($1, $2, $3::date, $4, $5, $6)
		RETURNING id, organisation_id, employee_id, date,
		          clock_in_at, clock_out_at, is_late, note,
		          created_at, updated_at
	`, orgID, employeeID, date, clockInAt, isLate, note).Scan(
		&rec.ID, &rec.OrganisationID, &rec.EmployeeID, &rec.Date,
		&rec.ClockInAt, &rec.ClockOutAt, &rec.IsLate, &rec.Note,
		&rec.CreatedAt, &rec.UpdatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, apperr.Conflict("already clocked in today")
		}
		return nil, err
	}
	return rec, nil
}

// UpdateClockOut sets the clock_out_at on an existing attendance record.
func (r *Repository) UpdateClockOut(ctx context.Context, orgID, employeeID uuid.UUID, date string, clockOutAt time.Time, note *string) (*Record, error) {
	rec := &Record{}
	err := r.db.QueryRow(ctx, `
		UPDATE attendance_records
		SET clock_out_at = $4,
		    note = COALESCE($5, note)
		WHERE organisation_id = $1
		  AND employee_id = $2
		  AND date = $3::date
		RETURNING id, organisation_id, employee_id, date,
		          clock_in_at, clock_out_at, is_late, note,
		          created_at, updated_at
	`, orgID, employeeID, date, clockOutAt, note).Scan(
		&rec.ID, &rec.OrganisationID, &rec.EmployeeID, &rec.Date,
		&rec.ClockInAt, &rec.ClockOutAt, &rec.IsLate, &rec.Note,
		&rec.CreatedAt, &rec.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("attendance record")
		}
		return nil, err
	}
	return rec, nil
}

// ListByDate returns all attendance records for an org on a given date.
func (r *Repository) ListByDate(ctx context.Context, orgID uuid.UUID, date string) ([]Record, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, employee_id, date,
		       clock_in_at, clock_out_at, is_late, note,
		       created_at, updated_at
		FROM attendance_records
		WHERE organisation_id = $1
		  AND date = $2::date
		ORDER BY clock_in_at ASC
	`, orgID, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []Record
	for rows.Next() {
		var rec Record
		if err := rows.Scan(
			&rec.ID, &rec.OrganisationID, &rec.EmployeeID, &rec.Date,
			&rec.ClockInAt, &rec.ClockOutAt, &rec.IsLate, &rec.Note,
			&rec.CreatedAt, &rec.UpdatedAt,
		); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, rows.Err()
}

// ListByMonth returns all attendance records for an org in a given month.
func (r *Repository) ListByMonth(ctx context.Context, orgID uuid.UUID, year, month int) ([]Record, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, employee_id, date,
		       clock_in_at, clock_out_at, is_late, note,
		       created_at, updated_at
		FROM attendance_records
		WHERE organisation_id = $1
		  AND EXTRACT(YEAR FROM date) = $2
		  AND EXTRACT(MONTH FROM date) = $3
		ORDER BY date ASC, clock_in_at ASC
	`, orgID, year, month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []Record
	for rows.Next() {
		var rec Record
		if err := rows.Scan(
			&rec.ID, &rec.OrganisationID, &rec.EmployeeID, &rec.Date,
			&rec.ClockInAt, &rec.ClockOutAt, &rec.IsLate, &rec.Note,
			&rec.CreatedAt, &rec.UpdatedAt,
		); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, rows.Err()
}

// GetDefaultSchedule returns the default work schedule for an org.
// Returns nil, nil if no default schedule exists.
func (r *Repository) GetDefaultSchedule(ctx context.Context, orgID uuid.UUID) (*WorkSchedule, error) {
	ws := &WorkSchedule{}
	err := r.db.QueryRow(ctx, `
		SELECT work_days, start_time
		FROM work_schedules
		WHERE organisation_id = $1
		  AND is_default = TRUE
		  AND is_active = TRUE
		LIMIT 1
	`, orgID).Scan(&ws.WorkDays, &ws.StartTime)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return ws, nil
}

// ListHolidays returns public holidays for a country within a date range.
func (r *Repository) ListHolidays(ctx context.Context, countryCode string, startDate, endDate string) ([]PublicHoliday, error) {
	rows, err := r.db.Query(ctx, `
		SELECT date, name
		FROM public_holidays
		WHERE country_code = $1
		  AND date >= $2::date
		  AND date <= $3::date
		ORDER BY date ASC
	`, countryCode, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var holidays []PublicHoliday
	for rows.Next() {
		var h PublicHoliday
		if err := rows.Scan(&h.Date, &h.Name); err != nil {
			return nil, err
		}
		holidays = append(holidays, h)
	}
	return holidays, rows.Err()
}

// ListActiveEmployees returns active employees for an org (for report generation).
func (r *Repository) ListActiveEmployees(ctx context.Context, orgID uuid.UUID) ([]ActiveEmployee, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, full_name
		FROM employees
		WHERE organisation_id = $1
		  AND is_active = TRUE
		ORDER BY full_name ASC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var emps []ActiveEmployee
	for rows.Next() {
		var e ActiveEmployee
		if err := rows.Scan(&e.ID, &e.FullName); err != nil {
			return nil, err
		}
		emps = append(emps, e)
	}
	return emps, rows.Err()
}

// ListByEmployeeMonth returns attendance records for a single employee in a given month.
func (r *Repository) ListByEmployeeMonth(ctx context.Context, orgID, employeeID uuid.UUID, year, month int) ([]Record, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, employee_id, date,
		       clock_in_at, clock_out_at, is_late, note,
		       created_at, updated_at
		FROM attendance_records
		WHERE organisation_id = $1
		  AND employee_id = $2
		  AND EXTRACT(YEAR FROM date) = $3
		  AND EXTRACT(MONTH FROM date) = $4
		ORDER BY date ASC
	`, orgID, employeeID, year, month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []Record
	for rows.Next() {
		var rec Record
		if err := rows.Scan(
			&rec.ID, &rec.OrganisationID, &rec.EmployeeID, &rec.Date,
			&rec.ClockInAt, &rec.ClockOutAt, &rec.IsLate, &rec.Note,
			&rec.CreatedAt, &rec.UpdatedAt,
		); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, rows.Err()
}

// GetEmployeeName returns the full_name for an employee, scoped to org.
func (r *Repository) GetEmployeeName(ctx context.Context, orgID, employeeID uuid.UUID) (string, error) {
	var name string
	err := r.db.QueryRow(ctx, `
		SELECT full_name FROM employees
		WHERE organisation_id = $1 AND id = $2 AND is_active = TRUE
	`, orgID, employeeID).Scan(&name)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", apperr.NotFound("employee")
		}
		return "", err
	}
	return name, nil
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

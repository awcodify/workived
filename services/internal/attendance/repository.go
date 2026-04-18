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
		SELECT id, organisation_id, employee_id, date::text,
		       clock_in_at, clock_out_at,
		       clock_in_latitude, clock_in_longitude, clock_in_photo_url,
		       clock_out_latitude, clock_out_longitude, clock_out_photo_url,
		       work_location_type, is_late, is_leaving_early, is_overtime, is_corrected, note,
		       created_at, updated_at
		FROM attendance_records
		WHERE organisation_id = $1
		  AND employee_id = $2
		  AND date = $3::date
	`, orgID, employeeID, date).Scan(
		&rec.ID, &rec.OrganisationID, &rec.EmployeeID, &rec.Date,
		&rec.ClockInAt, &rec.ClockOutAt,
		&rec.ClockInLatitude, &rec.ClockInLongitude, &rec.ClockInPhotoURL,
		&rec.ClockOutLatitude, &rec.ClockOutLongitude, &rec.ClockOutPhotoURL,
		&rec.WorkLocationType, &rec.IsLate, &rec.IsLeavingEarly, &rec.IsOvertime, &rec.IsCorrected, &rec.Note,
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
func (r *Repository) Create(ctx context.Context, orgID, employeeID uuid.UUID, date string, clockInAt time.Time, isLate bool, note *string, latitude, longitude *float64, photoURL *string) (*Record, error) {
	rec := &Record{}

	// Determine work location type based on coordinates
	var workLocationType *string
	if latitude != nil && longitude != nil {
		locType := "remote" // Could be enhanced with geofencing logic
		workLocationType = &locType
	}

	err := r.db.QueryRow(ctx, `
		INSERT INTO attendance_records (
			organisation_id, employee_id, date, clock_in_at, is_late, note,
			clock_in_latitude, clock_in_longitude, clock_in_photo_url, work_location_type
		)
		VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, organisation_id, employee_id, date::text,
		          clock_in_at, clock_out_at,
		          clock_in_latitude, clock_in_longitude, clock_in_photo_url,
		          clock_out_latitude, clock_out_longitude, clock_out_photo_url,
		          work_location_type, is_late, is_leaving_early, is_overtime, is_corrected, note,
		          created_at, updated_at
	`, orgID, employeeID, date, clockInAt, isLate, note, latitude, longitude, photoURL, workLocationType).Scan(
		&rec.ID, &rec.OrganisationID, &rec.EmployeeID, &rec.Date,
		&rec.ClockInAt, &rec.ClockOutAt,
		&rec.ClockInLatitude, &rec.ClockInLongitude, &rec.ClockInPhotoURL,
		&rec.ClockOutLatitude, &rec.ClockOutLongitude, &rec.ClockOutPhotoURL,
		&rec.WorkLocationType, &rec.IsLate, &rec.IsLeavingEarly, &rec.IsOvertime, &rec.IsCorrected, &rec.Note,
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
func (r *Repository) UpdateClockOut(ctx context.Context, orgID, employeeID uuid.UUID, date string, clockOutAt time.Time, isLeavingEarly, isOvertime bool, note *string, latitude, longitude *float64, photoURL *string) (*Record, error) {
	rec := &Record{}
	err := r.db.QueryRow(ctx, `
		UPDATE attendance_records
		SET clock_out_at      = $4,
		    is_leaving_early  = $5,
		    is_overtime       = $6,
		    note = COALESCE($7, note),
		    clock_out_latitude  = $8,
		    clock_out_longitude = $9,
		    clock_out_photo_url = $10
		WHERE organisation_id = $1
		  AND employee_id = $2
		  AND date = $3::date
		RETURNING id, organisation_id, employee_id, date::text,
		          clock_in_at, clock_out_at,
		          clock_in_latitude, clock_in_longitude, clock_in_photo_url,
		          clock_out_latitude, clock_out_longitude, clock_out_photo_url,
		          work_location_type, is_late, is_leaving_early, is_overtime, is_corrected, note,
		          created_at, updated_at
	`, orgID, employeeID, date, clockOutAt, isLeavingEarly, isOvertime, note, latitude, longitude, photoURL).Scan(
		&rec.ID, &rec.OrganisationID, &rec.EmployeeID, &rec.Date,
		&rec.ClockInAt, &rec.ClockOutAt,
		&rec.ClockInLatitude, &rec.ClockInLongitude, &rec.ClockInPhotoURL,
		&rec.ClockOutLatitude, &rec.ClockOutLongitude, &rec.ClockOutPhotoURL,
		&rec.WorkLocationType, &rec.IsLate, &rec.IsLeavingEarly, &rec.IsOvertime, &rec.IsCorrected, &rec.Note,
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
		SELECT id, organisation_id, employee_id, date::text,
		       clock_in_at, clock_out_at, is_late, is_leaving_early, is_overtime, is_corrected, note,
		       clock_in_latitude, clock_in_longitude, clock_in_photo_url, work_location_type,
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
			&rec.ClockInAt, &rec.ClockOutAt, &rec.IsLate, &rec.IsLeavingEarly, &rec.IsOvertime, &rec.IsCorrected, &rec.Note,
			&rec.ClockInLatitude, &rec.ClockInLongitude, &rec.ClockInPhotoURL, &rec.WorkLocationType,
			&rec.CreatedAt, &rec.UpdatedAt,
		); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, rows.Err()
}

// GetLocationCounts returns per-location-type clock-in counts for a date range.
func (r *Repository) GetLocationCounts(ctx context.Context, orgID uuid.UUID, startDate, endDate string) (map[string]int, error) {
	rows, err := r.db.Query(ctx, `
		SELECT COALESCE(work_location_type, 'unknown') AS loc, COUNT(*) AS cnt
		FROM attendance_records
		WHERE organisation_id = $1
		  AND date >= $2::date
		  AND date <= $3::date
		GROUP BY loc
	`, orgID, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := make(map[string]int)
	for rows.Next() {
		var loc string
		var cnt int
		if err := rows.Scan(&loc, &cnt); err != nil {
			return nil, err
		}
		counts[loc] = cnt
	}
	return counts, rows.Err()
}

// ListByMonth returns all attendance records for an org in a given month.
func (r *Repository) ListByMonth(ctx context.Context, orgID uuid.UUID, year, month int) ([]Record, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, employee_id, date::text,
		       clock_in_at, clock_out_at, is_late, is_leaving_early, is_overtime, is_corrected, note,
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
			&rec.ClockInAt, &rec.ClockOutAt, &rec.IsLate, &rec.IsLeavingEarly, &rec.IsOvertime, &rec.IsCorrected, &rec.Note,
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
		SELECT work_days, start_time, end_time
		FROM work_schedules
		WHERE organisation_id = $1
		  AND is_default = TRUE
		  AND is_active = TRUE
		LIMIT 1
	`, orgID).Scan(&ws.WorkDays, &ws.StartTime, &ws.EndTime)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return ws, nil
}

// GetScheduleForEmployee resolves the work schedule for an employee.
// Resolution order: employee.work_schedule_id → org default (is_default = TRUE).
// Returns nil, nil if no schedule is found.
func (r *Repository) GetScheduleForEmployee(ctx context.Context, orgID, employeeID uuid.UUID) (*WorkSchedule, error) {
	ws := &WorkSchedule{}
	err := r.db.QueryRow(ctx, `
		SELECT ws.work_days, ws.start_time, ws.end_time
		FROM employees e
		JOIN work_schedules ws
		  ON ws.organisation_id = $1
		  AND ws.is_active = TRUE
		  AND ws.id = COALESCE(e.work_schedule_id,
		      (SELECT id FROM work_schedules WHERE organisation_id = $1 AND is_default = TRUE AND is_active = TRUE LIMIT 1))
		WHERE e.organisation_id = $1 AND e.id = $2
	`, orgID, employeeID).Scan(&ws.WorkDays, &ws.StartTime, &ws.EndTime)
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
		SELECT date::text, name
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

// ListActiveEmployees returns active employees for an org on a given date.
// Only includes employees whose start_date is on or before the given date.
func (r *Repository) ListActiveEmployees(ctx context.Context, orgID uuid.UUID, date string) ([]ActiveEmployee, error) {
	rows, err := r.db.Query(ctx, `
		SELECT e.id, e.full_name, COALESCE(ws.name, dws.name) AS work_schedule_name
		FROM employees e
		LEFT JOIN work_schedules ws ON e.work_schedule_id = ws.id AND ws.is_active = TRUE
		LEFT JOIN work_schedules dws ON dws.organisation_id = e.organisation_id AND dws.is_default = TRUE AND dws.is_active = TRUE
		WHERE e.organisation_id = $1
		  AND e.is_active = TRUE
		  AND e.start_date <= $2::date
		ORDER BY e.full_name ASC
	`, orgID, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var emps []ActiveEmployee
	for rows.Next() {
		var e ActiveEmployee
		if err := rows.Scan(&e.ID, &e.FullName, &e.WorkScheduleName); err != nil {
			return nil, err
		}
		emps = append(emps, e)
	}
	return emps, rows.Err()
}

// ListByEmployeeMonth returns attendance records for a single employee in a given month.
func (r *Repository) ListByEmployeeMonth(ctx context.Context, orgID, employeeID uuid.UUID, year, month int) ([]Record, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, employee_id, date::text,
		       clock_in_at, clock_out_at, is_late, is_leaving_early, is_overtime, is_corrected, note,
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
			&rec.ClockInAt, &rec.ClockOutAt, &rec.IsLate, &rec.IsLeavingEarly, &rec.IsOvertime, &rec.IsCorrected, &rec.Note,
			&rec.CreatedAt, &rec.UpdatedAt,
		); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, rows.Err()
}

// ListByEmployeesDateRange returns attendance records for multiple employees within a date range.
// This is optimized for batch lookups (e.g., team week attendance view).
// startDate and endDate must be in YYYY-MM-DD format.
func (r *Repository) ListByEmployeesDateRange(ctx context.Context, orgID uuid.UUID, employeeIDs []uuid.UUID, startDate, endDate string) ([]Record, error) {
	if len(employeeIDs) == 0 {
		return []Record{}, nil
	}

	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, employee_id, date::text,
		       clock_in_at, clock_out_at, is_late, is_leaving_early, is_overtime, is_corrected, note,
		       created_at, updated_at
		FROM attendance_records
		WHERE organisation_id = $1
		  AND employee_id = ANY($2)
		  AND date >= $3::date
		  AND date <= $4::date
		ORDER BY employee_id, date ASC
	`, orgID, employeeIDs, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []Record
	for rows.Next() {
		var rec Record
		if err := rows.Scan(
			&rec.ID, &rec.OrganisationID, &rec.EmployeeID, &rec.Date,
			&rec.ClockInAt, &rec.ClockOutAt, &rec.IsLate, &rec.IsLeavingEarly, &rec.IsOvertime, &rec.IsCorrected, &rec.Note,
			&rec.CreatedAt, &rec.UpdatedAt,
		); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, rows.Err()
}

// ListWorkSchedules returns all active work schedules for an org.
func (r *Repository) ListWorkSchedules(ctx context.Context, orgID uuid.UUID) ([]WorkScheduleListItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, name, work_days, start_time::text, end_time::text, is_default
		FROM work_schedules
		WHERE organisation_id = $1
		  AND is_active = TRUE
		ORDER BY is_default DESC, name ASC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schedules []WorkScheduleListItem
	for rows.Next() {
		var s WorkScheduleListItem
		if err := rows.Scan(&s.ID, &s.Name, &s.WorkDays, &s.StartTime, &s.EndTime, &s.IsDefault); err != nil {
			return nil, err
		}
		schedules = append(schedules, s)
	}
	return schedules, rows.Err()
}

// CreateWorkSchedule inserts a new work schedule.
func (r *Repository) CreateWorkSchedule(ctx context.Context, orgID uuid.UUID, req CreateWorkScheduleRequest) (*WorkScheduleListItem, error) {
	ws := &WorkScheduleListItem{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO work_schedules (organisation_id, name, work_days, start_time, end_time)
		VALUES ($1, $2, $3, $4::TIME, $5::TIME)
		RETURNING id, name, work_days, start_time::text, end_time::text, is_default
	`, orgID, req.Name, req.WorkDays, req.StartTime, req.EndTime).Scan(
		&ws.ID, &ws.Name, &ws.WorkDays, &ws.StartTime, &ws.EndTime, &ws.IsDefault,
	)
	if err != nil {
		return nil, err
	}
	return ws, nil
}

// UpdateWorkSchedule updates an existing work schedule.
func (r *Repository) UpdateWorkSchedule(ctx context.Context, orgID, scheduleID uuid.UUID, req UpdateWorkScheduleRequest) (*WorkScheduleListItem, error) {
	ws := &WorkScheduleListItem{}
	err := r.db.QueryRow(ctx, `
		UPDATE work_schedules
		SET name = $3, work_days = $4, start_time = $5::TIME, end_time = $6::TIME, updated_at = NOW()
		WHERE organisation_id = $1 AND id = $2 AND is_active = TRUE
		RETURNING id, name, work_days, start_time::text, end_time::text, is_default
	`, orgID, scheduleID, req.Name, req.WorkDays, req.StartTime, req.EndTime).Scan(
		&ws.ID, &ws.Name, &ws.WorkDays, &ws.StartTime, &ws.EndTime, &ws.IsDefault,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("work schedule")
		}
		return nil, err
	}
	return ws, nil
}

// DeactivateWorkSchedule soft-deletes a work schedule.
func (r *Repository) DeactivateWorkSchedule(ctx context.Context, orgID, scheduleID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE work_schedules
		SET is_active = FALSE, updated_at = NOW()
		WHERE organisation_id = $1 AND id = $2 AND is_active = TRUE
	`, orgID, scheduleID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("work schedule")
	}
	return nil
}

// IsDefaultSchedule checks if a schedule is the org default.
func (r *Repository) IsDefaultSchedule(ctx context.Context, orgID, scheduleID uuid.UUID) (bool, error) {
	var isDefault bool
	err := r.db.QueryRow(ctx, `
		SELECT is_default FROM work_schedules
		WHERE organisation_id = $1 AND id = $2 AND is_active = TRUE
	`, orgID, scheduleID).Scan(&isDefault)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, apperr.NotFound("work schedule")
		}
		return false, err
	}
	return isDefault, nil
}

// CountEmployeesBySchedule returns the number of employees assigned to a schedule.
func (r *Repository) CountEmployeesBySchedule(ctx context.Context, orgID, scheduleID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM employees
		WHERE organisation_id = $1 AND work_schedule_id = $2 AND is_active = TRUE
	`, orgID, scheduleID).Scan(&count)
	return count, err
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

// ── Corrections ───────────────────────────────────────────────────────────────

const correctionSelectCols = `
    c.id, c.organisation_id, c.employee_id,
    COALESCE(e.full_name, '') AS employee_name,
    c.record_id, c.date::text,
    c.original_clock_in, c.original_clock_out,
    c.requested_clock_in, c.requested_clock_out,
    c.reason, c.status,
    c.reviewed_by, c.reviewed_at, c.rejection_reason,
    c.created_at, c.updated_at`

func scanCorrection(row interface {
	Scan(dest ...any) error
}) (*Correction, error) {
	c := &Correction{}
	err := row.Scan(
		&c.ID, &c.OrganisationID, &c.EmployeeID,
		&c.EmployeeName,
		&c.RecordID, &c.Date,
		&c.OriginalClockIn, &c.OriginalClockOut,
		&c.RequestedClockIn, &c.RequestedClockOut,
		&c.Reason, &c.Status,
		&c.ReviewedBy, &c.ReviewedAt, &c.RejectionReason,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return c, nil
}

// CreateCorrection inserts a new correction request.
func (r *Repository) CreateCorrection(ctx context.Context, orgID, employeeID uuid.UUID, date string, recordID *uuid.UUID, origIn, origOut, reqIn, reqOut *time.Time, reason string) (*Correction, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO attendance_corrections
		    (organisation_id, employee_id, record_id, date,
		     original_clock_in, original_clock_out,
		     requested_clock_in, requested_clock_out, reason)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, organisation_id, employee_id,
		    (SELECT full_name FROM employees WHERE id = $2),
		    record_id, date::text,
		    original_clock_in, original_clock_out,
		    requested_clock_in, requested_clock_out,
		    reason, status,
		    reviewed_by, reviewed_at, rejection_reason,
		    created_at, updated_at
	`, orgID, employeeID, recordID, date, origIn, origOut, reqIn, reqOut, reason)
	return scanCorrection(row)
}

// GetCorrection returns a single correction by ID, scoped to org.
func (r *Repository) GetCorrection(ctx context.Context, orgID, correctionID uuid.UUID) (*Correction, error) {
	row := r.db.QueryRow(ctx, `
		SELECT `+correctionSelectCols+`
		FROM attendance_corrections c
		LEFT JOIN employees e ON e.id = c.employee_id
		WHERE c.organisation_id = $1 AND c.id = $2
	`, orgID, correctionID)
	c, err := scanCorrection(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("attendance correction")
	}
	return c, err
}

// ListCorrections returns corrections for an org, optionally filtered by status/employee.
func (r *Repository) ListCorrections(ctx context.Context, orgID uuid.UUID, f ListCorrectionsFilter) ([]Correction, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+correctionSelectCols+`
		FROM attendance_corrections c
		LEFT JOIN employees e ON e.id = c.employee_id
		WHERE c.organisation_id = $1
		  AND ($2::varchar IS NULL OR c.status = $2)
		  AND ($3::uuid IS NULL OR c.employee_id = $3)
		ORDER BY c.created_at DESC
		LIMIT 200
	`, orgID, nullableStr(f.Status), f.EmployeeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Correction
	for rows.Next() {
		c, err := scanCorrection(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

// ApproveCorrection sets status=approved and records reviewer.
func (r *Repository) ApproveCorrection(ctx context.Context, orgID, correctionID, reviewerID uuid.UUID, now time.Time) (*Correction, error) {
	row := r.db.QueryRow(ctx, `
		UPDATE attendance_corrections SET
		    status = 'approved',
		    reviewed_by = $3,
		    reviewed_at = $4,
		    updated_at = $4
		WHERE organisation_id = $1 AND id = $2 AND status = 'pending'
		RETURNING id, organisation_id, employee_id,
		    (SELECT full_name FROM employees WHERE id = employee_id),
		    record_id, date::text,
		    original_clock_in, original_clock_out,
		    requested_clock_in, requested_clock_out,
		    reason, status,
		    reviewed_by, reviewed_at, rejection_reason,
		    created_at, updated_at
	`, orgID, correctionID, reviewerID, now)
	c, err := scanCorrection(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeConflict, "correction is not pending or does not exist")
	}
	return c, err
}

// RejectCorrection sets status=rejected and records reviewer + reason.
func (r *Repository) RejectCorrection(ctx context.Context, orgID, correctionID, reviewerID uuid.UUID, rejectionReason *string, now time.Time) (*Correction, error) {
	row := r.db.QueryRow(ctx, `
		UPDATE attendance_corrections SET
		    status = 'rejected',
		    reviewed_by = $3,
		    reviewed_at = $4,
		    rejection_reason = $5,
		    updated_at = $4
		WHERE organisation_id = $1 AND id = $2 AND status = 'pending'
		RETURNING id, organisation_id, employee_id,
		    (SELECT full_name FROM employees WHERE id = employee_id),
		    record_id, date::text,
		    original_clock_in, original_clock_out,
		    requested_clock_in, requested_clock_out,
		    reason, status,
		    reviewed_by, reviewed_at, rejection_reason,
		    created_at, updated_at
	`, orgID, correctionID, reviewerID, now, rejectionReason)
	c, err := scanCorrection(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeConflict, "correction is not pending or does not exist")
	}
	return c, err
}

// ApplyCorrection updates the attendance_record with the corrected times.
func (r *Repository) ApplyCorrection(ctx context.Context, orgID uuid.UUID, recordID uuid.UUID, clockIn, clockOut *time.Time) error {
	_, err := r.db.Exec(ctx, `
		UPDATE attendance_records SET
		    clock_in_at  = COALESCE($3, clock_in_at),
		    clock_out_at = $4,
		    is_corrected = TRUE,
		    updated_at   = NOW()
		WHERE organisation_id = $1 AND id = $2
	`, orgID, recordID, clockIn, clockOut)
	return err
}

func nullableStr(s string) *string {
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

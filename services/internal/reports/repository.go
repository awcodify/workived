package reports

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/workived/services/pkg/apperr"
)

// RepositoryInterface defines all data-access methods the reports service needs.
type RepositoryInterface interface {
	// Config CRUD
	GetConfig(ctx context.Context, orgID uuid.UUID) (*ScorecardConfig, error)
	UpsertConfig(ctx context.Context, orgID uuid.UUID, input ConfigUpdateInput) (*ScorecardConfig, error)

	// Employee listing
	ListActiveEmployees(ctx context.Context, orgID uuid.UUID, asOfDate string) ([]EmployeeBasic, error)

	// Aggregate stats for a single employee in a date range
	GetAttendanceStats(ctx context.Context, orgID, employeeID uuid.UUID, startDate, endDate string) (*AttendanceStats, error)
	GetPunctualityStats(ctx context.Context, orgID, employeeID uuid.UUID, startDate, endDate string) (*PunctualityStats, error)
	GetLeaveStats(ctx context.Context, orgID, employeeID uuid.UUID, startDate, endDate, year string) (*LeaveStats, error)
	GetTaskStats(ctx context.Context, orgID, employeeID uuid.UUID, startDate, endDate string) (*TaskStats, error)
	GetClaimStats(ctx context.Context, orgID, employeeID uuid.UUID, startDate, endDate string) (*ClaimStats, error)

	// Org timezone
	GetOrgTimezone(ctx context.Context, orgID uuid.UUID) (string, error)
}

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// ── Config CRUD ────────────────────────────────────────────────────────────

func (r *Repository) GetConfig(ctx context.Context, orgID uuid.UUID) (*ScorecardConfig, error) {
	cfg := &ScorecardConfig{}
	err := r.db.QueryRow(ctx, `
		SELECT id, organisation_id,
		       attendance_weight, punctuality_weight, leave_weight, tasks_weight, claims_weight,
		       grade_a_min, grade_b_min, grade_c_min,
		       late_flag_threshold, leave_warning_pct, task_concern_pct, score_drop_threshold,
		       min_working_days, is_active, created_at, updated_at
		FROM scorecard_config
		WHERE organisation_id = $1
	`, orgID).Scan(
		&cfg.ID, &cfg.OrganisationID,
		&cfg.AttendanceWeight, &cfg.PunctualityWeight, &cfg.LeaveWeight, &cfg.TasksWeight, &cfg.ClaimsWeight,
		&cfg.GradeAMin, &cfg.GradeBMin, &cfg.GradeCMin,
		&cfg.LateFlagThreshold, &cfg.LeaveWarningPct, &cfg.TaskConcernPct, &cfg.ScoreDropThreshold,
		&cfg.MinWorkingDays, &cfg.IsActive, &cfg.CreatedAt, &cfg.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.NotFound("scorecard_config")
	}
	if err != nil {
		return nil, err
	}
	return cfg, nil
}

func (r *Repository) UpsertConfig(ctx context.Context, orgID uuid.UUID, input ConfigUpdateInput) (*ScorecardConfig, error) {
	cfg := &ScorecardConfig{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO scorecard_config (
			organisation_id,
			attendance_weight, punctuality_weight, leave_weight, tasks_weight, claims_weight,
			grade_a_min, grade_b_min, grade_c_min,
			late_flag_threshold, leave_warning_pct, task_concern_pct, score_drop_threshold,
			min_working_days
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		ON CONFLICT (organisation_id) DO UPDATE SET
			attendance_weight   = EXCLUDED.attendance_weight,
			punctuality_weight  = EXCLUDED.punctuality_weight,
			leave_weight        = EXCLUDED.leave_weight,
			tasks_weight        = EXCLUDED.tasks_weight,
			claims_weight       = EXCLUDED.claims_weight,
			grade_a_min         = EXCLUDED.grade_a_min,
			grade_b_min         = EXCLUDED.grade_b_min,
			grade_c_min         = EXCLUDED.grade_c_min,
			late_flag_threshold  = EXCLUDED.late_flag_threshold,
			leave_warning_pct    = EXCLUDED.leave_warning_pct,
			task_concern_pct     = EXCLUDED.task_concern_pct,
			score_drop_threshold = EXCLUDED.score_drop_threshold,
			min_working_days     = EXCLUDED.min_working_days
		RETURNING id, organisation_id,
		          attendance_weight, punctuality_weight, leave_weight, tasks_weight, claims_weight,
		          grade_a_min, grade_b_min, grade_c_min,
		          late_flag_threshold, leave_warning_pct, task_concern_pct, score_drop_threshold,
		          min_working_days, is_active, created_at, updated_at
	`, orgID,
		input.AttendanceWeight, input.PunctualityWeight, input.LeaveWeight, input.TasksWeight, input.ClaimsWeight,
		input.GradeAMin, input.GradeBMin, input.GradeCMin,
		input.LateFlagThreshold, input.LeaveWarningPct, input.TaskConcernPct, input.ScoreDropThreshold,
		input.MinWorkingDays,
	).Scan(
		&cfg.ID, &cfg.OrganisationID,
		&cfg.AttendanceWeight, &cfg.PunctualityWeight, &cfg.LeaveWeight, &cfg.TasksWeight, &cfg.ClaimsWeight,
		&cfg.GradeAMin, &cfg.GradeBMin, &cfg.GradeCMin,
		&cfg.LateFlagThreshold, &cfg.LeaveWarningPct, &cfg.TaskConcernPct, &cfg.ScoreDropThreshold,
		&cfg.MinWorkingDays, &cfg.IsActive, &cfg.CreatedAt, &cfg.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return cfg, nil
}

// ── Employee listing ───────────────────────────────────────────────────────

func (r *Repository) ListActiveEmployees(ctx context.Context, orgID uuid.UUID, asOfDate string) ([]EmployeeBasic, error) {
	rows, err := r.db.Query(ctx, `
		SELECT e.id, e.full_name, COALESCE(d.name, '') AS department
		FROM employees e
		LEFT JOIN departments d ON e.department_id = d.id
		WHERE e.organisation_id = $1
		  AND e.is_active = TRUE
		  AND e.start_date <= $2::date
		ORDER BY e.full_name ASC
	`, orgID, asOfDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var employees []EmployeeBasic
	for rows.Next() {
		var eb EmployeeBasic
		if err := rows.Scan(&eb.ID, &eb.Name, &eb.Department); err != nil {
			return nil, err
		}
		employees = append(employees, eb)
	}
	return employees, rows.Err()
}

// ── Aggregate stats ────────────────────────────────────────────────────────

func (r *Repository) GetAttendanceStats(ctx context.Context, orgID, employeeID uuid.UUID, startDate, endDate string) (*AttendanceStats, error) {
	stats := &AttendanceStats{}
	// DaysPresent = rows in attendance_records (each row = employee showed up that day)
	// WorkingDays = business days derived from the date range (simplified: count rows expected)
	// For now, WorkingDays counts weekdays in range; DaysPresent counts actual records.
	err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(*)::int AS days_present,
			(
				SELECT COUNT(*)::int
				FROM generate_series($3::date, $4::date, '1 day'::interval) d
				WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
			) AS working_days
		FROM attendance_records
		WHERE organisation_id = $1
		  AND employee_id = $2
		  AND date >= $3::date
		  AND date <= $4::date
	`, orgID, employeeID, startDate, endDate).Scan(&stats.DaysPresent, &stats.WorkingDays)
	if err != nil {
		return nil, err
	}
	return stats, nil
}

func (r *Repository) GetPunctualityStats(ctx context.Context, orgID, employeeID uuid.UUID, startDate, endDate string) (*PunctualityStats, error) {
	stats := &PunctualityStats{}
	err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE is_late = FALSE)::int AS on_time_count,
			COUNT(*) FILTER (WHERE is_late = TRUE)::int  AS late_count,
			COUNT(*)::int                                 AS total_present
		FROM attendance_records
		WHERE organisation_id = $1
		  AND employee_id = $2
		  AND date >= $3::date
		  AND date <= $4::date
	`, orgID, employeeID, startDate, endDate).Scan(&stats.OnTimeCount, &stats.LateCount, &stats.TotalPresent)
	if err != nil {
		return nil, err
	}
	return stats, nil
}

func (r *Repository) GetLeaveStats(ctx context.Context, orgID, employeeID uuid.UUID, startDate, endDate, year string) (*LeaveStats, error) {
	stats := &LeaveStats{}
	err := r.db.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(lr.total_days), 0)::float8 AS days_taken,
			COALESCE((
				SELECT SUM(lb.entitled_days + lb.carried_over_days)::float8
				FROM leave_balances lb
				WHERE lb.organisation_id = $1
				  AND lb.employee_id = $2
				  AND lb.year = $5::int
			), 0) AS days_entitled,
			COUNT(*) FILTER (
				WHERE lr.created_at::date >= (lr.start_date - INTERVAL '2 days')::date
			)::int AS short_notice_count
		FROM leave_requests lr
		WHERE lr.organisation_id = $1
		  AND lr.employee_id = $2
		  AND lr.status = 'approved'
		  AND lr.start_date <= $4::date
		  AND lr.end_date >= $3::date
	`, orgID, employeeID, startDate, endDate, year).Scan(
		&stats.DaysTaken, &stats.DaysEntitled, &stats.ShortNoticeCount,
	)
	if err != nil {
		return nil, err
	}
	return stats, nil
}

func (r *Repository) GetTaskStats(ctx context.Context, orgID, employeeID uuid.UUID, startDate, endDate string) (*TaskStats, error) {
	stats := &TaskStats{}
	err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(*)::int AS total_assigned,
			COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::int AS completed,
			COUNT(*) FILTER (
				WHERE completed_at IS NOT NULL
				  AND (due_date IS NULL OR completed_at::date <= due_date)
			)::int AS completed_on_time
		FROM tasks
		WHERE organisation_id = $1
		  AND assignee_id = $2
		  AND created_at >= $3::timestamptz
		  AND created_at <= ($4::date + INTERVAL '1 day')::timestamptz
	`, orgID, employeeID, startDate, endDate).Scan(
		&stats.TotalAssigned, &stats.Completed, &stats.CompletedOnTime,
	)
	if err != nil {
		return nil, err
	}
	return stats, nil
}

func (r *Repository) GetClaimStats(ctx context.Context, orgID, employeeID uuid.UUID, startDate, endDate string) (*ClaimStats, error) {
	stats := &ClaimStats{}
	err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(*)::int AS total_claims,
			0::int AS over_budget_count,
			COUNT(*) FILTER (WHERE receipt_url IS NULL OR receipt_url = '')::int AS missing_receipt_count
		FROM claims
		WHERE organisation_id = $1
		  AND employee_id = $2
		  AND claim_date >= $3::date
		  AND claim_date <= $4::date
		  AND status IN ('pending', 'approved', 'paid')
	`, orgID, employeeID, startDate, endDate).Scan(
		&stats.TotalClaims, &stats.OverBudgetCount, &stats.MissingReceiptCount,
	)
	if err != nil {
		return nil, err
	}
	return stats, nil
}

// ── Org timezone ───────────────────────────────────────────────────────────

func (r *Repository) GetOrgTimezone(ctx context.Context, orgID uuid.UUID) (string, error) {
	var tz string
	err := r.db.QueryRow(ctx, `
		SELECT timezone FROM organisations WHERE id = $1
	`, orgID).Scan(&tz)
	if errors.Is(err, pgx.ErrNoRows) {
		return "UTC", nil
	}
	if err != nil {
		return "", err
	}
	return tz, nil
}

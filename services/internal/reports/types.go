package reports

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// ── Scorecard config (per-org, stored in DB) ────────────────────────────────

type ScorecardConfig struct {
	ID             uuid.UUID `json:"id"`
	OrganisationID uuid.UUID `json:"organisation_id"`

	// Weights (sum to 100)
	AttendanceWeight  int `json:"attendance_weight"`
	PunctualityWeight int `json:"punctuality_weight"`
	LeaveWeight       int `json:"leave_weight"`
	TasksWeight       int `json:"tasks_weight"`
	ClaimsWeight      int `json:"claims_weight"`

	// Grade thresholds
	GradeAMin int `json:"grade_a_min"`
	GradeBMin int `json:"grade_b_min"`
	GradeCMin int `json:"grade_c_min"`

	// Flag thresholds
	LateFlagThreshold  int `json:"late_flag_threshold"`
	LeaveWarningPct    int `json:"leave_warning_pct"`
	TaskConcernPct     int `json:"task_concern_pct"`
	ScoreDropThreshold int `json:"score_drop_threshold"`

	MinWorkingDays int       `json:"min_working_days"`
	IsActive       bool      `json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// DefaultConfig returns sensible defaults when no org config row exists.
func DefaultConfig(orgID uuid.UUID) ScorecardConfig {
	return ScorecardConfig{
		OrganisationID:    orgID,
		AttendanceWeight:  25,
		PunctualityWeight: 20,
		LeaveWeight:       15,
		TasksWeight:       25,
		ClaimsWeight:      15,
		GradeAMin:         90,
		GradeBMin:         75,
		GradeCMin:         60,
		LateFlagThreshold:  3,
		LeaveWarningPct:    90,
		TaskConcernPct:     60,
		ScoreDropThreshold: 10,
		MinWorkingDays:     5,
		IsActive:          true,
	}
}

// ConfigUpdateInput is the request payload for updating scorecard config.
type ConfigUpdateInput struct {
	AttendanceWeight  int `json:"attendance_weight" validate:"min=0,max=100"`
	PunctualityWeight int `json:"punctuality_weight" validate:"min=0,max=100"`
	LeaveWeight       int `json:"leave_weight" validate:"min=0,max=100"`
	TasksWeight       int `json:"tasks_weight" validate:"min=0,max=100"`
	ClaimsWeight      int `json:"claims_weight" validate:"min=0,max=100"`

	GradeAMin int `json:"grade_a_min" validate:"min=1,max=100"`
	GradeBMin int `json:"grade_b_min" validate:"min=1,max=100"`
	GradeCMin int `json:"grade_c_min" validate:"min=1,max=100"`

	LateFlagThreshold  int `json:"late_flag_threshold" validate:"min=1"`
	LeaveWarningPct    int `json:"leave_warning_pct" validate:"min=1,max=100"`
	TaskConcernPct     int `json:"task_concern_pct" validate:"min=1,max=100"`
	ScoreDropThreshold int `json:"score_drop_threshold" validate:"min=1"`
	MinWorkingDays     int `json:"min_working_days" validate:"min=1"`
}

// ── Raw stats from aggregate queries ────────────────────────────────────────

type AttendanceStats struct {
	DaysPresent int
	WorkingDays int
}

type PunctualityStats struct {
	OnTimeCount  int
	LateCount    int
	TotalPresent int
}

type LeaveStats struct {
	DaysTaken       float64
	DaysEntitled    float64
	ShortNoticeCount int // requests filed <2 days before start
}

type TaskStats struct {
	TotalAssigned    int
	Completed        int
	CompletedOnTime  int
}

type ClaimStats struct {
	TotalClaims        int
	OverBudgetCount    int
	MissingReceiptCount int
}

// ── Scorecard response types ────────────────────────────────────────────────

type Breakdown struct {
	Score  int    `json:"score"`
	Detail string `json:"detail"`
}

type Flag struct {
	Type     string `json:"type"`
	Message  string `json:"message"`
	Severity string `json:"severity"` // "warning" | "alert"
}

type Scorecard struct {
	EmployeeID   uuid.UUID            `json:"employee_id"`
	EmployeeName string               `json:"employee_name"`
	Department   string               `json:"department"`
	Period       string               `json:"period"`
	PeriodLabel  string               `json:"period_label"`
	StartDate    string               `json:"start_date"`
	EndDate      string               `json:"end_date"`
	OverallScore int                  `json:"overall_score"`
	Grade        string               `json:"grade"`
	Trend        int                  `json:"trend"`
	Breakdown    map[string]Breakdown `json:"breakdown"`
	Flags        []Flag               `json:"flags"`
	Sufficient   bool                 `json:"sufficient"` // false if below min_working_days
}

type EmployeeScore struct {
	EmployeeID       uuid.UUID `json:"employee_id"`
	EmployeeName     string    `json:"employee_name"`
	Department       string    `json:"department"`
	OverallScore     int       `json:"overall_score"`
	Grade            string    `json:"grade"`
	Trend            int       `json:"trend"`
	AttendanceScore  int       `json:"attendance_score"`
	PunctualityScore int       `json:"punctuality_score"`
	LeaveScore       int       `json:"leave_score"`
	TasksScore       int       `json:"tasks_score"`
	ClaimsScore      int       `json:"claims_score"`
}

type TeamScorecard struct {
	Period      string          `json:"period"`
	PeriodLabel string          `json:"period_label"`
	StartDate   string          `json:"start_date"`
	EndDate     string          `json:"end_date"`
	TeamAverage int             `json:"team_average"`
	Employees   []EmployeeScore `json:"employees"`
}

type PerformerHighlight struct {
	EmployeeID uuid.UUID `json:"employee_id"`
	Name       string    `json:"name"`
	Score      int       `json:"score"`
	Trend      int       `json:"trend,omitempty"`
}

type DepartmentBreakdown struct {
	Department    string `json:"department"`
	AvgScore      int    `json:"avg_score"`
	EmployeeCount int    `json:"employee_count"`
}

type CompanySummary struct {
	Period              string                `json:"period"`
	PeriodLabel         string                `json:"period_label"`
	AttendanceRate      float64               `json:"attendance_rate"`
	PunctualityRate     float64               `json:"punctuality_rate"`
	TaskCompletionRate  float64               `json:"task_completion_rate"`
	LeaveUtilization    float64               `json:"leave_utilization"`
	AvgScore            int                   `json:"avg_score"`
	TopPerformer        *PerformerHighlight   `json:"top_performer"`
	MostImproved        *PerformerHighlight   `json:"most_improved"`
	NeedsAttentionCount int                   `json:"needs_attention_count"`
	DepartmentBreakdown []DepartmentBreakdown `json:"department_breakdown"`
}

// ── Employee basic info (from ListActiveEmployees) ──────────────────────────

type EmployeeBasic struct {
	ID         uuid.UUID
	Name       string
	Department string
}

// ── Period helpers ───────────────────────────────────────────────────────────

type Period struct {
	Key       string // "this_month", "this_quarter", "this_year"
	Label     string // "April 2026", "Q2 2026", "2026"
	StartDate string // YYYY-MM-DD
	EndDate   string // YYYY-MM-DD
}

// ParsePeriod converts a period key into concrete date range using the org's timezone.
func ParsePeriod(key string, tz string) (*Period, error) {
	loc, err := time.LoadLocation(tz)
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)

	switch key {
	case "this_month":
		start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
		return &Period{
			Key:       key,
			Label:     now.Format("January 2006"),
			StartDate: start.Format("2006-01-02"),
			EndDate:   now.Format("2006-01-02"),
		}, nil

	case "this_quarter":
		q := (int(now.Month()) - 1) / 3
		startMonth := time.Month(q*3 + 1)
		start := time.Date(now.Year(), startMonth, 1, 0, 0, 0, 0, loc)
		label := fmt.Sprintf("Q%d %d", q+1, now.Year())
		return &Period{
			Key:       key,
			Label:     label,
			StartDate: start.Format("2006-01-02"),
			EndDate:   now.Format("2006-01-02"),
		}, nil

	case "this_year":
		start := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, loc)
		return &Period{
			Key:       key,
			Label:     fmt.Sprintf("%d", now.Year()),
			StartDate: start.Format("2006-01-02"),
			EndDate:   now.Format("2006-01-02"),
		}, nil

	default:
		return nil, fmt.Errorf("invalid period: %s (must be this_month, this_quarter, or this_year)", key)
	}
}

// PreviousPeriod returns the equivalent previous period for trend calculation.
func PreviousPeriod(key string, tz string) (*Period, error) {
	loc, err := time.LoadLocation(tz)
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)

	switch key {
	case "this_month":
		prev := now.AddDate(0, -1, 0)
		start := time.Date(prev.Year(), prev.Month(), 1, 0, 0, 0, 0, loc)
		end := start.AddDate(0, 1, -1)
		return &Period{
			Key:       "previous_month",
			Label:     prev.Format("January 2006"),
			StartDate: start.Format("2006-01-02"),
			EndDate:   end.Format("2006-01-02"),
		}, nil

	case "this_quarter":
		q := (int(now.Month()) - 1) / 3
		prevQ := q - 1
		year := now.Year()
		if prevQ < 0 {
			prevQ = 3
			year--
		}
		startMonth := time.Month(prevQ*3 + 1)
		start := time.Date(year, startMonth, 1, 0, 0, 0, 0, loc)
		end := start.AddDate(0, 3, -1)
		return &Period{
			Key:       "previous_quarter",
			Label:     fmt.Sprintf("Q%d %d", prevQ+1, year),
			StartDate: start.Format("2006-01-02"),
			EndDate:   end.Format("2006-01-02"),
		}, nil

	case "this_year":
		prevYear := now.Year() - 1
		start := time.Date(prevYear, 1, 1, 0, 0, 0, 0, loc)
		end := time.Date(prevYear, 12, 31, 0, 0, 0, 0, loc)
		return &Period{
			Key:       "previous_year",
			Label:     fmt.Sprintf("%d", prevYear),
			StartDate: start.Format("2006-01-02"),
			EndDate:   end.Format("2006-01-02"),
		}, nil

	default:
		return nil, fmt.Errorf("invalid period: %s", key)
	}
}

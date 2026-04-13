package reports

import (
	"context"
	"fmt"
	"math"
	"strconv"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/pkg/apperr"
)

type Service struct {
	repo RepositoryInterface
	log  zerolog.Logger
}

func NewService(repo RepositoryInterface, log zerolog.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// ── Config ─────────────────────────────────────────────────────────────────

// GetConfig returns the org's scorecard config, falling back to defaults.
func (s *Service) GetConfig(ctx context.Context, orgID uuid.UUID) (*ScorecardConfig, error) {
	cfg, err := s.repo.GetConfig(ctx, orgID)
	if err != nil {
		if apperr.IsCode(err, apperr.CodeNotFound) {
			d := DefaultConfig(orgID)
			return &d, nil
		}
		return nil, fmt.Errorf("reports.get_config: %w", err)
	}
	return cfg, nil
}

// UpdateConfig validates and upserts the org's scorecard config.
func (s *Service) UpdateConfig(ctx context.Context, orgID uuid.UUID, input ConfigUpdateInput) (*ScorecardConfig, error) {
	weightSum := input.AttendanceWeight + input.PunctualityWeight + input.LeaveWeight + input.TasksWeight
	if weightSum != 100 {
		return nil, apperr.NewWithDetails(apperr.CodeValidation,
			fmt.Sprintf("weights must sum to 100, got %d", weightSum),
			map[string]any{"weight_sum": weightSum},
		)
	}
	if input.GradeAMin <= input.GradeBMin || input.GradeBMin <= input.GradeCMin || input.GradeCMin <= 0 {
		return nil, apperr.New(apperr.CodeValidation, "grade thresholds must be in descending order: A > B > C > 0")
	}

	cfg, err := s.repo.UpsertConfig(ctx, orgID, input)
	if err != nil {
		return nil, fmt.Errorf("reports.update_config: %w", err)
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("config_id", cfg.ID.String()).
		Msg("reports.config.updated")

	return cfg, nil
}

// ── Individual scorecard ───────────────────────────────────────────────────

// GetEmployeeScorecard computes the full scorecard for a single employee.
func (s *Service) GetEmployeeScorecard(ctx context.Context, orgID, employeeID uuid.UUID, periodKey string) (*Scorecard, error) {
	tz, err := s.repo.GetOrgTimezone(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("reports.get_tz: %w", err)
	}

	period, err := ParsePeriod(periodKey, tz)
	if err != nil {
		return nil, apperr.New(apperr.CodeValidation, err.Error())
	}

	cfg, err := s.GetConfig(ctx, orgID)
	if err != nil {
		return nil, err
	}

	// Find employee info
	employees, err := s.repo.ListActiveEmployees(ctx, orgID, period.EndDate)
	if err != nil {
		return nil, fmt.Errorf("reports.list_employees: %w", err)
	}
	var emp *EmployeeBasic
	for i := range employees {
		if employees[i].ID == employeeID {
			emp = &employees[i]
			break
		}
	}
	if emp == nil {
		return nil, apperr.NotFound("employee")
	}

	sc, err := s.computeScorecard(ctx, orgID, *emp, *cfg, *period)
	if err != nil {
		return nil, err
	}

	// Compute trend from previous period
	prevPeriod, prevErr := PreviousPeriod(periodKey, tz)
	if prevErr == nil {
		prevSc, prevScErr := s.computeScorecard(ctx, orgID, *emp, *cfg, *prevPeriod)
		if prevScErr == nil && prevSc.Sufficient {
			sc.Trend = sc.OverallScore - prevSc.OverallScore
		}
	}

	return sc, nil
}

// ── Team scorecard ─────────────────────────────────────────────────────────

// GetTeamScorecard computes scores for all active employees.
func (s *Service) GetTeamScorecard(ctx context.Context, orgID uuid.UUID, periodKey string) (*TeamScorecard, error) {
	tz, err := s.repo.GetOrgTimezone(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("reports.get_tz: %w", err)
	}

	period, err := ParsePeriod(periodKey, tz)
	if err != nil {
		return nil, apperr.New(apperr.CodeValidation, err.Error())
	}

	cfg, err := s.GetConfig(ctx, orgID)
	if err != nil {
		return nil, err
	}

	employees, err := s.repo.ListActiveEmployees(ctx, orgID, period.EndDate)
	if err != nil {
		return nil, fmt.Errorf("reports.list_employees: %w", err)
	}

	prevPeriod, _ := PreviousPeriod(periodKey, tz)

	var scores []EmployeeScore
	var totalScore int
	var counted int

	for _, emp := range employees {
		sc, scErr := s.computeScorecard(ctx, orgID, emp, *cfg, *period)
		if scErr != nil {
			s.log.Warn().Err(scErr).Str("employee_id", emp.ID.String()).Msg("reports.team.skip_employee")
			continue
		}
		if !sc.Sufficient {
			continue
		}

		trend := 0
		if prevPeriod != nil {
			prevSc, prevErr := s.computeScorecard(ctx, orgID, emp, *cfg, *prevPeriod)
			if prevErr == nil && prevSc.Sufficient {
				trend = sc.OverallScore - prevSc.OverallScore
			}
		}

		scores = append(scores, EmployeeScore{
			EmployeeID:       emp.ID,
			EmployeeName:     emp.Name,
			Department:       emp.Department,
			OverallScore:     sc.OverallScore,
			Grade:            sc.Grade,
			Trend:            trend,
			AttendanceScore:  sc.Breakdown["attendance"].Score,
			PunctualityScore: sc.Breakdown["punctuality"].Score,
			LeaveScore:       sc.Breakdown["leave"].Score,
			TasksScore:       sc.Breakdown["tasks"].Score,
		})
		totalScore += sc.OverallScore
		counted++
	}

	avg := 0
	if counted > 0 {
		avg = int(math.Round(float64(totalScore) / float64(counted)))
	}

	return &TeamScorecard{
		Period:      period.Key,
		PeriodLabel: period.Label,
		StartDate:   period.StartDate,
		EndDate:     period.EndDate,
		TeamAverage: avg,
		Employees:   scores,
	}, nil
}

// ── Company summary ────────────────────────────────────────────────────────

// GetCompanySummary computes high-level org metrics.
func (s *Service) GetCompanySummary(ctx context.Context, orgID uuid.UUID, periodKey string) (*CompanySummary, error) {
	tz, err := s.repo.GetOrgTimezone(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("reports.get_tz: %w", err)
	}

	period, err := ParsePeriod(periodKey, tz)
	if err != nil {
		return nil, apperr.New(apperr.CodeValidation, err.Error())
	}

	cfg, err := s.GetConfig(ctx, orgID)
	if err != nil {
		return nil, err
	}

	employees, err := s.repo.ListActiveEmployees(ctx, orgID, period.EndDate)
	if err != nil {
		return nil, fmt.Errorf("reports.list_employees: %w", err)
	}

	prevPeriod, _ := PreviousPeriod(periodKey, tz)

	var (
		totalAttendanceRate  float64
		totalPunctualityRate float64
		totalTaskRate        float64
		totalLeaveUtil       float64
		totalScore           int
		counted              int
		topPerformer         *PerformerHighlight
		mostImproved         *PerformerHighlight
		needsAttention       int
		deptScores           = make(map[string][]int)
	)

	for _, emp := range employees {
		sc, scErr := s.computeScorecard(ctx, orgID, emp, *cfg, *period)
		if scErr != nil {
			continue
		}
		if !sc.Sufficient {
			continue
		}

		// Accumulate rates from breakdown details
		attStats, _ := s.repo.GetAttendanceStats(ctx, orgID, emp.ID, period.StartDate, period.EndDate)
		punctStats, _ := s.repo.GetPunctualityStats(ctx, orgID, emp.ID, period.StartDate, period.EndDate)
		taskStats, _ := s.repo.GetTaskStats(ctx, orgID, emp.ID, period.StartDate, period.EndDate)
		year := period.StartDate[:4]
		leaveStats, _ := s.repo.GetLeaveStats(ctx, orgID, emp.ID, period.StartDate, period.EndDate, year)

		if attStats != nil && attStats.WorkingDays > 0 {
			totalAttendanceRate += float64(attStats.DaysPresent) / float64(attStats.WorkingDays)
		}
		if punctStats != nil && punctStats.TotalPresent > 0 {
			totalPunctualityRate += float64(punctStats.OnTimeCount) / float64(punctStats.TotalPresent)
		}
		if taskStats != nil && taskStats.TotalAssigned > 0 {
			totalTaskRate += float64(taskStats.Completed) / float64(taskStats.TotalAssigned)
		}
		if leaveStats != nil && leaveStats.DaysEntitled > 0 {
			totalLeaveUtil += leaveStats.DaysTaken / leaveStats.DaysEntitled
		}

		totalScore += sc.OverallScore
		counted++

		// Track top performer
		if topPerformer == nil || sc.OverallScore > topPerformer.Score {
			topPerformer = &PerformerHighlight{EmployeeID: emp.ID, Name: emp.Name, Score: sc.OverallScore}
		}

		// Track trend for most improved
		if prevPeriod != nil {
			prevSc, prevErr := s.computeScorecard(ctx, orgID, emp, *cfg, *prevPeriod)
			if prevErr == nil && prevSc.Sufficient {
				trend := sc.OverallScore - prevSc.OverallScore
				if mostImproved == nil || trend > mostImproved.Trend {
					mostImproved = &PerformerHighlight{EmployeeID: emp.ID, Name: emp.Name, Score: sc.OverallScore, Trend: trend}
				}
			}
		}

		// Needs attention = grade D
		if sc.Grade == "D" {
			needsAttention++
		}

		// Department breakdown
		dept := emp.Department
		if dept == "" {
			dept = "Unassigned"
		}
		deptScores[dept] = append(deptScores[dept], sc.OverallScore)
	}

	var deptBreakdown []DepartmentBreakdown
	for dept, scores := range deptScores {
		sum := 0
		for _, s := range scores {
			sum += s
		}
		deptBreakdown = append(deptBreakdown, DepartmentBreakdown{
			Department:    dept,
			AvgScore:      int(math.Round(float64(sum) / float64(len(scores)))),
			EmployeeCount: len(scores),
		})
	}

	summary := &CompanySummary{
		Period:              period.Key,
		PeriodLabel:         period.Label,
		AvgScore:            0,
		TopPerformer:        topPerformer,
		MostImproved:        mostImproved,
		NeedsAttentionCount: needsAttention,
		DepartmentBreakdown: deptBreakdown,
	}

	if counted > 0 {
		summary.AvgScore = int(math.Round(float64(totalScore) / float64(counted)))
		summary.AttendanceRate = math.Round(totalAttendanceRate/float64(counted)*1000) / 10
		summary.PunctualityRate = math.Round(totalPunctualityRate/float64(counted)*1000) / 10
		summary.TaskCompletionRate = math.Round(totalTaskRate/float64(counted)*1000) / 10
		summary.LeaveUtilization = math.Round(totalLeaveUtil/float64(counted)*1000) / 10
	}

	return summary, nil
}

// ── Scoring engine ─────────────────────────────────────────────────────────

func (s *Service) computeScorecard(ctx context.Context, orgID uuid.UUID, emp EmployeeBasic, cfg ScorecardConfig, period Period) (*Scorecard, error) {
	year := period.StartDate[:4]

	attStats, err := s.repo.GetAttendanceStats(ctx, orgID, emp.ID, period.StartDate, period.EndDate)
	if err != nil {
		return nil, fmt.Errorf("reports.attendance_stats: %w", err)
	}

	punctStats, err := s.repo.GetPunctualityStats(ctx, orgID, emp.ID, period.StartDate, period.EndDate)
	if err != nil {
		return nil, fmt.Errorf("reports.punctuality_stats: %w", err)
	}

	leaveStats, err := s.repo.GetLeaveStats(ctx, orgID, emp.ID, period.StartDate, period.EndDate, year)
	if err != nil {
		return nil, fmt.Errorf("reports.leave_stats: %w", err)
	}

	taskStats, err := s.repo.GetTaskStats(ctx, orgID, emp.ID, period.StartDate, period.EndDate)
	if err != nil {
		return nil, fmt.Errorf("reports.task_stats: %w", err)
	}

	// Check sufficiency
	sufficient := attStats.WorkingDays >= cfg.MinWorkingDays

	// Compute component scores (0-100)
	attScore := scoreAttendance(attStats)
	punctScore := scorePunctuality(punctStats)
	leaveScore := scoreLeave(leaveStats)
	taskScore := scoreTasks(taskStats)

	// Weighted overall — redistribute weight away from signals with no data.
	// A signal is excluded when there's nothing to measure (no working days,
	// never clocked in, no tasks assigned, no leave balance). Its weight is
	// shared proportionally among the remaining active signals.
	type scoredSignal struct {
		score  int
		weight int
		active bool
	}
	scoredSignals := []scoredSignal{
		{attScore, cfg.AttendanceWeight, attStats.WorkingDays > 0},
		{punctScore, cfg.PunctualityWeight, punctStats.TotalPresent > 0},
		{leaveScore, cfg.LeaveWeight, leaveStats.DaysEntitled > 0},
		{taskScore, cfg.TasksWeight, taskStats.TotalAssigned > 0},
	}

	activeWeight := 0
	weightedSum := 0
	for _, sig := range scoredSignals {
		if sig.active {
			activeWeight += sig.weight
			weightedSum += sig.score * sig.weight
		}
	}

	var overall int
	if activeWeight > 0 {
		overall = int(math.Round(float64(weightedSum) / float64(activeWeight)))
	}

	grade := assignGrade(overall, cfg)
	flags := generateFlags(cfg, punctStats, leaveStats, taskStats)

	breakdown := map[string]Breakdown{
		"attendance": {
			Score:  attScore,
			Detail: fmt.Sprintf("%d/%d days present", attStats.DaysPresent, attStats.WorkingDays),
		},
		"punctuality": {
			Score:  punctScore,
			Detail: fmt.Sprintf("%d on-time, %d late out of %d", punctStats.OnTimeCount, punctStats.LateCount, punctStats.TotalPresent),
		},
		"leave": {
			Score:  leaveScore,
			Detail: fmt.Sprintf("%.1f/%.1f days used, %d short-notice", leaveStats.DaysTaken, leaveStats.DaysEntitled, leaveStats.ShortNoticeCount),
		},
		"tasks": {
			Score:  taskScore,
			Detail: fmt.Sprintf("%d/%d completed (%d on-time)", taskStats.Completed, taskStats.TotalAssigned, taskStats.CompletedOnTime),
		},
	}

	return &Scorecard{
		EmployeeID:   emp.ID,
		EmployeeName: emp.Name,
		Department:   emp.Department,
		Period:       period.Key,
		PeriodLabel:  period.Label,
		StartDate:    period.StartDate,
		EndDate:      period.EndDate,
		OverallScore: overall,
		Grade:        grade,
		Breakdown:    breakdown,
		Flags:        flags,
		Sufficient:   sufficient,
	}, nil
}

// ── Component scoring functions ────────────────────────────────────────────

// scoreAttendance: 100 * (days_present / working_days)
func scoreAttendance(s *AttendanceStats) int {
	if s.WorkingDays == 0 {
		return 0 // no working days recorded — signal excluded from weighting
	}
	score := float64(s.DaysPresent) / float64(s.WorkingDays) * 100
	return clampScore(score)
}

// scorePunctuality: 100 * (on_time / total_present)
func scorePunctuality(s *PunctualityStats) int {
	if s.TotalPresent == 0 {
		return 0 // never clocked in — signal excluded from weighting
	}
	score := float64(s.OnTimeCount) / float64(s.TotalPresent) * 100
	return clampScore(score)
}

// scoreLeave: penalise short-notice requests only.
// Leave utilisation is not penalised — employees are entitled to their leave.
// Base: 100 - (short_notice_count * 10)
func scoreLeave(s *LeaveStats) int {
	if s.DaysEntitled == 0 {
		return 0 // no leave balance assigned — signal excluded from weighting
	}
	score := 100.0 - float64(s.ShortNoticeCount)*10
	return clampScore(score)
}

// scoreTasks: weighted blend of completion rate (70%) and on-time rate (30%).
func scoreTasks(s *TaskStats) int {
	if s.TotalAssigned == 0 {
		return 0 // no tasks assigned — signal excluded from weighting
	}
	completionRate := float64(s.Completed) / float64(s.TotalAssigned) * 100
	onTimeRate := 0.0
	if s.Completed > 0 {
		onTimeRate = float64(s.CompletedOnTime) / float64(s.Completed) * 100
	}
	score := completionRate*0.7 + onTimeRate*0.3
	return clampScore(score)
}

func clampScore(score float64) int {
	if score < 0 {
		return 0
	}
	if score > 100 {
		return 100
	}
	return int(math.Round(score))
}

// ── Grade assignment ───────────────────────────────────────────────────────

func assignGrade(score int, cfg ScorecardConfig) string {
	switch {
	case score >= cfg.GradeAMin:
		return "A"
	case score >= cfg.GradeBMin:
		return "B"
	case score >= cfg.GradeCMin:
		return "C"
	default:
		return "D"
	}
}

// ── Flag generation ────────────────────────────────────────────────────────

func generateFlags(cfg ScorecardConfig, punct *PunctualityStats, leave *LeaveStats, tasks *TaskStats) []Flag {
	var flags []Flag

	// Frequent lateness
	if punct.LateCount >= cfg.LateFlagThreshold {
		flags = append(flags, Flag{
			Type:     "frequent_lateness",
			Message:  fmt.Sprintf("Late %d times (threshold: %d)", punct.LateCount, cfg.LateFlagThreshold),
			Severity: severity(punct.LateCount, cfg.LateFlagThreshold*2),
		})
	}

	// Leave exhaustion
	if leave.DaysEntitled > 0 {
		utilPct := leave.DaysTaken / leave.DaysEntitled * 100
		if int(utilPct) >= cfg.LeaveWarningPct {
			flags = append(flags, Flag{
				Type:     "leave_exhaustion",
				Message:  fmt.Sprintf("Leave %.0f%% used (threshold: %d%%)", utilPct, cfg.LeaveWarningPct),
				Severity: severity(int(utilPct), 100),
			})
		}
	}

	// Task delivery concern
	if tasks.TotalAssigned > 0 {
		completionPct := float64(tasks.Completed) / float64(tasks.TotalAssigned) * 100
		if int(completionPct) <= cfg.TaskConcernPct {
			flags = append(flags, Flag{
				Type:     "task_delivery_concern",
				Message:  fmt.Sprintf("Task completion at %s%% (threshold: %d%%)", strconv.Itoa(int(completionPct)), cfg.TaskConcernPct),
				Severity: severity(cfg.TaskConcernPct, int(completionPct)),
			})
		}
	}

	return flags
}

// severity returns "alert" if value >= alertThreshold, otherwise "warning".
func severity(value, alertThreshold int) string {
	if value >= alertThreshold {
		return "alert"
	}
	return "warning"
}

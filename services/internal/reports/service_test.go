package reports_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/reports"
	"github.com/workived/services/pkg/apperr"
)

// ── Fake repository ────────────────────────────────────────────────────────

type fakeRepo struct {
	config     *reports.ScorecardConfig
	configErr  error
	employees  []reports.EmployeeBasic
	attendance map[uuid.UUID]*reports.AttendanceStats
	punctuality map[uuid.UUID]*reports.PunctualityStats
	leave      map[uuid.UUID]*reports.LeaveStats
	tasks      map[uuid.UUID]*reports.TaskStats
	claims     map[uuid.UUID]*reports.ClaimStats
	timezone   string
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		attendance:  make(map[uuid.UUID]*reports.AttendanceStats),
		punctuality: make(map[uuid.UUID]*reports.PunctualityStats),
		leave:       make(map[uuid.UUID]*reports.LeaveStats),
		tasks:       make(map[uuid.UUID]*reports.TaskStats),
		claims:      make(map[uuid.UUID]*reports.ClaimStats),
		timezone:    "Asia/Jakarta",
	}
}

func (f *fakeRepo) GetConfig(_ context.Context, _ uuid.UUID) (*reports.ScorecardConfig, error) {
	if f.configErr != nil {
		return nil, f.configErr
	}
	if f.config != nil {
		return f.config, nil
	}
	return nil, apperr.NotFound("scorecard_config")
}

func (f *fakeRepo) UpsertConfig(_ context.Context, orgID uuid.UUID, input reports.ConfigUpdateInput) (*reports.ScorecardConfig, error) {
	return &reports.ScorecardConfig{
		ID:                uuid.New(),
		OrganisationID:    orgID,
		AttendanceWeight:  input.AttendanceWeight,
		PunctualityWeight: input.PunctualityWeight,
		LeaveWeight:       input.LeaveWeight,
		TasksWeight:       input.TasksWeight,
		ClaimsWeight:      input.ClaimsWeight,
		GradeAMin:         input.GradeAMin,
		GradeBMin:         input.GradeBMin,
		GradeCMin:         input.GradeCMin,
		IsActive:          true,
	}, nil
}

func (f *fakeRepo) ListActiveEmployees(_ context.Context, _ uuid.UUID, _ string) ([]reports.EmployeeBasic, error) {
	return f.employees, nil
}

func (f *fakeRepo) GetAttendanceStats(_ context.Context, _, empID uuid.UUID, _, _ string) (*reports.AttendanceStats, error) {
	if s, ok := f.attendance[empID]; ok {
		return s, nil
	}
	return &reports.AttendanceStats{}, nil
}

func (f *fakeRepo) GetPunctualityStats(_ context.Context, _, empID uuid.UUID, _, _ string) (*reports.PunctualityStats, error) {
	if s, ok := f.punctuality[empID]; ok {
		return s, nil
	}
	return &reports.PunctualityStats{}, nil
}

func (f *fakeRepo) GetLeaveStats(_ context.Context, _, empID uuid.UUID, _, _, _ string) (*reports.LeaveStats, error) {
	if s, ok := f.leave[empID]; ok {
		return s, nil
	}
	return &reports.LeaveStats{}, nil
}

func (f *fakeRepo) GetTaskStats(_ context.Context, _, empID uuid.UUID, _, _ string) (*reports.TaskStats, error) {
	if s, ok := f.tasks[empID]; ok {
		return s, nil
	}
	return &reports.TaskStats{}, nil
}

func (f *fakeRepo) GetClaimStats(_ context.Context, _, empID uuid.UUID, _, _ string) (*reports.ClaimStats, error) {
	if s, ok := f.claims[empID]; ok {
		return s, nil
	}
	return &reports.ClaimStats{}, nil
}

func (f *fakeRepo) GetOrgTimezone(_ context.Context, _ uuid.UUID) (string, error) {
	return f.timezone, nil
}

// ── Helpers ────────────────────────────────────────────────────────────────

func newTestService(repo reports.RepositoryInterface) *reports.Service {
	return reports.NewService(repo, zerolog.Nop())
}

var (
	testOrgID = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	empAlice  = uuid.MustParse("00000000-0000-0000-0000-000000000010")
	empBob    = uuid.MustParse("00000000-0000-0000-0000-000000000020")
)

// ── Tests ──────────────────────────────────────────────────────────────────

func TestGetConfig_DefaultsWhenNoRow(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)

	cfg, err := svc.GetConfig(context.Background(), testOrgID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.AttendanceWeight != 25 {
		t.Errorf("attendance_weight = %d, want 25", cfg.AttendanceWeight)
	}
	if cfg.PunctualityWeight != 20 {
		t.Errorf("punctuality_weight = %d, want 20", cfg.PunctualityWeight)
	}
}

func TestGetConfig_ReturnsStoredConfig(t *testing.T) {
	repo := newFakeRepo()
	repo.config = &reports.ScorecardConfig{
		OrganisationID:    testOrgID,
		AttendanceWeight:  30,
		PunctualityWeight: 20,
		LeaveWeight:       10,
		TasksWeight:       30,
		ClaimsWeight:      10,
		GradeAMin:         90,
		GradeBMin:         75,
		GradeCMin:         60,
	}
	svc := newTestService(repo)

	cfg, err := svc.GetConfig(context.Background(), testOrgID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.AttendanceWeight != 30 {
		t.Errorf("attendance_weight = %d, want 30", cfg.AttendanceWeight)
	}
}

func TestUpdateConfig_WeightsSumValidation(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)

	_, err := svc.UpdateConfig(context.Background(), testOrgID, reports.ConfigUpdateInput{
		AttendanceWeight:  30,
		PunctualityWeight: 30,
		LeaveWeight:       30,
		TasksWeight:       30,
		ClaimsWeight:      30, // sum = 150
		GradeAMin:         90,
		GradeBMin:         75,
		GradeCMin:         60,
	})
	if err == nil {
		t.Fatal("expected validation error for weights sum != 100")
	}
	if !apperr.IsCode(err, apperr.CodeValidation) {
		t.Errorf("expected VALIDATION_ERROR, got: %v", err)
	}
}

func TestUpdateConfig_GradeOrderValidation(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)

	_, err := svc.UpdateConfig(context.Background(), testOrgID, reports.ConfigUpdateInput{
		AttendanceWeight:   25,
		PunctualityWeight:  20,
		LeaveWeight:        15,
		TasksWeight:        25,
		ClaimsWeight:       15,
		GradeAMin:          70,
		GradeBMin:          80, // B > A — invalid
		GradeCMin:          60,
		LateFlagThreshold:  3,
		LeaveWarningPct:    90,
		TaskConcernPct:     60,
		ScoreDropThreshold: 10,
		MinWorkingDays:     5,
	})
	if err == nil {
		t.Fatal("expected validation error for grade order")
	}
}

func TestUpdateConfig_Success(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)

	cfg, err := svc.UpdateConfig(context.Background(), testOrgID, reports.ConfigUpdateInput{
		AttendanceWeight:   30,
		PunctualityWeight:  20,
		LeaveWeight:        10,
		TasksWeight:        30,
		ClaimsWeight:       10,
		GradeAMin:          90,
		GradeBMin:          75,
		GradeCMin:          60,
		LateFlagThreshold:  3,
		LeaveWarningPct:    90,
		TaskConcernPct:     60,
		ScoreDropThreshold: 10,
		MinWorkingDays:     5,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.AttendanceWeight != 30 {
		t.Errorf("attendance_weight = %d, want 30", cfg.AttendanceWeight)
	}
}

func TestGetEmployeeScorecard_PerfectAttendance(t *testing.T) {
	repo := newFakeRepo()
	repo.employees = []reports.EmployeeBasic{
		{ID: empAlice, Name: "Alice", Department: "Engineering"},
	}
	repo.attendance[empAlice] = &reports.AttendanceStats{DaysPresent: 20, WorkingDays: 20}
	repo.punctuality[empAlice] = &reports.PunctualityStats{OnTimeCount: 20, LateCount: 0, TotalPresent: 20}
	repo.leave[empAlice] = &reports.LeaveStats{DaysTaken: 0, DaysEntitled: 12}
	repo.tasks[empAlice] = &reports.TaskStats{TotalAssigned: 10, Completed: 10, CompletedOnTime: 10}
	repo.claims[empAlice] = &reports.ClaimStats{TotalClaims: 0}

	svc := newTestService(repo)
	sc, err := svc.GetEmployeeScorecard(context.Background(), testOrgID, empAlice, "this_month")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sc.OverallScore != 100 {
		t.Errorf("overall_score = %d, want 100", sc.OverallScore)
	}
	if sc.Grade != "A" {
		t.Errorf("grade = %s, want A", sc.Grade)
	}
	if !sc.Sufficient {
		t.Error("expected sufficient = true")
	}
}

func TestGetEmployeeScorecard_LowPerformance(t *testing.T) {
	repo := newFakeRepo()
	repo.employees = []reports.EmployeeBasic{
		{ID: empAlice, Name: "Alice", Department: "Sales"},
	}
	repo.attendance[empAlice] = &reports.AttendanceStats{DaysPresent: 10, WorkingDays: 20}
	repo.punctuality[empAlice] = &reports.PunctualityStats{OnTimeCount: 5, LateCount: 5, TotalPresent: 10}
	repo.leave[empAlice] = &reports.LeaveStats{DaysTaken: 11, DaysEntitled: 12}
	repo.tasks[empAlice] = &reports.TaskStats{TotalAssigned: 10, Completed: 3, CompletedOnTime: 2}
	repo.claims[empAlice] = &reports.ClaimStats{TotalClaims: 5, MissingReceiptCount: 3}

	svc := newTestService(repo)
	sc, err := svc.GetEmployeeScorecard(context.Background(), testOrgID, empAlice, "this_month")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sc.Grade == "A" {
		t.Error("expected grade below A for low performance")
	}
	if len(sc.Flags) == 0 {
		t.Error("expected flags for low performance")
	}
}

func TestGetEmployeeScorecard_NotFound(t *testing.T) {
	repo := newFakeRepo()
	repo.employees = []reports.EmployeeBasic{} // no employees

	svc := newTestService(repo)
	_, err := svc.GetEmployeeScorecard(context.Background(), testOrgID, empAlice, "this_month")
	if err == nil {
		t.Fatal("expected error for non-existent employee")
	}
	if !apperr.IsCode(err, apperr.CodeNotFound) {
		t.Errorf("expected NOT_FOUND, got: %v", err)
	}
}

func TestGetEmployeeScorecard_InvalidPeriod(t *testing.T) {
	repo := newFakeRepo()
	svc := newTestService(repo)

	_, err := svc.GetEmployeeScorecard(context.Background(), testOrgID, empAlice, "invalid_period")
	if err == nil {
		t.Fatal("expected error for invalid period")
	}
}

func TestGetTeamScorecard(t *testing.T) {
	repo := newFakeRepo()
	repo.employees = []reports.EmployeeBasic{
		{ID: empAlice, Name: "Alice", Department: "Engineering"},
		{ID: empBob, Name: "Bob", Department: "Sales"},
	}
	// Alice: perfect
	repo.attendance[empAlice] = &reports.AttendanceStats{DaysPresent: 20, WorkingDays: 20}
	repo.punctuality[empAlice] = &reports.PunctualityStats{OnTimeCount: 20, TotalPresent: 20}
	repo.leave[empAlice] = &reports.LeaveStats{DaysEntitled: 12}
	repo.tasks[empAlice] = &reports.TaskStats{TotalAssigned: 5, Completed: 5, CompletedOnTime: 5}
	repo.claims[empAlice] = &reports.ClaimStats{}

	// Bob: decent
	repo.attendance[empBob] = &reports.AttendanceStats{DaysPresent: 18, WorkingDays: 20}
	repo.punctuality[empBob] = &reports.PunctualityStats{OnTimeCount: 16, LateCount: 2, TotalPresent: 18}
	repo.leave[empBob] = &reports.LeaveStats{DaysTaken: 2, DaysEntitled: 12}
	repo.tasks[empBob] = &reports.TaskStats{TotalAssigned: 8, Completed: 7, CompletedOnTime: 6}
	repo.claims[empBob] = &reports.ClaimStats{}

	svc := newTestService(repo)
	team, err := svc.GetTeamScorecard(context.Background(), testOrgID, "this_month")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(team.Employees) != 2 {
		t.Errorf("employees count = %d, want 2", len(team.Employees))
	}
	if team.TeamAverage <= 0 {
		t.Errorf("team_average = %d, want > 0", team.TeamAverage)
	}
}

func TestGetTeamScorecard_InsufficientDaysExcluded(t *testing.T) {
	repo := newFakeRepo()
	repo.employees = []reports.EmployeeBasic{
		{ID: empAlice, Name: "Alice", Department: "Engineering"},
	}
	// Only 2 working days — below default min of 5
	repo.attendance[empAlice] = &reports.AttendanceStats{DaysPresent: 2, WorkingDays: 2}
	repo.punctuality[empAlice] = &reports.PunctualityStats{OnTimeCount: 2, TotalPresent: 2}
	repo.leave[empAlice] = &reports.LeaveStats{DaysEntitled: 12}
	repo.tasks[empAlice] = &reports.TaskStats{}
	repo.claims[empAlice] = &reports.ClaimStats{}

	svc := newTestService(repo)
	team, err := svc.GetTeamScorecard(context.Background(), testOrgID, "this_month")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(team.Employees) != 0 {
		t.Errorf("expected 0 sufficient employees, got %d", len(team.Employees))
	}
}

func TestGetCompanySummary(t *testing.T) {
	repo := newFakeRepo()
	repo.employees = []reports.EmployeeBasic{
		{ID: empAlice, Name: "Alice", Department: "Engineering"},
		{ID: empBob, Name: "Bob", Department: "Engineering"},
	}
	for _, id := range []uuid.UUID{empAlice, empBob} {
		repo.attendance[id] = &reports.AttendanceStats{DaysPresent: 20, WorkingDays: 20}
		repo.punctuality[id] = &reports.PunctualityStats{OnTimeCount: 18, LateCount: 2, TotalPresent: 20}
		repo.leave[id] = &reports.LeaveStats{DaysTaken: 2, DaysEntitled: 12}
		repo.tasks[id] = &reports.TaskStats{TotalAssigned: 10, Completed: 9, CompletedOnTime: 8}
		repo.claims[id] = &reports.ClaimStats{TotalClaims: 3}
	}

	svc := newTestService(repo)
	summary, err := svc.GetCompanySummary(context.Background(), testOrgID, "this_month")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if summary.AvgScore <= 0 {
		t.Errorf("avg_score = %d, want > 0", summary.AvgScore)
	}
	if summary.TopPerformer == nil {
		t.Error("expected top_performer to be set")
	}
	if len(summary.DepartmentBreakdown) != 1 {
		t.Errorf("department_breakdown count = %d, want 1", len(summary.DepartmentBreakdown))
	}
}

func TestScoring_ZeroData(t *testing.T) {
	// Employee with zero activity should get 100 (not penalised for no data)
	repo := newFakeRepo()
	repo.employees = []reports.EmployeeBasic{
		{ID: empAlice, Name: "Alice", Department: "Engineering"},
	}
	repo.attendance[empAlice] = &reports.AttendanceStats{DaysPresent: 0, WorkingDays: 20}
	repo.punctuality[empAlice] = &reports.PunctualityStats{TotalPresent: 0}
	repo.leave[empAlice] = &reports.LeaveStats{DaysEntitled: 0}
	repo.tasks[empAlice] = &reports.TaskStats{TotalAssigned: 0}
	repo.claims[empAlice] = &reports.ClaimStats{TotalClaims: 0}

	svc := newTestService(repo)
	sc, err := svc.GetEmployeeScorecard(context.Background(), testOrgID, empAlice, "this_month")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Attendance = 0/20 = 0, others = 100 (no activity)
	if sc.Breakdown["attendance"].Score != 0 {
		t.Errorf("attendance score = %d, want 0", sc.Breakdown["attendance"].Score)
	}
	if sc.Breakdown["punctuality"].Score != 100 {
		t.Errorf("punctuality score = %d, want 100", sc.Breakdown["punctuality"].Score)
	}
}

func TestFlags_FrequentLateness(t *testing.T) {
	repo := newFakeRepo()
	repo.employees = []reports.EmployeeBasic{
		{ID: empAlice, Name: "Alice", Department: "Engineering"},
	}
	repo.attendance[empAlice] = &reports.AttendanceStats{DaysPresent: 20, WorkingDays: 20}
	repo.punctuality[empAlice] = &reports.PunctualityStats{OnTimeCount: 15, LateCount: 5, TotalPresent: 20}
	repo.leave[empAlice] = &reports.LeaveStats{DaysEntitled: 12}
	repo.tasks[empAlice] = &reports.TaskStats{TotalAssigned: 5, Completed: 5, CompletedOnTime: 5}
	repo.claims[empAlice] = &reports.ClaimStats{}

	svc := newTestService(repo)
	sc, err := svc.GetEmployeeScorecard(context.Background(), testOrgID, empAlice, "this_month")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	found := false
	for _, f := range sc.Flags {
		if f.Type == "frequent_lateness" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected frequent_lateness flag when late_count >= 3 (default threshold)")
	}
}

func TestFlags_LeaveExhaustion(t *testing.T) {
	repo := newFakeRepo()
	repo.employees = []reports.EmployeeBasic{
		{ID: empAlice, Name: "Alice", Department: "Engineering"},
	}
	repo.attendance[empAlice] = &reports.AttendanceStats{DaysPresent: 20, WorkingDays: 20}
	repo.punctuality[empAlice] = &reports.PunctualityStats{OnTimeCount: 20, TotalPresent: 20}
	repo.leave[empAlice] = &reports.LeaveStats{DaysTaken: 11, DaysEntitled: 12} // ~92% used
	repo.tasks[empAlice] = &reports.TaskStats{TotalAssigned: 5, Completed: 5, CompletedOnTime: 5}
	repo.claims[empAlice] = &reports.ClaimStats{}

	svc := newTestService(repo)
	sc, err := svc.GetEmployeeScorecard(context.Background(), testOrgID, empAlice, "this_month")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	found := false
	for _, f := range sc.Flags {
		if f.Type == "leave_exhaustion" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected leave_exhaustion flag when utilisation >= 90%")
	}
}

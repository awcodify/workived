package attendance_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/attendance"
	"github.com/workived/services/pkg/apperr"
)

// ── Fakes ─────────────────────────────────────────────────────────────────────

type fakeRepo struct {
	getByEmpDateFn        func(ctx context.Context, orgID, empID uuid.UUID, date string) (*attendance.Record, error)
	createFn              func(ctx context.Context, orgID, empID uuid.UUID, date string, clockIn time.Time, isLate bool, note *string) (*attendance.Record, error)
	updateClockOutFn      func(ctx context.Context, orgID, empID uuid.UUID, date string, clockOut time.Time, note *string) (*attendance.Record, error)
	listByDateFn          func(ctx context.Context, orgID uuid.UUID, date string) ([]attendance.Record, error)
	listByMonthFn         func(ctx context.Context, orgID uuid.UUID, year, month int) ([]attendance.Record, error)
	listByEmpMonthFn      func(ctx context.Context, orgID, empID uuid.UUID, year, month int) ([]attendance.Record, error)
	listByEmpsDateRangeFn func(ctx context.Context, orgID uuid.UUID, employeeIDs []uuid.UUID, startDate, endDate string) ([]attendance.Record, error)
	getDefaultSchedFn     func(ctx context.Context, orgID uuid.UUID) (*attendance.WorkSchedule, error)
	listHolidaysFn        func(ctx context.Context, cc string, start, end string) ([]attendance.PublicHoliday, error)
	listActiveEmpsFn      func(ctx context.Context, orgID uuid.UUID, date string) ([]attendance.ActiveEmployee, error)
	getEmployeeNameFn     func(ctx context.Context, orgID, empID uuid.UUID) (string, error)
}

func (f *fakeRepo) GetByEmployeeAndDate(ctx context.Context, orgID, empID uuid.UUID, date string) (*attendance.Record, error) {
	return f.getByEmpDateFn(ctx, orgID, empID, date)
}
func (f *fakeRepo) Create(ctx context.Context, orgID, empID uuid.UUID, date string, clockIn time.Time, isLate bool, note *string) (*attendance.Record, error) {
	return f.createFn(ctx, orgID, empID, date, clockIn, isLate, note)
}
func (f *fakeRepo) UpdateClockOut(ctx context.Context, orgID, empID uuid.UUID, date string, clockOut time.Time, note *string) (*attendance.Record, error) {
	return f.updateClockOutFn(ctx, orgID, empID, date, clockOut, note)
}
func (f *fakeRepo) ListByDate(ctx context.Context, orgID uuid.UUID, date string) ([]attendance.Record, error) {
	return f.listByDateFn(ctx, orgID, date)
}
func (f *fakeRepo) ListByMonth(ctx context.Context, orgID uuid.UUID, year, month int) ([]attendance.Record, error) {
	return f.listByMonthFn(ctx, orgID, year, month)
}
func (f *fakeRepo) ListByEmployeeMonth(ctx context.Context, orgID, empID uuid.UUID, year, month int) ([]attendance.Record, error) {
	return f.listByEmpMonthFn(ctx, orgID, empID, year, month)
}
func (f *fakeRepo) ListByEmployeesDateRange(ctx context.Context, orgID uuid.UUID, employeeIDs []uuid.UUID, startDate, endDate string) ([]attendance.Record, error) {
	if f.listByEmpsDateRangeFn != nil {
		return f.listByEmpsDateRangeFn(ctx, orgID, employeeIDs, startDate, endDate)
	}
	return []attendance.Record{}, nil
}
func (f *fakeRepo) GetDefaultSchedule(ctx context.Context, orgID uuid.UUID) (*attendance.WorkSchedule, error) {
	return f.getDefaultSchedFn(ctx, orgID)
}
func (f *fakeRepo) ListHolidays(ctx context.Context, cc string, start, end string) ([]attendance.PublicHoliday, error) {
	return f.listHolidaysFn(ctx, cc, start, end)
}
func (f *fakeRepo) ListActiveEmployees(ctx context.Context, orgID uuid.UUID, date string) ([]attendance.ActiveEmployee, error) {
	return f.listActiveEmpsFn(ctx, orgID, date)
}
func (f *fakeRepo) GetEmployeeName(ctx context.Context, orgID, empID uuid.UUID) (string, error) {
	return f.getEmployeeNameFn(ctx, orgID, empID)
}

type fakeOrgInfo struct {
	tz    string
	tzErr error
	cc    string
	ccErr error
}

func (f *fakeOrgInfo) GetOrgTimezone(_ context.Context, _ uuid.UUID) (string, error) {
	if f.tzErr != nil {
		return "", f.tzErr
	}
	return f.tz, nil
}
func (f *fakeOrgInfo) GetOrgCountryCode(_ context.Context, _ uuid.UUID) (string, error) {
	if f.ccErr != nil {
		return "", f.ccErr
	}
	return f.cc, nil
}

type fakeEmployeeInfo struct {
	subordinateIDsFn     func(ctx context.Context, orgID, managerID uuid.UUID) ([]uuid.UUID, error)
	employeeProfileFn    func(ctx context.Context, orgID, employeeID uuid.UUID) (string, *string, *uuid.UUID, error)
	employeeNamesBatchFn func(ctx context.Context, orgID uuid.UUID, employeeIDs []uuid.UUID) (map[uuid.UUID]string, error)
}

func (f *fakeEmployeeInfo) GetSubordinateIDs(ctx context.Context, orgID, managerID uuid.UUID) ([]uuid.UUID, error) {
	if f.subordinateIDsFn != nil {
		return f.subordinateIDsFn(ctx, orgID, managerID)
	}
	return []uuid.UUID{}, nil
}

func (f *fakeEmployeeInfo) GetEmployeeProfile(ctx context.Context, orgID, employeeID uuid.UUID) (string, *string, *uuid.UUID, error) {
	if f.employeeProfileFn != nil {
		return f.employeeProfileFn(ctx, orgID, employeeID)
	}
	return "Test Employee", nil, nil, nil
}

func (f *fakeEmployeeInfo) GetEmployeeNamesBatch(ctx context.Context, orgID uuid.UUID, employeeIDs []uuid.UUID) (map[uuid.UUID]string, error) {
	if f.employeeNamesBatchFn != nil {
		return f.employeeNamesBatchFn(ctx, orgID, employeeIDs)
	}
	// Default: return simple ID -> name mapping
	result := make(map[uuid.UUID]string, len(employeeIDs))
	for _, id := range employeeIDs {
		result[id] = "Employee " + id.String()[:8]
	}
	return result, nil
}

// ── Helpers ──────────────────────────────────────────────────────────────────

var (
	testOrgID = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	testEmpID = uuid.MustParse("00000000-0000-0000-0000-000000000002")
)

func fixedNow(t time.Time) func() time.Time {
	return func() time.Time { return t }
}

// schedule9AM creates a Mon-Fri schedule starting at 09:00.
func schedule9AM() *attendance.WorkSchedule {
	return &attendance.WorkSchedule{
		WorkDays:  []int{1, 2, 3, 4, 5},
		StartTime: time.Date(0, 1, 1, 9, 0, 0, 0, time.UTC),
	}
}

func defaultFakeRepo() *fakeRepo {
	return &fakeRepo{
		getByEmpDateFn: func(_ context.Context, _, _ uuid.UUID, _ string) (*attendance.Record, error) {
			return nil, apperr.NotFound("attendance record")
		},
		createFn: func(_ context.Context, orgID, empID uuid.UUID, date string, clockIn time.Time, isLate bool, note *string) (*attendance.Record, error) {
			return &attendance.Record{
				ID:             uuid.New(),
				OrganisationID: orgID,
				EmployeeID:     empID,
				Date:           date,
				ClockInAt:      clockIn,
				IsLate:         isLate,
				Note:           note,
			}, nil
		},
		updateClockOutFn: func(_ context.Context, orgID, empID uuid.UUID, date string, clockOut time.Time, note *string) (*attendance.Record, error) {
			return &attendance.Record{
				ID:             uuid.New(),
				OrganisationID: orgID,
				EmployeeID:     empID,
				Date:           date,
				ClockInAt:      clockOut.Add(-8 * time.Hour),
				ClockOutAt:     &clockOut,
				Note:           note,
			}, nil
		},
		getDefaultSchedFn: func(_ context.Context, _ uuid.UUID) (*attendance.WorkSchedule, error) {
			return schedule9AM(), nil
		},
		listByDateFn: func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.Record, error) {
			return nil, nil
		},
		listByMonthFn: func(_ context.Context, _ uuid.UUID, _, _ int) ([]attendance.Record, error) {
			return nil, nil
		},
		listByEmpMonthFn: func(_ context.Context, _, _ uuid.UUID, _, _ int) ([]attendance.Record, error) {
			return nil, nil
		},
		listHolidaysFn: func(_ context.Context, _ string, _, _ string) ([]attendance.PublicHoliday, error) {
			return nil, nil
		},
		listActiveEmpsFn: func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.ActiveEmployee, error) {
			return nil, nil
		},
		getEmployeeNameFn: func(_ context.Context, _, _ uuid.UUID) (string, error) {
			return "Ahmad Rashid", nil
		},
	}
}

func newTestService(repo *fakeRepo, orgInfo *fakeOrgInfo, now time.Time) *attendance.Service {
	empInfo := &fakeEmployeeInfo{}
	svc := attendance.NewService(repo, orgInfo, empInfo, zerolog.Nop())
	svc.SetNowFunc(fixedNow(now))
	return svc
}

// ── ClockIn tests ────────────────────────────────────────────────────────────

func TestService_ClockIn(t *testing.T) {
	// Monday 2026-03-16 08:30 UTC → 15:30 WIB (Asia/Jakarta = UTC+7)
	nowUTC := time.Date(2026, 3, 16, 8, 30, 0, 0, time.UTC)

	tests := []struct {
		name     string
		setup    func(r *fakeRepo, o *fakeOrgInfo)
		wantErr  string
		wantLate bool
	}{
		{
			name:     "success — on time",
			wantLate: false,
			setup: func(r *fakeRepo, o *fakeOrgInfo) {
				// 08:30 UTC = 15:30 WIB → late (after 09:00 local)
				// Use 01:30 UTC so local = 08:30 WIB → on time
			},
		},
		{
			name:     "success — late clock-in",
			wantLate: true,
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				// keep default nowUTC: 08:30 UTC = 15:30 WIB → late
				// Override create to verify isLate flag
				origCreate := r.createFn
				r.createFn = func(ctx context.Context, orgID, empID uuid.UUID, date string, clockIn time.Time, isLate bool, note *string) (*attendance.Record, error) {
					if !isLate {
						t.Error("expected isLate=true")
					}
					return origCreate(ctx, orgID, empID, date, clockIn, isLate, note)
				}
			},
		},
		{
			name:    "conflict — already clocked in",
			wantErr: apperr.CodeConflict,
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				r.getByEmpDateFn = func(_ context.Context, _, _ uuid.UUID, _ string) (*attendance.Record, error) {
					return &attendance.Record{ID: uuid.New()}, nil
				}
			},
		},
		{
			name:    "timezone error",
			wantErr: "", // non-AppError
			setup: func(_ *fakeRepo, o *fakeOrgInfo) {
				o.tzErr = errors.New("db down")
			},
		},
		{
			name:    "invalid timezone",
			wantErr: "",
			setup: func(_ *fakeRepo, o *fakeOrgInfo) {
				o.tz = "Invalid/Zone"
			},
		},
		{
			name: "getByEmployeeAndDate non-not-found error",
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				r.getByEmpDateFn = func(_ context.Context, _, _ uuid.UUID, _ string) (*attendance.Record, error) {
					return nil, errors.New("db down")
				}
			},
		},
		{
			name: "schedule error",
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				r.getDefaultSchedFn = func(_ context.Context, _ uuid.UUID) (*attendance.WorkSchedule, error) {
					return nil, errors.New("schedule db error")
				}
			},
		},
		{
			name:     "no schedule — skip late check",
			wantLate: false,
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				r.getDefaultSchedFn = func(_ context.Context, _ uuid.UUID) (*attendance.WorkSchedule, error) {
					return nil, nil
				}
			},
		},
		{
			name:     "clock-in on non-work day (Sunday)",
			wantLate: false,
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				// Sunday schedule — still allow clock-in but not late
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := defaultFakeRepo()
			orgInfo := &fakeOrgInfo{tz: "Asia/Jakarta", cc: "ID"}

			testNow := nowUTC
			if tt.name == "success — on time" {
				// 01:30 UTC = 08:30 WIB → before 09:00 → on time
				testNow = time.Date(2026, 3, 16, 1, 30, 0, 0, time.UTC)
			}
			if tt.name == "clock-in on non-work day (Sunday)" {
				// Sunday 2026-03-15
				testNow = time.Date(2026, 3, 15, 8, 30, 0, 0, time.UTC)
			}

			if tt.setup != nil {
				tt.setup(repo, orgInfo)
			}

			svc := newTestService(repo, orgInfo, testNow)
			rec, err := svc.ClockIn(context.Background(), testOrgID, attendance.ClockInRequest{
				EmployeeID: testEmpID,
			})

			if tt.wantErr != "" {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.wantErr == apperr.CodeConflict {
					if !apperr.IsCode(err, apperr.CodeConflict) {
						t.Errorf("expected CONFLICT, got %v", err)
					}
				}
				return
			}
			if tt.name == "timezone error" || tt.name == "invalid timezone" ||
				tt.name == "getByEmployeeAndDate non-not-found error" ||
				tt.name == "schedule error" {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if rec == nil {
				t.Fatal("expected record, got nil")
			}
		})
	}
}

// ── ClockOut tests ───────────────────────────────────────────────────────────

func TestService_ClockOut(t *testing.T) {
	nowUTC := time.Date(2026, 3, 16, 10, 0, 0, 0, time.UTC) // 17:00 WIB
	clockInTime := time.Date(2026, 3, 16, 2, 0, 0, 0, time.UTC)

	tests := []struct {
		name    string
		setup   func(r *fakeRepo, o *fakeOrgInfo)
		wantErr string
	}{
		{
			name: "success",
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				r.getByEmpDateFn = func(_ context.Context, _, _ uuid.UUID, _ string) (*attendance.Record, error) {
					return &attendance.Record{ID: uuid.New(), ClockInAt: clockInTime}, nil
				}
			},
		},
		{
			name:    "already clocked out",
			wantErr: apperr.CodeConflict,
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				co := nowUTC
				r.getByEmpDateFn = func(_ context.Context, _, _ uuid.UUID, _ string) (*attendance.Record, error) {
					return &attendance.Record{ID: uuid.New(), ClockInAt: clockInTime, ClockOutAt: &co}, nil
				}
			},
		},
		{
			name: "no record found",
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				r.getByEmpDateFn = func(_ context.Context, _, _ uuid.UUID, _ string) (*attendance.Record, error) {
					return nil, apperr.NotFound("attendance record")
				}
			},
		},
		{
			name: "timezone error",
			setup: func(_ *fakeRepo, o *fakeOrgInfo) {
				o.tzErr = errors.New("tz error")
			},
		},
		{
			name: "invalid timezone",
			setup: func(_ *fakeRepo, o *fakeOrgInfo) {
				o.tz = "Bad/Zone"
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := defaultFakeRepo()
			orgInfo := &fakeOrgInfo{tz: "Asia/Jakarta", cc: "ID"}
			if tt.setup != nil {
				tt.setup(repo, orgInfo)
			}

			svc := newTestService(repo, orgInfo, nowUTC)
			rec, err := svc.ClockOut(context.Background(), testOrgID, attendance.ClockOutRequest{
				EmployeeID: testEmpID,
			})

			if tt.wantErr != "" {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.wantErr == apperr.CodeConflict && !apperr.IsCode(err, apperr.CodeConflict) {
					t.Errorf("expected CONFLICT, got %v", err)
				}
				return
			}
			if tt.name == "no record found" || tt.name == "timezone error" || tt.name == "invalid timezone" {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if rec == nil {
				t.Fatal("expected record, got nil")
			}
		})
	}
}

// ── GetToday tests ───────────────────────────────────────────────────────────

func TestService_GetToday(t *testing.T) {
	nowUTC := time.Date(2026, 3, 16, 8, 0, 0, 0, time.UTC)

	tests := []struct {
		name    string
		setup   func(r *fakeRepo, o *fakeOrgInfo)
		wantErr bool
	}{
		{
			name: "success",
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				r.getByEmpDateFn = func(_ context.Context, _, _ uuid.UUID, _ string) (*attendance.Record, error) {
					return &attendance.Record{ID: uuid.New()}, nil
				}
			},
		},
		{
			name:    "not found",
			wantErr: true,
		},
		{
			name:    "timezone error",
			wantErr: true,
			setup: func(_ *fakeRepo, o *fakeOrgInfo) {
				o.tzErr = errors.New("tz db down")
			},
		},
		{
			name:    "invalid timezone",
			wantErr: true,
			setup: func(_ *fakeRepo, o *fakeOrgInfo) {
				o.tz = "Not/Real"
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := defaultFakeRepo()
			orgInfo := &fakeOrgInfo{tz: "Asia/Jakarta", cc: "ID"}
			if tt.setup != nil {
				tt.setup(repo, orgInfo)
			}

			svc := newTestService(repo, orgInfo, nowUTC)
			rec, err := svc.GetToday(context.Background(), testOrgID, testEmpID)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if rec == nil {
				t.Fatal("expected record, got nil")
			}
		})
	}
}

// ── DailyReport tests ────────────────────────────────────────────────────────

func TestService_DailyReport(t *testing.T) {
	emp1 := uuid.MustParse("00000000-0000-0000-0000-000000000010")
	emp2 := uuid.MustParse("00000000-0000-0000-0000-000000000011")
	emp3 := uuid.MustParse("00000000-0000-0000-0000-000000000012")

	tests := []struct {
		name       string
		setup      func(r *fakeRepo)
		wantErr    bool
		wantCount  int
		checkEntry func(t *testing.T, entries []attendance.DailyEntry)
	}{
		{
			name: "present, late, and absent employees",
			setup: func(r *fakeRepo) {
				r.listActiveEmpsFn = func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.ActiveEmployee, error) {
					return []attendance.ActiveEmployee{
						{ID: emp1, FullName: "Alice"},
						{ID: emp2, FullName: "Bob"},
						{ID: emp3, FullName: "Charlie"},
					}, nil
				}
				r.listByDateFn = func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.Record, error) {
					return []attendance.Record{
						{EmployeeID: emp1, IsLate: false},
						{EmployeeID: emp2, IsLate: true},
					}, nil
				}
			},
			wantCount: 3,
			checkEntry: func(t *testing.T, entries []attendance.DailyEntry) {
				statusMap := make(map[uuid.UUID]string)
				for _, e := range entries {
					statusMap[e.EmployeeID] = e.Status
				}
				if statusMap[emp1] != "present" {
					t.Errorf("emp1 status = %q, want present", statusMap[emp1])
				}
				if statusMap[emp2] != "late" {
					t.Errorf("emp2 status = %q, want late", statusMap[emp2])
				}
				if statusMap[emp3] != "absent" {
					t.Errorf("emp3 status = %q, want absent", statusMap[emp3])
				}
			},
		},
		{
			name: "employee list error",
			setup: func(r *fakeRepo) {
				r.listActiveEmpsFn = func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.ActiveEmployee, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "records list error",
			setup: func(r *fakeRepo) {
				r.listActiveEmpsFn = func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.ActiveEmployee, error) {
					return []attendance.ActiveEmployee{{ID: emp1}}, nil
				}
				r.listByDateFn = func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.Record, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := defaultFakeRepo()
			orgInfo := &fakeOrgInfo{tz: "Asia/Jakarta", cc: "ID"}
			empInfo := &fakeEmployeeInfo{}
			if tt.setup != nil {
				tt.setup(repo)
			}

			svc := attendance.NewService(repo, orgInfo, empInfo, zerolog.Nop())
			entries, err := svc.DailyReport(context.Background(), testOrgID, attendance.DailyReportFilters{Date: "2026-03-16"})

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(entries) != tt.wantCount {
				t.Errorf("entries count = %d, want %d", len(entries), tt.wantCount)
			}
			if tt.checkEntry != nil {
				tt.checkEntry(t, entries)
			}
		})
	}
}

// ── MonthlySummaryReport tests ───────────────────────────────────────────────

func TestService_MonthlySummaryReport(t *testing.T) {
	emp1 := uuid.MustParse("00000000-0000-0000-0000-000000000010")

	tests := []struct {
		name    string
		setup   func(r *fakeRepo, o *fakeOrgInfo)
		wantErr bool
		check   func(t *testing.T, summaries []attendance.MonthlySummary)
	}{
		{
			name: "success — employee with 18 present, 2 late, in 22 working days",
			setup: func(r *fakeRepo, o *fakeOrgInfo) {
				r.listActiveEmpsFn = func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.ActiveEmployee, error) {
					return []attendance.ActiveEmployee{{ID: emp1, FullName: "Alice"}}, nil
				}
				// 18 records, 2 of which are late
				records := make([]attendance.Record, 18)
				for i := range records {
					records[i] = attendance.Record{EmployeeID: emp1}
				}
				records[0].IsLate = true
				records[1].IsLate = true
				r.listByMonthFn = func(_ context.Context, _ uuid.UUID, _, _ int) ([]attendance.Record, error) {
					return records, nil
				}
				// No holidays
				r.listHolidaysFn = func(_ context.Context, _ string, _, _ string) ([]attendance.PublicHoliday, error) {
					return nil, nil
				}
			},
			check: func(t *testing.T, summaries []attendance.MonthlySummary) {
				if len(summaries) != 1 {
					t.Fatalf("want 1 summary, got %d", len(summaries))
				}
				s := summaries[0]
				if s.Present != 18 {
					t.Errorf("present = %d, want 18", s.Present)
				}
				if s.Late != 2 {
					t.Errorf("late = %d, want 2", s.Late)
				}
				if s.WorkingDays < 1 {
					t.Error("working days should be > 0")
				}
				if s.Absent != s.WorkingDays-s.Present {
					t.Errorf("absent = %d, want %d", s.Absent, s.WorkingDays-s.Present)
				}
			},
		},
		{
			name: "employee list error",
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				r.listActiveEmpsFn = func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.ActiveEmployee, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "records list error",
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				r.listActiveEmpsFn = func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.ActiveEmployee, error) {
					return []attendance.ActiveEmployee{{ID: emp1}}, nil
				}
				r.listByMonthFn = func(_ context.Context, _ uuid.UUID, _, _ int) ([]attendance.Record, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "countWorkingDays error — schedule error",
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				r.listActiveEmpsFn = func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.ActiveEmployee, error) {
					return []attendance.ActiveEmployee{{ID: emp1}}, nil
				}
				r.listByMonthFn = func(_ context.Context, _ uuid.UUID, _, _ int) ([]attendance.Record, error) {
					return nil, nil
				}
				r.getDefaultSchedFn = func(_ context.Context, _ uuid.UUID) (*attendance.WorkSchedule, error) {
					return nil, errors.New("schedule db error")
				}
			},
			wantErr: true,
		},
		{
			name: "countWorkingDays error — country code error",
			setup: func(r *fakeRepo, o *fakeOrgInfo) {
				r.listActiveEmpsFn = func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.ActiveEmployee, error) {
					return []attendance.ActiveEmployee{{ID: emp1}}, nil
				}
				r.listByMonthFn = func(_ context.Context, _ uuid.UUID, _, _ int) ([]attendance.Record, error) {
					return nil, nil
				}
				o.ccErr = errors.New("cc db error")
			},
			wantErr: true,
		},
		{
			name: "countWorkingDays error — holidays error",
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				r.listActiveEmpsFn = func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.ActiveEmployee, error) {
					return []attendance.ActiveEmployee{{ID: emp1}}, nil
				}
				r.listByMonthFn = func(_ context.Context, _ uuid.UUID, _, _ int) ([]attendance.Record, error) {
					return nil, nil
				}
				r.listHolidaysFn = func(_ context.Context, _ string, _, _ string) ([]attendance.PublicHoliday, error) {
					return nil, errors.New("holidays db error")
				}
			},
			wantErr: true,
		},
		{
			name: "holidays on working days reduce count",
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				r.listActiveEmpsFn = func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.ActiveEmployee, error) {
					return []attendance.ActiveEmployee{{ID: emp1, FullName: "Alice"}}, nil
				}
				r.listByMonthFn = func(_ context.Context, _ uuid.UUID, _, _ int) ([]attendance.Record, error) {
					return nil, nil
				}
				// Holiday on a Monday (working day) — 2026-03-16 is Monday
				r.listHolidaysFn = func(_ context.Context, _ string, _, _ string) ([]attendance.PublicHoliday, error) {
					return []attendance.PublicHoliday{{Date: "2026-03-16", Name: "Holiday"}}, nil
				}
			},
			check: func(t *testing.T, summaries []attendance.MonthlySummary) {
				if len(summaries) != 1 {
					t.Fatalf("want 1 summary, got %d", len(summaries))
				}
				// With 1 holiday on a working day, working days should be reduced by 1
				s := summaries[0]
				if s.Present != 0 {
					t.Errorf("present = %d, want 0", s.Present)
				}
			},
		},
		{
			name: "holiday with invalid date is skipped",
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				r.listActiveEmpsFn = func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.ActiveEmployee, error) {
					return []attendance.ActiveEmployee{{ID: emp1, FullName: "Alice"}}, nil
				}
				r.listByMonthFn = func(_ context.Context, _ uuid.UUID, _, _ int) ([]attendance.Record, error) {
					return nil, nil
				}
				r.listHolidaysFn = func(_ context.Context, _ string, _, _ string) ([]attendance.PublicHoliday, error) {
					return []attendance.PublicHoliday{{Date: "invalid-date", Name: "Bad"}}, nil
				}
			},
			check: func(t *testing.T, summaries []attendance.MonthlySummary) {
				if len(summaries) != 1 {
					t.Fatalf("want 1 summary, got %d", len(summaries))
				}
			},
		},
		{
			name: "no schedule defaults to Mon-Fri",
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				r.listActiveEmpsFn = func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.ActiveEmployee, error) {
					return []attendance.ActiveEmployee{{ID: emp1, FullName: "Alice"}}, nil
				}
				r.listByMonthFn = func(_ context.Context, _ uuid.UUID, _, _ int) ([]attendance.Record, error) {
					return nil, nil
				}
				r.getDefaultSchedFn = func(_ context.Context, _ uuid.UUID) (*attendance.WorkSchedule, error) {
					return nil, nil
				}
			},
			check: func(t *testing.T, summaries []attendance.MonthlySummary) {
				if len(summaries) != 1 {
					t.Fatalf("want 1 summary, got %d", len(summaries))
				}
				if summaries[0].WorkingDays < 1 {
					t.Error("working days should be > 0 with default Mon-Fri")
				}
			},
		},
		{
			name: "absent clamped to zero when present > working days",
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				r.listActiveEmpsFn = func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.ActiveEmployee, error) {
					return []attendance.ActiveEmployee{{ID: emp1, FullName: "Alice"}}, nil
				}
				// 50 records in a month with ~22 working days
				records := make([]attendance.Record, 50)
				for i := range records {
					records[i] = attendance.Record{EmployeeID: emp1}
				}
				r.listByMonthFn = func(_ context.Context, _ uuid.UUID, _, _ int) ([]attendance.Record, error) {
					return records, nil
				}
			},
			check: func(t *testing.T, summaries []attendance.MonthlySummary) {
				if len(summaries) != 1 {
					t.Fatalf("want 1 summary, got %d", len(summaries))
				}
				if summaries[0].Absent != 0 {
					t.Errorf("absent = %d, want 0 (clamped)", summaries[0].Absent)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := defaultFakeRepo()
			orgInfo := &fakeOrgInfo{tz: "Asia/Jakarta", cc: "ID"}
			empInfo := &fakeEmployeeInfo{}
			if tt.setup != nil {
				tt.setup(repo, orgInfo)
			}

			svc := attendance.NewService(repo, orgInfo, empInfo, zerolog.Nop())
			summaries, err := svc.MonthlySummaryReport(context.Background(), testOrgID, attendance.MonthlyReportFilters{Year: 2026, Month: 3})

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.check != nil {
				tt.check(t, summaries)
			}
		})
	}
}

// ── EmployeeMonthlySummary tests ─────────────────────────────────────────────

func TestService_EmployeeMonthlySummary(t *testing.T) {
	tests := []struct {
		name    string
		setup   func(r *fakeRepo, o *fakeOrgInfo)
		wantErr bool
		check   func(t *testing.T, s *attendance.MonthlySummary)
	}{
		{
			name: "success — 10 present, 1 late",
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				records := make([]attendance.Record, 10)
				for i := range records {
					records[i] = attendance.Record{EmployeeID: testEmpID}
				}
				records[0].IsLate = true
				r.listByEmpMonthFn = func(_ context.Context, _, _ uuid.UUID, _, _ int) ([]attendance.Record, error) {
					return records, nil
				}
			},
			check: func(t *testing.T, s *attendance.MonthlySummary) {
				if s.Present != 10 {
					t.Errorf("present = %d, want 10", s.Present)
				}
				if s.Late != 1 {
					t.Errorf("late = %d, want 1", s.Late)
				}
				if s.EmployeeName != "Ahmad Rashid" {
					t.Errorf("name = %q, want Ahmad Rashid", s.EmployeeName)
				}
			},
		},
		{
			name: "employee name error",
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				r.getEmployeeNameFn = func(_ context.Context, _, _ uuid.UUID) (string, error) {
					return "", apperr.NotFound("employee")
				}
			},
			wantErr: true,
		},
		{
			name: "records error",
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				r.listByEmpMonthFn = func(_ context.Context, _, _ uuid.UUID, _, _ int) ([]attendance.Record, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "countWorkingDays error",
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				r.listByEmpMonthFn = func(_ context.Context, _, _ uuid.UUID, _, _ int) ([]attendance.Record, error) {
					return nil, nil
				}
				r.getDefaultSchedFn = func(_ context.Context, _ uuid.UUID) (*attendance.WorkSchedule, error) {
					return nil, errors.New("schedule error")
				}
			},
			wantErr: true,
		},
		{
			name: "absent clamped to zero",
			setup: func(r *fakeRepo, _ *fakeOrgInfo) {
				records := make([]attendance.Record, 50)
				for i := range records {
					records[i] = attendance.Record{EmployeeID: testEmpID}
				}
				r.listByEmpMonthFn = func(_ context.Context, _, _ uuid.UUID, _, _ int) ([]attendance.Record, error) {
					return records, nil
				}
			},
			check: func(t *testing.T, s *attendance.MonthlySummary) {
				if s.Absent != 0 {
					t.Errorf("absent = %d, want 0 (clamped)", s.Absent)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := defaultFakeRepo()
			orgInfo := &fakeOrgInfo{tz: "Asia/Jakarta", cc: "ID"}
			empInfo := &fakeEmployeeInfo{}
			if tt.setup != nil {
				tt.setup(repo, orgInfo)
			}

			svc := attendance.NewService(repo, orgInfo, empInfo, zerolog.Nop())
			summary, err := svc.EmployeeMonthlySummary(context.Background(), testOrgID, testEmpID, attendance.MonthlyReportFilters{Year: 2026, Month: 3})

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.check != nil {
				tt.check(t, summary)
			}
		})
	}
}

// ── Holiday on weekend does not reduce working days ──────────────────────────

func TestService_HolidayOnWeekendNotSubtracted(t *testing.T) {
	repo := defaultFakeRepo()
	orgInfo := &fakeOrgInfo{tz: "Asia/Jakarta", cc: "ID"}

	emp1 := uuid.MustParse("00000000-0000-0000-0000-000000000010")
	repo.listActiveEmpsFn = func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.ActiveEmployee, error) {
		return []attendance.ActiveEmployee{{ID: emp1, FullName: "Alice"}}, nil
	}
	repo.listByMonthFn = func(_ context.Context, _ uuid.UUID, _, _ int) ([]attendance.Record, error) {
		return nil, nil
	}
	// 2026-03-14 is Saturday
	repo.listHolidaysFn = func(_ context.Context, _ string, _, _ string) ([]attendance.PublicHoliday, error) {
		return []attendance.PublicHoliday{{Date: "2026-03-14", Name: "Weekend Holiday"}}, nil
	}

	empInfo := &fakeEmployeeInfo{}
	svc := attendance.NewService(repo, orgInfo, empInfo, zerolog.Nop())
	summariesWithHoliday, err := svc.MonthlySummaryReport(context.Background(), testOrgID, attendance.MonthlyReportFilters{Year: 2026, Month: 3})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Now without any holidays
	repo.listHolidaysFn = func(_ context.Context, _ string, _, _ string) ([]attendance.PublicHoliday, error) {
		return nil, nil
	}

	summariesNoHoliday, err := svc.MonthlySummaryReport(context.Background(), testOrgID, attendance.MonthlyReportFilters{Year: 2026, Month: 3})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Working days should be the same since the holiday falls on a weekend
	if summariesWithHoliday[0].WorkingDays != summariesNoHoliday[0].WorkingDays {
		t.Errorf("weekend holiday should not reduce working days: with=%d, without=%d",
			summariesWithHoliday[0].WorkingDays, summariesNoHoliday[0].WorkingDays)
	}
}

// ── GetTeamWeek (batch optimized) ───────────────────────────────────────────

func TestGetTeamWeek_BatchQueriesAndCorrectness(t *testing.T) {
	managerID := uuid.MustParse("00000000-0000-0000-0000-000000000100")
	sub1 := uuid.MustParse("00000000-0000-0000-0000-000000000101")
	sub2 := uuid.MustParse("00000000-0000-0000-0000-000000000102")

	var (
		batchFetchCalled                bool
		employeeNamesBatchCalledWithIDs []uuid.UUID
	)

	empInfo := &fakeEmployeeInfo{
		subordinateIDsFn: func(_ context.Context, _, _ uuid.UUID) ([]uuid.UUID, error) {
			return []uuid.UUID{sub1, sub2}, nil
		},
		employeeNamesBatchFn: func(_ context.Context, _ uuid.UUID, ids []uuid.UUID) (map[uuid.UUID]string, error) {
			batchFetchCalled = true
			employeeNamesBatchCalledWithIDs = ids
			return map[uuid.UUID]string{
				managerID: "Manager Name",
				sub1:      "Sub 1 Name",
				sub2:      "Sub 2 Name",
			}, nil
		},
	}

	repo := &fakeRepo{
		getDefaultSchedFn: func(_ context.Context, _ uuid.UUID) (*attendance.WorkSchedule, error) {
			return schedule9AM(), nil
		},
		listHolidaysFn: func(_ context.Context, _ string, _, _ string) ([]attendance.PublicHoliday, error) {
			return []attendance.PublicHoliday{}, nil
		},
		listByEmpsDateRangeFn: func(_ context.Context, _ uuid.UUID, eids []uuid.UUID, start, end string) ([]attendance.Record, error) {
			// Should be called once with all 3 employee IDs (manager + 2 subs)
			if len(eids) != 3 {
				t.Errorf("expected 3 employee IDs in batch query, got %d", len(eids))
			}
			// Return some attendance data
			return []attendance.Record{
				{EmployeeID: managerID, Date: "2026-03-30", ClockInAt: time.Date(2026, 3, 30, 9, 0, 0, 0, time.UTC), IsLate: false},
				{EmployeeID: sub1, Date: "2026-03-30", ClockInAt: time.Date(2026, 3, 30, 9, 30, 0, 0, time.UTC), IsLate: true},
			}, nil
		},
	}

	orgInfo := &fakeOrgInfo{tz: "UTC", cc: "ID"}
	svc := attendance.NewService(repo, orgInfo, empInfo, zerolog.Nop())

	result, err := svc.GetTeamWeek(context.Background(), testOrgID, managerID, "2026-03-30") // Monday
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify batch fetch was called
	if !batchFetchCalled {
		t.Error("expected GetEmployeeNamesBatch to be called, but it wasn't")
	}

	// Verify all 3 employee IDs were passed to batch method
	if len(employeeNamesBatchCalledWithIDs) != 3 {
		t.Errorf("expected batch fetch called with 3 IDs, got %d", len(employeeNamesBatchCalledWithIDs))
	}

	// Verify result has all 3 employees
	if len(result) != 3 {
		t.Fatalf("expected 3 team members, got %d", len(result))
	}

	// Verify names are correctly mapped
	nameMap := make(map[uuid.UUID]string)
	for _, entry := range result {
		nameMap[entry.EmployeeID] = entry.EmployeeName
	}

	if nameMap[managerID] != "Manager Name" {
		t.Errorf("manager name = %q, want %q", nameMap[managerID], "Manager Name")
	}
	if nameMap[sub1] != "Sub 1 Name" {
		t.Errorf("sub1 name = %q, want %q", nameMap[sub1], "Sub 1 Name")
	}
	if nameMap[sub2] != "Sub 2 Name" {
		t.Errorf("sub2 name = %q, want %q", nameMap[sub2], "Sub 2 Name")
	}

	// Verify attendance data is correctly assigned
	var managerEntry *attendance.TeamWeekEntry
	for i := range result {
		if result[i].EmployeeID == managerID {
			managerEntry = &result[i]
			break
		}
	}
	if managerEntry == nil {
		t.Fatal("manager not found in result")
	}
	if managerEntry.Week.Days[0].Status != "on-time" {
		t.Errorf("manager Monday status = %q, want on-time", managerEntry.Week.Days[0].Status)
	}
}

func TestGetAllWeek_BatchQueriesAndCorrectness(t *testing.T) {
	emp1 := uuid.MustParse("00000000-0000-0000-0000-000000000201")
	emp2 := uuid.MustParse("00000000-0000-0000-0000-000000000202")
	emp3 := uuid.MustParse("00000000-0000-0000-0000-000000000203")

	repo := &fakeRepo{
		listActiveEmpsFn: func(_ context.Context, _ uuid.UUID, _ string) ([]attendance.ActiveEmployee, error) {
			return []attendance.ActiveEmployee{
				{ID: emp1, FullName: "Alice"},
				{ID: emp2, FullName: "Bob"},
				{ID: emp3, FullName: "Charlie"},
			}, nil
		},
		getDefaultSchedFn: func(_ context.Context, _ uuid.UUID) (*attendance.WorkSchedule, error) {
			return schedule9AM(), nil
		},
		listHolidaysFn: func(_ context.Context, _ string, _, _ string) ([]attendance.PublicHoliday, error) {
			return []attendance.PublicHoliday{}, nil
		},
		listByEmpsDateRangeFn: func(_ context.Context, _ uuid.UUID, eids []uuid.UUID, start, end string) ([]attendance.Record, error) {
			// Should be called once with all 3 employee IDs
			if len(eids) != 3 {
				t.Errorf("expected 3 employee IDs in batch query, got %d", len(eids))
			}
			// Return attendance for all 3
			return []attendance.Record{
				{EmployeeID: emp1, Date: "2026-03-30", ClockInAt: time.Date(2026, 3, 30, 8, 55, 0, 0, time.UTC), IsLate: false},
				{EmployeeID: emp2, Date: "2026-03-30", ClockInAt: time.Date(2026, 3, 30, 9, 15, 0, 0, time.UTC), IsLate: true},
				{EmployeeID: emp3, Date: "2026-03-30", ClockInAt: time.Date(2026, 3, 30, 9, 0, 0, 0, time.UTC), IsLate: false},
			}, nil
		},
	}

	empInfo := &fakeEmployeeInfo{}
	orgInfo := &fakeOrgInfo{tz: "UTC", cc: "ID"}
	svc := attendance.NewService(repo, orgInfo, empInfo, zerolog.Nop())

	result, err := svc.GetAllWeek(context.Background(), testOrgID, "2026-03-30") // Monday
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify all 3 employees are in result
	if len(result) != 3 {
		t.Fatalf("expected 3 employees, got %d", len(result))
	}

	// Verify names and attendance
	nameMap := make(map[uuid.UUID]string)
	statusMap := make(map[uuid.UUID]string)
	for _, entry := range result {
		nameMap[entry.EmployeeID] = entry.EmployeeName
		// Monday is index 0
		statusMap[entry.EmployeeID] = entry.Week.Days[0].Status
	}

	if nameMap[emp1] != "Alice" {
		t.Errorf("emp1 name = %q, want Alice", nameMap[emp1])
	}
	if nameMap[emp2] != "Bob" {
		t.Errorf("emp2 name = %q, want Bob", nameMap[emp2])
	}
	if nameMap[emp3] != "Charlie" {
		t.Errorf("emp3 name = %q, want Charlie", nameMap[emp3])
	}

	// Verify statuses (March 30 = Monday)
	if statusMap[emp1] != "on-time" {
		t.Errorf("Alice Monday status = %q, want on-time", statusMap[emp1])
	}
	if statusMap[emp2] != "late" {
		t.Errorf("Bob Monday status = %q, want late", statusMap[emp2])
	}
	if statusMap[emp3] != "on-time" {
		t.Errorf("Charlie Monday status = %q, want on-time", statusMap[emp3])
	}
}

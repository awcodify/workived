package attendance

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/pkg/apperr"
)

// RepositoryInterface is the data access interface the service depends on.
type RepositoryInterface interface {
	GetByEmployeeAndDate(ctx context.Context, orgID, employeeID uuid.UUID, date string) (*Record, error)
	Create(ctx context.Context, orgID, employeeID uuid.UUID, date string, clockInAt time.Time, isLate bool, note *string) (*Record, error)
	UpdateClockOut(ctx context.Context, orgID, employeeID uuid.UUID, date string, clockOutAt time.Time, note *string) (*Record, error)
	ListByDate(ctx context.Context, orgID uuid.UUID, date string) ([]Record, error)
	ListByMonth(ctx context.Context, orgID uuid.UUID, year, month int) ([]Record, error)
	ListByEmployeeMonth(ctx context.Context, orgID, employeeID uuid.UUID, year, month int) ([]Record, error)
	GetDefaultSchedule(ctx context.Context, orgID uuid.UUID) (*WorkSchedule, error)
	ListHolidays(ctx context.Context, countryCode string, startDate, endDate string) ([]PublicHoliday, error)
	ListActiveEmployees(ctx context.Context, orgID uuid.UUID) ([]ActiveEmployee, error)
	GetEmployeeName(ctx context.Context, orgID, employeeID uuid.UUID) (string, error)
}

// OrgInfoProvider is the narrow interface for org data the attendance service needs.
type OrgInfoProvider interface {
	GetOrgTimezone(ctx context.Context, orgID uuid.UUID) (string, error)
	GetOrgCountryCode(ctx context.Context, orgID uuid.UUID) (string, error)
}

// NowFunc can be replaced in tests to control time.
type NowFunc func() time.Time

type Service struct {
	repo    RepositoryInterface
	orgRepo OrgInfoProvider
	now     NowFunc
	log     zerolog.Logger
}

func NewService(repo RepositoryInterface, orgRepo OrgInfoProvider, log zerolog.Logger) *Service {
	return &Service{
		repo:    repo,
		orgRepo: orgRepo,
		now:     func() time.Time { return time.Now().UTC() },
		log:     log,
	}
}

// SetNowFunc overrides the clock — used in tests only.
func (s *Service) SetNowFunc(fn NowFunc) {
	s.now = fn
}

// ClockIn creates a new attendance record for today.
func (s *Service) ClockIn(ctx context.Context, orgID uuid.UUID, req ClockInRequest) (*Record, error) {
	now := s.now()

	tz, err := s.orgRepo.GetOrgTimezone(ctx, orgID)
	if err != nil {
		return nil, err
	}

	loc, err := time.LoadLocation(tz)
	if err != nil {
		return nil, fmt.Errorf("invalid timezone %q: %w", tz, err)
	}

	localNow := now.In(loc)
	today := localNow.Format("2006-01-02")

	// Check for duplicate clock-in
	existing, err := s.repo.GetByEmployeeAndDate(ctx, orgID, req.EmployeeID, today)
	if err != nil {
		var appErr *apperr.AppError
		if !isNotFound(err, &appErr) {
			return nil, err
		}
	}
	if existing != nil {
		return nil, apperr.Conflict("already clocked in today")
	}

	// Determine late status
	isLate := false
	schedule, err := s.repo.GetDefaultSchedule(ctx, orgID)
	if err != nil {
		return nil, err
	}
	if schedule != nil {
		isLate = s.checkLate(localNow, schedule)
	}

	rec, err := s.repo.Create(ctx, orgID, req.EmployeeID, today, now, isLate, req.Note)
	if err != nil {
		return nil, err
	}

	// Log business event
	s.log.Info().
		Str("org_id", orgID.String()).
		Str("employee_id", req.EmployeeID.String()).
		Str("date", today).
		Time("clock_in_at", now).
		Bool("is_late", isLate).
		Msg("attendance.clock_in")

	return rec, nil
}

// ClockOut updates today's attendance record with the clock-out time.
func (s *Service) ClockOut(ctx context.Context, orgID uuid.UUID, req ClockOutRequest) (*Record, error) {
	now := s.now()

	tz, err := s.orgRepo.GetOrgTimezone(ctx, orgID)
	if err != nil {
		return nil, err
	}

	loc, err := time.LoadLocation(tz)
	if err != nil {
		return nil, fmt.Errorf("invalid timezone %q: %w", tz, err)
	}

	today := now.In(loc).Format("2006-01-02")

	// Verify record exists and hasn't already been clocked out
	existing, err := s.repo.GetByEmployeeAndDate(ctx, orgID, req.EmployeeID, today)
	if err != nil {
		return nil, err
	}
	if existing.ClockOutAt != nil {
		return nil, apperr.Conflict("already clocked out today")
	}

	rec, err := s.repo.UpdateClockOut(ctx, orgID, req.EmployeeID, today, now, req.Note)
	if err != nil {
		return nil, err
	}

	// Log business event
	duration := now.Sub(existing.ClockInAt)
	s.log.Info().
		Str("org_id", orgID.String()).
		Str("employee_id", req.EmployeeID.String()).
		Str("date", today).
		Time("clock_out_at", now).
		Dur("duration", duration).
		Msg("attendance.clock_out")

	return rec, nil
}

// GetToday returns the current user's attendance record for today.
func (s *Service) GetToday(ctx context.Context, orgID, employeeID uuid.UUID) (*Record, error) {
	tz, err := s.orgRepo.GetOrgTimezone(ctx, orgID)
	if err != nil {
		return nil, err
	}

	loc, err := time.LoadLocation(tz)
	if err != nil {
		return nil, fmt.Errorf("invalid timezone %q: %w", tz, err)
	}

	today := s.now().In(loc).Format("2006-01-02")
	return s.repo.GetByEmployeeAndDate(ctx, orgID, employeeID, today)
}

// DailyReport builds a list of all employees' attendance for a given date.
// Absent = an active employee with no attendance record on a working day.
func (s *Service) DailyReport(ctx context.Context, orgID uuid.UUID, filters DailyReportFilters) ([]DailyEntry, error) {
	employees, err := s.repo.ListActiveEmployees(ctx, orgID)
	if err != nil {
		return nil, err
	}

	records, err := s.repo.ListByDate(ctx, orgID, filters.Date)
	if err != nil {
		return nil, err
	}

	// Index records by employee_id
	recordMap := make(map[uuid.UUID]Record, len(records))
	for _, rec := range records {
		recordMap[rec.EmployeeID] = rec
	}

	entries := make([]DailyEntry, 0, len(employees))
	for _, emp := range employees {
		entry := DailyEntry{
			EmployeeID:   emp.ID,
			EmployeeName: emp.FullName,
		}
		if rec, ok := recordMap[emp.ID]; ok {
			if rec.IsLate {
				entry.Status = "late"
			} else {
				entry.Status = "present"
			}
			entry.ClockInAt = &rec.ClockInAt
			entry.ClockOutAt = rec.ClockOutAt
		} else {
			entry.Status = "absent"
		}
		entries = append(entries, entry)
	}

	return entries, nil
}

// MonthlySummaryReport generates per-employee attendance summaries for a month.
func (s *Service) MonthlySummaryReport(ctx context.Context, orgID uuid.UUID, filters MonthlyReportFilters) ([]MonthlySummary, error) {
	employees, err := s.repo.ListActiveEmployees(ctx, orgID)
	if err != nil {
		return nil, err
	}

	records, err := s.repo.ListByMonth(ctx, orgID, filters.Year, filters.Month)
	if err != nil {
		return nil, err
	}

	workingDays, err := s.countWorkingDays(ctx, orgID, filters.Year, filters.Month)
	if err != nil {
		return nil, err
	}

	// Index records by employee_id
	type empCounts struct {
		present int
		late    int
	}
	countMap := make(map[uuid.UUID]*empCounts, len(employees))
	for _, rec := range records {
		c, ok := countMap[rec.EmployeeID]
		if !ok {
			c = &empCounts{}
			countMap[rec.EmployeeID] = c
		}
		c.present++
		if rec.IsLate {
			c.late++
		}
	}

	summaries := make([]MonthlySummary, 0, len(employees))
	for _, emp := range employees {
		c := countMap[emp.ID]
		present := 0
		late := 0
		if c != nil {
			present = c.present
			late = c.late
		}
		absent := workingDays - present
		if absent < 0 {
			absent = 0
		}

		summaries = append(summaries, MonthlySummary{
			EmployeeID:   emp.ID,
			EmployeeName: emp.FullName,
			Present:      present,
			Late:         late,
			Absent:       absent,
			WorkingDays:  workingDays,
		})
	}

	return summaries, nil
}

// EmployeeMonthlySummary generates a monthly summary for a single employee.
func (s *Service) EmployeeMonthlySummary(ctx context.Context, orgID, employeeID uuid.UUID, filters MonthlyReportFilters) (*MonthlySummary, error) {
	name, err := s.repo.GetEmployeeName(ctx, orgID, employeeID)
	if err != nil {
		return nil, err
	}

	records, err := s.repo.ListByEmployeeMonth(ctx, orgID, employeeID, filters.Year, filters.Month)
	if err != nil {
		return nil, err
	}

	workingDays, err := s.countWorkingDays(ctx, orgID, filters.Year, filters.Month)
	if err != nil {
		return nil, err
	}

	present := len(records)
	late := 0
	for _, rec := range records {
		if rec.IsLate {
			late++
		}
	}
	absent := workingDays - present
	if absent < 0 {
		absent = 0
	}

	return &MonthlySummary{
		EmployeeID:   employeeID,
		EmployeeName: name,
		Present:      present,
		Late:         late,
		Absent:       absent,
		WorkingDays:  workingDays,
	}, nil
}

// ── Internal helpers ─────────────────────────────────────────────────────────

// checkLate determines if the local clock-in time is past the schedule start time.
func (s *Service) checkLate(localNow time.Time, schedule *WorkSchedule) bool {
	weekday := int(localNow.Weekday()) // 0=Sun, 6=Sat
	isWorkDay := false
	for _, wd := range schedule.WorkDays {
		if wd == weekday {
			isWorkDay = true
			break
		}
	}
	if !isWorkDay {
		return false
	}

	// Compare time-of-day only
	clockInTime := localNow.Hour()*60 + localNow.Minute()
	scheduleTime := schedule.StartTime.Hour()*60 + schedule.StartTime.Minute()

	return clockInTime > scheduleTime
}

// countWorkingDays computes the number of working days in a month,
// subtracting public holidays that fall on working days.
func (s *Service) countWorkingDays(ctx context.Context, orgID uuid.UUID, year, month int) (int, error) {
	schedule, err := s.repo.GetDefaultSchedule(ctx, orgID)
	if err != nil {
		return 0, err
	}

	// If no schedule configured, assume 5-day week (Mon-Fri)
	workDays := []int{1, 2, 3, 4, 5}
	if schedule != nil {
		workDays = schedule.WorkDays
	}

	workDaySet := make(map[int]bool, len(workDays))
	for _, wd := range workDays {
		workDaySet[wd] = true
	}

	// Count calendar working days in the month
	startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	endDate := startDate.AddDate(0, 1, -1)

	count := 0
	for d := startDate; !d.After(endDate); d = d.AddDate(0, 0, 1) {
		if workDaySet[int(d.Weekday())] {
			count++
		}
	}

	// Subtract public holidays that fall on working days
	countryCode, err := s.orgRepo.GetOrgCountryCode(ctx, orgID)
	if err != nil {
		return 0, err
	}

	holidays, err := s.repo.ListHolidays(ctx, countryCode, startDate.Format("2006-01-02"), endDate.Format("2006-01-02"))
	if err != nil {
		return 0, err
	}

	for _, h := range holidays {
		hDate, parseErr := time.Parse("2006-01-02", h.Date)
		if parseErr != nil {
			continue
		}
		if workDaySet[int(hDate.Weekday())] {
			count--
		}
	}

	return count, nil
}

func isNotFound(err error, _ **apperr.AppError) bool {
	return apperr.IsCode(err, apperr.CodeNotFound)
}

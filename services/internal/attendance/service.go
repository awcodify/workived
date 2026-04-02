package attendance

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/cache"
)

// RepositoryInterface is the data access interface the service depends on.
type RepositoryInterface interface {
	GetByEmployeeAndDate(ctx context.Context, orgID, employeeID uuid.UUID, date string) (*Record, error)
	Create(ctx context.Context, orgID, employeeID uuid.UUID, date string, clockInAt time.Time, isLate bool, note *string) (*Record, error)
	UpdateClockOut(ctx context.Context, orgID, employeeID uuid.UUID, date string, clockOutAt time.Time, note *string) (*Record, error)
	ListByDate(ctx context.Context, orgID uuid.UUID, date string) ([]Record, error)
	ListByMonth(ctx context.Context, orgID uuid.UUID, year, month int) ([]Record, error)
	ListByEmployeeMonth(ctx context.Context, orgID, employeeID uuid.UUID, year, month int) ([]Record, error)
	ListByEmployeesDateRange(ctx context.Context, orgID uuid.UUID, employeeIDs []uuid.UUID, startDate, endDate string) ([]Record, error)
	GetDefaultSchedule(ctx context.Context, orgID uuid.UUID) (*WorkSchedule, error)
	GetScheduleForEmployee(ctx context.Context, orgID, employeeID uuid.UUID) (*WorkSchedule, error)
	ListHolidays(ctx context.Context, countryCode string, startDate, endDate string) ([]PublicHoliday, error)
	ListActiveEmployees(ctx context.Context, orgID uuid.UUID, date string) ([]ActiveEmployee, error)
	GetEmployeeName(ctx context.Context, orgID, employeeID uuid.UUID) (string, error)
	ListWorkSchedules(ctx context.Context, orgID uuid.UUID) ([]WorkScheduleListItem, error)
	CreateWorkSchedule(ctx context.Context, orgID uuid.UUID, req CreateWorkScheduleRequest) (*WorkScheduleListItem, error)
	UpdateWorkSchedule(ctx context.Context, orgID, scheduleID uuid.UUID, req UpdateWorkScheduleRequest) (*WorkScheduleListItem, error)
	DeactivateWorkSchedule(ctx context.Context, orgID, scheduleID uuid.UUID) error
	IsDefaultSchedule(ctx context.Context, orgID, scheduleID uuid.UUID) (bool, error)
	CountEmployeesBySchedule(ctx context.Context, orgID, scheduleID uuid.UUID) (int, error)
}

// OrgInfoProvider is the narrow interface for org data the attendance service needs.
type OrgInfoProvider interface {
	GetOrgTimezone(ctx context.Context, orgID uuid.UUID) (string, error)
	GetOrgCountryCode(ctx context.Context, orgID uuid.UUID) (string, error)
}

// EmployeeInfoProvider provides employee relationship data for team attendance views.
type EmployeeInfoProvider interface {
	GetSubordinateIDs(ctx context.Context, orgID, managerID uuid.UUID) ([]uuid.UUID, error)
	GetEmployeeProfile(ctx context.Context, orgID, employeeID uuid.UUID) (name string, email *string, managerID *uuid.UUID, err error)
	GetEmployeeNamesBatch(ctx context.Context, orgID uuid.UUID, employeeIDs []uuid.UUID) (map[uuid.UUID]string, error)
}

// NowFunc can be replaced in tests to control time.
type NowFunc func() time.Time

type Service struct {
	repo         RepositoryInterface
	orgRepo      OrgInfoProvider
	employeeRepo EmployeeInfoProvider
	now          NowFunc
	log          zerolog.Logger
	cache        *cache.Store
}

func NewService(repo RepositoryInterface, orgRepo OrgInfoProvider, employeeRepo EmployeeInfoProvider, log zerolog.Logger, opts ...ServiceOption) *Service {
	s := &Service{
		repo:         repo,
		orgRepo:      orgRepo,
		employeeRepo: employeeRepo,
		now:          func() time.Time { return time.Now().UTC() },
		log:          log,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
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

	// Determine late status using employee-specific schedule
	isLate := false
	schedule, err := s.getScheduleForEmployeeCached(ctx, orgID, req.EmployeeID)
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
	employees, err := s.repo.ListActiveEmployees(ctx, orgID, filters.Date)
	if err != nil {
		return nil, err
	}

	// Filter to specific employee if provided (non-admin view)
	if filters.EmployeeID != nil {
		filteredEmployees := make([]ActiveEmployee, 0, 1)
		for _, emp := range employees {
			if emp.ID == *filters.EmployeeID {
				filteredEmployees = append(filteredEmployees, emp)
				break
			}
		}
		employees = filteredEmployees
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
	// Use last day of month to include all employees who started within the month
	lastDay := time.Date(filters.Year, time.Month(filters.Month)+1, 0, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
	employees, err := s.repo.ListActiveEmployees(ctx, orgID, lastDay)
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

// GetEmployeeWeek returns a 7-day week calendar (Mon-Sun) for a single employee.
// startDate must be a Monday in "YYYY-MM-DD" format.
func (s *Service) GetEmployeeWeek(ctx context.Context, orgID, employeeID uuid.UUID, startDate string) (*WeekCalendar, error) {
	// Parse start date
	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return nil, apperr.NewField(apperr.CodeValidation, "invalid start_date format, expected YYYY-MM-DD", "start_date")
	}

	// Verify it's a Monday
	if start.Weekday() != time.Monday {
		return nil, apperr.NewField(apperr.CodeValidation, "start_date must be a Monday", "start_date")
	}

	// Get org timezone for "today" calculation
	tz, err := s.orgRepo.GetOrgTimezone(ctx, orgID)
	if err != nil {
		return nil, err
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return nil, fmt.Errorf("invalid timezone %q: %w", tz, err)
	}

	now := s.now()
	localNow := now.In(loc)
	todayStr := localNow.Format("2006-01-02")

	// Get employee-specific work schedule and holidays
	schedule, err := s.getScheduleForEmployeeCached(ctx, orgID, employeeID)
	if err != nil {
		return nil, err
	}
	workDays := []int{1, 2, 3, 4, 5} // Default Mon-Fri
	if schedule != nil {
		workDays = schedule.WorkDays
	}
	workDaySet := make(map[int]bool, len(workDays))
	for _, wd := range workDays {
		workDaySet[wd] = true
	}

	endDate := start.AddDate(0, 0, 6) // Sunday
	countryCode, err := s.orgRepo.GetOrgCountryCode(ctx, orgID)
	if err != nil {
		return nil, err
	}
	holidays, err := s.repo.ListHolidays(ctx, countryCode, start.Format("2006-01-02"), endDate.Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	holidaySet := make(map[string]bool, len(holidays))
	for _, h := range holidays {
		holidaySet[h.Date] = true
	}

	// Fetch attendance records for the week's month(s)
	// A week can span two months, so we need to handle both
	startYear, startMonth, _ := start.Date()
	endYear, endMonth, _ := endDate.Date()

	var records []Record
	if startYear == endYear && startMonth == endMonth {
		// Week within single month
		records, err = s.repo.ListByEmployeeMonth(ctx, orgID, employeeID, startYear, int(startMonth))
		if err != nil {
			return nil, err
		}
	} else {
		// Week spans two months
		r1, err1 := s.repo.ListByEmployeeMonth(ctx, orgID, employeeID, startYear, int(startMonth))
		if err1 != nil {
			return nil, err1
		}
		r2, err2 := s.repo.ListByEmployeeMonth(ctx, orgID, employeeID, endYear, int(endMonth))
		if err2 != nil {
			return nil, err2
		}
		records = append(r1, r2...)
	}

	// Build map: date → record
	recordMap := make(map[string]*Record, len(records))
	for i := range records {
		recordMap[records[i].Date] = &records[i]
	}

	// Generate 7 days
	days := make([]WeekDay, 7)
	for i := 0; i < 7; i++ {
		d := start.AddDate(0, 0, i)
		dateStr := d.Format("2006-01-02")
		dayName := d.Format("Mon")
		dayNumber := d.Day()

		weekDay := WeekDay{
			Date:      dateStr,
			DayName:   dayName,
			DayNumber: dayNumber,
			IsToday:   dateStr == todayStr,
		}

		// Determine status
		isFuture := d.After(localNow.Truncate(24 * time.Hour))
		isHoliday := holidaySet[dateStr]
		isWeekendDay := !workDaySet[int(d.Weekday())]
		isWorkDay := !isHoliday && !isWeekendDay
		rec := recordMap[dateStr]

		if isFuture {
			weekDay.Status = "future"
		} else if rec != nil {
			// Has attendance record
			if !isWorkDay {
				// Clocked in on weekend/holiday = overtime
				weekDay.Status = "overtime"
			} else if rec.IsLate {
				weekDay.Status = "late"
			} else {
				weekDay.Status = "on-time"
			}
			weekDay.ClockInAt = &rec.ClockInAt
			weekDay.ClockOutAt = rec.ClockOutAt
		} else if isHoliday {
			// Public holiday with no attendance
			weekDay.Status = "holiday"
		} else if isWeekendDay {
			// Weekend with no attendance
			weekDay.Status = "weekend"
		} else {
			// No record on past working day
			weekDay.Status = "absent"
		}

		days[i] = weekDay
	}

	return &WeekCalendar{
		StartDate: start.Format("2006-01-02"),
		EndDate:   endDate.Format("2006-01-02"),
		Days:      days,
	}, nil
}

// GetTeamWeek returns week calendars for the manager and all their subordinates.
// startDate must be a Monday in "YYYY-MM-DD" format.
// GetTeamWeek returns week calendars for the manager and all their subordinates.
// startDate must be a Monday in "YYYY-MM-DD" format.
// Optimized with batch queries to avoid N+1 performance issues.
func (s *Service) GetTeamWeek(ctx context.Context, orgID, managerEmployeeID uuid.UUID, startDate string) ([]TeamWeekEntry, error) {
	// Parse and validate start date
	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return nil, apperr.NewField(apperr.CodeValidation, "invalid start_date format, expected YYYY-MM-DD", "start_date")
	}
	if start.Weekday() != time.Monday {
		return nil, apperr.NewField(apperr.CodeValidation, "start_date must be a Monday", "start_date")
	}

	// Get subordinate employee IDs
	subordinateIDs, err := s.employeeRepo.GetSubordinateIDs(ctx, orgID, managerEmployeeID)
	if err != nil {
		return nil, err
	}

	// Include the manager's own attendance
	employeeIDs := append([]uuid.UUID{managerEmployeeID}, subordinateIDs...)
	if len(employeeIDs) == 0 {
		return []TeamWeekEntry{}, nil
	}

	// Batch fetch employee names
	employeeNames, err := s.employeeRepo.GetEmployeeNamesBatch(ctx, orgID, employeeIDs)
	if err != nil {
		return nil, err
	}

	// Fetch org-level data once (not per employee)
	tz, err := s.orgRepo.GetOrgTimezone(ctx, orgID)
	if err != nil {
		return nil, err
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return nil, fmt.Errorf("invalid timezone %q: %w", tz, err)
	}

	now := s.now()
	localNow := now.In(loc)
	todayStr := localNow.Format("2006-01-02")

	schedule, err := s.repo.GetDefaultSchedule(ctx, orgID)
	if err != nil {
		return nil, err
	}
	workDays := []int{1, 2, 3, 4, 5} // Default Mon-Fri
	if schedule != nil {
		workDays = schedule.WorkDays
	}
	workDaySet := make(map[int]bool, len(workDays))
	for _, wd := range workDays {
		workDaySet[wd] = true
	}

	endDate := start.AddDate(0, 0, 6) // Sunday
	countryCode, err := s.orgRepo.GetOrgCountryCode(ctx, orgID)
	if err != nil {
		return nil, err
	}
	holidays, err := s.repo.ListHolidays(ctx, countryCode, start.Format("2006-01-02"), endDate.Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	holidaySet := make(map[string]bool, len(holidays))
	for _, h := range holidays {
		holidaySet[h.Date] = true
	}

	// Batch fetch attendance records for all employees in the week
	allRecords, err := s.repo.ListByEmployeesDateRange(ctx, orgID, employeeIDs, start.Format("2006-01-02"), endDate.Format("2006-01-02"))
	if err != nil {
		return nil, err
	}

	// Group records by employee ID
	recordsByEmployee := make(map[uuid.UUID]map[string]*Record)
	for i := range allRecords {
		rec := &allRecords[i]
		if recordsByEmployee[rec.EmployeeID] == nil {
			recordsByEmployee[rec.EmployeeID] = make(map[string]*Record)
		}
		recordsByEmployee[rec.EmployeeID][rec.Date] = rec
	}

	// Build week calendar for each employee
	result := make([]TeamWeekEntry, 0, len(employeeIDs))
	for _, employeeID := range employeeIDs {
		name, ok := employeeNames[employeeID]
		if !ok {
			// Employee not found (soft-deleted, etc.) - skip
			continue
		}

		recordMap := recordsByEmployee[employeeID]
		if recordMap == nil {
			recordMap = make(map[string]*Record)
		}

		// Generate 7 days for this employee
		days := make([]WeekDay, 7)
		for i := 0; i < 7; i++ {
			d := start.AddDate(0, 0, i)
			dateStr := d.Format("2006-01-02")
			dayName := d.Format("Mon")
			dayNumber := d.Day()

			weekDay := WeekDay{
				Date:      dateStr,
				DayName:   dayName,
				DayNumber: dayNumber,
				IsToday:   dateStr == todayStr,
			}

			// Determine status
			isFuture := d.After(localNow.Truncate(24 * time.Hour))
			isHoliday := holidaySet[dateStr]
			isWeekendDay := !workDaySet[int(d.Weekday())]
			isWorkDay := !isHoliday && !isWeekendDay
			rec := recordMap[dateStr]

			if isFuture {
				weekDay.Status = "future"
			} else if rec != nil {
				// Has attendance record
				if !isWorkDay {
					// Clocked in on weekend/holiday = overtime
					weekDay.Status = "overtime"
				} else if rec.IsLate {
					weekDay.Status = "late"
				} else {
					weekDay.Status = "on-time"
				}
				weekDay.ClockInAt = &rec.ClockInAt
				weekDay.ClockOutAt = rec.ClockOutAt
			} else if isHoliday {
				// Public holiday with no attendance
				weekDay.Status = "holiday"
			} else if isWeekendDay {
				// Weekend with no attendance
				weekDay.Status = "weekend"
			} else {
				// No record on past working day
				weekDay.Status = "absent"
			}

			days[i] = weekDay
		}

		result = append(result, TeamWeekEntry{
			EmployeeID:   employeeID,
			EmployeeName: name,
			Week: &WeekCalendar{
				StartDate: start.Format("2006-01-02"),
				EndDate:   endDate.Format("2006-01-02"),
				Days:      days,
			},
		})
	}

	return result, nil
}

// GetAllWeek returns week calendars for all active employees in the organization.
// startDate must be a Monday in "YYYY-MM-DD" format.
// GetAllWeek returns week calendars for all active employees in the organization.
// startDate must be a Monday in "YYYY-MM-DD" format.
// Optimized with batch queries to avoid N+1 performance issues.
func (s *Service) GetAllWeek(ctx context.Context, orgID uuid.UUID, startDate string) ([]TeamWeekEntry, error) {
	// Parse and validate start date
	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return nil, apperr.NewField(apperr.CodeValidation, "invalid start_date format, expected YYYY-MM-DD", "start_date")
	}
	if start.Weekday() != time.Monday {
		return nil, apperr.NewField(apperr.CodeValidation, "start_date must be a Monday", "start_date")
	}

	// Get all active employees who started on or before end of week
	endOfWeek := start.AddDate(0, 0, 6).Format("2006-01-02")
	employees, err := s.repo.ListActiveEmployees(ctx, orgID, endOfWeek)
	if err != nil {
		return nil, err
	}

	if len(employees) == 0 {
		return []TeamWeekEntry{}, nil
	}

	// Extract employee IDs and build name map
	employeeIDs := make([]uuid.UUID, len(employees))
	employeeNames := make(map[uuid.UUID]string, len(employees))
	for i, emp := range employees {
		employeeIDs[i] = emp.ID
		employeeNames[emp.ID] = emp.FullName
	}

	// Fetch org-level data once (not per employee)
	tz, err := s.orgRepo.GetOrgTimezone(ctx, orgID)
	if err != nil {
		return nil, err
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return nil, fmt.Errorf("invalid timezone %q: %w", tz, err)
	}

	now := s.now()
	localNow := now.In(loc)
	todayStr := localNow.Format("2006-01-02")

	schedule, err := s.repo.GetDefaultSchedule(ctx, orgID)
	if err != nil {
		return nil, err
	}
	workDays := []int{1, 2, 3, 4, 5} // Default Mon-Fri
	if schedule != nil {
		workDays = schedule.WorkDays
	}
	workDaySet := make(map[int]bool, len(workDays))
	for _, wd := range workDays {
		workDaySet[wd] = true
	}

	endDate := start.AddDate(0, 0, 6) // Sunday
	countryCode, err := s.orgRepo.GetOrgCountryCode(ctx, orgID)
	if err != nil {
		return nil, err
	}
	holidays, err := s.repo.ListHolidays(ctx, countryCode, start.Format("2006-01-02"), endDate.Format("2006-01-02"))
	if err != nil {
		return nil, err
	}
	holidaySet := make(map[string]bool, len(holidays))
	for _, h := range holidays {
		holidaySet[h.Date] = true
	}

	// Batch fetch attendance records for all employees in the week
	allRecords, err := s.repo.ListByEmployeesDateRange(ctx, orgID, employeeIDs, start.Format("2006-01-02"), endDate.Format("2006-01-02"))
	if err != nil {
		return nil, err
	}

	// Group records by employee ID
	recordsByEmployee := make(map[uuid.UUID]map[string]*Record)
	for i := range allRecords {
		rec := &allRecords[i]
		if recordsByEmployee[rec.EmployeeID] == nil {
			recordsByEmployee[rec.EmployeeID] = make(map[string]*Record)
		}
		recordsByEmployee[rec.EmployeeID][rec.Date] = rec
	}

	// Build week calendar for each employee
	result := make([]TeamWeekEntry, 0, len(employeeIDs))
	for _, employeeID := range employeeIDs {
		name := employeeNames[employeeID]

		recordMap := recordsByEmployee[employeeID]
		if recordMap == nil {
			recordMap = make(map[string]*Record)
		}

		// Generate 7 days for this employee
		days := make([]WeekDay, 7)
		for i := 0; i < 7; i++ {
			d := start.AddDate(0, 0, i)
			dateStr := d.Format("2006-01-02")
			dayName := d.Format("Mon")
			dayNumber := d.Day()

			weekDay := WeekDay{
				Date:      dateStr,
				DayName:   dayName,
				DayNumber: dayNumber,
				IsToday:   dateStr == todayStr,
			}

			// Determine status
			isFuture := d.After(localNow.Truncate(24 * time.Hour))
			isHoliday := holidaySet[dateStr]
			isWeekendDay := !workDaySet[int(d.Weekday())]
			isWorkDay := !isHoliday && !isWeekendDay
			rec := recordMap[dateStr]

			if isFuture {
				weekDay.Status = "future"
			} else if rec != nil {
				// Has attendance record
				if !isWorkDay {
					// Clocked in on weekend/holiday = overtime
					weekDay.Status = "overtime"
				} else if rec.IsLate {
					weekDay.Status = "late"
				} else {
					weekDay.Status = "on-time"
				}
				weekDay.ClockInAt = &rec.ClockInAt
				weekDay.ClockOutAt = rec.ClockOutAt
			} else if isHoliday {
				// Public holiday with no attendance
				weekDay.Status = "holiday"
			} else if isWeekendDay {
				// Weekend with no attendance
				weekDay.Status = "weekend"
			} else {
				// No record on past working day
				weekDay.Status = "absent"
			}

			days[i] = weekDay
		}

		result = append(result, TeamWeekEntry{
			EmployeeID:   employeeID,
			EmployeeName: name,
			Week: &WeekCalendar{
				StartDate: start.Format("2006-01-02"),
				EndDate:   endDate.Format("2006-01-02"),
				Days:      days,
			},
		})
	}

	return result, nil
}

// ListWorkSchedules returns all active work schedules for an org.
func (s *Service) ListWorkSchedules(ctx context.Context, orgID uuid.UUID) ([]WorkScheduleListItem, error) {
	return s.listWorkSchedulesCached(ctx, orgID)
}

// CreateWorkSchedule creates a new work schedule for the org.
func (s *Service) CreateWorkSchedule(ctx context.Context, orgID uuid.UUID, req CreateWorkScheduleRequest) (*WorkScheduleListItem, error) {
	ws, err := s.repo.CreateWorkSchedule(ctx, orgID, req)
	if err != nil {
		return nil, err
	}
	s.invalidateScheduleCache(ctx, orgID)
	s.log.Info().
		Str("org_id", orgID.String()).
		Str("schedule_id", ws.ID.String()).
		Str("name", ws.Name).
		Msg("work_schedule.created")
	return ws, nil
}

// UpdateWorkSchedule updates an existing work schedule.
func (s *Service) UpdateWorkSchedule(ctx context.Context, orgID, scheduleID uuid.UUID, req UpdateWorkScheduleRequest) (*WorkScheduleListItem, error) {
	ws, err := s.repo.UpdateWorkSchedule(ctx, orgID, scheduleID, req)
	if err != nil {
		return nil, err
	}
	s.invalidateScheduleCache(ctx, orgID)
	s.log.Info().
		Str("org_id", orgID.String()).
		Str("schedule_id", scheduleID.String()).
		Str("name", req.Name).
		Msg("work_schedule.updated")
	return ws, nil
}

// DeactivateWorkSchedule soft-deletes a work schedule after validation.
func (s *Service) DeactivateWorkSchedule(ctx context.Context, orgID, scheduleID uuid.UUID) error {
	// Cannot deactivate the default schedule
	isDefault, err := s.repo.IsDefaultSchedule(ctx, orgID, scheduleID)
	if err != nil {
		return err
	}
	if isDefault {
		return apperr.New(apperr.CodeValidation, "cannot deactivate the default work schedule")
	}

	if err := s.repo.DeactivateWorkSchedule(ctx, orgID, scheduleID); err != nil {
		return err
	}
	s.invalidateScheduleCache(ctx, orgID)
	s.log.Info().
		Str("org_id", orgID.String()).
		Str("schedule_id", scheduleID.String()).
		Msg("work_schedule.deactivated")
	return nil
}

// CountEmployeesBySchedule returns the number of employees using a schedule.
func (s *Service) CountEmployeesBySchedule(ctx context.Context, orgID, scheduleID uuid.UUID) (int, error) {
	return s.repo.CountEmployeesBySchedule(ctx, orgID, scheduleID)
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

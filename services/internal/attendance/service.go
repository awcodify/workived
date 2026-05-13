package attendance

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/cache"
)

// RepositoryInterface is the data access interface the service depends on.
type RepositoryInterface interface {
	GetByEmployeeAndDate(ctx context.Context, orgID, employeeID uuid.UUID, date string) (*Record, error)
	Create(ctx context.Context, orgID, employeeID uuid.UUID, date string, clockInAt time.Time, isLate bool, note *string, latitude, longitude *float64, photoURL *string) (*Record, error)
	UpdateClockOut(ctx context.Context, orgID, employeeID uuid.UUID, date string, clockOutAt time.Time, isLeavingEarly, isOvertime bool, note *string, latitude, longitude *float64, photoURL *string) (*Record, error)
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
	AssignScheduleToUnassignedEmployees(ctx context.Context, orgID, scheduleID uuid.UUID) (int64, error)
	GetLocationCounts(ctx context.Context, orgID uuid.UUID, startDate, endDate string) (map[string]int, error)
	// Corrections
	CreateCorrection(ctx context.Context, orgID, employeeID uuid.UUID, date string, recordID *uuid.UUID, origIn, origOut, reqIn, reqOut *time.Time, reason string) (*Correction, error)
	GetCorrection(ctx context.Context, orgID, correctionID uuid.UUID) (*Correction, error)
	GetPendingCorrectionByDate(ctx context.Context, orgID, employeeID uuid.UUID, date string) (*Correction, error)
	ListCorrections(ctx context.Context, orgID uuid.UUID, f ListCorrectionsFilter) ([]Correction, error)
	ApproveCorrection(ctx context.Context, orgID, correctionID, reviewerID uuid.UUID, now time.Time) (*Correction, error)
	ApproveCorrectionTx(ctx context.Context, orgID, correctionID, reviewerID uuid.UUID, now time.Time, isLeavingEarly, isOvertime bool) (*Correction, error)
	RejectCorrection(ctx context.Context, orgID, correctionID, reviewerID uuid.UUID, rejectionReason *string, now time.Time) (*Correction, error)
	CancelCorrection(ctx context.Context, orgID, correctionID, employeeID uuid.UUID) error
	ApplyCorrection(ctx context.Context, orgID uuid.UUID, recordID uuid.UUID, clockIn, clockOut *time.Time, isLeavingEarly, isOvertime bool) error
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
	GetEmployeeScheduleNamesBatch(ctx context.Context, orgID uuid.UUID, employeeIDs []uuid.UUID) (map[uuid.UUID]*string, error)
}

// LeaveInfoProvider is the narrow interface for leave data the attendance service needs.
type LeaveInfoProvider interface {
	ListApprovedLeaveDates(ctx context.Context, orgID, employeeID uuid.UUID, startDate, endDate string) ([]string, error)
	ListApprovedLeaveDatesBatch(ctx context.Context, orgID uuid.UUID, employeeIDs []uuid.UUID, startDate, endDate string) (map[uuid.UUID]map[string]bool, error)
}

// NowFunc can be replaced in tests to control time.
type NowFunc func() time.Time

type Service struct {
	repo         RepositoryInterface
	orgRepo      OrgInfoProvider
	employeeRepo EmployeeInfoProvider
	leaveRepo    LeaveInfoProvider
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

	// Get employee's work schedule - required for attendance tracking
	schedule, err := s.getScheduleForEmployeeCached(ctx, orgID, req.EmployeeID)
	if err != nil {
		return nil, err
	}
	if schedule == nil {
		return nil, apperr.New(apperr.CodeValidation, "employee has no work schedule assigned")
	}

	// Determine late status
	isLate := s.checkLate(localNow, schedule)

	rec, err := s.repo.Create(ctx, orgID, req.EmployeeID, today, now, isLate, req.Note, req.Latitude, req.Longitude, req.PhotoURL)
	if err != nil {
		return nil, err
	}

	// Log business event
	evt := s.log.Info().
		Str("org_id", orgID.String()).
		Str("employee_id", req.EmployeeID.String()).
		Str("date", today).
		Time("clock_in_at", now).
		Bool("is_late", isLate).
		Bool("has_photo", req.PhotoURL != nil).
		Bool("has_location", req.Latitude != nil && req.Longitude != nil)
	if req.Latitude != nil {
		evt = evt.Float64("latitude", *req.Latitude)
	}
	if req.Longitude != nil {
		evt = evt.Float64("longitude", *req.Longitude)
	}
	evt.Msg("attendance.clock_in")

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

	// Get employee's work schedule - required for attendance tracking
	schedule, err := s.repo.GetScheduleForEmployee(ctx, orgID, req.EmployeeID)
	if err != nil {
		return nil, fmt.Errorf("get employee schedule: %w", err)
	}
	if schedule == nil {
		return nil, apperr.New(apperr.CodeValidation, "employee has no work schedule assigned")
	}

	localNow := now.In(loc)
	isLeavingEarly := s.checkLeavingEarly(localNow, schedule)
	isOvertime := s.checkOvertimeClockOut(localNow, schedule)

	rec, err := s.repo.UpdateClockOut(ctx, orgID, req.EmployeeID, today, now, isLeavingEarly, isOvertime, req.Note, req.Latitude, req.Longitude, req.PhotoURL)
	if err != nil {
		return nil, err
	}

	// Log business event
	duration := now.Sub(existing.ClockInAt)
	evtOut := s.log.Info().
		Str("org_id", orgID.String()).
		Str("employee_id", req.EmployeeID.String()).
		Str("date", today).
		Time("clock_out_at", now).
		Dur("duration", duration).
		Bool("has_photo", req.PhotoURL != nil).
		Bool("has_location", req.Latitude != nil && req.Longitude != nil)
	if req.Latitude != nil {
		evtOut = evtOut.Float64("latitude", *req.Latitude)
	}
	if req.Longitude != nil {
		evtOut = evtOut.Float64("longitude", *req.Longitude)
	}
	evtOut.Msg("attendance.clock_out")

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
			entry.ClockInLatitude = rec.ClockInLatitude
			entry.ClockInLongitude = rec.ClockInLongitude
			entry.ClockInPhotoURL = rec.ClockInPhotoURL
			entry.WorkLocationType = rec.WorkLocationType
		} else {
			entry.Status = "absent"
		}
		entries = append(entries, entry)
	}

	return entries, nil
}

// LocationAnalyticsReport aggregates clock-in counts by work_location_type for a date range.
func (s *Service) LocationAnalyticsReport(ctx context.Context, orgID uuid.UUID, filters LocationAnalyticsFilters) (*LocationAnalytics, error) {
	tz, err := s.orgRepo.GetOrgTimezone(ctx, orgID)
	if err != nil {
		return nil, err
	}

	loc, err := time.LoadLocation(tz)
	if err != nil {
		loc = time.UTC
	}
	now := s.now().In(loc)
	today := now.Format("2006-01-02")

	startDate := filters.StartDate
	endDate := filters.EndDate

	switch filters.Period {
	case "this_week":
		// Monday of current week
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		monday := now.AddDate(0, 0, -(weekday - 1))
		startDate = monday.Format("2006-01-02")
		endDate = today
	case "this_month":
		startDate = fmt.Sprintf("%d-%02d-01", now.Year(), now.Month())
		endDate = today
	}

	counts, err := s.repo.GetLocationCounts(ctx, orgID, startDate, endDate)
	if err != nil {
		return nil, err
	}

	// Order: office, wfh, remote, unknown
	order := []string{"office", "wfh", "remote", "unknown"}
	total := 0
	for _, c := range counts {
		total += c
	}

	breakdown := make([]LocationBreakdownItem, 0, len(order))
	for _, t := range order {
		c := counts[t]
		if c == 0 {
			continue
		}
		pct := 0.0
		if total > 0 {
			pct = float64(c) / float64(total) * 100
		}
		breakdown = append(breakdown, LocationBreakdownItem{
			Type:       t,
			Count:      c,
			Percentage: math.Round(pct*10) / 10,
		})
	}
	// Also include any types not in the predefined order
	for t, c := range counts {
		found := false
		for _, o := range order {
			if o == t {
				found = true
				break
			}
		}
		if !found {
			pct := float64(c) / float64(total) * 100
			breakdown = append(breakdown, LocationBreakdownItem{
				Type:       t,
				Count:      c,
				Percentage: math.Round(pct*10) / 10,
			})
		}
	}

	return &LocationAnalytics{
		Total:     total,
		Breakdown: breakdown,
		StartDate: startDate,
		EndDate:   endDate,
	}, nil
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
		present      int
		late         int
		leavingEarly int
		overtime     int
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
		if rec.IsLeavingEarly {
			c.leavingEarly++
		}
		if rec.IsOvertime {
			c.overtime++
		}
	}

	summaries := make([]MonthlySummary, 0, len(employees))
	for _, emp := range employees {
		c := countMap[emp.ID]
		present := 0
		late := 0
		leavingEarly := 0
		overtime := 0
		if c != nil {
			present = c.present
			late = c.late
			leavingEarly = c.leavingEarly
			overtime = c.overtime
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
			LeavingEarly: leavingEarly,
			Overtime:     overtime,
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
	leavingEarly := 0
	overtime := 0
	for _, rec := range records {
		if rec.IsLate {
			late++
		}
		if rec.IsLeavingEarly {
			leavingEarly++
		}
		if rec.IsOvertime {
			overtime++
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
		LeavingEarly: leavingEarly,
		Overtime:     overtime,
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

	// Build set of approved leave dates for this week
	leaveSet := make(map[string]bool)
	if s.leaveRepo != nil {
		leaveDates, err := s.leaveRepo.ListApprovedLeaveDates(ctx, orgID, employeeID, start.Format("2006-01-02"), endDate.Format("2006-01-02"))
		if err != nil {
			s.log.Warn().Err(err).Msg("failed to fetch leave dates for week view")
		}
		for _, d := range leaveDates {
			leaveSet[d] = true
		}
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
			weekDay.Note = rec.Note
			weekDay.IsLeavingEarly = rec.IsLeavingEarly
			weekDay.IsOvertime = rec.IsOvertime
			weekDay.IsCorrected = rec.IsCorrected
		} else if isHoliday {
			// Public holiday with no attendance
			weekDay.Status = "holiday"
		} else if isWeekendDay {
			// Weekend with no attendance
			weekDay.Status = "weekend"
		} else if leaveSet[dateStr] {
			// Approved leave — no clock-in expected
			weekDay.Status = "on_leave"
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

	// Batch fetch employee names and schedule names
	employeeNames, err := s.employeeRepo.GetEmployeeNamesBatch(ctx, orgID, employeeIDs)
	if err != nil {
		return nil, err
	}
	employeeScheduleNames, err := s.employeeRepo.GetEmployeeScheduleNamesBatch(ctx, orgID, employeeIDs)
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

	// Batch fetch approved leave dates for all employees
	leaveDatesByEmployee := make(map[uuid.UUID]map[string]bool)
	if s.leaveRepo != nil {
		leaveDatesByEmployee, err = s.leaveRepo.ListApprovedLeaveDatesBatch(ctx, orgID, employeeIDs, start.Format("2006-01-02"), endDate.Format("2006-01-02"))
		if err != nil {
			s.log.Warn().Err(err).Msg("failed to fetch leave dates for team week view")
			leaveDatesByEmployee = make(map[uuid.UUID]map[string]bool)
		}
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
		leaveSet := leaveDatesByEmployee[employeeID]

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
				weekDay.Note = rec.Note
				weekDay.IsLeavingEarly = rec.IsLeavingEarly
				weekDay.IsOvertime = rec.IsOvertime
				weekDay.IsCorrected = rec.IsCorrected
			} else if isHoliday {
				// Public holiday with no attendance
				weekDay.Status = "holiday"
			} else if isWeekendDay {
				// Weekend with no attendance
				weekDay.Status = "weekend"
			} else if leaveSet != nil && leaveSet[dateStr] {
				// Approved leave — no clock-in expected
				weekDay.Status = "on_leave"
			} else {
				// No record on past working day
				weekDay.Status = "absent"
			}

			days[i] = weekDay
		}

		result = append(result, TeamWeekEntry{
			EmployeeID:       employeeID,
			EmployeeName:     name,
			WorkScheduleName: employeeScheduleNames[employeeID],
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

	// Extract employee IDs and build name/schedule maps
	employeeIDs := make([]uuid.UUID, len(employees))
	employeeNames := make(map[uuid.UUID]string, len(employees))
	employeeScheduleNames := make(map[uuid.UUID]*string, len(employees))
	for i, emp := range employees {
		employeeIDs[i] = emp.ID
		employeeNames[emp.ID] = emp.FullName
		employeeScheduleNames[emp.ID] = emp.WorkScheduleName
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

	// Batch fetch approved leave dates for all employees (GetAllWeek)
	allLeaveDatesByEmployee := make(map[uuid.UUID]map[string]bool)
	if s.leaveRepo != nil {
		allLeaveDatesByEmployee, err = s.leaveRepo.ListApprovedLeaveDatesBatch(ctx, orgID, employeeIDs, start.Format("2006-01-02"), endDate.Format("2006-01-02"))
		if err != nil {
			s.log.Warn().Err(err).Msg("failed to fetch leave dates for all-week view")
			allLeaveDatesByEmployee = make(map[uuid.UUID]map[string]bool)
		}
	}

	// Build week calendar for each employee
	result := make([]TeamWeekEntry, 0, len(employeeIDs))
	for _, employeeID := range employeeIDs {
		name := employeeNames[employeeID]

		recordMap := recordsByEmployee[employeeID]
		if recordMap == nil {
			recordMap = make(map[string]*Record)
		}
		leaveSet := allLeaveDatesByEmployee[employeeID]

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
				weekDay.Note = rec.Note
				weekDay.IsLeavingEarly = rec.IsLeavingEarly
				weekDay.IsOvertime = rec.IsOvertime
				weekDay.IsCorrected = rec.IsCorrected
			} else if isHoliday {
				// Public holiday with no attendance
				weekDay.Status = "holiday"
			} else if isWeekendDay {
				// Weekend with no attendance
				weekDay.Status = "weekend"
			} else if leaveSet != nil && leaveSet[dateStr] {
				// Approved leave — no clock-in expected
				weekDay.Status = "on_leave"
			} else {
				// No record on past working day
				weekDay.Status = "absent"
			}

			days[i] = weekDay
		}

		result = append(result, TeamWeekEntry{
			EmployeeID:       employeeID,
			EmployeeName:     name,
			WorkScheduleName: employeeScheduleNames[employeeID],
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
// After creation it auto-assigns the schedule to any employees whose
// work_schedule_id is NULL (e.g. the owner who skipped setup).
func (s *Service) CreateWorkSchedule(ctx context.Context, orgID uuid.UUID, req CreateWorkScheduleRequest) (*WorkScheduleListItem, error) {
	ws, err := s.repo.CreateWorkSchedule(ctx, orgID, req)
	if err != nil {
		return nil, err
	}
	s.invalidateScheduleCache(ctx, orgID)

	affected, err := s.repo.AssignScheduleToUnassignedEmployees(ctx, orgID, ws.ID)
	if err != nil {
		s.log.Warn().Err(err).
			Str("org_id", orgID.String()).
			Str("schedule_id", ws.ID.String()).
			Msg("work_schedule.created: failed to back-fill unassigned employees")
	} else if affected > 0 {
		s.log.Info().
			Str("org_id", orgID.String()).
			Str("schedule_id", ws.ID.String()).
			Int64("employees_assigned", affected).
			Msg("work_schedule.created: back-filled unassigned employees")
	}

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
	// Cannot deactivate if employees are using this schedule
	count, err := s.repo.CountEmployeesBySchedule(ctx, orgID, scheduleID)
	if err != nil {
		return err
	}
	if count > 0 {
		return apperr.New(apperr.CodeValidation, fmt.Sprintf("cannot deactivate work schedule: %d employee(s) are currently assigned to it", count))
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

// checkLeavingEarly determines if the local clock-out time is before the schedule end time on a work day.
func (s *Service) checkLeavingEarly(localNow time.Time, schedule *WorkSchedule) bool {
	if schedule == nil {
		return false
	}
	weekday := int(localNow.Weekday())
	for _, wd := range schedule.WorkDays {
		if wd == weekday {
			endMinutes := schedule.EndTime.Hour()*60 + schedule.EndTime.Minute()
			clockOutMinutes := localNow.Hour()*60 + localNow.Minute()
			result := clockOutMinutes < endMinutes
			s.log.Debug().
				Str("local_now", localNow.Format("15:04:05 MST")).
				Int("clock_out_minutes", clockOutMinutes).
				Str("schedule_end", schedule.EndTime.Format("15:04:05 MST")).
				Int("end_minutes", endMinutes).
				Ints("work_days", schedule.WorkDays).
				Int("weekday", weekday).
				Bool("is_leaving_early", result).
				Msg("checkLeavingEarly comparison")
			return result
		}
	}
	return false
}

// checkOvertimeClockOut determines if the local clock-out time is after the schedule end time on a work day,
// or if clocking out on a non-work day.
func (s *Service) checkOvertimeClockOut(localNow time.Time, schedule *WorkSchedule) bool {
	if schedule == nil {
		return false
	}
	weekday := int(localNow.Weekday())
	for _, wd := range schedule.WorkDays {
		if wd == weekday {
			endMinutes := schedule.EndTime.Hour()*60 + schedule.EndTime.Minute()
			clockOutMinutes := localNow.Hour()*60 + localNow.Minute()
			result := clockOutMinutes > endMinutes
			s.log.Debug().
				Str("local_now", localNow.Format("15:04:05 MST")).
				Int("clock_out_minutes", clockOutMinutes).
				Str("schedule_end", schedule.EndTime.Format("15:04:05 MST")).
				Int("end_minutes", endMinutes).
				Ints("work_days", schedule.WorkDays).
				Int("weekday", weekday).
				Bool("is_overtime", result).
				Msg("checkOvertimeClockOut comparison")
			return result
		}
	}
	// Clocking out on a non-work day = overtime
	s.log.Debug().
		Str("local_now", localNow.Format("15:04:05 MST")).
		Int("weekday", weekday).
		Ints("work_days", schedule.WorkDays).
		Msg("checkOvertimeClockOut: non-work day → overtime")
	return true
}

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

	// Debug logging for troubleshooting
	s.log.Debug().
		Str("local_now", localNow.Format("15:04:05 MST")).
		Int("clock_in_minutes", clockInTime).
		Str("schedule_start", schedule.StartTime.Format("15:04:05 MST")).
		Int("schedule_minutes", scheduleTime).
		Bool("is_late", clockInTime > scheduleTime).
		Msg("checkLate comparison")

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

// ── Attendance Corrections ────────────────────────────────────────────────────

// SubmitCorrection allows an employee to request a correction to their attendance.
func (s *Service) SubmitCorrection(ctx context.Context, orgID, employeeID uuid.UUID, req SubmitCorrectionRequest) (*Correction, error) {
	// Only past dates allowed.
	tz, err := s.orgRepo.GetOrgTimezone(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("get org timezone: %w", err)
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return nil, apperr.New(apperr.CodeValidation, "invalid org timezone")
	}
	today := s.now().In(loc).Format("2006-01-02")
	if req.Date >= today {
		return nil, apperr.New(apperr.CodeValidation, "corrections are only allowed for past dates")
	}

	// At least one of requested_clock_in or requested_clock_out must be provided.
	if req.RequestedClockIn == nil && req.RequestedClockOut == nil {
		return nil, apperr.New(apperr.CodeValidation, "at least one of requested_clock_in or requested_clock_out is required")
	}

	// Block if there is already a pending correction for this date.
	if existing, err := s.repo.GetPendingCorrectionByDate(ctx, orgID, employeeID, req.Date); err == nil && existing != nil {
		return nil, apperr.New(apperr.CodeConflict, "a pending correction already exists for this date — wait for it to be reviewed before submitting a new one")
	} else if err != nil && !apperr.IsCode(err, apperr.CodeNotFound) {
		return nil, fmt.Errorf("check pending correction: %w", err)
	}

	// Parse requested times (stored as UTC).
	var reqIn, reqOut *time.Time
	if req.RequestedClockIn != nil {
		t, err := time.Parse(time.RFC3339, *req.RequestedClockIn)
		if err != nil {
			return nil, apperr.New(apperr.CodeValidation, "requested_clock_in must be RFC3339")
		}
		utc := t.UTC()
		reqIn = &utc
	}
	if req.RequestedClockOut != nil {
		t, err := time.Parse(time.RFC3339, *req.RequestedClockOut)
		if err != nil {
			return nil, apperr.New(apperr.CodeValidation, "requested_clock_out must be RFC3339")
		}
		utc := t.UTC()
		reqOut = &utc
	}

	// Load existing record to populate original times (may not exist for missed clock-in).
	var recordID *uuid.UUID
	var origIn, origOut *time.Time
	existing, err := s.repo.GetByEmployeeAndDate(ctx, orgID, employeeID, req.Date)
	if err == nil {
		recordID = &existing.ID
		origIn = &existing.ClockInAt
		origOut = existing.ClockOutAt
	} else if !apperr.IsCode(err, apperr.CodeNotFound) {
		return nil, fmt.Errorf("get attendance record: %w", err)
	}

	c, err := s.repo.CreateCorrection(ctx, orgID, employeeID, req.Date, recordID, origIn, origOut, reqIn, reqOut, req.Reason)
	if err != nil {
		return nil, fmt.Errorf("create correction: %w", err)
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("employee_id", employeeID.String()).
		Str("correction_id", c.ID.String()).
		Str("date", req.Date).
		Msg("attendance.correction.submitted")

	return c, nil
}

// GetCorrections returns corrections, optionally filtered. Employees only see their own.
func (s *Service) GetCorrections(ctx context.Context, orgID uuid.UUID, f ListCorrectionsFilter) ([]Correction, error) {
	corrections, err := s.repo.ListCorrections(ctx, orgID, f)
	if err != nil {
		return nil, fmt.Errorf("list corrections: %w", err)
	}
	return corrections, nil
}

// ApproveCorrection approves a pending correction and atomically applies it to the attendance record.
func (s *Service) ApproveCorrection(ctx context.Context, orgID, reviewerEmployeeID, correctionID uuid.UUID) (*Correction, error) {
	now := s.now()

	// Pre-fetch the correction so we can recompute is_leaving_early / is_overtime
	// using the requested clock-out time before atomically applying.
	pending, err := s.repo.GetCorrection(ctx, orgID, correctionID)
	if err != nil {
		return nil, fmt.Errorf("get correction: %w", err)
	}

	var isLeavingEarly, isOvertime bool
	if pending.RequestedClockOut != nil {
		tz, err := s.orgRepo.GetOrgTimezone(ctx, orgID)
		if err != nil {
			return nil, fmt.Errorf("get org timezone: %w", err)
		}
		loc, err := time.LoadLocation(tz)
		if err != nil {
			return nil, fmt.Errorf("invalid timezone %q: %w", tz, err)
		}
		schedule, err := s.repo.GetScheduleForEmployee(ctx, orgID, pending.EmployeeID)
		if err != nil {
			return nil, fmt.Errorf("get employee schedule: %w", err)
		}
		localClockOut := pending.RequestedClockOut.In(loc)
		isLeavingEarly = s.checkLeavingEarly(localClockOut, schedule)
		isOvertime = s.checkOvertimeClockOut(localClockOut, schedule)
	}

	// For existing records: approve + apply in one transaction so they cannot diverge.
	c, err := s.repo.ApproveCorrectionTx(ctx, orgID, correctionID, reviewerEmployeeID, now, isLeavingEarly, isOvertime)
	if err != nil {
		return nil, fmt.Errorf("approve correction: %w", err)
	}

	// For absent days (no existing record): correction created new attendance record inside the tx
	// only covers clock-in; handle clock-out separately if needed.
	if c.RecordID == nil && c.RequestedClockIn != nil {
		_, createErr := s.repo.Create(ctx, orgID, c.EmployeeID, c.Date, *c.RequestedClockIn, false, nil, nil, nil, nil)
		if createErr != nil {
			s.log.Error().Err(createErr).Str("correction_id", correctionID.String()).Msg("failed to create record from correction")
		} else if c.RequestedClockOut != nil {
			newRec, getErr := s.repo.GetByEmployeeAndDate(ctx, orgID, c.EmployeeID, c.Date)
			if getErr == nil {
				if err := s.repo.ApplyCorrection(ctx, orgID, newRec.ID, nil, c.RequestedClockOut, isLeavingEarly, isOvertime); err != nil {
					s.log.Error().Err(err).Str("correction_id", correctionID.String()).Msg("failed to apply clock-out to created correction record")
				}
			}
		}
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("correction_id", correctionID.String()).
		Str("reviewer_id", reviewerEmployeeID.String()).
		Msg("attendance.correction.approved")

	return c, nil
}

// CancelCorrection lets the submitting employee cancel their own pending correction.
func (s *Service) CancelCorrection(ctx context.Context, orgID, employeeID, correctionID uuid.UUID) error {
	if err := s.repo.CancelCorrection(ctx, orgID, correctionID, employeeID); err != nil {
		return fmt.Errorf("cancel correction: %w", err)
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("correction_id", correctionID.String()).
		Str("employee_id", employeeID.String()).
		Msg("attendance.correction.cancelled")

	return nil
}

// RejectCorrection rejects a pending correction.
func (s *Service) RejectCorrection(ctx context.Context, orgID, reviewerEmployeeID, correctionID uuid.UUID, req ReviewCorrectionRequest) (*Correction, error) {
	now := s.now()
	c, err := s.repo.RejectCorrection(ctx, orgID, correctionID, reviewerEmployeeID, req.RejectionReason, now)
	if err != nil {
		return nil, fmt.Errorf("reject correction: %w", err)
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("correction_id", correctionID.String()).
		Str("reviewer_id", reviewerEmployeeID.String()).
		Msg("attendance.correction.rejected")

	return c, nil
}

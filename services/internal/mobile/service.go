package mobile

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/approval"
	"github.com/workived/services/internal/attendance"
	"github.com/workived/services/internal/claims"
	"github.com/workived/services/internal/employee"
	"github.com/workived/services/internal/leave"
	"github.com/workived/services/pkg/cache"
)

// EmployeeProvider provides employee data.
type EmployeeProvider interface {
	GetByUserID(ctx context.Context, orgID, userID uuid.UUID) (*employee.Employee, error)
	Get(ctx context.Context, orgID, id uuid.UUID) (*employee.EmployeeWithManager, error)
}

// AttendanceProvider provides attendance data.
type AttendanceProvider interface {
	GetByEmployeeAndDate(ctx context.Context, orgID, employeeID uuid.UUID, date string) (*attendance.Record, error)
	ListByEmployeesDateRange(ctx context.Context, orgID uuid.UUID, employeeIDs []uuid.UUID, startDate, endDate string) ([]attendance.Record, error)
}

// LeaveProvider provides leave balance and request data.
type LeaveProvider interface {
	ListMyBalances(ctx context.Context, orgID, employeeID uuid.UUID, year int) ([]leave.BalanceWithPolicy, error)
	ListRequests(ctx context.Context, orgID uuid.UUID, filter leave.ListRequestsFilter, role string, managerEmployeeID *uuid.UUID) ([]leave.RequestWithDetails, error)
}

// ClaimsProvider provides claims data.
type ClaimsProvider interface {
	ListClaims(ctx context.Context, orgID uuid.UUID, f claims.ClaimFilters, role string, managerEmployeeID *uuid.UUID) (*claims.ListResult, error)
}

// OrgInfoProvider provides organisation configuration.
type OrgInfoProvider interface {
	GetOrgTimezone(ctx context.Context, orgID uuid.UUID) (string, error)
}

// Service aggregates data from multiple services for mobile endpoints.
type Service struct {
	employeeRepo   EmployeeProvider
	attendanceRepo AttendanceProvider
	leaveRepo      LeaveProvider
	claimsRepo     ClaimsProvider
	orgRepo        OrgInfoProvider
	log            zerolog.Logger
	cache          *cache.Store
}

// NewService creates a new mobile service.
func NewService(
	employeeRepo EmployeeProvider,
	attendanceRepo AttendanceProvider,
	leaveRepo LeaveProvider,
	claimsRepo ClaimsProvider,
	orgRepo OrgInfoProvider,
	log zerolog.Logger,
	cache *cache.Store,
) *Service {
	return &Service{
		employeeRepo:   employeeRepo,
		attendanceRepo: attendanceRepo,
		leaveRepo:      leaveRepo,
		claimsRepo:     claimsRepo,
		orgRepo:        orgRepo,
		log:            log,
		cache:          cache,
	}
}

// GetHomeDataForUser is a convenience wrapper that looks up the employee ID from user ID first.
func (s *Service) GetHomeDataForUser(ctx context.Context, orgID, userID uuid.UUID) (*HomeData, error) {
	// Lookup employee by user ID
	emp, err := s.employeeRepo.GetByUserID(ctx, orgID, userID)
	if err != nil {
		return nil, fmt.Errorf("get employee by user ID: %w", err)
	}

	return s.GetHomeData(ctx, orgID, emp.ID)
}

// GetHomeData aggregates all data for the mobile home screen.
// Uses goroutines to fetch data in parallel for optimal performance.
func (s *Service) GetHomeData(ctx context.Context, orgID, employeeID uuid.UUID) (*HomeData, error) {
	// Fetch employee info first (needed for manager check and display)
	emp, err := s.employeeRepo.Get(ctx, orgID, employeeID)
	if err != nil {
		return nil, fmt.Errorf("get employee: %w", err)
	}

	// Rest of the implementation continues...
	// Get timezone for today calculation
	tz, err := s.orgRepo.GetOrgTimezone(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("get org timezone: %w", err)
	}

	loc, err := time.LoadLocation(tz)
	if err != nil {
		return nil, fmt.Errorf("invalid timezone %q: %w", tz, err)
	}

	now := time.Now().In(loc)
	today := now.Format("2006-01-02")
	year := now.Year()

	// Calculate week range (Monday to Friday)
	weekStart, weekEnd := getWeekRange(now)

	// Fetch all data in parallel
	type result struct {
		clockStatus      *ClockStatusInfo
		leaveBalance     *LeaveBalanceInfo
		pendingApprovals *PendingApprovalsInfo
		weekAttendance   *WeekAttendanceInfo
		err              error
	}

	resultCh := make(chan result, 1)

	go func() {
		var wg sync.WaitGroup
		var mu sync.Mutex

		res := result{}

		// Fetch clock status
		wg.Add(1)
		go func() {
			defer wg.Done()
			clockStatus, err := s.getClockStatus(ctx, orgID, employeeID, today, now)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				res.err = fmt.Errorf("get clock status: %w", err)
				return
			}
			res.clockStatus = clockStatus
		}()

		// Fetch leave balance
		wg.Add(1)
		go func() {
			defer wg.Done()
			balances, err := s.leaveRepo.ListMyBalances(ctx, orgID, employeeID, year)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				res.err = fmt.Errorf("get leave balance: %w", err)
				return
			}
			res.leaveBalance = aggregateLeaveBalances(balances)
		}()

		// Fetch pending approvals (managers only)
		wg.Add(1)
		go func() {
			defer wg.Done()
			var approvals *PendingApprovalsInfo
			var err error

			// Only fetch if employee has direct reports
			// (simple manager check: has subordinates)
			approvals, err = s.getPendingApprovals(ctx, orgID, &employeeID)

			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				res.err = fmt.Errorf("get pending approvals: %w", err)
				return
			}
			res.pendingApprovals = approvals
		}()

		// Fetch week attendance
		wg.Add(1)
		go func() {
			defer wg.Done()
			weekAtt, err := s.getWeekAttendance(ctx, orgID, employeeID, weekStart, weekEnd, now)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				res.err = fmt.Errorf("get week attendance: %w", err)
				return
			}
			res.weekAttendance = weekAtt
		}()

		wg.Wait()
		resultCh <- res
	}()

	res := <-resultCh
	if res.err != nil {
		return nil, res.err
	}

	roleStr := ""
	if emp.JobTitle != nil {
		roleStr = *emp.JobTitle
	}

	return &HomeData{
		Employee: EmployeeInfo{
			Name: emp.FullName,
			Role: roleStr,
		},
		ClockStatus:      *res.clockStatus,
		LeaveBalance:     *res.leaveBalance,
		PendingApprovals: *res.pendingApprovals,
		WeekAttendance:   *res.weekAttendance,
	}, nil
}

// getClockStatus fetches today's attendance record and calculates hours worked.
func (s *Service) getClockStatus(ctx context.Context, orgID, employeeID uuid.UUID, today string, now time.Time) (*ClockStatusInfo, error) {
	record, err := s.attendanceRepo.GetByEmployeeAndDate(ctx, orgID, employeeID, today)
	if err != nil {
		// No record for today = not clocked in
		return &ClockStatusInfo{
			IsClockedIn:      false,
			LastClockIn:      nil,
			LastClockOut:     nil,
			HoursWorkedToday: nil,
		}, nil
	}

	status := &ClockStatusInfo{
		IsClockedIn:  record.ClockOutAt == nil,
		LastClockIn:  ptrString(record.ClockInAt.Format(time.RFC3339)),
		LastClockOut: nil,
	}

	if record.ClockOutAt != nil {
		status.LastClockOut = ptrString(record.ClockOutAt.Format(time.RFC3339))
		// Calculate hours worked
		duration := record.ClockOutAt.Sub(record.ClockInAt)
		hours := duration.Hours()
		status.HoursWorkedToday = &hours
	} else {
		// Still clocked in, calculate hours so far
		duration := now.Sub(record.ClockInAt)
		hours := duration.Hours()
		status.HoursWorkedToday = &hours
	}

	return status, nil
}

// getPendingApprovals fetches pending leave requests and claims for approval.
func (s *Service) getPendingApprovals(ctx context.Context, orgID uuid.UUID, managerEmployeeID *uuid.UUID) (*PendingApprovalsInfo, error) {
	// Fetch pending leave requests
	statusPending := approval.StatusPending
	leaveReqs, err := s.leaveRepo.ListRequests(ctx, orgID, leave.ListRequestsFilter{
		Status:            &statusPending,
		ManagerEmployeeID: managerEmployeeID,
	}, "manager", managerEmployeeID)
	if err != nil {
		return nil, fmt.Errorf("list pending leave requests: %w", err)
	}

	// Fetch pending claims (use manager role to filter by manager relationship)
	claimsResult, err := s.claimsRepo.ListClaims(ctx, orgID, claims.ClaimFilters{
		Status: &statusPending,
		Limit:  100, // Get first 100 pending claims
	}, "manager", managerEmployeeID)
	if err != nil {
		return nil, fmt.Errorf("list pending claims: %w", err)
	}

	// Combine and format
	items := []PendingApprovalItem{}

	for _, req := range leaveReqs {
		items = append(items, PendingApprovalItem{
			EmployeeName: req.EmployeeName,
			Type:         "leave",
			Summary:      fmt.Sprintf("%s (%.1f days)", req.PolicyName, req.TotalDays),
		})
	}

	for _, claim := range claimsResult.Claims {
		items = append(items, PendingApprovalItem{
			EmployeeName: claim.EmployeeName,
			Type:         "claim",
			Summary:      fmt.Sprintf("%s claim", claim.CategoryName),
		})
	}

	// Limit to first 3 items for preview
	previewItems := items
	if len(items) > 3 {
		previewItems = items[:3]
	}

	return &PendingApprovalsInfo{
		Count: len(items),
		Items: previewItems,
	}, nil
}

// getWeekAttendance fetches attendance for the current week and calculates on-time percentage.
func (s *Service) getWeekAttendance(ctx context.Context, orgID, employeeID uuid.UUID, weekStart, weekEnd string, now time.Time) (*WeekAttendanceInfo, error) {
	records, err := s.attendanceRepo.ListByEmployeesDateRange(ctx, orgID, []uuid.UUID{employeeID}, weekStart, weekEnd)
	if err != nil {
		return nil, fmt.Errorf("list attendance: %w", err)
	}

	// Build map of dates to attendance records
	recordMap := make(map[string]attendance.Record)
	for _, r := range records {
		recordMap[r.Date] = r
	}

	// Build 5-day status array (Mon-Fri)
	days := []string{}
	checkedCount := 0
	totalDays := 0

	start, _ := time.Parse("2006-01-02", weekStart)
	for i := 0; i < 5; i++ {
		day := start.AddDate(0, 0, i)
		dateStr := day.Format("2006-01-02")

		// Skip future days
		if day.After(now) {
			days = append(days, "future")
			continue
		}

		totalDays++

		if record, exists := recordMap[dateStr]; exists {
			if record.IsLate {
				days = append(days, "late")
			} else {
				days = append(days, "checked")
				checkedCount++
			}
		} else {
			days = append(days, "absent")
		}
	}

	// Calculate on-time percentage
	percentage := 0
	if totalDays > 0 {
		percentage = (checkedCount * 100) / totalDays
	}

	return &WeekAttendanceInfo{
		Days:       days,
		Percentage: percentage,
	}, nil
}

// aggregateLeaveBalances sums up balances across different policies by type.
func aggregateLeaveBalances(balances []leave.BalanceWithPolicy) *LeaveBalanceInfo {
	result := &LeaveBalanceInfo{
		Annual: 0,
		Sick:   0,
		Unpaid: 0,
	}

	for _, bal := range balances {
		available := bal.Available()

		// Simple heuristic: categorize by policy name keywords
		policyNameLower := bal.PolicyName
		switch {
		case containsAny(policyNameLower, []string{"Annual", "Vacation", "Holiday"}):
			result.Annual += int(available)
		case containsAny(policyNameLower, []string{"Sick", "Medical"}):
			result.Sick += int(available)
		case containsAny(policyNameLower, []string{"Unpaid", "No Pay"}):
			result.Unpaid += int(available)
		default:
			// Default to annual if unclear
			result.Annual += int(available)
		}
	}

	return result
}

// getWeekRange returns the Monday-Friday range for the week containing the given date.
func getWeekRange(now time.Time) (start, end string) {
	// Find Monday of this week
	weekday := int(now.Weekday())
	if weekday == 0 { // Sunday
		weekday = 7
	}
	daysFromMonday := weekday - 1

	monday := now.AddDate(0, 0, -daysFromMonday)
	friday := monday.AddDate(0, 0, 4)

	return monday.Format("2006-01-02"), friday.Format("2006-01-02")
}

// containsAny checks if a string contains any of the given substrings (case-insensitive).
func containsAny(s string, subs []string) bool {
	for _, sub := range subs {
		if len(s) >= len(sub) && stringContainsCaseInsensitive(s, sub) {
			return true
		}
	}
	return false
}

// stringContainsCaseInsensitive checks if needle is in haystack (case-insensitive).
func stringContainsCaseInsensitive(haystack, needle string) bool {
	for i := 0; i <= len(haystack)-len(needle); i++ {
		match := true
		for j := 0; j < len(needle); j++ {
			if toLower(haystack[i+j]) != toLower(needle[j]) {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}

// toLower converts a byte to lowercase.
func toLower(b byte) byte {
	if b >= 'A' && b <= 'Z' {
		return b + ('a' - 'A')
	}
	return b
}

// ptrString returns a pointer to a string.
func ptrString(s string) *string {
	return &s
}

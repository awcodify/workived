package mobile

import "github.com/google/uuid"

// HomeData represents the aggregated data for the mobile home screen.
type HomeData struct {
	Employee         EmployeeInfo         `json:"employee"`
	ClockStatus      ClockStatusInfo      `json:"clock_status"`
	LeaveBalance     LeaveBalanceInfo     `json:"leave_balance"`
	PendingApprovals PendingApprovalsInfo `json:"pending_approvals"`
	WeekAttendance   WeekAttendanceInfo   `json:"week_attendance"`
	WeekOffset       int                  `json:"week_offset"` // 0 = this week, -1 = last week
}

// EmployeeInfo contains basic employee profile data.
type EmployeeInfo struct {
	Name string `json:"name"`
	Role string `json:"role"`
}

// ClockStatusInfo contains real-time attendance status.
type ClockStatusInfo struct {
	IsClockedIn      bool     `json:"is_clocked_in"`
	LastClockIn      *string  `json:"last_clock_in"`       // ISO 8601 timestamp
	LastClockOut     *string  `json:"last_clock_out"`      // ISO 8601 timestamp
	HoursWorkedToday *float64 `json:"hours_worked_today"`  // Hours worked today (nullable)
	ClockInLat       *float64 `json:"clock_in_latitude"`   // Latitude where clocked in
	ClockInLng       *float64 `json:"clock_in_longitude"`  // Longitude where clocked in
	ClockOutLat      *float64 `json:"clock_out_latitude"`  // Latitude where clocked out
	ClockOutLng      *float64 `json:"clock_out_longitude"` // Longitude where clocked out
	WorkLocationType *string  `json:"work_location_type"`  // office, remote, client_site
}

// LeaveBalanceInfo contains leave balance aggregated across all policies.
type LeaveBalanceInfo struct {
	Annual int `json:"annual"` // Total annual leave days available
	Sick   int `json:"sick"`   // Total sick leave days available
	Unpaid int `json:"unpaid"` // Total unpaid leave days available
}

// PendingApprovalsInfo contains the count of pending approvals by category.
type PendingApprovalsInfo struct {
	LeaveCount int `json:"leave_count"` // Number of pending leave requests
	ClaimCount int `json:"claim_count"` // Number of pending claims
}

// WeekAttendanceInfo contains week attendance status.
type WeekAttendanceInfo struct {
	Days       []string `json:"days"`       // 5 days: ["checked", "checked", "absent", "checked", "weekend"]
	Percentage int      `json:"percentage"` // Percentage on time (e.g., 80)
}

// MobileHomeFilter contains filter criteria for the mobile home endpoint.
type MobileHomeFilter struct {
	EmployeeID uuid.UUID
}

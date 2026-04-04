package mobile

import "github.com/google/uuid"

// HomeData represents the aggregated data for the mobile home screen.
type HomeData struct {
	Employee         EmployeeInfo         `json:"employee"`
	ClockStatus      ClockStatusInfo      `json:"clock_status"`
	LeaveBalance     LeaveBalanceInfo     `json:"leave_balance"`
	PendingApprovals PendingApprovalsInfo `json:"pending_approvals"`
	WeekAttendance   WeekAttendanceInfo   `json:"week_attendance"`
}

// EmployeeInfo contains basic employee profile data.
type EmployeeInfo struct {
	Name string `json:"name"`
	Role string `json:"role"`
}

// ClockStatusInfo contains real-time attendance status.
type ClockStatusInfo struct {
	IsClockedIn      bool     `json:"is_clocked_in"`
	LastClockIn      *string  `json:"last_clock_in"`      // ISO 8601 timestamp
	LastClockOut     *string  `json:"last_clock_out"`     // ISO 8601 timestamp
	HoursWorkedToday *float64 `json:"hours_worked_today"` // Hours worked today (nullable)
}

// LeaveBalanceInfo contains leave balance aggregated across all policies.
type LeaveBalanceInfo struct {
	Annual int `json:"annual"` // Total annual leave days available
	Sick   int `json:"sick"`   // Total sick leave days available
	Unpaid int `json:"unpaid"` // Total unpaid leave days available
}

// PendingApprovalsInfo contains the count and sample of pending approvals.
type PendingApprovalsInfo struct {
	Count int                   `json:"count"` // Total pending approvals
	Items []PendingApprovalItem `json:"items"` // First 3 items for preview
}

// PendingApprovalItem represents a single pending approval.
type PendingApprovalItem struct {
	EmployeeName string `json:"employee_name"` // Name of employee who submitted the request
	Type         string `json:"type"`          // "leave" or "claim"
	Summary      string `json:"summary"`       // e.g., "Annual Leave (3 days)"
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

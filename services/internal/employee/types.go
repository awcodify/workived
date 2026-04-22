package employee

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// ── Domain types ──────────────────────────────────────────────────────────────

type Employee struct {
	ID             uuid.UUID       `json:"id"`
	OrganisationID uuid.UUID       `json:"organisation_id"`
	UserID         *uuid.UUID      `json:"user_id,omitempty"`
	EmployeeCode   *string         `json:"employee_code,omitempty"`
	FullName       string          `json:"full_name"`
	Email          *string         `json:"email,omitempty"`
	Phone          *string         `json:"phone,omitempty"`
	DepartmentID   *uuid.UUID      `json:"department_id,omitempty"`
	JobTitle       *string         `json:"job_title,omitempty"`    // Legacy free-text field
	JobTitleID     *uuid.UUID      `json:"job_title_id,omitempty"` // FK to job_titles table
	EmploymentType string          `json:"employment_type"`
	Status         string          `json:"status"`
	ReportingTo    *uuid.UUID      `json:"reporting_to,omitempty"`     // Manager (self-ref FK)
	Gender         *string         `json:"gender,omitempty"`           // "male", "female", or nil
	WorkScheduleID *uuid.UUID      `json:"work_schedule_id,omitempty"` // Per-employee schedule override
	StartDate      time.Time       `json:"start_date"`
	EndDate        *time.Time      `json:"end_date,omitempty"`
	BaseSalary     *int64          `json:"base_salary,omitempty"`
	SalaryCurrency *string         `json:"salary_currency,omitempty"`
	CustomFields   json.RawMessage `json:"custom_fields,omitempty"`
	IsActive       bool            `json:"is_active"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

// EmployeeWithManager includes manager name for API responses.
type EmployeeWithManager struct {
	Employee
	ManagerName       *string `json:"manager_name,omitempty"`       // Full name of reporting_to employee
	DepartmentName    *string `json:"department_name,omitempty"`    // Name of department (from departments table)
	WorkScheduleName  *string `json:"work_schedule_name,omitempty"` // Resolved schedule name (own or org default)
	InvitationPending bool    `json:"invitation_pending,omitempty"` // True if employee has unaccepted invitation
}

// OrgChartNode represents an employee in the organizational hierarchy with their direct reports.
type OrgChartNode struct {
	ID             uuid.UUID       `json:"id"`
	FullName       string          `json:"full_name"`
	Email          *string         `json:"email,omitempty"`
	JobTitle       *string         `json:"job_title,omitempty"`    // Legacy free-text field
	JobTitleID     *uuid.UUID      `json:"job_title_id,omitempty"` // FK to job_titles table
	DepartmentID   *uuid.UUID      `json:"department_id,omitempty"`
	EmploymentType string          `json:"employment_type"`
	Status         string          `json:"status"`
	ReportingTo    *uuid.UUID      `json:"reporting_to,omitempty"`
	DirectReports  []*OrgChartNode `json:"direct_reports,omitempty"`
}

// ── Request / Response types ──────────────────────────────────────────────────

type CreateEmployeeRequest struct {
	FullName       string     `json:"full_name"        validate:"required,min=1,max=255"`
	Email          *string    `json:"email"            validate:"omitempty,email,max=255"`
	UserID         *uuid.UUID `json:"user_id"          validate:"omitempty"`
	Phone          *string    `json:"phone"            validate:"omitempty,max=30"`
	DepartmentID   *uuid.UUID `json:"department_id"    validate:"omitempty"`
	JobTitleID     *uuid.UUID `json:"job_title_id"     validate:"omitempty"`
	JobTitle       *string    `json:"job_title"        validate:"omitempty,max=150"`
	EmploymentType string     `json:"employment_type"  validate:"required,oneof=full_time part_time contract intern"`
	ReportingTo    *uuid.UUID `json:"reporting_to"     validate:"omitempty"`
	Gender         *string    `json:"gender"           validate:"omitempty,oneof=male female"`
	StartDate      string     `json:"start_date"       validate:"required"`
	WorkScheduleID uuid.UUID  `json:"work_schedule_id" validate:"required"`
	EmployeeCode   *string    `json:"employee_code"    validate:"omitempty,max=50"`
}

type UpdateEmployeeRequest struct {
	FullName       *string    `json:"full_name"        validate:"omitempty,min=1,max=255"`
	Phone          *string    `json:"phone"            validate:"omitempty,max=30"`
	DepartmentID   *uuid.UUID `json:"department_id"    validate:"omitempty"`
	JobTitleID     *uuid.UUID `json:"job_title_id"     validate:"omitempty"`
	JobTitle       *string    `json:"job_title"        validate:"omitempty,max=150"`
	EmploymentType *string    `json:"employment_type"  validate:"omitempty,oneof=full_time part_time contract intern"`
	ReportingTo    *uuid.UUID `json:"reporting_to"     validate:"omitempty"`
	Gender         *string    `json:"gender"           validate:"omitempty,oneof=male female"`
	Status         *string    `json:"status"           validate:"omitempty,oneof=active on_leave probation inactive"`
	StartDate      *string    `json:"start_date"       validate:"omitempty"`
	EndDate        *string    `json:"end_date"         validate:"omitempty"`
	WorkScheduleID *uuid.UUID `json:"work_schedule_id" validate:"omitempty"`
	BaseSalary     *int64     `json:"base_salary"      validate:"omitempty,gte=0"`
	SalaryCurrency *string    `json:"salary_currency"  validate:"omitempty,oneof=IDR AED MYR SGD"`
}

type ListFilters struct {
	Status       *string
	DepartmentID *string
	ScheduleID   *string
	Search       *string
	Cursor       string
	Limit        int
}

// ── Bulk Import ───────────────────────────────────────────────────────────────

// ImportRow represents one parsed CSV row before validation.
type ImportRow struct {
	RowNum         int    `json:"row_num"`
	FullName       string `json:"full_name"`
	Email          string `json:"email"`
	Department     string `json:"department"`
	JobTitle       string `json:"job_title"`
	EmploymentType string `json:"employment_type"`
	StartDate      string `json:"start_date"`
	Gender         string `json:"gender"`
	Phone          string `json:"phone"`
	EmployeeCode   string `json:"employee_code"`
}

// ImportRowResult is the outcome for a single row after import.
type ImportRowResult struct {
	RowNum  int    `json:"row_num"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
	Name    string `json:"name"`
}

// BulkImportResult summarises an import operation.
type BulkImportResult struct {
	Total     int               `json:"total"`
	Succeeded int               `json:"succeeded"`
	Failed    int               `json:"failed"`
	Rows      []ImportRowResult `json:"rows"`
}

// WorkloadStatus represents an employee's current workload level.
type WorkloadStatus string

const (
	WorkloadAvailable  WorkloadStatus = "available"  // 0-5 active tasks
	WorkloadWarning    WorkloadStatus = "warning"    // 6-10 active tasks
	WorkloadOverloaded WorkloadStatus = "overloaded" // 11+ active tasks
	WorkloadOnLeave    WorkloadStatus = "on_leave"   // Currently on approved leave
)

// WorkloadInfo contains task and leave information for an employee.
type WorkloadInfo struct {
	ActiveTasks  int            `json:"active_tasks"`
	OverdueTasks int            `json:"overdue_tasks"`
	Status       WorkloadStatus `json:"status"`
}

// LeaveInfo contains current and upcoming leave information.
type LeaveInfo struct {
	IsOnLeave       bool       `json:"is_on_leave"`
	IsUpcomingLeave bool       `json:"is_upcoming_leave"`
	LeaveStart      *time.Time `json:"leave_start,omitempty"`
	LeaveEnd        *time.Time `json:"leave_end,omitempty"`
}

// EmployeeWorkload combines employee info with workload and leave status.
type EmployeeWorkload struct {
	ID           uuid.UUID    `json:"employee_id"`
	FullName     string       `json:"full_name"`
	Email        *string      `json:"email,omitempty"`
	DepartmentID *uuid.UUID   `json:"department_id,omitempty"`
	Workload     WorkloadInfo `json:"workload"`
	Leave        LeaveInfo    `json:"leave"`
}

// PerformanceMetrics contains task completion statistics for an employee.
type PerformanceMetrics struct {
	CompletedTasks           int     `json:"completed_tasks"`
	AvgCompletionTimeHours   float64 `json:"avg_completion_time_hours"`
	OnTimeCompletionRate     float64 `json:"on_time_completion_rate"` // Percentage (0-100)
	TotalTasksCreated        int     `json:"total_tasks_created"`
	OverdueTasksCompleted    int     `json:"overdue_tasks_completed"`
	AvgDaysBeforeDueComplete float64 `json:"avg_days_before_due_complete"` // Negative = late, positive = early
}

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
	JobTitle       *string         `json:"job_title,omitempty"`
	EmploymentType string          `json:"employment_type"`
	Status         string          `json:"status"`
	ReportingTo    *uuid.UUID      `json:"reporting_to,omitempty"` // Manager (self-ref FK)
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
	ManagerName *string `json:"manager_name,omitempty"` // Full name of reporting_to employee
}

// OrgChartNode represents an employee in the organizational hierarchy with their direct reports.
type OrgChartNode struct {
	ID             uuid.UUID       `json:"id"`
	FullName       string          `json:"full_name"`
	Email          *string         `json:"email,omitempty"`
	JobTitle       *string         `json:"job_title,omitempty"`
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
	JobTitle       *string    `json:"job_title"        validate:"omitempty,max=150"`
	EmploymentType string     `json:"employment_type"  validate:"required,oneof=full_time part_time contract intern"`
	ReportingTo    *uuid.UUID `json:"reporting_to"     validate:"omitempty"`
	StartDate      string     `json:"start_date"       validate:"required"`
	EmployeeCode   *string    `json:"employee_code"    validate:"omitempty,max=50"`
}

type UpdateEmployeeRequest struct {
	FullName       *string    `json:"full_name"        validate:"omitempty,min=1,max=255"`
	Phone          *string    `json:"phone"            validate:"omitempty,max=30"`
	DepartmentID   *uuid.UUID `json:"department_id"    validate:"omitempty"`
	JobTitle       *string    `json:"job_title"        validate:"omitempty,max=150"`
	EmploymentType *string    `json:"employment_type"  validate:"omitempty,oneof=full_time part_time contract intern"`
	ReportingTo    *uuid.UUID `json:"reporting_to"     validate:"omitempty"`
	Status         *string    `json:"status"           validate:"omitempty,oneof=active on_leave probation inactive"`
	EndDate        *string    `json:"end_date"         validate:"omitempty"`
}

type ListFilters struct {
	Status       *string
	DepartmentID *string
	Cursor       string
	Limit        int
}

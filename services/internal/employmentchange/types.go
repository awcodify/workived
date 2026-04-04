package employmentchange

import (
	"time"

	"github.com/google/uuid"
)

// ChangeType represents the type of employment change.
type ChangeType string

const (
	ChangeTypeDepartment     ChangeType = "department"
	ChangeTypeTitle          ChangeType = "title"
	ChangeTypeSalary         ChangeType = "salary"
	ChangeTypeStatus         ChangeType = "status"
	ChangeTypeEmploymentType ChangeType = "employment_type"
)

// EmploymentChange represents a single change in an employee's employment record.
type EmploymentChange struct {
	ID             uuid.UUID  `json:"id"`
	OrganisationID uuid.UUID  `json:"organisation_id"`
	EmployeeID     uuid.UUID  `json:"employee_id"`
	ChangeType     ChangeType `json:"change_type"`
	OldValue       *string    `json:"old_value,omitempty"`
	NewValue       *string    `json:"new_value,omitempty"`
	OldSalary      *int64     `json:"old_salary,omitempty"`
	NewSalary      *int64     `json:"new_salary,omitempty"`
	CurrencyCode   *string    `json:"currency_code,omitempty"`
	EffectiveDate  time.Time  `json:"effective_date"`
	Reason         *string    `json:"reason,omitempty"`
	ChangedBy      *uuid.UUID `json:"changed_by,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	// Resolved names for display (populated via JOINs)
	OldDepartmentName *string `json:"old_department_name,omitempty"`
	NewDepartmentName *string `json:"new_department_name,omitempty"`
}

// CreateChangeRequest represents the request to create an employment change record.
type CreateChangeRequest struct {
	EmployeeID    uuid.UUID
	ChangeType    ChangeType
	OldValue      *string
	NewValue      *string
	OldSalary     *int64
	NewSalary     *int64
	CurrencyCode  *string
	EffectiveDate time.Time
	Reason        *string
	ChangedBy     *uuid.UUID
}

// ListFilters contains filters for querying employment changes.
type ListFilters struct {
	EmployeeID *uuid.UUID
	ChangeType *ChangeType
	StartDate  *time.Time
	EndDate    *time.Time
	Limit      int
	Offset     int
}

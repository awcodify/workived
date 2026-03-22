package leave

import (
	"time"

	"github.com/google/uuid"
)

// ── Domain types ──────────────────────────────────────────────────────────────

// Policy represents a leave type configured per organisation (e.g. Annual Leave, Sick Leave).
type Policy struct {
	ID               uuid.UUID `json:"id"`
	OrganisationID   uuid.UUID `json:"organisation_id"`
	Name             string    `json:"name"`
	Description      *string   `json:"description,omitempty"`
	DaysPerYear      float64   `json:"days_per_year"`
	CarryOverDays    float64   `json:"carry_over_days"`
	MinTenureDays    int       `json:"min_tenure_days"`
	RequiresApproval bool      `json:"requires_approval"`
	IsUnlimited      bool      `json:"is_unlimited"`
	IsActive         bool      `json:"is_active"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// Balance tracks how many days an employee has used/remaining for a specific
// leave policy in a given year.
type Balance struct {
	ID              uuid.UUID `json:"id"`
	OrganisationID  uuid.UUID `json:"organisation_id"`
	EmployeeID      uuid.UUID `json:"employee_id"`
	LeavePolicyID   uuid.UUID `json:"leave_policy_id"`
	Year            int       `json:"year"`
	EntitledDays    float64   `json:"entitled_days"`
	CarriedOverDays float64   `json:"carried_over_days"`
	UsedDays        float64   `json:"used_days"`
	PendingDays     float64   `json:"pending_days"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// Available returns the number of days the employee can still request.
func (b Balance) Available() float64 {
	return b.EntitledDays + b.CarriedOverDays - b.UsedDays - b.PendingDays
}

// Request represents a leave request submitted by an employee.
type Request struct {
	ID             uuid.UUID  `json:"id"`
	OrganisationID uuid.UUID  `json:"organisation_id"`
	EmployeeID     uuid.UUID  `json:"employee_id"`
	LeavePolicyID  uuid.UUID  `json:"leave_policy_id"`
	StartDate      string     `json:"start_date"` // YYYY-MM-DD
	EndDate        string     `json:"end_date"`   // YYYY-MM-DD
	TotalDays      float64    `json:"total_days"`
	Reason         *string    `json:"reason,omitempty"`
	Status         string     `json:"status"` // pending, approved, rejected, cancelled
	ReviewedBy     *uuid.UUID `json:"reviewed_by,omitempty"`
	ReviewedAt     *time.Time `json:"reviewed_at,omitempty"`
	ReviewNote     *string    `json:"review_note,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	// Populated when fetching with joins
	EmployeeName   string  `json:"employee_name,omitempty"`
	PolicyName     string  `json:"policy_name,omitempty"`
	ReviewedByName *string `json:"reviewed_by_name,omitempty"`
}

// BalanceWithPolicy combines a balance row with its policy name for display.
type BalanceWithPolicy struct {
	Balance
	PolicyName        string  `json:"policy_name"`
	PolicyDescription *string `json:"policy_description,omitempty"`
}

// RequestWithDetails combines a request with employee and policy names for display.
type RequestWithDetails struct {
	Request
	EmployeeName string `json:"employee_name"`
	PolicyName   string `json:"policy_name"`
}

// CalendarEntry represents one approved leave block for the calendar view.
type CalendarEntry struct {
	EmployeeID   uuid.UUID `json:"employee_id"`
	EmployeeName string    `json:"employee_name"`
	PolicyName   string    `json:"policy_name"`
	StartDate    string    `json:"start_date"`
	EndDate      string    `json:"end_date"`
	TotalDays    float64   `json:"total_days"`
}

// PublicHoliday is a minimal projection of the public_holidays table.
type PublicHoliday struct {
	CountryCode string `json:"country_code"`
	Date        string `json:"date"` // YYYY-MM-DD
	Name        string `json:"name"`
}

// PolicyTemplate represents a pre-configured leave policy template for a specific country.
// Used for quick org onboarding (import templates → create policies).
type PolicyTemplate struct {
	ID                  uuid.UUID `json:"id"`
	CountryCode         string    `json:"country_code"`
	Name                string    `json:"name"`
	Description         *string   `json:"description,omitempty"`
	EntitledDaysPerYear float64   `json:"entitled_days_per_year"`
	IsCarryOverAllowed  bool      `json:"is_carry_over_allowed"`
	MaxCarryOverDays    *float64  `json:"max_carry_over_days,omitempty"`
	IsAccrued           bool      `json:"is_accrued"`
	RequiresApproval    bool      `json:"requires_approval"`
	SortOrder           int       `json:"sort_order"`
	CreatedAt           time.Time `json:"created_at"`
}

// ── Request / Response types ────────────────────────────────────────────────

type CreatePolicyRequest struct {
	Name             string  `json:"name"              validate:"required,min=1,max=100"`
	Description      *string `json:"description"       validate:"omitempty,max=500"`
	DaysPerYear      float64 `json:"days_per_year"     validate:"required,gte=0,lte=365"`
	CarryOverDays    float64 `json:"carry_over_days"   validate:"gte=0,lte=365"`
	MinTenureDays    int     `json:"min_tenure_days"   validate:"gte=0"`
	RequiresApproval *bool   `json:"requires_approval"`
	IsUnlimited      *bool   `json:"is_unlimited"`
}

type UpdatePolicyRequest struct {
	Name             *string  `json:"name"              validate:"omitempty,min=1,max=100"`
	Description      *string  `json:"description"       validate:"omitempty,max=500"`
	DaysPerYear      *float64 `json:"days_per_year"     validate:"omitempty,gte=0,lte=365"`
	CarryOverDays    *float64 `json:"carry_over_days"   validate:"omitempty,gte=0,lte=365"`
	MinTenureDays    *int     `json:"min_tenure_days"   validate:"omitempty,gte=0"`
	RequiresApproval *bool    `json:"requires_approval"`
	IsUnlimited      *bool    `json:"is_unlimited"`
}

type SubmitRequestInput struct {
	LeavePolicyID uuid.UUID `json:"leave_policy_id" validate:"required"`
	StartDate     string    `json:"start_date"      validate:"required"` // YYYY-MM-DD
	EndDate       string    `json:"end_date"        validate:"required"` // YYYY-MM-DD
	Reason        *string   `json:"reason"          validate:"omitempty,max=1000"`
}

type ReviewInput struct {
	Note *string `json:"note" validate:"omitempty,max=1000"`
}

type ImportPoliciesInput struct {
	TemplateIDs []uuid.UUID `json:"template_ids" validate:"required,min=1,max=20"`
}

type ListRequestsFilter struct {
	Status            *string
	EmployeeID        *uuid.UUID
	Year              *int
	Date              *string // YYYY-MM-DD for single date filtering
	ManagerEmployeeID *uuid.UUID
}

type CalendarFilter struct {
	Year  int
	Month int // 1-12
}

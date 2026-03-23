package setup

import (
	"time"

	"github.com/google/uuid"
)

// SetupStatus represents the current state of organization setup wizard
type SetupStatus struct {
	NeedsSetup           bool       `json:"needs_setup"`
	Skipped              bool       `json:"skipped"`
	CompletedAt          *time.Time `json:"completed_at"`
	WorkScheduleExists   bool       `json:"work_schedule_exists"`
	LeavePoliciesCount   int        `json:"leave_policies_count"`
	ClaimCategoriesCount int        `json:"claim_categories_count"`
	MembersCount         int        `json:"members_count"`
}

// WorkScheduleTemplate represents a pre-configured work schedule template
type WorkScheduleTemplate struct {
	ID          uuid.UUID `json:"id"`
	CountryCode string    `json:"country_code"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	WorkDays    []int     `json:"work_days"`  // 1=Mon, 2=Tue, ..., 7=Sun
	StartTime   string    `json:"start_time"` // HH:MM:SS
	EndTime     string    `json:"end_time"`   // HH:MM:SS
	SortOrder   int       `json:"sort_order"`
}

// LeavePolicyTemplate represents a country-specific leave policy template
type LeavePolicyTemplate struct {
	ID                  uuid.UUID `json:"id"`
	CountryCode         string    `json:"country_code"`
	Name                string    `json:"name"`
	Description         string    `json:"description"`
	EntitledDaysPerYear float64   `json:"entitled_days_per_year"`
	IsCarryOverAllowed  bool      `json:"is_carry_over_allowed"`
	MaxCarryOverDays    *float64  `json:"max_carry_over_days"`
	IsAccrued           bool      `json:"is_accrued"`
	RequiresApproval    bool      `json:"requires_approval"`
	SortOrder           int       `json:"sort_order"`
}

// ClaimCategoryTemplate represents a country-specific claim category template
type ClaimCategoryTemplate struct {
	ID              uuid.UUID `json:"id"`
	CountryCode     string    `json:"country_code"`
	Name            string    `json:"name"`
	Description     string    `json:"description"`
	MonthlyLimit    *int64    `json:"monthly_limit"` // Smallest currency unit, NULL = unlimited
	CurrencyCode    *string   `json:"currency_code"`
	RequiresReceipt bool      `json:"requires_receipt"`
	SortOrder       int       `json:"sort_order"`
}

// SetupTemplatesResponse returns all available templates for organization's country
type SetupTemplatesResponse struct {
	WorkSchedules   []WorkScheduleTemplate  `json:"work_schedules"`
	LeavePolicies   []LeavePolicyTemplate   `json:"leave_policies"`
	ClaimCategories []ClaimCategoryTemplate `json:"claim_categories"`
}

// WorkScheduleChoice represents user's work schedule selection
type WorkScheduleChoice struct {
	TemplateID     *uuid.UUID           `json:"template_id"`     // XOR with CustomSchedule
	CustomSchedule *CustomScheduleInput `json:"custom_schedule"` // Only if template_id is null
}

// CustomScheduleInput for custom work schedule
type CustomScheduleInput struct {
	Name      string `json:"name" validate:"required,min=1,max=100"`
	WorkDays  []int  `json:"work_days" validate:"required,min=1,max=7,dive,min=1,max=7"`
	StartTime string `json:"start_time" validate:"required,time_format=15:04"`
	EndTime   string `json:"end_time" validate:"required,time_format=15:04"`
}

// LeavePolicyCustomization allows overriding template defaults
type LeavePolicyCustomization struct {
	DaysPerYear *float64 `json:"days_per_year,omitempty"`
}

// ClaimCategoryCustomization allows overriding template defaults
type ClaimCategoryCustomization struct {
	MonthlyLimit *int64 `json:"monthly_limit,omitempty"`
}

// InvitationInput for team member invitation
type InvitationInput struct {
	Email string `json:"email" validate:"required,email"`
	Role  string `json:"role" validate:"required,oneof=admin member hr_admin manager finance"`
}

// CompleteSetupRequest contains all setup wizard choices
type CompleteSetupRequest struct {
	WorkSchedule    WorkScheduleChoice     `json:"work_schedule" validate:"required"`
	LeavePolicies   LeavePolicySelection   `json:"leave_policies"`
	ClaimCategories ClaimCategorySelection `json:"claim_categories"`
	Invitations     []InvitationInput      `json:"invitations" validate:"max=10"`
}

// LeavePolicySelection contains template IDs and optional customizations
type LeavePolicySelection struct {
	TemplateIDs    []uuid.UUID                         `json:"template_ids" validate:"required,min=1"`
	Customizations map[string]LeavePolicyCustomization `json:"customizations,omitempty"`
}

// ClaimCategorySelection contains template IDs and optional customizations
type ClaimCategorySelection struct {
	TemplateIDs    []uuid.UUID                           `json:"template_ids" validate:"required,min=1"`
	Customizations map[string]ClaimCategoryCustomization `json:"customizations,omitempty"`
}

// CompleteSetupResponse returns created resource IDs
type CompleteSetupResponse struct {
	Success          bool        `json:"success"`
	WorkScheduleID   uuid.UUID   `json:"work_schedule_id"`
	LeavePolicyIDs   []uuid.UUID `json:"leave_policy_ids"`
	ClaimCategoryIDs []uuid.UUID `json:"claim_category_ids"`
	InvitationIDs    []uuid.UUID `json:"invitation_ids"`
}

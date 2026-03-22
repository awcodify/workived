package organisation

import (
	"time"

	"github.com/google/uuid"
)

// ── Domain types ──────────────────────────────────────────────────────────────

type Organisation struct {
	ID                uuid.UUID `json:"id"`
	Name              string    `json:"name"`
	Slug              string    `json:"slug"`
	CountryCode       string    `json:"country_code"`
	Timezone          string    `json:"timezone"`
	CurrencyCode      string    `json:"currency_code"`
	WorkDays          []int     `json:"work_days"`
	Plan              string    `json:"plan"`
	PlanEmployeeLimit *int      `json:"plan_employee_limit,omitempty"`
	LogoURL           *string   `json:"logo_url,omitempty"`
	IsActive          bool      `json:"is_active"`
	CreatedAt         time.Time `json:"created_at"`
}

type Member struct {
	ID             uuid.UUID  `json:"id"`
	UserID         uuid.UUID  `json:"user_id"`
	OrgID          uuid.UUID  `json:"organisation_id"`
	EmployeeID     *uuid.UUID `json:"employee_id,omitempty"`
	Role           string     `json:"role"`
	HasSubordinate bool       `json:"has_subordinate"`
	IsActive       bool       `json:"is_active"`
	JoinedAt       time.Time  `json:"joined_at"`
}

type Invitation struct {
	ID         uuid.UUID  `json:"id"`
	OrgID      uuid.UUID  `json:"organisation_id"`
	Email      string     `json:"email"`
	Role       string     `json:"role"`
	InvitedBy  uuid.UUID  `json:"invited_by"`
	TokenHash  string     `json:"-"`
	InviteURL  string     `json:"invite_url"`
	EmployeeID *uuid.UUID `json:"employee_id,omitempty"`
	ExpiresAt  time.Time  `json:"expires_at"`
	AcceptedAt *time.Time `json:"accepted_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

// ── Request / Response types ──────────────────────────────────────────────────

type CreateOrgRequest struct {
	Name         string `json:"name"          validate:"required,min=1,max=255"`
	Slug         string `json:"slug"          validate:"required,min=2,max=100,slug"`
	CountryCode  string `json:"country_code"  validate:"required,len=2"`
	Timezone     string `json:"timezone"      validate:"required,max=50"`
	CurrencyCode string `json:"currency_code" validate:"required,len=3"`
}

type InviteMemberRequest struct {
	Email      string     `json:"email"       validate:"required,email,max=255"`
	Role       string     `json:"role"        validate:"required,oneof=admin member hr_admin manager finance"`
	EmployeeID *uuid.UUID `json:"employee_id" validate:"omitempty"`
}

type InviteResponse struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	InviteURL string    `json:"invite_url"`
	ExpiresAt time.Time `json:"expires_at"`
}

type AcceptInvitationRequest struct {
	Token string `json:"token" validate:"required"`
}

type AcceptInvitationResponse struct {
	AccessToken  string        `json:"access_token"`
	Organisation *Organisation `json:"organisation"`
	Member       *Member       `json:"member"`
}

type VerifyInvitationResponse struct {
	Email        string `json:"email"`
	Role         string `json:"role"`
	OrgName      string `json:"org_name"`
	IsValid      bool   `json:"is_valid"`
	ErrorMessage string `json:"error_message,omitempty"`
}

// CreateOrgResponse includes the new org and a fresh JWT scoped to that org.
type CreateOrgResponse struct {
	AccessToken  string        `json:"access_token"`
	Organisation *Organisation `json:"organisation"`
}

// AcceptParams holds the validated data needed to accept an invitation in a single transaction.
type AcceptParams struct {
	InvitationID uuid.UUID
	OrgID        uuid.UUID
	UserID       uuid.UUID
	Role         string
	EmployeeID   *uuid.UUID
}

// UpdateOrgRequest allows partial updates — nil fields are not changed.
type UpdateOrgRequest struct {
	Name         *string `json:"name"          validate:"omitempty,min=1,max=255"`
	Slug         *string `json:"slug"          validate:"omitempty,min=2,max=100,slug"`
	CountryCode  *string `json:"country_code"  validate:"omitempty,len=2"`
	Timezone     *string `json:"timezone"      validate:"omitempty,max=50"`
	CurrencyCode *string `json:"currency_code" validate:"omitempty,len=3"`
}

type TransferOwnershipRequest struct {
	NewOwnerUserID uuid.UUID `json:"new_owner_user_id" validate:"required"`
}

// OrgDetail extends Organisation with runtime-computed fields for the settings page.
type OrgDetail struct {
	Organisation
	EmployeeCount int    `json:"employee_count"`
	OwnerName     string `json:"owner_name"`
}

// UnlinkedMember is a workspace member who has login access but no HR employee record.
// Returned by ListUnlinkedMembers to populate the Add Employee email combobox.
type UnlinkedMember struct {
	UserID   uuid.UUID `json:"user_id"`
	FullName string    `json:"full_name"`
	Email    string    `json:"email"`
	Role     string    `json:"role"`
}

// MyInvitation is an invitation addressed to the current user, enriched with org info.
// Returned by GetMyInvitations for the setup-org / onboarding page.
type MyInvitation struct {
	Invitation
	OrgName string `json:"org_name"`
	OrgSlug string `json:"org_slug"`
}

// MemberWithProfile enriches a workspace member record with their HR profile link status.
// Returned by ListMembers for the Settings → Members page.
type MemberWithProfile struct {
	ID              uuid.UUID  `json:"id"`
	UserID          uuid.UUID  `json:"user_id"`
	OrgID           uuid.UUID  `json:"organisation_id"`
	EmployeeID      *uuid.UUID `json:"employee_id,omitempty"`
	Role            string     `json:"role"`
	JoinedAt        time.Time  `json:"joined_at"`
	FullName        string     `json:"full_name"`
	Email           string     `json:"email"`
	HasHRProfile    bool       `json:"has_hr_profile"`
	HRProfileActive bool       `json:"hr_profile_active"`
}

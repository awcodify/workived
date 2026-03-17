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
	ID       uuid.UUID `json:"id"`
	UserID   uuid.UUID `json:"user_id"`
	OrgID    uuid.UUID `json:"organisation_id"`
	Role     string    `json:"role"`
	IsActive bool      `json:"is_active"`
	JoinedAt time.Time `json:"joined_at"`
}

// ── Request / Response types ──────────────────────────────────────────────────

type CreateOrgRequest struct {
	Name         string `json:"name"          validate:"required,min=1,max=255"`
	Slug         string `json:"slug"          validate:"required,min=2,max=100,alphanum"`
	CountryCode  string `json:"country_code"  validate:"required,len=2"`
	Timezone     string `json:"timezone"      validate:"required,max=50"`
	CurrencyCode string `json:"currency_code" validate:"required,len=3"`
}

type InviteMemberRequest struct {
	Email string `json:"email" validate:"required,email,max=255"`
	Role  string `json:"role"  validate:"required,oneof=admin member"`
}

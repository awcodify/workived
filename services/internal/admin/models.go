package admin

import (
	"time"

	"github.com/google/uuid"
)

// FeatureFlag represents a feature toggle for gradual rollout.
type FeatureFlag struct {
	ID          uuid.UUID              `json:"id"`
	FeatureKey  string                 `json:"feature_key"`
	Name        string                 `json:"name"`
	Description *string                `json:"description,omitempty"`
	IsEnabled   bool                   `json:"is_enabled"`
	Scope       string                 `json:"scope"` // 'global' | 'org' | 'user'
	TargetIDs   map[string]interface{} `json:"target_ids,omitempty"`
	CreatedBy   *uuid.UUID             `json:"created_by,omitempty"`
	UpdatedBy   *uuid.UUID             `json:"updated_by,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// ProLicense represents a Pro tier license for an organisation.
type ProLicense struct {
	ID                   uuid.UUID  `json:"id"`
	OrganisationID       uuid.UUID  `json:"organisation_id"`
	LicenseType          string     `json:"license_type"` // 'trial' | 'monthly' | 'annual'
	Status               string     `json:"status"`       // 'active' | 'expired' | 'cancelled' | 'suspended'
	MaxEmployees         *int       `json:"max_employees,omitempty"`
	StartsAt             time.Time  `json:"starts_at"`
	ExpiresAt            time.Time  `json:"expires_at"`
	CancelledAt          *time.Time `json:"cancelled_at,omitempty"`
	StripeSubscriptionID *string    `json:"stripe_subscription_id,omitempty"`
	StripeCustomerID     *string    `json:"stripe_customer_id,omitempty"`
	CreatedBy            *uuid.UUID `json:"created_by,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

// AdminConfig represents a system configuration setting.
type AdminConfig struct {
	Key         string                 `json:"key"`
	Value       map[string]interface{} `json:"value"`
	Description *string                `json:"description,omitempty"`
	UpdatedBy   *uuid.UUID             `json:"updated_by,omitempty"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// ── Requests ────────────────────────────────────────────────────────────────

type UpdateFeatureFlagRequest struct {
	IsEnabled bool                    `json:"is_enabled"`
	Scope     *string                 `json:"scope,omitempty"`
	TargetIDs *map[string]interface{} `json:"target_ids,omitempty"`
}

type CreateProLicenseRequest struct {
	OrganisationID uuid.UUID `json:"organisation_id" binding:"required"`
	LicenseType    string    `json:"license_type" binding:"required,oneof=trial monthly annual"`
	MaxEmployees   *int      `json:"max_employees,omitempty"`
	DurationDays   int       `json:"duration_days" binding:"required,min=1"`
}

type UpdateProLicenseRequest struct {
	Status       *string    `json:"status,omitempty" binding:"omitempty,oneof=active expired cancelled suspended"`
	MaxEmployees *int       `json:"max_employees,omitempty"`
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
}

type UpdateAdminConfigRequest struct {
	Value map[string]interface{} `json:"value" binding:"required"`
}

// ── Responses ───────────────────────────────────────────────────────────────

type SystemStatsResponse struct {
	TotalOrganisations int           `json:"total_organisations"`
	FreeOrganisations  int           `json:"free_organisations"`
	ProOrganisations   int           `json:"pro_organisations"`
	TotalUsers         int           `json:"total_users"`
	TotalEmployees     int           `json:"total_employees"`
	ActiveFeatures     []FeatureFlag `json:"active_features"`
	ActiveLicenses     int           `json:"active_licenses"`
	ExpiringLicenses   []ProLicense  `json:"expiring_licenses"` // Expiring in next 7 days
}

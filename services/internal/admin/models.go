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
	OrganisationName     string     `json:"organisation_name"` // Joined from organisations table
	LicenseType          string     `json:"license_type"`      // 'trial' | 'monthly' | 'annual'
	Status               string     `json:"status"`            // 'active' | 'expired' | 'cancelled' | 'suspended'
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

// DaysUntilExpiry returns the number of days until the license expires.
func (l *ProLicense) DaysUntilExpiry() int {
	duration := time.Until(l.ExpiresAt)
	return int(duration.Hours() / 24)
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

// OrganisationListItem represents an organisation in the admin list view.
type OrganisationListItem struct {
	ID            uuid.UUID  `json:"id"`
	Name          string     `json:"name"`
	Slug          string     `json:"slug"`
	CountryCode   string     `json:"country_code"`
	Plan          string     `json:"plan"`
	EmployeeCount int        `json:"employee_count"`
	MemberCount   int        `json:"member_count"`
	OwnerName     string     `json:"owner_name"`
	OwnerEmail    string     `json:"owner_email"`
	IsActive      bool       `json:"is_active"`
	CreatedAt     time.Time  `json:"created_at"`
	HasProLicense bool       `json:"has_pro_license"`
	LicenseExpiry *time.Time `json:"license_expiry,omitempty"`
}

// OrganisationDetailView represents full organisation details for the admin modal.
type OrganisationDetailView struct {
	OrganisationListItem
	Timezone          string      `json:"timezone"`
	CurrencyCode      string      `json:"currency_code"`
	WorkDays          []int       `json:"work_days"`
	PlanEmployeeLimit *int        `json:"plan_employee_limit,omitempty"`
	LogoURL           *string     `json:"logo_url,omitempty"`
	AllowWebClockIn   bool        `json:"allow_web_clock_in"`
	SetupCompleted    bool        `json:"setup_completed"`
	ProLicense        *ProLicense `json:"pro_license,omitempty"`
}

// ── System Health ───────────────────────────────────────────────────────────

// SystemHealthResponse represents system health metrics for monitoring.
type SystemHealthResponse struct {
	RealTimeStats    RealTimeStats    `json:"real_time_stats"`
	RecentActivity   RecentActivity   `json:"recent_activity"`
	SystemStatus     SystemStatus     `json:"system_status"`
	DatabasePoolInfo DatabasePoolInfo `json:"database_pool_info"`
	CacheInfo        *CacheInfo       `json:"cache_info,omitempty"`
}

// RealTimeStats holds current system statistics.
type RealTimeStats struct {
	ActiveSessions     int `json:"active_sessions"`
	FailedLoginsLastHr int `json:"failed_logins_last_hr"`
}

// RecentActivity holds statistics for the last 24 hours.
type RecentActivity struct {
	NewUsers         int `json:"new_users"`
	NewOrganisations int `json:"new_organisations"`
	ActiveEmployees  int `json:"active_employees"`
}

// SystemStatus holds status indicators for various system components.
type SystemStatus struct {
	Database string `json:"database"` // "healthy" | "warning" | "down"
	Email    string `json:"email"`    // "connected" | "not_configured" | "unreachable"
	Cache    string `json:"cache"`    // "connected" | "not_configured" | "down"
}

// DatabasePoolInfo holds database connection pool statistics.
type DatabasePoolInfo struct {
	AcquiredConns int32 `json:"acquired_conns"`
	IdleConns     int32 `json:"idle_conns"`
	MaxConns      int32 `json:"max_conns"`
	TotalConns    int32 `json:"total_conns"`
}

// CacheInfo holds Redis cache statistics.
type CacheInfo struct {
	IsConfigured bool    `json:"is_configured"`
	UsedMemory   string  `json:"used_memory,omitempty"`
	UsedMemoryMB float64 `json:"used_memory_mb,omitempty"`
	Keys         int64   `json:"keys,omitempty"`
}

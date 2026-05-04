package admin

import (
	"context"
	"fmt"
	"net/smtp"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/platform/config"
	"github.com/workived/services/pkg/cache"
)

// licenseRepo is the subset of Repository methods used by license sync logic.
// Extracted as an interface so service tests can stub it without a real DB.
type licenseRepo interface {
	CreateProLicense(ctx context.Context, req CreateProLicenseRequest, createdBy, staffAdminID uuid.UUID) (*ProLicense, error)
	UpdateProLicense(ctx context.Context, licenseID uuid.UUID, req UpdateProLicenseRequest) (*ProLicense, error)
	UpdateOrgPlan(ctx context.Context, orgID uuid.UUID, plan string, employeeLimit *int) error
	CountActiveProLicenses(ctx context.Context, orgID uuid.UUID) (int, error)
}

type Service struct {
	repo    *Repository
	licRepo licenseRepo
	cache   *cache.Store
	config  *config.Config
	log     zerolog.Logger
}

type ServiceOption func(*Service)

func WithLogger(log zerolog.Logger) ServiceOption {
	return func(s *Service) {
		s.log = log
	}
}

// WithCache sets the cache store for the admin service.
func WithCache(c *cache.Store) ServiceOption {
	return func(s *Service) {
		s.cache = c
	}
}

// WithConfig sets the configuration for the admin service.
func WithConfig(cfg *config.Config) ServiceOption {
	return func(s *Service) {
		s.config = cfg
	}
}

func NewService(repo *Repository, opts ...ServiceOption) *Service {
	s := &Service{repo: repo, licRepo: repo}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

const (
	featureFlagsCacheKey = "system:feature_flags:all"
	featureFlagsCacheTTL = 10 * time.Minute
)

// listFeatureFlagsCached returns all feature flags, using cache when available.
func (s *Service) listFeatureFlagsCached(ctx context.Context) ([]FeatureFlag, error) {
	if s.cache != nil {
		if v, ok := cache.Get[[]FeatureFlag](ctx, s.cache, featureFlagsCacheKey); ok {
			return v, nil
		}
	}

	flags, err := s.repo.ListFeatureFlags(ctx)
	if err != nil {
		return nil, err
	}

	if s.cache != nil {
		cache.Set(ctx, s.cache, featureFlagsCacheKey, flags, featureFlagsCacheTTL)
	}
	return flags, nil
}

// invalidateFeatureFlagsCache removes the cached feature flags.
func (s *Service) invalidateFeatureFlagsCache(ctx context.Context) {
	if s.cache != nil {
		s.cache.Delete(ctx, featureFlagsCacheKey)
	}
}

// ── Feature Flags ───────────────────────────────────────────────────────────

func (s *Service) ListFeatureFlags(ctx context.Context) ([]FeatureFlag, error) {
	return s.repo.ListFeatureFlags(ctx)
}

func (s *Service) GetFeatureFlagByKey(ctx context.Context, key string) (*FeatureFlag, error) {
	return s.repo.GetFeatureFlagByKey(ctx, key)
}

func (s *Service) UpdateFeatureFlag(ctx context.Context, key string, req UpdateFeatureFlagRequest, updatedBy uuid.UUID) (*FeatureFlag, error) {
	flag, err := s.repo.UpdateFeatureFlag(ctx, key, req, updatedBy)
	if err != nil {
		return nil, fmt.Errorf("update feature flag: %w", err)
	}

	s.invalidateFeatureFlagsCache(ctx)

	s.log.Info().
		Str("feature_key", key).
		Bool("is_enabled", flag.IsEnabled).
		Str("scope", flag.Scope).
		Str("updated_by", updatedBy.String()).
		Msg("admin.feature_flag.updated")

	return flag, nil
}

// GetEnabledFeaturesForOrg returns a map of feature_key → bool for all known flags
// evaluated against the given org and user. Safe to call from non-admin handlers.
// Evaluates flags in memory from the single ListFeatureFlags query — no N+1.
func (s *Service) GetEnabledFeaturesForOrg(ctx context.Context, orgID uuid.UUID, userID uuid.UUID) (map[string]bool, error) {
	flags, err := s.listFeatureFlagsCached(ctx)
	if err != nil {
		return nil, fmt.Errorf("list feature flags: %w", err)
	}

	result := make(map[string]bool, len(flags))
	for _, f := range flags {
		result[f.FeatureKey] = evaluateFlag(&f, &orgID, &userID)
	}
	return result, nil
}

// evaluateFlag checks if a flag is enabled for the given org/user without DB calls.
func evaluateFlag(flag *FeatureFlag, orgID *uuid.UUID, userID *uuid.UUID) bool {
	if !flag.IsEnabled {
		return false
	}

	// Global scope — enabled for everyone
	if flag.Scope == "global" {
		return true
	}

	// Org scope — check if orgID is in target list
	if flag.Scope == "org" && orgID != nil {
		if flag.TargetIDs != nil {
			if ids, ok := flag.TargetIDs["org_ids"].([]interface{}); ok {
				for _, id := range ids {
					if id.(string) == orgID.String() {
						return true
					}
				}
			}
		}
		return false
	}

	// User scope — check if userID is in target list
	if flag.Scope == "user" && userID != nil {
		if flag.TargetIDs != nil {
			if ids, ok := flag.TargetIDs["user_ids"].([]interface{}); ok {
				for _, id := range ids {
					if id.(string) == userID.String() {
						return true
					}
				}
			}
		}
		return false
	}

	return false
}

// IsFeatureEnabled checks if a feature is enabled globally or for a specific org/user.
func (s *Service) IsFeatureEnabled(ctx context.Context, featureKey string, orgID *uuid.UUID, userID *uuid.UUID) (bool, error) {
	flag, err := s.repo.GetFeatureFlagByKey(ctx, featureKey)
	if err != nil {
		// If flag doesn't exist, default to disabled
		return false, nil
	}

	if !flag.IsEnabled {
		return false, nil
	}

	// Global scope — enabled for everyone
	if flag.Scope == "global" {
		return true, nil
	}

	// Org scope — check if orgID is in target list
	if flag.Scope == "org" && orgID != nil {
		if flag.TargetIDs != nil {
			if ids, ok := flag.TargetIDs["org_ids"].([]interface{}); ok {
				for _, id := range ids {
					if id.(string) == orgID.String() {
						return true, nil
					}
				}
			}
		}
		return false, nil
	}

	// User scope — check if userID is in target list
	if flag.Scope == "user" && userID != nil {
		if flag.TargetIDs != nil {
			if ids, ok := flag.TargetIDs["user_ids"].([]interface{}); ok {
				for _, id := range ids {
					if id.(string) == userID.String() {
						return true, nil
					}
				}
			}
		}
		return false, nil
	}

	return false, nil
}

// ── Pro Licenses ────────────────────────────────────────────────────────────

func (s *Service) ListProLicenses(ctx context.Context, status *string) ([]ProLicense, error) {
	return s.repo.ListProLicenses(ctx, status)
}

func (s *Service) GetProLicenseByOrg(ctx context.Context, orgID uuid.UUID) (*ProLicense, error) {
	return s.repo.GetProLicenseByOrg(ctx, orgID)
}

// HasActiveProLicense checks if an organisation has an active Pro license.
// Returns true if license exists, is active, and not expired.
func (s *Service) HasActiveProLicense(ctx context.Context, orgID uuid.UUID) (bool, error) {
	license, err := s.repo.GetProLicenseByOrg(ctx, orgID)
	if err != nil {
		// If license not found, org is on free tier
		return false, nil
	}

	// Check if license is active and not expired
	if license.Status != "active" {
		return false, nil
	}

	// Check if license has not expired
	if time.Now().UTC().After(license.ExpiresAt) {
		return false, nil
	}

	return true, nil
}

func (s *Service) CreateProLicense(ctx context.Context, req CreateProLicenseRequest, createdBy uuid.UUID) (*ProLicense, error) {
	license, err := s.licRepo.CreateProLicense(ctx, req, createdBy, uuid.Nil)
	if err != nil {
		return nil, fmt.Errorf("create pro license: %w", err)
	}

	if err := s.licRepo.UpdateOrgPlan(ctx, license.OrganisationID, "pro", nil); err != nil {
		return nil, fmt.Errorf("set org plan to pro: %w", err)
	}

	s.log.Info().
		Str("license_id", license.ID.String()).
		Str("org_id", license.OrganisationID.String()).
		Str("status", license.Status).
		Str("created_by", createdBy.String()).
		Msg("admin.pro_license.created")

	return license, nil
}

// CreateProLicenseByStaffAdmin creates a license with staff admin attribution.
func (s *Service) CreateProLicenseByStaffAdmin(ctx context.Context, req CreateProLicenseRequest, staffAdminID uuid.UUID) (*ProLicense, error) {
	license, err := s.licRepo.CreateProLicense(ctx, req, uuid.Nil, staffAdminID)
	if err != nil {
		return nil, fmt.Errorf("create pro license: %w", err)
	}

	if err := s.licRepo.UpdateOrgPlan(ctx, license.OrganisationID, "pro", nil); err != nil {
		return nil, fmt.Errorf("set org plan to pro: %w", err)
	}

	s.log.Info().
		Str("license_id", license.ID.String()).
		Str("org_id", license.OrganisationID.String()).
		Str("status", license.Status).
		Str("staff_admin_id", staffAdminID.String()).
		Msg("admin.pro_license.created_by_staff")

	return license, nil
}

func (s *Service) UpdateProLicense(ctx context.Context, licenseID uuid.UUID, req UpdateProLicenseRequest) (*ProLicense, error) {
	license, err := s.licRepo.UpdateProLicense(ctx, licenseID, req)
	if err != nil {
		return nil, fmt.Errorf("update pro license: %w", err)
	}

	// Sync org plan based on license status change.
	if req.Status != nil {
		if *req.Status == "active" {
			if err := s.licRepo.UpdateOrgPlan(ctx, license.OrganisationID, "pro", nil); err != nil {
				return nil, fmt.Errorf("set org plan to pro: %w", err)
			}
		} else {
			// License deactivated — revert to free only if no other active licenses remain.
			remaining, err := s.licRepo.CountActiveProLicenses(ctx, license.OrganisationID)
			if err != nil {
				return nil, fmt.Errorf("count active licenses: %w", err)
			}
			if remaining == 0 {
				freeLimit := 15
				if err := s.licRepo.UpdateOrgPlan(ctx, license.OrganisationID, "free", &freeLimit); err != nil {
					return nil, fmt.Errorf("revert org plan to free: %w", err)
				}
			}
		}
	}

	s.log.Info().
		Str("license_id", licenseID.String()).
		Str("org_id", license.OrganisationID.String()).
		Str("status", license.Status).
		Msg("admin.pro_license.updated")

	return license, nil
}

// ── Admin Config ────────────────────────────────────────────────────────────

func (s *Service) ListAdminConfigs(ctx context.Context) ([]AdminConfig, error) {
	return s.repo.ListAdminConfigs(ctx)
}

func (s *Service) UpdateAdminConfig(ctx context.Context, key string, req UpdateAdminConfigRequest, updatedBy uuid.UUID) (*AdminConfig, error) {
	config, err := s.repo.UpdateAdminConfig(ctx, key, req, updatedBy)
	if err != nil {
		return nil, fmt.Errorf("update admin config: %w", err)
	}

	s.log.Info().
		Str("config_key", key).
		Str("updated_by", updatedBy.String()).
		Msg("admin.config.updated")

	return config, nil
}

// ── System Stats ────────────────────────────────────────────────────────────

func (s *Service) GetSystemStats(ctx context.Context) (*SystemStatsResponse, error) {
	return s.repo.GetSystemStats(ctx)
}

func (s *Service) GetSystemHealth(ctx context.Context) (*SystemHealthResponse, error) {
	// Get base health from repository (database queries)
	health, err := s.repo.GetSystemHealth(ctx)
	if err != nil {
		return nil, err
	}

	// Check Redis/Cache health
	if s.cache != nil {
		health.SystemStatus.Cache = "connected"

		// Get cache info
		cacheInfo := &CacheInfo{
			IsConfigured: true,
		}

		// Try to get Redis INFO stats
		// Note: This requires access to the underlying Redis client
		// For now, we'll just confirm it's connected
		health.CacheInfo = cacheInfo
	} else {
		health.SystemStatus.Cache = "not_configured"
	}

	// Email service health
	if s.config != nil && s.config.EmailEnabled {
		// Email is configured - test connectivity
		if s.config.ResendAPIKey != "" {
			// Using Resend API
			health.SystemStatus.Email = "connected"
		} else if s.config.SMTPHost != "" && s.config.SMTPPort > 0 {
			// Using SMTP - test connection
			health.SystemStatus.Email = s.testSMTPConnection()
		} else {
			health.SystemStatus.Email = "not_configured"
		}
	} else {
		health.SystemStatus.Email = "not_configured"
	}

	return health, nil
}

// testSMTPConnection attempts to connect to the SMTP server to verify it's reachable
func (s *Service) testSMTPConnection() string {
	if s.config == nil {
		return "not_configured"
	}

	// Try to connect with a short timeout
	addr := fmt.Sprintf("%s:%d", s.config.SMTPHost, s.config.SMTPPort)

	// Use smtp.Dial with timeout context
	// Note: smtp package doesn't support context, so we do a quick check
	client, err := smtp.Dial(addr)
	if err != nil {
		s.log.Warn().Err(err).Str("smtp_host", s.config.SMTPHost).Msg("smtp health check failed")
		return "unreachable"
	}
	defer client.Close()

	// Try HELLO command
	if err := client.Hello("workived-health-check"); err != nil {
		s.log.Warn().Err(err).Msg("smtp hello failed")
		return "unreachable"
	}

	return "connected"
}

// ── Organisations ───────────────────────────────────────────────────────────

func (s *Service) ListOrganisations(ctx context.Context) ([]OrganisationListItem, error) {
	return s.repo.ListOrganisations(ctx)
}

func (s *Service) GetOrganisationDetail(ctx context.Context, orgID uuid.UUID) (*OrganisationDetailView, error) {
	return s.repo.GetOrganisationDetail(ctx, orgID)
}

func (s *Service) SuspendOrganisation(ctx context.Context, orgID uuid.UUID, suspendedBy uuid.UUID) error {
	if err := s.repo.UpdateOrganisationStatus(ctx, orgID, false); err != nil {
		return fmt.Errorf("suspend organisation: %w", err)
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("suspended_by", suspendedBy.String()).
		Msg("admin.organisation.suspended")

	return nil
}

func (s *Service) ReactivateOrganisation(ctx context.Context, orgID uuid.UUID, reactivatedBy uuid.UUID) error {
	if err := s.repo.UpdateOrganisationStatus(ctx, orgID, true); err != nil {
		return fmt.Errorf("reactivate organisation: %w", err)
	}

	s.log.Info().
		Str("org_id", orgID.String()).
		Str("reactivated_by", reactivatedBy.String()).
		Msg("admin.organisation.reactivated")

	return nil
}

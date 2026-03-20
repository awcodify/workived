package admin

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

type Service struct {
	repo *Repository
	log  zerolog.Logger
}

type ServiceOption func(*Service)

func WithLogger(log zerolog.Logger) ServiceOption {
	return func(s *Service) {
		s.log = log
	}
}

func NewService(repo *Repository, opts ...ServiceOption) *Service {
	s := &Service{repo: repo}
	for _, opt := range opts {
		opt(s)
	}
	return s
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
func (s *Service) GetEnabledFeaturesForOrg(ctx context.Context, orgID uuid.UUID, userID uuid.UUID) (map[string]bool, error) {
	flags, err := s.repo.ListFeatureFlags(ctx)
	if err != nil {
		return nil, fmt.Errorf("list feature flags: %w", err)
	}

	result := make(map[string]bool, len(flags))
	for _, f := range flags {
		enabled, _ := s.IsFeatureEnabled(ctx, f.FeatureKey, &orgID, &userID)
		result[f.FeatureKey] = enabled
	}
	return result, nil
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

func (s *Service) CreateProLicense(ctx context.Context, req CreateProLicenseRequest, createdBy uuid.UUID) (*ProLicense, error) {
	license, err := s.repo.CreateProLicense(ctx, req, createdBy)
	if err != nil {
		return nil, fmt.Errorf("create pro license: %w", err)
	}

	s.log.Info().
		Str("license_id", license.ID.String()).
		Str("org_id", license.OrganisationID.String()).
		Str("status", license.Status).
		Str("created_by", createdBy.String()).
		Msg("admin.pro_license.created")

	return license, nil
}

func (s *Service) UpdateProLicense(ctx context.Context, licenseID uuid.UUID, req UpdateProLicenseRequest) (*ProLicense, error) {
	license, err := s.repo.UpdateProLicense(ctx, licenseID, req)
	if err != nil {
		return nil, fmt.Errorf("update pro license: %w", err)
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

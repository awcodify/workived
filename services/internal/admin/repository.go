package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/workived/services/pkg/apperr"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// ── Feature Flags ───────────────────────────────────────────────────────────

func (r *Repository) ListFeatureFlags(ctx context.Context) ([]FeatureFlag, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, feature_key, name, description, is_enabled, scope, target_ids,
		       created_by, updated_by, created_at, updated_at
		FROM feature_flags
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var flags []FeatureFlag
	for rows.Next() {
		var f FeatureFlag
		var targetIDsJSON []byte
		if err := rows.Scan(
			&f.ID, &f.FeatureKey, &f.Name, &f.Description, &f.IsEnabled, &f.Scope, &targetIDsJSON,
			&f.CreatedBy, &f.UpdatedBy, &f.CreatedAt, &f.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if targetIDsJSON != nil {
			if err := json.Unmarshal(targetIDsJSON, &f.TargetIDs); err != nil {
				return nil, fmt.Errorf("unmarshal target_ids: %w", err)
			}
		}
		flags = append(flags, f)
	}
	return flags, rows.Err()
}

func (r *Repository) GetFeatureFlagByKey(ctx context.Context, key string) (*FeatureFlag, error) {
	var f FeatureFlag
	var targetIDsJSON []byte
	err := r.db.QueryRow(ctx, `
		SELECT id, feature_key, name, description, is_enabled, scope, target_ids,
		       created_by, updated_by, created_at, updated_at
		FROM feature_flags
		WHERE feature_key = $1
	`, key).Scan(
		&f.ID, &f.FeatureKey, &f.Name, &f.Description, &f.IsEnabled, &f.Scope, &targetIDsJSON,
		&f.CreatedBy, &f.UpdatedBy, &f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		return nil, apperr.NotFound("feature flag")
	}
	if targetIDsJSON != nil {
		if err := json.Unmarshal(targetIDsJSON, &f.TargetIDs); err != nil {
			return nil, fmt.Errorf("unmarshal target_ids: %w", err)
		}
	}
	return &f, nil
}

func (r *Repository) UpdateFeatureFlag(ctx context.Context, key string, req UpdateFeatureFlagRequest, updatedBy uuid.UUID) (*FeatureFlag, error) {
	var targetIDsJSON []byte
	if req.TargetIDs != nil {
		targetIDsJSON, _ = json.Marshal(req.TargetIDs)
	}

	var f FeatureFlag
	var respTargetIDsJSON []byte
	err := r.db.QueryRow(ctx, `
		UPDATE feature_flags
		SET is_enabled = $1,
		    scope = COALESCE($2, scope),
		    target_ids = COALESCE($3, target_ids),
		    updated_by = $4,
		    updated_at = NOW()
		WHERE feature_key = $5
		RETURNING id, feature_key, name, description, is_enabled, scope, target_ids,
		          created_by, updated_by, created_at, updated_at
	`, req.IsEnabled, req.Scope, targetIDsJSON, updatedBy, key).Scan(
		&f.ID, &f.FeatureKey, &f.Name, &f.Description, &f.IsEnabled, &f.Scope, &respTargetIDsJSON,
		&f.CreatedBy, &f.UpdatedBy, &f.CreatedAt, &f.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if respTargetIDsJSON != nil {
		if err := json.Unmarshal(respTargetIDsJSON, &f.TargetIDs); err != nil {
			return nil, fmt.Errorf("unmarshal target_ids: %w", err)
		}
	}
	return &f, nil
}

// ── Pro Licenses ────────────────────────────────────────────────────────────

func (r *Repository) ListProLicenses(ctx context.Context, status *string) ([]ProLicense, error) {
	query := `
		SELECT id, organisation_id, license_type, status, max_employees,
		       starts_at, expires_at, cancelled_at,
		       stripe_subscription_id, stripe_customer_id,
		       created_by, created_at, updated_at
		FROM pro_licenses
	`
	args := []interface{}{}
	if status != nil {
		query += ` WHERE status = $1`
		args = append(args, *status)
	}
	query += ` ORDER BY created_at DESC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var licenses []ProLicense
	for rows.Next() {
		var l ProLicense
		if err := rows.Scan(
			&l.ID, &l.OrganisationID, &l.LicenseType, &l.Status, &l.MaxEmployees,
			&l.StartsAt, &l.ExpiresAt, &l.CancelledAt,
			&l.StripeSubscriptionID, &l.StripeCustomerID,
			&l.CreatedBy, &l.CreatedAt, &l.UpdatedAt,
		); err != nil {
			return nil, err
		}
		licenses = append(licenses, l)
	}
	return licenses, rows.Err()
}

func (r *Repository) GetProLicenseByOrg(ctx context.Context, orgID uuid.UUID) (*ProLicense, error) {
	var l ProLicense
	err := r.db.QueryRow(ctx, `
		SELECT id, organisation_id, license_type, status, max_employees,
		       starts_at, expires_at, cancelled_at,
		       stripe_subscription_id, stripe_customer_id,
		       created_by, created_at, updated_at
		FROM pro_licenses
		WHERE organisation_id = $1
	`, orgID).Scan(
		&l.ID, &l.OrganisationID, &l.LicenseType, &l.Status, &l.MaxEmployees,
		&l.StartsAt, &l.ExpiresAt, &l.CancelledAt,
		&l.StripeSubscriptionID, &l.StripeCustomerID,
		&l.CreatedBy, &l.CreatedAt, &l.UpdatedAt,
	)
	if err != nil {
		return nil, apperr.NotFound("pro license")
	}
	return &l, nil
}

func (r *Repository) CreateProLicense(ctx context.Context, req CreateProLicenseRequest, createdBy uuid.UUID) (*ProLicense, error) {
	startsAt := time.Now().UTC()
	expiresAt := startsAt.AddDate(0, 0, req.DurationDays)

	var l ProLicense
	err := r.db.QueryRow(ctx, `
		INSERT INTO pro_licenses (organisation_id, license_type, status, max_employees, starts_at, expires_at, created_by)
		VALUES ($1, $2, 'active', $3, $4, $5, $6)
		RETURNING id, organisation_id, license_type, status, max_employees,
		          starts_at, expires_at, cancelled_at,
		          stripe_subscription_id, stripe_customer_id,
		          created_by, created_at, updated_at
	`, req.OrganisationID, req.LicenseType, req.MaxEmployees, startsAt, expiresAt, createdBy).Scan(
		&l.ID, &l.OrganisationID, &l.LicenseType, &l.Status, &l.MaxEmployees,
		&l.StartsAt, &l.ExpiresAt, &l.CancelledAt,
		&l.StripeSubscriptionID, &l.StripeCustomerID,
		&l.CreatedBy, &l.CreatedAt, &l.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &l, nil
}

func (r *Repository) UpdateProLicense(ctx context.Context, licenseID uuid.UUID, req UpdateProLicenseRequest) (*ProLicense, error) {
	var l ProLicense
	err := r.db.QueryRow(ctx, `
		UPDATE pro_licenses
		SET status = COALESCE($1, status),
		    max_employees = COALESCE($2, max_employees),
		    expires_at = COALESCE($3, expires_at),
		    updated_at = NOW()
		WHERE id = $4
		RETURNING id, organisation_id, license_type, status, max_employees,
		          starts_at, expires_at, cancelled_at,
		          stripe_subscription_id, stripe_customer_id,
		          created_by, created_at, updated_at
	`, req.Status, req.MaxEmployees, req.ExpiresAt, licenseID).Scan(
		&l.ID, &l.OrganisationID, &l.LicenseType, &l.Status, &l.MaxEmployees,
		&l.StartsAt, &l.ExpiresAt, &l.CancelledAt,
		&l.StripeSubscriptionID, &l.StripeCustomerID,
		&l.CreatedBy, &l.CreatedAt, &l.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &l, nil
}

// ── Admin Config ────────────────────────────────────────────────────────────

func (r *Repository) ListAdminConfigs(ctx context.Context) ([]AdminConfig, error) {
	rows, err := r.db.Query(ctx, `
		SELECT key, value, description, updated_by, updated_at
		FROM admin_config
		ORDER BY key
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var configs []AdminConfig
	for rows.Next() {
		var c AdminConfig
		var valueJSON []byte
		if err := rows.Scan(&c.Key, &valueJSON, &c.Description, &c.UpdatedBy, &c.UpdatedAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(valueJSON, &c.Value); err != nil {
			return nil, fmt.Errorf("unmarshal config value: %w", err)
		}
		configs = append(configs, c)
	}
	return configs, rows.Err()
}

func (r *Repository) UpdateAdminConfig(ctx context.Context, key string, req UpdateAdminConfigRequest, updatedBy uuid.UUID) (*AdminConfig, error) {
	valueJSON, _ := json.Marshal(req.Value)

	var c AdminConfig
	var respValueJSON []byte
	err := r.db.QueryRow(ctx, `
		UPDATE admin_config
		SET value = $1, updated_by = $2, updated_at = NOW()
		WHERE key = $3
		RETURNING key, value, description, updated_by, updated_at
	`, valueJSON, updatedBy, key).Scan(&c.Key, &respValueJSON, &c.Description, &c.UpdatedBy, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(respValueJSON, &c.Value); err != nil {
		return nil, fmt.Errorf("unmarshal config value: %w", err)
	}
	return &c, nil
}

// ── System Stats ────────────────────────────────────────────────────────────

func (r *Repository) GetSystemStats(ctx context.Context) (*SystemStatsResponse, error) {
	stats := &SystemStatsResponse{
		ActiveFeatures:   []FeatureFlag{},
		ExpiringLicenses: []ProLicense{},
	}

	// Total organisations
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM organisations WHERE is_active = TRUE`).Scan(&stats.TotalOrganisations); err != nil {
		return nil, fmt.Errorf("count organisations: %w", err)
	}
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM organisations WHERE is_active = TRUE AND plan = 'free'`).Scan(&stats.FreeOrganisations); err != nil {
		return nil, fmt.Errorf("count free organisations: %w", err)
	}
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM organisations WHERE is_active = TRUE AND plan = 'pro'`).Scan(&stats.ProOrganisations); err != nil {
		return nil, fmt.Errorf("count pro organisations: %w", err)
	}

	// Users and employees
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&stats.TotalUsers); err != nil {
		return nil, fmt.Errorf("count users: %w", err)
	}
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM employees WHERE is_active = TRUE`).Scan(&stats.TotalEmployees); err != nil {
		return nil, fmt.Errorf("count employees: %w", err)
	}

	// Active licenses
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM pro_licenses WHERE status = 'active' AND expires_at > NOW()`).Scan(&stats.ActiveLicenses); err != nil {
		return nil, fmt.Errorf("count active licenses: %w", err)
	}

	// Expiring licenses (next 7 days)
	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, license_type, status, max_employees,
		       starts_at, expires_at, cancelled_at,
		       stripe_subscription_id, stripe_customer_id,
		       created_by, created_at, updated_at
		FROM pro_licenses
		WHERE status = 'active' 
		  AND expires_at > NOW() 
		  AND expires_at <= NOW() + INTERVAL '7 days'
		ORDER BY expires_at
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var l ProLicense
			if err := rows.Scan(
				&l.ID, &l.OrganisationID, &l.LicenseType, &l.Status, &l.MaxEmployees,
				&l.StartsAt, &l.ExpiresAt, &l.CancelledAt,
				&l.StripeSubscriptionID, &l.StripeCustomerID,
				&l.CreatedBy, &l.CreatedAt, &l.UpdatedAt,
			); err != nil {
				return nil, fmt.Errorf("scan expiring license: %w", err)
			}
			stats.ExpiringLicenses = append(stats.ExpiringLicenses, l)
		}
	}

	// Active features
	activeFlags, err := r.ListFeatureFlags(ctx)
	if err == nil {
		for _, flag := range activeFlags {
			if flag.IsEnabled {
				stats.ActiveFeatures = append(stats.ActiveFeatures, flag)
			}
		}
	}

	return stats, nil
}

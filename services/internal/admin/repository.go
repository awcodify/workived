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
		SELECT 
			pl.id, pl.organisation_id, COALESCE(o.name, 'Unknown') as organisation_name,
			pl.license_type, pl.status, pl.max_employees,
			pl.starts_at, pl.expires_at, pl.cancelled_at,
			pl.stripe_subscription_id, pl.stripe_customer_id,
			pl.created_by, pl.created_by_staff_admin_id, pl.created_at, pl.updated_at
		FROM pro_licenses pl
		LEFT JOIN organisations o ON o.id = pl.organisation_id
	`
	args := []interface{}{}
	if status != nil {
		query += ` WHERE pl.status = $1`
		args = append(args, *status)
	}
	query += ` ORDER BY pl.created_at DESC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var licenses []ProLicense
	for rows.Next() {
		var l ProLicense
		if err := rows.Scan(
			&l.ID, &l.OrganisationID, &l.OrganisationName,
			&l.LicenseType, &l.Status, &l.MaxEmployees,
			&l.StartsAt, &l.ExpiresAt, &l.CancelledAt,
			&l.StripeSubscriptionID, &l.StripeCustomerID,
			&l.CreatedBy, &l.CreatedByStaffAdminID, &l.CreatedAt, &l.UpdatedAt,
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
		SELECT 
			pl.id, pl.organisation_id, COALESCE(o.name, 'Unknown') as organisation_name,
			pl.license_type, pl.status, pl.max_employees,
			pl.starts_at, pl.expires_at, pl.cancelled_at,
			pl.stripe_subscription_id, pl.stripe_customer_id,
			pl.created_by, pl.created_by_staff_admin_id, pl.created_at, pl.updated_at
		FROM pro_licenses pl
		LEFT JOIN organisations o ON o.id = pl.organisation_id
		WHERE pl.organisation_id = $1
	`, orgID).Scan(
		&l.ID, &l.OrganisationID, &l.OrganisationName,
		&l.LicenseType, &l.Status, &l.MaxEmployees,
		&l.StartsAt, &l.ExpiresAt, &l.CancelledAt,
		&l.StripeSubscriptionID, &l.StripeCustomerID,
		&l.CreatedBy, &l.CreatedByStaffAdminID, &l.CreatedAt, &l.UpdatedAt,
	)
	if err != nil {
		return nil, apperr.NotFound("pro license")
	}
	return &l, nil
}

func (r *Repository) GetProLicenseByID(ctx context.Context, licenseID uuid.UUID) (*ProLicense, error) {
	var l ProLicense
	err := r.db.QueryRow(ctx, `
		SELECT 
			pl.id, pl.organisation_id, COALESCE(o.name, 'Unknown') as organisation_name,
			pl.license_type, pl.status, pl.max_employees,
			pl.starts_at, pl.expires_at, pl.cancelled_at,
			pl.stripe_subscription_id, pl.stripe_customer_id,
			pl.created_by, pl.created_by_staff_admin_id, pl.created_at, pl.updated_at
		FROM pro_licenses pl
		LEFT JOIN organisations o ON o.id = pl.organisation_id
		WHERE pl.id = $1
	`, licenseID).Scan(
		&l.ID, &l.OrganisationID, &l.OrganisationName,
		&l.LicenseType, &l.Status, &l.MaxEmployees,
		&l.StartsAt, &l.ExpiresAt, &l.CancelledAt,
		&l.StripeSubscriptionID, &l.StripeCustomerID,
		&l.CreatedBy, &l.CreatedByStaffAdminID, &l.CreatedAt, &l.UpdatedAt,
	)
	if err != nil {
		return nil, apperr.NotFound("pro license")
	}
	return &l, nil
}

func (r *Repository) CreateProLicense(ctx context.Context, req CreateProLicenseRequest, createdBy uuid.UUID, staffAdminID uuid.UUID) (*ProLicense, error) {
	startsAt := time.Now().UTC()
	expiresAt := startsAt.AddDate(0, 0, req.DurationDays)

	// Convert uuid.Nil to NULL for foreign key fields
	var createdByParam, staffAdminIDParam interface{}
	if createdBy == uuid.Nil {
		createdByParam = nil
	} else {
		createdByParam = createdBy
	}
	if staffAdminID == uuid.Nil {
		staffAdminIDParam = nil
	} else {
		staffAdminIDParam = staffAdminID
	}

	var l ProLicense
	err := r.db.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO pro_licenses (organisation_id, license_type, status, max_employees, starts_at, expires_at, created_by, created_by_staff_admin_id)
			VALUES ($1, $2, 'active', $3, $4, $5, $6, $7)
			RETURNING id, organisation_id, license_type, status, max_employees,
			          starts_at, expires_at, cancelled_at,
			          stripe_subscription_id, stripe_customer_id,
			          created_by, created_by_staff_admin_id, created_at, updated_at
		)
		SELECT 
			i.id, i.organisation_id, COALESCE(o.name, 'Unknown') as organisation_name,
			i.license_type, i.status, i.max_employees,
			i.starts_at, i.expires_at, i.cancelled_at,
			i.stripe_subscription_id, i.stripe_customer_id,
			i.created_by, i.created_by_staff_admin_id, i.created_at, i.updated_at
		FROM inserted i
		LEFT JOIN organisations o ON o.id = i.organisation_id
	`, req.OrganisationID, req.LicenseType, req.MaxEmployees, startsAt, expiresAt, createdByParam, staffAdminIDParam).Scan(
		&l.ID, &l.OrganisationID, &l.OrganisationName,
		&l.LicenseType, &l.Status, &l.MaxEmployees,
		&l.StartsAt, &l.ExpiresAt, &l.CancelledAt,
		&l.StripeSubscriptionID, &l.StripeCustomerID,
		&l.CreatedBy, &l.CreatedByStaffAdminID, &l.CreatedAt, &l.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert pro license for org %s (type=%s, max_employees=%v, duration=%d days): %w",
			req.OrganisationID.String(), req.LicenseType, req.MaxEmployees, req.DurationDays, err)
	}
	return &l, nil
}

func (r *Repository) UpdateProLicense(ctx context.Context, licenseID uuid.UUID, req UpdateProLicenseRequest) (*ProLicense, error) {
	var l ProLicense
	err := r.db.QueryRow(ctx, `
		WITH updated AS (
			UPDATE pro_licenses
			SET status = COALESCE($1, status),
			    max_employees = COALESCE($2, max_employees),
			    expires_at = COALESCE($3, expires_at),
			    updated_at = NOW()
			WHERE id = $4
			RETURNING id, organisation_id, license_type, status, max_employees,
			          starts_at, expires_at, cancelled_at,
			          stripe_subscription_id, stripe_customer_id,
			          created_by, created_by_staff_admin_id, created_at, updated_at
		)
		SELECT 
			u.id, u.organisation_id, COALESCE(o.name, 'Unknown') as organisation_name,
			u.license_type, u.status, u.max_employees,
			u.starts_at, u.expires_at, u.cancelled_at,
			u.stripe_subscription_id, u.stripe_customer_id,
			u.created_by, u.created_by_staff_admin_id, u.created_at, u.updated_at
		FROM updated u
		LEFT JOIN organisations o ON o.id = u.organisation_id
	`, req.Status, req.MaxEmployees, req.ExpiresAt, licenseID).Scan(
		&l.ID, &l.OrganisationID, &l.OrganisationName,
		&l.LicenseType, &l.Status, &l.MaxEmployees,
		&l.StartsAt, &l.ExpiresAt, &l.CancelledAt,
		&l.StripeSubscriptionID, &l.StripeCustomerID,
		&l.CreatedBy, &l.CreatedByStaffAdminID, &l.CreatedAt, &l.UpdatedAt,
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

// ── Organisations ───────────────────────────────────────────────────────────

// ListOrganisations returns all organisations with employee/member counts and owner info.
func (r *Repository) ListOrganisations(ctx context.Context) ([]OrganisationListItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT 
			o.id,
			o.name,
			o.slug,
			o.country_code,
			o.plan,
			COALESCE((SELECT COUNT(*) FROM employees WHERE organisation_id = o.id AND is_active = TRUE), 0) AS employee_count,
			COALESCE((SELECT COUNT(*) FROM organisation_members WHERE organisation_id = o.id AND is_active = TRUE), 0) AS member_count,
			COALESCE(u.full_name, '') AS owner_name,
			COALESCE(u.email, '') AS owner_email,
			o.is_active,
			o.created_at,
			EXISTS(SELECT 1 FROM pro_licenses WHERE organisation_id = o.id AND status = 'active' AND expires_at > NOW()) AS has_pro_license,
			(SELECT expires_at FROM pro_licenses WHERE organisation_id = o.id AND status = 'active' AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1) AS license_expiry
		FROM organisations o
		LEFT JOIN organisation_members om ON om.organisation_id = o.id AND om.role = 'owner' AND om.is_active = TRUE
		LEFT JOIN users u ON u.id = om.user_id
		ORDER BY o.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orgs []OrganisationListItem
	for rows.Next() {
		var org OrganisationListItem
		if err := rows.Scan(
			&org.ID, &org.Name, &org.Slug, &org.CountryCode, &org.Plan,
			&org.EmployeeCount, &org.MemberCount, &org.OwnerName, &org.OwnerEmail,
			&org.IsActive, &org.CreatedAt, &org.HasProLicense, &org.LicenseExpiry,
		); err != nil {
			return nil, err
		}
		orgs = append(orgs, org)
	}
	return orgs, rows.Err()
}

// GetOrganisationDetail returns full details for a single organisation.
func (r *Repository) GetOrganisationDetail(ctx context.Context, orgID uuid.UUID) (*OrganisationDetailView, error) {
	var detail OrganisationDetailView
	err := r.db.QueryRow(ctx, `
		SELECT 
			o.id,
			o.name,
			o.slug,
			o.country_code,
			o.timezone,
			o.currency_code,
			o.work_days,
			o.plan,
			o.plan_employee_limit,
			o.logo_url,
			o.allow_web_clock_in,
			o.is_active,
			o.created_at,
			COALESCE((SELECT COUNT(*) FROM employees WHERE organisation_id = o.id AND is_active = TRUE), 0) AS employee_count,
			COALESCE((SELECT COUNT(*) FROM organisation_members WHERE organisation_id = o.id AND is_active = TRUE), 0) AS member_count,
			COALESCE(u.full_name, '') AS owner_name,
			COALESCE(u.email, '') AS owner_email,
			EXISTS(SELECT 1 FROM pro_licenses WHERE organisation_id = o.id AND status = 'active' AND expires_at > NOW()) AS has_pro_license,
			(SELECT expires_at FROM pro_licenses WHERE organisation_id = o.id AND status = 'active' AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1) AS license_expiry,
			EXISTS(SELECT 1 FROM employees WHERE organisation_id = o.id LIMIT 1) AS setup_completed
		FROM organisations o
		LEFT JOIN organisation_members om ON om.organisation_id = o.id AND om.role = 'owner' AND om.is_active = TRUE
		LEFT JOIN users u ON u.id = om.user_id
		WHERE o.id = $1
	`, orgID).Scan(
		&detail.ID, &detail.Name, &detail.Slug, &detail.CountryCode, &detail.Timezone,
		&detail.CurrencyCode, &detail.WorkDays, &detail.Plan, &detail.PlanEmployeeLimit,
		&detail.LogoURL, &detail.AllowWebClockIn, &detail.IsActive, &detail.CreatedAt,
		&detail.EmployeeCount, &detail.MemberCount, &detail.OwnerName, &detail.OwnerEmail,
		&detail.HasProLicense, &detail.LicenseExpiry, &detail.SetupCompleted,
	)
	if err != nil {
		return nil, apperr.NotFound("organisation")
	}

	// Fetch pro license if exists
	if detail.HasProLicense {
		license, err := r.GetProLicenseByOrg(ctx, orgID)
		if err == nil {
			detail.ProLicense = license
		}
	}

	return &detail, nil
}

// UpdateOrganisationStatus updates the is_active status of an organisation.
func (r *Repository) UpdateOrganisationStatus(ctx context.Context, orgID uuid.UUID, isActive bool) error {
	result, err := r.db.Exec(ctx, `
		UPDATE organisations
		SET is_active = $1, updated_at = NOW()
		WHERE id = $2
	`, isActive, orgID)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return apperr.NotFound("organisation")
	}
	return nil
}

// ── System Health ───────────────────────────────────────────────────────────

// GetSystemHealth returns real-time health metrics for system monitoring.
func (r *Repository) GetSystemHealth(ctx context.Context) (*SystemHealthResponse, error) {
	health := &SystemHealthResponse{
		RealTimeStats:  RealTimeStats{},
		RecentActivity: RecentActivity{},
		SystemStatus:   SystemStatus{},
	}

	// Real-time stats: Active sessions (unique users with valid refresh tokens)
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(DISTINCT user_id) 
		FROM auth_tokens 
		WHERE token_type = 'refresh' 
		  AND expires_at > NOW()
	`).Scan(&health.RealTimeStats.ActiveSessions)
	if err != nil {
		return nil, fmt.Errorf("count active sessions: %w", err)
	}

	// Real-time stats: Failed login attempts (last hour)
	// Note: We track this via expired/used password_reset tokens as a proxy
	// TODO: Implement dedicated login_attempts audit table for more accurate tracking
	err = r.db.QueryRow(ctx, `
		SELECT COUNT(*) 
		FROM auth_tokens 
		WHERE token_type = 'password_reset' 
		  AND created_at > NOW() - INTERVAL '1 hour'
		  AND used_at IS NULL
		  AND expires_at < NOW()
	`).Scan(&health.RealTimeStats.FailedLoginsLastHr)
	if err != nil {
		// Non-critical, just log and continue
		health.RealTimeStats.FailedLoginsLastHr = 0
	}

	// Recent activity (last 24 hours): New users
	err = r.db.QueryRow(ctx, `
		SELECT COUNT(*) 
		FROM users 
		WHERE created_at > NOW() - INTERVAL '24 hours'
	`).Scan(&health.RecentActivity.NewUsers)
	if err != nil {
		return nil, fmt.Errorf("count new users: %w", err)
	}

	// Recent activity: New organisations
	err = r.db.QueryRow(ctx, `
		SELECT COUNT(*) 
		FROM organisations 
		WHERE created_at > NOW() - INTERVAL '24 hours'
	`).Scan(&health.RecentActivity.NewOrganisations)
	if err != nil {
		return nil, fmt.Errorf("count new organisations: %w", err)
	}

	// Recent activity: Active employees (had attendance/leave activity in last 24h)
	err = r.db.QueryRow(ctx, `
		SELECT COUNT(DISTINCT employee_id) FROM (
			SELECT employee_id FROM attendance_records WHERE created_at > NOW() - INTERVAL '24 hours'
			UNION
			SELECT employee_id FROM leave_requests WHERE created_at > NOW() - INTERVAL '24 hours'
		) AS active_employees
	`).Scan(&health.RecentActivity.ActiveEmployees)
	if err != nil {
		return nil, fmt.Errorf("count active employees: %w", err)
	}

	// Database health check
	var dbHealthCheck int
	err = r.db.QueryRow(ctx, `SELECT 1`).Scan(&dbHealthCheck)
	if err != nil {
		health.SystemStatus.Database = "down"
	} else {
		health.SystemStatus.Database = "healthy"
	}

	// Database connection pool stats
	stats := r.db.Stat()
	health.DatabasePoolInfo = DatabasePoolInfo{
		AcquiredConns: stats.AcquiredConns(),
		IdleConns:     stats.IdleConns(),
		MaxConns:      stats.MaxConns(),
		TotalConns:    stats.TotalConns(),
	}

	return health, nil
}

package setup

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// GetSetupStatus checks if organization needs setup wizard
func (r *Repository) GetSetupStatus(ctx context.Context, orgID uuid.UUID) (*SetupStatus, error) {
	query := `
		SELECT 
			o.setup_completed_at IS NULL AND (o.setup_skipped IS NULL OR o.setup_skipped = FALSE) AS needs_setup,
			COALESCE(o.setup_skipped, FALSE) AS skipped,
			o.setup_completed_at,
			EXISTS(SELECT 1 FROM work_schedules WHERE organisation_id = $1 AND is_active = TRUE) AS work_schedule_exists,
			(SELECT COUNT(*) FROM leave_policies WHERE organisation_id = $1 AND is_active = TRUE) AS leave_policies_count,
			(SELECT COUNT(*) FROM claim_categories WHERE organisation_id = $1 AND is_active = TRUE) AS claim_categories_count,
			(SELECT COUNT(*) FROM organisation_members WHERE organisation_id = $1) AS members_count
		FROM organisations o
	WHERE o.id = $1
	`

	var status SetupStatus
	err := r.db.QueryRow(ctx, query, orgID).Scan(
		&status.NeedsSetup,
		&status.Skipped,
		&status.CompletedAt,
		&status.WorkScheduleExists,
		&status.LeavePoliciesCount,
		&status.ClaimCategoriesCount,
		&status.MembersCount,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("organisation not found")
		}
		return nil, err
	}

	return &status, nil
}

// GetWorkScheduleTemplates retrieves templates for a country
func (r *Repository) GetWorkScheduleTemplates(ctx context.Context, countryCode string) ([]WorkScheduleTemplate, error) {
	query := `
		SELECT id, country_code, name, description, work_days, start_time::TEXT, end_time::TEXT, sort_order
		FROM work_schedule_templates
		WHERE country_code = $1
		ORDER BY sort_order
	`

	rows, err := r.db.Query(ctx, query, countryCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []WorkScheduleTemplate
	for rows.Next() {
		var t WorkScheduleTemplate
		if err := rows.Scan(&t.ID, &t.CountryCode, &t.Name, &t.Description, &t.WorkDays, &t.StartTime, &t.EndTime, &t.SortOrder); err != nil {
			return nil, err
		}
		templates = append(templates, t)
	}

	return templates, rows.Err()
}

// GetLeavePolicyTemplates retrieves templates for a country
func (r *Repository) GetLeavePolicyTemplates(ctx context.Context, countryCode string) ([]LeavePolicyTemplate, error) {
	query := `
		SELECT id, country_code, name, description, entitled_days_per_year,
		       is_carry_over_allowed, max_carry_over_days, is_accrued, requires_approval,
		       COALESCE(gender_eligibility, 'all'), sort_order
		FROM leave_policy_templates
		WHERE country_code = $1
		ORDER BY sort_order
	`

	rows, err := r.db.Query(ctx, query, countryCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []LeavePolicyTemplate
	for rows.Next() {
		var t LeavePolicyTemplate
		if err := rows.Scan(&t.ID, &t.CountryCode, &t.Name, &t.Description, &t.EntitledDaysPerYear,
			&t.IsCarryOverAllowed, &t.MaxCarryOverDays, &t.IsAccrued, &t.RequiresApproval,
			&t.GenderEligibility, &t.SortOrder); err != nil {
			return nil, err
		}
		templates = append(templates, t)
	}

	return templates, rows.Err()
}

// GetClaimCategoryTemplates retrieves templates for a country
func (r *Repository) GetClaimCategoryTemplates(ctx context.Context, countryCode string) ([]ClaimCategoryTemplate, error) {
	query := `
		SELECT id, country_code, name, description, monthly_limit, currency_code, requires_receipt,
		       COALESCE(budget_period, 'monthly'), sort_order
		FROM claim_category_templates
		WHERE country_code = $1
		ORDER BY sort_order
	`

	rows, err := r.db.Query(ctx, query, countryCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []ClaimCategoryTemplate
	for rows.Next() {
		var t ClaimCategoryTemplate
		if err := rows.Scan(&t.ID, &t.CountryCode, &t.Name, &t.Description, &t.MonthlyLimit, &t.CurrencyCode,
			&t.RequiresReceipt, &t.BudgetPeriod, &t.SortOrder); err != nil {
			return nil, err
		}
		templates = append(templates, t)
	}

	return templates, rows.Err()
}

// MarkSetupComplete marks the setup wizard as completed
func (r *Repository) MarkSetupComplete(ctx context.Context, tx pgx.Tx, orgID uuid.UUID) error {
	query := `
		UPDATE organisations
		SET setup_completed_at = NOW(), setup_skipped = FALSE, updated_at = NOW()
		WHERE id = $1
	`

	_, err := tx.Exec(ctx, query, orgID)
	return err
}

// MarkSetupSkipped marks the setup wizard as skipped
func (r *Repository) MarkSetupSkipped(ctx context.Context, orgID uuid.UUID) error {
	query := `
		UPDATE organisations
		SET setup_skipped = TRUE, updated_at = NOW()
		WHERE id = $1
	`

	_, err := r.db.Exec(ctx, query, orgID)
	return err
}

// CreateWorkScheduleFromTemplate creates a work schedule from template
func (r *Repository) CreateWorkScheduleFromTemplate(ctx context.Context, tx pgx.Tx, orgID, templateID uuid.UUID) (uuid.UUID, error) {
	query := `
		INSERT INTO work_schedules (organisation_id, name, work_days, start_time, end_time, is_active)
		SELECT $1, name, work_days, start_time, end_time, TRUE
		FROM work_schedule_templates
		WHERE id = $2
		RETURNING id
	`

	var scheduleID uuid.UUID
	err := tx.QueryRow(ctx, query, orgID, templateID).Scan(&scheduleID)
	return scheduleID, err
}

// CreateCustomWorkSchedule creates a custom work schedule
func (r *Repository) CreateCustomWorkSchedule(ctx context.Context, tx pgx.Tx, orgID uuid.UUID, input *CustomScheduleInput) (uuid.UUID, error) {
	query := `
		INSERT INTO work_schedules (organisation_id, name, work_days, start_time, end_time, is_active)
		VALUES ($1, $2, $3, $4::TIME, $5::TIME, TRUE)
		RETURNING id
	`

	var scheduleID uuid.UUID
	err := tx.QueryRow(ctx, query, orgID, input.Name, input.WorkDays, input.StartTime, input.EndTime).Scan(&scheduleID)
	return scheduleID, err
}

// CreateLeavePolicyFromTemplate creates a leave policy from template with optional customization
func (r *Repository) CreateLeavePolicyFromTemplate(ctx context.Context, tx pgx.Tx, orgID, templateID uuid.UUID, customization *LeavePolicyCustomization) (uuid.UUID, error) {
	// Create the policy and get the entitled days
	query := `
		WITH new_policy AS (
			INSERT INTO leave_policies (
				organisation_id, name, description, days_per_year,
				carry_over_days, requires_approval, gender_eligibility, is_active
			)
			SELECT
				$1,
				name,
				description,
				COALESCE($3, entitled_days_per_year),
				COALESCE(max_carry_over_days, 0),
				requires_approval,
				COALESCE(gender_eligibility, 'all'),
				TRUE
			FROM leave_policy_templates
			WHERE id = $2
			RETURNING id, days_per_year
		)
		SELECT id, days_per_year FROM new_policy
	`

	var daysPerYear *float64
	if customization != nil {
		daysPerYear = customization.DaysPerYear
	}

	var policyID uuid.UUID
	var entitledDays float64
	err := tx.QueryRow(ctx, query, orgID, templateID, daysPerYear).Scan(&policyID, &entitledDays)
	if err != nil {
		return uuid.Nil, err
	}

	// Create leave balances for all active employees for the current year
	currentYear := time.Now().Year()
	balanceQuery := `
		INSERT INTO leave_balances (organisation_id, employee_id, leave_policy_id, year, entitled_days)
		SELECT $1, id, $2, $3, $4
		FROM employees
		WHERE organisation_id = $1 AND is_active = true
		ON CONFLICT (employee_id, leave_policy_id, year) DO NOTHING
	`

	_, err = tx.Exec(ctx, balanceQuery, orgID, policyID, currentYear, entitledDays)
	if err != nil {
		return uuid.Nil, err
	}

	return policyID, nil
}

// CreateClaimCategoryFromTemplate creates a claim category from template with optional customization
func (r *Repository) CreateClaimCategoryFromTemplate(ctx context.Context, tx pgx.Tx, orgID, templateID uuid.UUID, customization *ClaimCategoryCustomization) (uuid.UUID, error) {
	query := `
		INSERT INTO claim_categories (
			organisation_id, name, monthly_limit, currency_code, requires_receipt, budget_period, is_active
		)
		SELECT
			$1,
			t.name,
			COALESCE($3, t.monthly_limit),
			COALESCE(t.currency_code, o.currency_code),
			t.requires_receipt,
			COALESCE(t.budget_period, 'monthly'),
			TRUE
		FROM claim_category_templates t
		CROSS JOIN organisations o
		WHERE t.id = $2 AND o.id = $1
		RETURNING id
	`

	var monthlyLimit *int64
	if customization != nil {
		monthlyLimit = customization.MonthlyLimit
	}

	var categoryID uuid.UUID
	err := tx.QueryRow(ctx, query, orgID, templateID, monthlyLimit).Scan(&categoryID)
	return categoryID, err
}

// CreateInvitation creates a team member invitation
func (r *Repository) CreateInvitation(ctx context.Context, tx pgx.Tx, orgID uuid.UUID, email, role string) (uuid.UUID, error) {
	query := `
		INSERT INTO invitations (organisation_id, email, role)
		VALUES ($1, $2, $3)
		RETURNING id
	`

	var invitationID uuid.UUID
	err := tx.QueryRow(ctx, query, orgID, email, role).Scan(&invitationID)
	return invitationID, err
}

// GetOrganisationCountryCode retrieves the country code for an organisation
func (r *Repository) GetOrganisationCountryCode(ctx context.Context, orgID uuid.UUID) (string, error) {
	query := `
		SELECT country_code
		FROM organisations
		WHERE id = $1
	`

	var countryCode string
	err := r.db.QueryRow(ctx, query, orgID).Scan(&countryCode)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", errors.New("organisation not found")
		}
		return "", err
	}

	return countryCode, nil
}

// BeginTx starts a new transaction
func (r *Repository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.db.Begin(ctx)
}

// AssignScheduleToUnassignedEmployeesTx sets scheduleID on every employee in the org
// whose work_schedule_id is NULL, within the provided transaction.
func (r *Repository) AssignScheduleToUnassignedEmployeesTx(ctx context.Context, tx pgx.Tx, orgID, scheduleID uuid.UUID) error {
	_, err := tx.Exec(ctx, `
		UPDATE employees
		SET    work_schedule_id = $2, updated_at = NOW()
		WHERE  organisation_id  = $1
		  AND  work_schedule_id IS NULL
		  AND  is_active        = TRUE
	`, orgID, scheduleID)
	return err
}

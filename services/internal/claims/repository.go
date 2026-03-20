package claims

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/paginate"
)

type Repository struct {
	db  *pgxpool.Pool
	log zerolog.Logger
}

func NewRepository(db *pgxpool.Pool, log zerolog.Logger) *Repository {
	return &Repository{db: db, log: log}
}

// ── Category Methods ──────────────────────────────────────────────────────────

func (r *Repository) ListCategories(ctx context.Context, orgID uuid.UUID) ([]Category, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, name, monthly_limit, currency_code,
		       requires_receipt, is_active, created_at, updated_at
		FROM claim_categories
		WHERE organisation_id = $1 AND is_active = TRUE
		ORDER BY name ASC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var categories []Category
	for rows.Next() {
		var c Category
		if err := rows.Scan(
			&c.ID, &c.OrganisationID, &c.Name, &c.MonthlyLimit, &c.CurrencyCode,
			&c.RequiresReceipt, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		categories = append(categories, c)
	}
	return categories, rows.Err()
}

func (r *Repository) GetCategory(ctx context.Context, orgID, id uuid.UUID) (*Category, error) {
	var c Category
	err := r.db.QueryRow(ctx, `
		SELECT id, organisation_id, name, monthly_limit, currency_code,
		       requires_receipt, is_active, created_at, updated_at
		FROM claim_categories
		WHERE organisation_id = $1 AND id = $2
	`, orgID, id).Scan(
		&c.ID, &c.OrganisationID, &c.Name, &c.MonthlyLimit, &c.CurrencyCode,
		&c.RequiresReceipt, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("claim category")
		}
		return nil, err
	}
	return &c, nil
}

func (r *Repository) CreateCategory(ctx context.Context, orgID uuid.UUID, req CreateCategoryRequest) (*Category, error) {
	// If currency_code not provided, use organization's currency
	currencyCode := req.CurrencyCode
	if currencyCode == nil || *currencyCode == "" {
		var orgCurrency string
		err := r.db.QueryRow(ctx, `SELECT currency_code FROM organisations WHERE id = $1`, orgID).Scan(&orgCurrency)
		if err != nil {
			return nil, err
		}
		currencyCode = &orgCurrency
	}

	var c Category

	err := r.db.QueryRow(ctx, `
		INSERT INTO claim_categories (
			organisation_id, name, monthly_limit, currency_code, requires_receipt
		) VALUES ($1, $2, $3, $4, $5)
		RETURNING id, organisation_id, name, monthly_limit, currency_code,
		          requires_receipt, is_active, created_at, updated_at
	`, orgID, req.Name, req.MonthlyLimit, *currencyCode, req.RequiresReceipt).Scan(
		&c.ID, &c.OrganisationID, &c.Name, &c.MonthlyLimit, &c.CurrencyCode,
		&c.RequiresReceipt, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *Repository) UpdateCategory(ctx context.Context, orgID, id uuid.UUID, req UpdateCategoryRequest) (*Category, error) {
	var c Category
	err := r.db.QueryRow(ctx, `
		UPDATE claim_categories SET
			name             = COALESCE($3, name),
			monthly_limit    = COALESCE($4, monthly_limit),
			currency_code    = COALESCE($5, currency_code),
			requires_receipt = COALESCE($6, requires_receipt)
		WHERE organisation_id = $1 AND id = $2
		RETURNING id, organisation_id, name, monthly_limit, currency_code,
		          requires_receipt, is_active, created_at, updated_at
	`, orgID, id, req.Name, req.MonthlyLimit, req.CurrencyCode, req.RequiresReceipt).Scan(
		&c.ID, &c.OrganisationID, &c.Name, &c.MonthlyLimit, &c.CurrencyCode,
		&c.RequiresReceipt, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("claim category")
		}
		return nil, err
	}
	return &c, nil
}

// DeactivateCategory soft-deletes a category (sets is_active = FALSE).
func (r *Repository) DeactivateCategory(ctx context.Context, orgID, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE claim_categories SET is_active = FALSE
		WHERE organisation_id = $1 AND id = $2 AND is_active = TRUE
	`, orgID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("claim category")
	}
	return nil
}

// CountPendingClaimsByCategory returns the count of pending claims for a category.
func (r *Repository) CountPendingClaimsByCategory(ctx context.Context, orgID, categoryID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM claims
		WHERE organisation_id = $1 AND category_id = $2 AND status = 'pending'
	`, orgID, categoryID).Scan(&count)
	return count, err
}

// ── Claim Methods ─────────────────────────────────────────────────────────────

func (r *Repository) CreateClaim(ctx context.Context, orgID uuid.UUID, req SubmitClaimRequest, employeeID uuid.UUID, receiptURL *string) (*Claim, error) {
	var c Claim
	err := r.db.QueryRow(ctx, `
		INSERT INTO claims (
			organisation_id, employee_id, category_id, amount, currency_code,
			description, receipt_url, claim_date, status
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, 'pending')
		RETURNING id, organisation_id, employee_id, category_id, amount, currency_code,
		          description, receipt_url, status, reviewed_by, reviewed_at, review_note,
		          claim_date, created_at, updated_at
	`, orgID, employeeID, req.CategoryID, req.Amount, req.CurrencyCode,
		req.Description, receiptURL, req.ClaimDate).Scan(
		&c.ID, &c.OrganisationID, &c.EmployeeID, &c.CategoryID, &c.Amount, &c.CurrencyCode,
		&c.Description, &c.ReceiptURL, &c.Status, &c.ReviewedBy, &c.ReviewedAt, &c.ReviewNote,
		&c.ClaimDate, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *Repository) GetClaim(ctx context.Context, orgID, id uuid.UUID) (*Claim, error) {
	var c Claim
	err := r.db.QueryRow(ctx, `
		SELECT id, organisation_id, employee_id, category_id, amount, currency_code,
		       description, receipt_url, status, reviewed_by, reviewed_at, review_note,
		       claim_date, created_at, updated_at
		FROM claims
		WHERE organisation_id = $1 AND id = $2
	`, orgID, id).Scan(
		&c.ID, &c.OrganisationID, &c.EmployeeID, &c.CategoryID, &c.Amount, &c.CurrencyCode,
		&c.Description, &c.ReceiptURL, &c.Status, &c.ReviewedBy, &c.ReviewedAt, &c.ReviewNote,
		&c.ClaimDate, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("claim")
		}
		return nil, err
	}
	return &c, nil
}

func (r *Repository) ListClaims(ctx context.Context, orgID uuid.UUID, f ClaimFilters) ([]ClaimWithDetails, error) {
	limit := paginate.ClampLimit(f.Limit)
	cursor := paginate.Decode(f.Cursor)

	query := `
		SELECT 
			c.id, c.organisation_id, c.employee_id, c.category_id, c.amount, c.currency_code,
			c.description, c.receipt_url, c.status, c.reviewed_by, c.reviewed_at, c.review_note,
			c.claim_date, c.created_at, c.updated_at,
			e.full_name AS employee_name,
			cat.name AS category_name
		FROM claims c
		JOIN employees e ON c.employee_id = e.id
		JOIN claim_categories cat ON c.category_id = cat.id
		WHERE c.organisation_id = $1
		  AND ($2::varchar IS NULL OR c.status = $2)
		  AND ($3::uuid IS NULL OR c.employee_id = $3::uuid)
		  AND ($4::uuid IS NULL OR c.category_id = $4::uuid)
		  AND ($5::date IS NULL OR c.claim_date >= $5::date)
		  AND ($6::date IS NULL OR c.claim_date <= $6::date)
		  AND ($7::timestamptz IS NULL OR c.created_at < $7::timestamptz)
		ORDER BY c.created_at DESC
		LIMIT $8
	`

	rows, err := r.db.Query(ctx, query,
		orgID,
		f.Status,
		ptrToUUID(f.EmployeeID),
		ptrToUUID(f.CategoryID),
		f.StartDate,
		f.EndDate,
		nilIfEmpty(cursor.Value),
		limit+1,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var claims []ClaimWithDetails
	for rows.Next() {
		var c ClaimWithDetails
		if err := rows.Scan(
			&c.ID, &c.OrganisationID, &c.EmployeeID, &c.CategoryID, &c.Amount, &c.CurrencyCode,
			&c.Description, &c.ReceiptURL, &c.Status, &c.ReviewedBy, &c.ReviewedAt, &c.ReviewNote,
			&c.ClaimDate, &c.CreatedAt, &c.UpdatedAt,
			&c.EmployeeName,
			&c.CategoryName,
		); err != nil {
			return nil, err
		}
		claims = append(claims, c)
	}
	return claims, rows.Err()
}

// UpdateStatus transitions a claim status atomically.
// Returns error if fromStatus doesn't match (optimistic concurrency control).
func (r *Repository) UpdateStatus(ctx context.Context, orgID, claimID uuid.UUID, fromStatus, toStatus string, reviewerEmployeeID *uuid.UUID, reviewNote *string) (*Claim, error) {
	var c Claim
	err := r.db.QueryRow(ctx, `
		UPDATE claims SET
			status      = $3,
			reviewed_by = $4,
			reviewed_at = CASE WHEN $3::varchar IN ('approved', 'rejected') THEN NOW() ELSE reviewed_at END,
			review_note = $5
		WHERE organisation_id = $1 AND id = $2 AND status = $6
		RETURNING id, organisation_id, employee_id, category_id, amount, currency_code,
		          description, receipt_url, status, reviewed_by, reviewed_at, review_note,
		          claim_date, created_at, updated_at
	`, orgID, claimID, toStatus, reviewerEmployeeID, reviewNote, fromStatus).Scan(
		&c.ID, &c.OrganisationID, &c.EmployeeID, &c.CategoryID, &c.Amount, &c.CurrencyCode,
		&c.Description, &c.ReceiptURL, &c.Status, &c.ReviewedBy, &c.ReviewedAt, &c.ReviewNote,
		&c.ClaimDate, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.New(apperr.CodeConflict, fmt.Sprintf("claim is not in %s status", fromStatus))
		}
		// Check if it's a foreign key violation
		if strings.Contains(err.Error(), "foreign key") || strings.Contains(err.Error(), "violates") {
			r.log.Warn().Interface("reviewer_employee_id", reviewerEmployeeID).Msg("foreign key violation for reviewer")
			return nil, apperr.New(apperr.CodeValidation, "reviewer employee not found or inactive")
		}
		return nil, err
	}
	return &c, nil
}

// GetMonthlySpent returns total amount claimed by an employee in a category for a specific month.
// Used for Pro tier monthly limit enforcement.
func (r *Repository) GetMonthlySpent(ctx context.Context, orgID, employeeID, categoryID uuid.UUID, claimDate string) (int64, error) {
	// Extract year-month from claim_date (YYYY-MM-DD)
	var total int64
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount), 0)
		FROM claims
		WHERE organisation_id = $1
		  AND employee_id = $2
		  AND category_id = $3
		  AND DATE_TRUNC('month', claim_date::date) = DATE_TRUNC('month', $4::date)
		  AND status IN ('pending', 'approved')
	`, orgID, employeeID, categoryID, claimDate).Scan(&total)
	return total, err
}

// GetMonthlySummary returns aggregated claim totals per employee for a given month.
func (r *Repository) GetMonthlySummary(ctx context.Context, orgID uuid.UUID, year, month int) ([]MonthlySummary, error) {
	rows, err := r.db.Query(ctx, `
		SELECT 
			c.employee_id,
			e.full_name,
			SUM(c.amount) AS total_amount,
			COUNT(*) AS claim_count,
			c.currency_code
		FROM claims c
		JOIN employees e ON c.employee_id = e.id
		WHERE c.organisation_id = $1
		  AND EXTRACT(YEAR FROM c.claim_date::date) = $2
		  AND EXTRACT(MONTH FROM c.claim_date::date) = $3
		  AND c.status = 'approved'
		GROUP BY c.employee_id, e.full_name, c.currency_code
		ORDER BY total_amount DESC
	`, orgID, year, month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var summaries []MonthlySummary
	for rows.Next() {
		var s MonthlySummary
		if err := rows.Scan(&s.EmployeeID, &s.EmployeeName, &s.TotalAmount, &s.ClaimCount, &s.CurrencyCode); err != nil {
			return nil, err
		}
		summaries = append(summaries, s)
	}
	return summaries, rows.Err()
}

// ListTemplates returns all category templates for a given country, ordered by sort_order.
func (r *Repository) ListTemplates(ctx context.Context, countryCode string) ([]CategoryTemplate, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, country_code, name, description, monthly_limit, currency_code, 
		       requires_receipt, sort_order, created_at
		FROM claim_category_templates
		WHERE country_code = $1
		ORDER BY sort_order
	`, countryCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var templates []CategoryTemplate
	for rows.Next() {
		var t CategoryTemplate
		if err := rows.Scan(
			&t.ID, &t.CountryCode, &t.Name, &t.Description, &t.MonthlyLimit,
			&t.CurrencyCode, &t.RequiresReceipt, &t.SortOrder, &t.CreatedAt,
		); err != nil {
			return nil, err
		}
		templates = append(templates, t)
	}
	return templates, rows.Err()
}

// ImportCategoriesFromTemplates creates categories from templates.
// Always creates new categories - duplicates are allowed for flexibility.
func (r *Repository) ImportCategoriesFromTemplates(ctx context.Context, orgID uuid.UUID, templates []CategoryTemplate) ([]Category, error) {
	// Get organisation's currency code as fallback
	var orgCurrencyCode string
	err := r.db.QueryRow(ctx, `SELECT currency_code FROM organisations WHERE id = $1`, orgID).Scan(&orgCurrencyCode)
	if err != nil {
		return nil, err
	}

	var categories []Category

	for _, tmpl := range templates {
		// Use template's currency_code if provided, otherwise use org's currency
		currencyCode := orgCurrencyCode
		if tmpl.CurrencyCode != nil && *tmpl.CurrencyCode != "" {
			currencyCode = *tmpl.CurrencyCode
		}

		var cat Category
		err := r.db.QueryRow(ctx, `
			INSERT INTO claim_categories (organisation_id, name, monthly_limit, currency_code, requires_receipt)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id, organisation_id, name, monthly_limit, currency_code, requires_receipt, 
			          is_active, created_at, updated_at
		`, orgID, tmpl.Name, tmpl.MonthlyLimit, currencyCode, tmpl.RequiresReceipt).Scan(
			&cat.ID, &cat.OrganisationID, &cat.Name, &cat.MonthlyLimit, &cat.CurrencyCode,
			&cat.RequiresReceipt, &cat.IsActive, &cat.CreatedAt, &cat.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		categories = append(categories, cat)
	}

	return categories, nil
}

// ── Balance Methods ───────────────────────────────────────────────────────────

// GetOrCreateBalance returns the balance for a specific employee/category/month.
// Creates a new balance if it doesn't exist, copying the limit from the category.
func (r *Repository) GetOrCreateBalance(ctx context.Context, orgID, employeeID, categoryID uuid.UUID, year, month int) (*ClaimBalance, error) {
	// First, try to get existing balance
	var balance ClaimBalance
	err := r.db.QueryRow(ctx, `
		SELECT id, organisation_id, employee_id, category_id, year, month,
		       total_spent, claim_count, currency_code, monthly_limit,
		       created_at, updated_at
		FROM claim_balances
		WHERE organisation_id = $1 AND employee_id = $2 AND category_id = $3
		  AND year = $4 AND month = $5
	`, orgID, employeeID, categoryID, year, month).Scan(
		&balance.ID, &balance.OrganisationID, &balance.EmployeeID, &balance.CategoryID,
		&balance.Year, &balance.Month, &balance.TotalSpent, &balance.ClaimCount,
		&balance.CurrencyCode, &balance.MonthlyLimit, &balance.CreatedAt, &balance.UpdatedAt,
	)

	if err == nil {
		return &balance, nil
	}
	if err != pgx.ErrNoRows {
		return nil, err
	}

	// Balance doesn't exist - create it with category's current limit
	var currencyCode string
	var monthlyLimit *int64
	err = r.db.QueryRow(ctx, `
		SELECT COALESCE(currency_code, 'IDR'), monthly_limit
		FROM claim_categories
		WHERE id = $1 AND organisation_id = $2
	`, categoryID, orgID).Scan(&currencyCode, &monthlyLimit)
	if err != nil {
		return nil, err
	}

	err = r.db.QueryRow(ctx, `
		INSERT INTO claim_balances (organisation_id, employee_id, category_id, year, month, currency_code, monthly_limit)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, organisation_id, employee_id, category_id, year, month,
		          total_spent, claim_count, currency_code, monthly_limit,
		          created_at, updated_at
	`, orgID, employeeID, categoryID, year, month, currencyCode, monthlyLimit).Scan(
		&balance.ID, &balance.OrganisationID, &balance.EmployeeID, &balance.CategoryID,
		&balance.Year, &balance.Month, &balance.TotalSpent, &balance.ClaimCount,
		&balance.CurrencyCode, &balance.MonthlyLimit, &balance.CreatedAt, &balance.UpdatedAt,
	)

	return &balance, err
}

// UpdateBalanceOnApproval increments the balance when a claim is approved.
func (r *Repository) UpdateBalanceOnApproval(ctx context.Context, orgID, employeeID, categoryID uuid.UUID, year, month int, amount int64) error {
	_, err := r.db.Exec(ctx, `
		UPDATE claim_balances
		SET total_spent = total_spent + $1,
		    claim_count = claim_count + 1,
		    updated_at = NOW()
		WHERE organisation_id = $2 AND employee_id = $3 AND category_id = $4
		  AND year = $5 AND month = $6
	`, amount, orgID, employeeID, categoryID, year, month)
	return err
}

// UpdateBalanceOnRejection decrements the balance when a claim is rejected/cancelled.
func (r *Repository) UpdateBalanceOnRejection(ctx context.Context, orgID, employeeID, categoryID uuid.UUID, year, month int, amount int64) error {
	_, err := r.db.Exec(ctx, `
		UPDATE claim_balances
		SET total_spent = GREATEST(0, total_spent - $1),
		    claim_count = GREATEST(0, claim_count - 1),
		    updated_at = NOW()
		WHERE organisation_id = $2 AND employee_id = $3 AND category_id = $4
		  AND year = $5 AND month = $6
	`, amount, orgID, employeeID, categoryID, year, month)
	return err
}

// ListBalancesByEmployee returns all balances for an employee in a specific month.
// Only returns balances for active categories.
func (r *Repository) ListBalancesByEmployee(ctx context.Context, orgID, employeeID uuid.UUID, year, month int) ([]ClaimBalanceWithCategory, error) {
	rows, err := r.db.Query(ctx, `
		SELECT b.id, b.organisation_id, b.employee_id, b.category_id, b.year, b.month,
		       b.total_spent, b.claim_count, b.currency_code, b.monthly_limit,
		       b.created_at, b.updated_at, c.name
		FROM claim_balances b
		JOIN claim_categories c ON b.category_id = c.id
		WHERE b.organisation_id = $1 AND b.employee_id = $2 
		  AND b.year = $3 AND b.month = $4
		  AND c.is_active = true
		ORDER BY c.name
	`, orgID, employeeID, year, month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var balances []ClaimBalanceWithCategory
	for rows.Next() {
		var b ClaimBalanceWithCategory
		if err := rows.Scan(
			&b.ID, &b.OrganisationID, &b.EmployeeID, &b.CategoryID, &b.Year, &b.Month,
			&b.TotalSpent, &b.ClaimCount, &b.CurrencyCode, &b.MonthlyLimit,
			&b.CreatedAt, &b.UpdatedAt, &b.CategoryName,
		); err != nil {
			return nil, err
		}

		// Calculate remaining if limit exists
		if b.MonthlyLimit != nil {
			remaining := *b.MonthlyLimit - b.TotalSpent
			b.Remaining = &remaining
		}

		balances = append(balances, b)
	}
	return balances, rows.Err()
}

// CreateBalancesForAllEmployees creates claim balances for all active employees in the organization
// for the current month. Called when a new category is created or imported.
func (r *Repository) CreateBalancesForAllEmployees(ctx context.Context, orgID, categoryID uuid.UUID, year, month int) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO claim_balances (organisation_id, employee_id, category_id, year, month, currency_code, monthly_limit)
		SELECT $1, e.id, $2, $3, $4, c.currency_code, c.monthly_limit
		FROM employees e
		CROSS JOIN claim_categories c
		WHERE e.organisation_id = $1 AND e.is_active = true
		  AND c.id = $2 AND c.is_active = true
		ON CONFLICT (organisation_id, employee_id, category_id, year, month) DO NOTHING
	`, orgID, categoryID, year, month)
	if err != nil {
		return fmt.Errorf("create balances for all employees: %w", err)
	}
	return nil
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func ptrToUUID(s *string) *uuid.UUID {
	if s == nil || *s == "" {
		return nil
	}
	id, err := uuid.Parse(*s)
	if err != nil {
		return nil
	}
	return &id
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

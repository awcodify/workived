package leave

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/workived/services/pkg/apperr"
)

// Repository handles all leave-related database operations.
type Repository struct {
	db *pgxpool.Pool
}

// NewRepository creates a new leave repository.
func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// ── Policies ────────────────────────────────────────────────────────────────

// ListPolicies returns all active leave policies for an organisation.
func (r *Repository) ListPolicies(ctx context.Context, orgID uuid.UUID) ([]Policy, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, name, description, days_per_year, carry_over_days,
		       min_tenure_days, requires_approval, is_active, created_at, updated_at
		FROM leave_policies
		WHERE organisation_id = $1
		  AND is_active = TRUE
		ORDER BY name ASC
	`, orgID)
	if err != nil {
		return nil, fmt.Errorf("list leave policies: %w", err)
	}
	defer rows.Close()

	var policies []Policy
	for rows.Next() {
		var p Policy
		if err := rows.Scan(
			&p.ID, &p.OrganisationID, &p.Name, &p.Description, &p.DaysPerYear, &p.CarryOverDays,
			&p.MinTenureDays, &p.RequiresApproval, &p.IsActive, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan leave policy: %w", err)
		}
		policies = append(policies, p)
	}
	return policies, nil
}

// GetPolicy returns a single leave policy by ID.
func (r *Repository) GetPolicy(ctx context.Context, orgID, policyID uuid.UUID) (*Policy, error) {
	var p Policy
	err := r.db.QueryRow(ctx, `
		SELECT id, organisation_id, name, description, days_per_year, carry_over_days,
		       min_tenure_days, requires_approval, is_active, created_at, updated_at
		FROM leave_policies
		WHERE organisation_id = $1 AND id = $2
	`, orgID, policyID).Scan(
		&p.ID, &p.OrganisationID, &p.Name, &p.Description, &p.DaysPerYear, &p.CarryOverDays,
		&p.MinTenureDays, &p.RequiresApproval, &p.IsActive, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("leave policy")
		}
		return nil, fmt.Errorf("get leave policy: %w", err)
	}
	return &p, nil
}

// CreatePolicy inserts a new leave policy.
func (r *Repository) CreatePolicy(ctx context.Context, orgID uuid.UUID, req CreatePolicyRequest) (*Policy, error) {
	reqApproval := true
	if req.RequiresApproval != nil {
		reqApproval = *req.RequiresApproval
	}

	var p Policy
	err := r.db.QueryRow(ctx, `
		INSERT INTO leave_policies (organisation_id, name, description, days_per_year, carry_over_days, min_tenure_days, requires_approval)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, organisation_id, name, description, days_per_year, carry_over_days,
		          min_tenure_days, requires_approval, is_active, created_at, updated_at
	`, orgID, req.Name, req.Description, req.DaysPerYear, req.CarryOverDays, req.MinTenureDays, reqApproval).Scan(
		&p.ID, &p.OrganisationID, &p.Name, &p.Description, &p.DaysPerYear, &p.CarryOverDays,
		&p.MinTenureDays, &p.RequiresApproval, &p.IsActive, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create leave policy: %w", err)
	}
	return &p, nil
}

// UpdatePolicy applies a partial update to a leave policy.
func (r *Repository) UpdatePolicy(ctx context.Context, orgID, policyID uuid.UUID, req UpdatePolicyRequest) (*Policy, error) {
	var p Policy
	err := r.db.QueryRow(ctx, `
		UPDATE leave_policies SET
			name              = COALESCE($3, name),
			description       = COALESCE($4, description),
			days_per_year     = COALESCE($5, days_per_year),
			carry_over_days   = COALESCE($6, carry_over_days),
			min_tenure_days   = COALESCE($7, min_tenure_days),
			requires_approval = COALESCE($8, requires_approval)
		WHERE organisation_id = $1 AND id = $2
		RETURNING id, organisation_id, name, description, days_per_year, carry_over_days,
		          min_tenure_days, requires_approval, is_active, created_at, updated_at
	`, orgID, policyID, req.Name, req.Description, req.DaysPerYear, req.CarryOverDays, req.MinTenureDays, req.RequiresApproval).Scan(
		&p.ID, &p.OrganisationID, &p.Name, &p.Description, &p.DaysPerYear, &p.CarryOverDays,
		&p.MinTenureDays, &p.RequiresApproval, &p.IsActive, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("leave policy")
		}
		return nil, fmt.Errorf("update leave policy: %w", err)
	}
	return &p, nil
}

// DeactivatePolicy soft-deletes a leave policy.
func (r *Repository) DeactivatePolicy(ctx context.Context, orgID, policyID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE leave_policies SET is_active = FALSE
		WHERE organisation_id = $1 AND id = $2 AND is_active = TRUE
	`, orgID, policyID)
	if err != nil {
		return fmt.Errorf("deactivate leave policy: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.NotFound("leave policy")
	}
	return nil
}

// ── Balances ────────────────────────────────────────────────────────────────

// GetBalance returns a single balance row, locking it for update within a transaction.
func (r *Repository) GetBalance(ctx context.Context, orgID, employeeID, policyID uuid.UUID, year int) (*Balance, error) {
	var b Balance
	err := r.db.QueryRow(ctx, `
		SELECT id, organisation_id, employee_id, leave_policy_id, year,
		       entitled_days, carried_over_days, used_days, pending_days,
		       created_at, updated_at
		FROM leave_balances
		WHERE organisation_id = $1
		  AND employee_id = $2
		  AND leave_policy_id = $3
		  AND year = $4
	`, orgID, employeeID, policyID, year).Scan(
		&b.ID, &b.OrganisationID, &b.EmployeeID, &b.LeavePolicyID, &b.Year,
		&b.EntitledDays, &b.CarriedOverDays, &b.UsedDays, &b.PendingDays,
		&b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("leave balance")
		}
		return nil, fmt.Errorf("get leave balance: %w", err)
	}
	return &b, nil
}

// GetBalanceForUpdate is like GetBalance but acquires a row-level lock (FOR UPDATE).
// Must be called within a transaction.
func (r *Repository) GetBalanceForUpdate(ctx context.Context, tx pgx.Tx, orgID, employeeID, policyID uuid.UUID, year int) (*Balance, error) {
	var b Balance
	err := tx.QueryRow(ctx, `
		SELECT id, organisation_id, employee_id, leave_policy_id, year,
		       entitled_days, carried_over_days, used_days, pending_days,
		       created_at, updated_at
		FROM leave_balances
		WHERE organisation_id = $1
		  AND employee_id = $2
		  AND leave_policy_id = $3
		  AND year = $4
		FOR UPDATE
	`, orgID, employeeID, policyID, year).Scan(
		&b.ID, &b.OrganisationID, &b.EmployeeID, &b.LeavePolicyID, &b.Year,
		&b.EntitledDays, &b.CarriedOverDays, &b.UsedDays, &b.PendingDays,
		&b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("leave balance")
		}
		return nil, fmt.Errorf("get leave balance for update: %w", err)
	}
	return &b, nil
}

// ListBalances returns all balances for an org in a given year, joined with policy names.
func (r *Repository) ListBalances(ctx context.Context, orgID uuid.UUID, year int) ([]BalanceWithPolicy, error) {
	rows, err := r.db.Query(ctx, `
		SELECT b.id, b.organisation_id, b.employee_id, b.leave_policy_id, b.year,
		       b.entitled_days, b.carried_over_days, b.used_days, b.pending_days,
		       b.created_at, b.updated_at,
		       lp.name, lp.description
		FROM leave_balances b
		JOIN leave_policies lp ON lp.id = b.leave_policy_id
		WHERE b.organisation_id = $1 AND b.year = $2
		ORDER BY b.employee_id, lp.name
	`, orgID, year)
	if err != nil {
		return nil, fmt.Errorf("list leave balances: %w", err)
	}
	defer rows.Close()

	var balances []BalanceWithPolicy
	for rows.Next() {
		var bwp BalanceWithPolicy
		if err := rows.Scan(
			&bwp.ID, &bwp.OrganisationID, &bwp.EmployeeID, &bwp.LeavePolicyID, &bwp.Year,
			&bwp.EntitledDays, &bwp.CarriedOverDays, &bwp.UsedDays, &bwp.PendingDays,
			&bwp.CreatedAt, &bwp.UpdatedAt,
			&bwp.PolicyName, &bwp.PolicyDescription,
		); err != nil {
			return nil, fmt.Errorf("scan leave balance: %w", err)
		}
		balances = append(balances, bwp)
	}
	return balances, nil
}

// ListEmployeeBalances returns all balances for a specific employee in a given year.
func (r *Repository) ListEmployeeBalances(ctx context.Context, orgID, employeeID uuid.UUID, year int) ([]BalanceWithPolicy, error) {
	rows, err := r.db.Query(ctx, `
		SELECT b.id, b.organisation_id, b.employee_id, b.leave_policy_id, b.year,
		       b.entitled_days, b.carried_over_days, b.used_days, b.pending_days,
		       b.created_at, b.updated_at,
		       lp.name, lp.description
		FROM leave_balances b
		JOIN leave_policies lp ON lp.id = b.leave_policy_id
		WHERE b.organisation_id = $1 AND b.employee_id = $2 AND b.year = $3
		ORDER BY lp.name
	`, orgID, employeeID, year)
	if err != nil {
		return nil, fmt.Errorf("list employee leave balances: %w", err)
	}
	defer rows.Close()

	var balances []BalanceWithPolicy
	for rows.Next() {
		var bwp BalanceWithPolicy
		if err := rows.Scan(
			&bwp.ID, &bwp.OrganisationID, &bwp.EmployeeID, &bwp.LeavePolicyID, &bwp.Year,
			&bwp.EntitledDays, &bwp.CarriedOverDays, &bwp.UsedDays, &bwp.PendingDays,
			&bwp.CreatedAt, &bwp.UpdatedAt,
			&bwp.PolicyName, &bwp.PolicyDescription,
		); err != nil {
			return nil, fmt.Errorf("scan employee leave balance: %w", err)
		}
		balances = append(balances, bwp)
	}
	return balances, nil
}

// EnsureBalance creates a leave balance if it doesn't exist for the given employee/policy/year.
func (r *Repository) EnsureBalance(ctx context.Context, orgID, employeeID, policyID uuid.UUID, year int, entitledDays float64) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO leave_balances (organisation_id, employee_id, leave_policy_id, year, entitled_days)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (employee_id, leave_policy_id, year) DO NOTHING
	`, orgID, employeeID, policyID, year, entitledDays)
	if err != nil {
		return fmt.Errorf("ensure leave balance: %w", err)
	}
	return nil
}

// CreateBalancesForAllEmployees creates balances for all active employees in the organization.
// Must be called within a transaction.
func (r *Repository) CreateBalancesForAllEmployees(ctx context.Context, tx pgx.Tx, orgID, policyID uuid.UUID, year int, entitledDays float64) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO leave_balances (organisation_id, employee_id, leave_policy_id, year, entitled_days)
		SELECT $1, id, $2, $3, $4
		FROM employees
		WHERE organisation_id = $1 AND is_active = true
		ON CONFLICT (employee_id, leave_policy_id, year) DO NOTHING
	`, orgID, policyID, year, entitledDays)
	if err != nil {
		return fmt.Errorf("create balances for all employees: %w", err)
	}
	return nil
}

// UpdateBalancePending adds deltaDays to pending_days. Must be called in a transaction after GetBalanceForUpdate.
func (r *Repository) UpdateBalancePending(ctx context.Context, tx pgx.Tx, balanceID uuid.UUID, deltaDays float64) error {
	_, err := tx.Exec(ctx, `
		UPDATE leave_balances SET pending_days = pending_days + $2
		WHERE id = $1
	`, balanceID, deltaDays)
	if err != nil {
		return fmt.Errorf("update balance pending: %w", err)
	}
	return nil
}

// ApproveBalanceUpdate moves days from pending to used. Must be called in a transaction.
func (r *Repository) ApproveBalanceUpdate(ctx context.Context, tx pgx.Tx, balanceID uuid.UUID, totalDays float64) error {
	_, err := tx.Exec(ctx, `
		UPDATE leave_balances SET
			used_days    = used_days + $2,
			pending_days = pending_days - $2
		WHERE id = $1
	`, balanceID, totalDays)
	if err != nil {
		return fmt.Errorf("approve balance update: %w", err)
	}
	return nil
}

// ── Requests ────────────────────────────────────────────────────────────────

// CreateRequest inserts a new leave request. Must be called in a transaction.
func (r *Repository) CreateRequest(ctx context.Context, tx pgx.Tx, orgID, employeeID, policyID uuid.UUID, startDate, endDate string, totalDays float64, reason *string) (*Request, error) {
	var req Request
	err := tx.QueryRow(ctx, `
		INSERT INTO leave_requests (organisation_id, employee_id, leave_policy_id, start_date, end_date, total_days, reason)
		VALUES ($1, $2, $3, $4::date, $5::date, $6, $7)
		RETURNING id, organisation_id, employee_id, leave_policy_id,
		          start_date::text, end_date::text, total_days, reason,
		          status, reviewed_by, reviewed_at, review_note,
		          created_at, updated_at
	`, orgID, employeeID, policyID, startDate, endDate, totalDays, reason).Scan(
		&req.ID, &req.OrganisationID, &req.EmployeeID, &req.LeavePolicyID,
		&req.StartDate, &req.EndDate, &req.TotalDays, &req.Reason,
		&req.Status, &req.ReviewedBy, &req.ReviewedAt, &req.ReviewNote,
		&req.CreatedAt, &req.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create leave request: %w", err)
	}
	return &req, nil
}

// GetRequest returns a leave request by ID.
func (r *Repository) GetRequest(ctx context.Context, orgID, requestID uuid.UUID) (*Request, error) {
	var req Request
	err := r.db.QueryRow(ctx, `
		SELECT id, organisation_id, employee_id, leave_policy_id,
		       start_date::text, end_date::text, total_days, reason,
		       status, reviewed_by, reviewed_at, review_note,
		       created_at, updated_at
		FROM leave_requests
		WHERE organisation_id = $1 AND id = $2
	`, orgID, requestID).Scan(
		&req.ID, &req.OrganisationID, &req.EmployeeID, &req.LeavePolicyID,
		&req.StartDate, &req.EndDate, &req.TotalDays, &req.Reason,
		&req.Status, &req.ReviewedBy, &req.ReviewedAt, &req.ReviewNote,
		&req.CreatedAt, &req.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("leave request")
		}
		return nil, fmt.Errorf("get leave request: %w", err)
	}
	return &req, nil
}

// UpdateRequestStatus atomically updates a request's status. Returns apperr.NotFound
// if no row matched (request doesn't exist or is not in expectedCurrentStatus).
func (r *Repository) UpdateRequestStatus(ctx context.Context, tx pgx.Tx, orgID, requestID uuid.UUID, expectedCurrentStatus, newStatus string, reviewedBy *uuid.UUID, reviewNote *string) (*Request, error) {
	var req Request
	err := tx.QueryRow(ctx, `
		UPDATE leave_requests SET
			status      = $3,
			reviewed_by = $4::uuid,
			reviewed_at = CASE WHEN $4::uuid IS NOT NULL THEN NOW() ELSE reviewed_at END,
			review_note = COALESCE($5, review_note)
		WHERE organisation_id = $1
		  AND id = $2
		  AND status = $6
		RETURNING id, organisation_id, employee_id, leave_policy_id,
		          start_date::text, end_date::text, total_days, reason,
		          status, reviewed_by, reviewed_at, review_note,
		          created_at, updated_at
	`, orgID, requestID, newStatus, reviewedBy, reviewNote, expectedCurrentStatus).Scan(
		&req.ID, &req.OrganisationID, &req.EmployeeID, &req.LeavePolicyID,
		&req.StartDate, &req.EndDate, &req.TotalDays, &req.Reason,
		&req.Status, &req.ReviewedBy, &req.ReviewedAt, &req.ReviewNote,
		&req.CreatedAt, &req.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.NotFound("leave request")
		}
		return nil, fmt.Errorf("update leave request status: %w", err)
	}
	return &req, nil
}

// ListRequests returns leave requests with employee and policy names.
func (r *Repository) ListRequests(ctx context.Context, orgID uuid.UUID, filter ListRequestsFilter) ([]RequestWithDetails, error) {
	rows, err := r.db.Query(ctx, `
		SELECT lr.id, lr.organisation_id, lr.employee_id, lr.leave_policy_id,
		       lr.start_date::text, lr.end_date::text, lr.total_days, lr.reason,
		       lr.status, lr.reviewed_by, lr.reviewed_at, lr.review_note,
		       lr.created_at, lr.updated_at,
		       e.full_name, lp.name
		FROM leave_requests lr
		JOIN employees e ON e.id = lr.employee_id
		JOIN leave_policies lp ON lp.id = lr.leave_policy_id
		WHERE lr.organisation_id = $1
		  AND ($2::varchar IS NULL OR lr.status = $2)
		  AND ($3::uuid IS NULL OR lr.employee_id = $3)
		  AND ($4::int IS NULL OR EXTRACT(YEAR FROM lr.start_date) = $4)
		ORDER BY lr.created_at DESC
	`, orgID, filter.Status, filter.EmployeeID, filter.Year)
	if err != nil {
		return nil, fmt.Errorf("list leave requests: %w", err)
	}
	defer rows.Close()

	var results []RequestWithDetails
	for rows.Next() {
		var rd RequestWithDetails
		if err := rows.Scan(
			&rd.ID, &rd.OrganisationID, &rd.EmployeeID, &rd.LeavePolicyID,
			&rd.StartDate, &rd.EndDate, &rd.TotalDays, &rd.Reason,
			&rd.Status, &rd.ReviewedBy, &rd.ReviewedAt, &rd.ReviewNote,
			&rd.CreatedAt, &rd.UpdatedAt,
			&rd.EmployeeName, &rd.PolicyName,
		); err != nil {
			return nil, fmt.Errorf("scan leave request: %w", err)
		}
		results = append(results, rd)
	}
	return results, nil
}

// HasOverlap checks if an employee has any pending or approved leave that overlaps [startDate, endDate].
func (r *Repository) HasOverlap(ctx context.Context, orgID, employeeID uuid.UUID, startDate, endDate string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM leave_requests
			WHERE organisation_id = $1
			  AND employee_id = $2
			  AND status IN ('pending', 'approved')
			  AND start_date <= $4::date
			  AND end_date >= $3::date
		)
	`, orgID, employeeID, startDate, endDate).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check leave overlap: %w", err)
	}
	return exists, nil
}

// CountPendingRequests returns the number of pending leave requests for the organization.
func (r *Repository) CountPendingRequests(ctx context.Context, orgID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM leave_requests
		WHERE organisation_id = $1
		  AND status = 'pending'
	`, orgID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count pending leave requests: %w", err)
	}
	return count, nil
}

// ── Calendar ────────────────────────────────────────────────────────────────

// ListCalendar returns approved leave entries that overlap a given month.
func (r *Repository) ListCalendar(ctx context.Context, orgID uuid.UUID, year, month int) ([]CalendarEntry, error) {
	monthStart := fmt.Sprintf("%04d-%02d-01", year, month)
	// Last day of month: go to first of next month, subtract 1 day
	var monthEnd string
	if month == 12 {
		monthEnd = fmt.Sprintf("%04d-01-01", year+1)
	} else {
		monthEnd = fmt.Sprintf("%04d-%02d-01", year, month+1)
	}

	rows, err := r.db.Query(ctx, `
		SELECT lr.employee_id, e.full_name, lp.name,
		       lr.start_date::text, lr.end_date::text, lr.total_days
		FROM leave_requests lr
		JOIN employees e ON e.id = lr.employee_id
		JOIN leave_policies lp ON lp.id = lr.leave_policy_id
		WHERE lr.organisation_id = $1
		  AND lr.status = 'approved'
		  AND lr.start_date < $3::date
		  AND lr.end_date >= $2::date
		ORDER BY lr.start_date ASC, e.full_name ASC
	`, orgID, monthStart, monthEnd)
	if err != nil {
		return nil, fmt.Errorf("list leave calendar: %w", err)
	}
	defer rows.Close()

	var entries []CalendarEntry
	for rows.Next() {
		var ce CalendarEntry
		if err := rows.Scan(
			&ce.EmployeeID, &ce.EmployeeName, &ce.PolicyName,
			&ce.StartDate, &ce.EndDate, &ce.TotalDays,
		); err != nil {
			return nil, fmt.Errorf("scan calendar entry: %w", err)
		}
		entries = append(entries, ce)
	}
	return entries, nil
}

// ── Leave checker (for attendance integration) ──────────────────────────────

// IsOnApprovedLeave checks whether an employee has approved leave covering a specific date.
func (r *Repository) IsOnApprovedLeave(ctx context.Context, orgID, employeeID uuid.UUID, date string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM leave_requests
			WHERE organisation_id = $1
			  AND employee_id = $2
			  AND status = 'approved'
			  AND start_date <= $3::date
			  AND end_date >= $3::date
		)
	`, orgID, employeeID, date).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check approved leave: %w", err)
	}
	return exists, nil
}

// ── Holidays (delegated — reuses public_holidays table) ─────────────────────

// ListHolidays returns public holidays in a date range for a country.
func (r *Repository) ListHolidays(ctx context.Context, countryCode, startDate, endDate string) ([]PublicHoliday, error) {
	rows, err := r.db.Query(ctx, `
		SELECT country_code, date::text, name
		FROM public_holidays
		WHERE country_code = $1
		  AND date >= $2::date
		  AND date <= $3::date
		ORDER BY date ASC
	`, countryCode, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("list holidays: %w", err)
	}
	defer rows.Close()

	var holidays []PublicHoliday
	for rows.Next() {
		var h PublicHoliday
		if err := rows.Scan(&h.CountryCode, &h.Date, &h.Name); err != nil {
			return nil, fmt.Errorf("scan holiday: %w", err)
		}
		holidays = append(holidays, h)
	}
	return holidays, nil
}

// ── Policy Templates ──────────────────────────────────────────────────────────

// ListTemplates returns all policy templates for a given country, ordered by sort_order.
func (r *Repository) ListTemplates(ctx context.Context, countryCode string) ([]PolicyTemplate, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, country_code, name, description,
		       entitled_days_per_year, is_carry_over_allowed, max_carry_over_days,
		       is_accrued, requires_approval, sort_order, created_at
		FROM leave_policy_templates
		WHERE country_code = $1
		ORDER BY sort_order ASC
	`, countryCode)
	if err != nil {
		return nil, fmt.Errorf("list templates: %w", err)
	}
	defer rows.Close()

	var templates []PolicyTemplate
	for rows.Next() {
		var t PolicyTemplate
		if err := rows.Scan(
			&t.ID, &t.CountryCode, &t.Name, &t.Description,
			&t.EntitledDaysPerYear, &t.IsCarryOverAllowed, &t.MaxCarryOverDays,
			&t.IsAccrued, &t.RequiresApproval, &t.SortOrder, &t.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan template: %w", err)
		}
		templates = append(templates, t)
	}
	return templates, nil
}

// GetTemplatesByIDs fetches templates by their IDs. Returns error if any ID not found.
func (r *Repository) GetTemplatesByIDs(ctx context.Context, ids []uuid.UUID) ([]PolicyTemplate, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, country_code, name, description,
		       entitled_days_per_year, is_carry_over_allowed, max_carry_over_days,
		       is_accrued, requires_approval, sort_order, created_at
		FROM leave_policy_templates
		WHERE id = ANY($1)
		ORDER BY sort_order ASC
	`, ids)
	if err != nil {
		return nil, fmt.Errorf("get templates by ids: %w", err)
	}
	defer rows.Close()

	var templates []PolicyTemplate
	for rows.Next() {
		var t PolicyTemplate
		if err := rows.Scan(
			&t.ID, &t.CountryCode, &t.Name, &t.Description,
			&t.EntitledDaysPerYear, &t.IsCarryOverAllowed, &t.MaxCarryOverDays,
			&t.IsAccrued, &t.RequiresApproval, &t.SortOrder, &t.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan template: %w", err)
		}
		templates = append(templates, t)
	}

	if len(templates) != len(ids) {
		return nil, fmt.Errorf("expected %d templates, got %d", len(ids), len(templates))
	}
	return templates, nil
}

// ImportPoliciesFromTemplates creates policies from templates in a transaction.
// Skips templates whose policy name already exists for this org (idempotent).
// Returns the created policies.
func (r *Repository) ImportPoliciesFromTemplates(ctx context.Context, tx pgx.Tx, orgID uuid.UUID, templates []PolicyTemplate) ([]Policy, error) {
	// First, get existing policy names for this org to skip duplicates
	existingNames, err := r.getExistingPolicyNames(ctx, tx, orgID)
	if err != nil {
		return nil, fmt.Errorf("get existing policy names: %w", err)
	}

	var policies []Policy
	for _, tmpl := range templates {
		// Skip if policy with this name already exists
		if existingNames[tmpl.Name] {
			continue
		}

		// Map template fields to policy fields
		carryOverDays := 0.0
		if tmpl.MaxCarryOverDays != nil {
			carryOverDays = *tmpl.MaxCarryOverDays
		}

		var policy Policy
		err := tx.QueryRow(ctx, `
			INSERT INTO leave_policies (
				organisation_id, name, description, days_per_year, carry_over_days,
				min_tenure_days, requires_approval, is_active
			)
			VALUES ($1, $2, $3, $4, $5, 0, $6, TRUE)
			RETURNING id, organisation_id, name, description, days_per_year, carry_over_days,
			          min_tenure_days, requires_approval, is_active, created_at, updated_at
		`, orgID, tmpl.Name, tmpl.Description, tmpl.EntitledDaysPerYear, carryOverDays, tmpl.RequiresApproval).Scan(
			&policy.ID, &policy.OrganisationID, &policy.Name, &policy.Description, &policy.DaysPerYear,
			&policy.CarryOverDays, &policy.MinTenureDays, &policy.RequiresApproval,
			&policy.IsActive, &policy.CreatedAt, &policy.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("create policy from template %s: %w", tmpl.Name, err)
		}
		policies = append(policies, policy)
	}

	return policies, nil
}

// getExistingPolicyNames returns a set of policy names that already exist for this org.
func (r *Repository) getExistingPolicyNames(ctx context.Context, tx pgx.Tx, orgID uuid.UUID) (map[string]bool, error) {
	rows, err := tx.Query(ctx, `
		SELECT name FROM leave_policies
		WHERE organisation_id = $1 AND is_active = TRUE
	`, orgID)
	if err != nil {
		return nil, fmt.Errorf("query existing policy names: %w", err)
	}
	defer rows.Close()

	names := make(map[string]bool)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("scan policy name: %w", err)
		}
		names[name] = true
	}
	return names, nil
}

// ── Year-end Rollover ─────────────────────────────────────────────────────────

// CreateBalanceWithCarryOver creates a new balance for the given year with entitled and carried-over days.
// If a balance already exists for this employee/policy/year, it does nothing (idempotent).
func (r *Repository) CreateBalanceWithCarryOver(ctx context.Context, orgID, employeeID, policyID uuid.UUID, year int, entitledDays, carriedOverDays float64) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO leave_balances (
			organisation_id, employee_id, leave_policy_id, year,
			entitled_days, carried_over_days, used_days, pending_days
		) VALUES ($1, $2, $3, $4, $5, $6, 0, 0)
		ON CONFLICT (employee_id, leave_policy_id, year) DO NOTHING
	`, orgID, employeeID, policyID, year, entitledDays, carriedOverDays)
	return err
}

// BeginTx starts a new database transaction.
func (r *Repository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.db.Begin(ctx)
}

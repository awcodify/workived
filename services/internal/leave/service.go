package leave

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/workived/services/internal/audit"
	"github.com/workived/services/pkg/apperr"
)

// ── Interfaces ──────────────────────────────────────────────────────────────

type RepositoryInterface interface {
	// Policies
	ListPolicies(ctx context.Context, orgID uuid.UUID) ([]Policy, error)
	GetPolicy(ctx context.Context, orgID, policyID uuid.UUID) (*Policy, error)
	CreatePolicy(ctx context.Context, orgID uuid.UUID, req CreatePolicyRequest) (*Policy, error)
	UpdatePolicy(ctx context.Context, orgID, policyID uuid.UUID, req UpdatePolicyRequest) (*Policy, error)
	DeactivatePolicy(ctx context.Context, orgID, policyID uuid.UUID) error

	// Balances
	GetBalance(ctx context.Context, orgID, employeeID, policyID uuid.UUID, year int) (*Balance, error)
	GetBalanceForUpdate(ctx context.Context, tx pgx.Tx, orgID, employeeID, policyID uuid.UUID, year int) (*Balance, error)
	ListBalances(ctx context.Context, orgID uuid.UUID, year int) ([]BalanceWithPolicy, error)
	ListEmployeeBalances(ctx context.Context, orgID, employeeID uuid.UUID, year int) ([]BalanceWithPolicy, error)
	EnsureBalance(ctx context.Context, orgID, employeeID, policyID uuid.UUID, year int, entitledDays float64) error
	UpdateBalancePending(ctx context.Context, tx pgx.Tx, balanceID uuid.UUID, deltaDays float64) error
	ApproveBalanceUpdate(ctx context.Context, tx pgx.Tx, balanceID uuid.UUID, totalDays float64) error

	// Requests
	CreateRequest(ctx context.Context, tx pgx.Tx, orgID, employeeID, policyID uuid.UUID, startDate, endDate string, totalDays float64, reason *string) (*Request, error)
	GetRequest(ctx context.Context, orgID, requestID uuid.UUID) (*Request, error)
	UpdateRequestStatus(ctx context.Context, tx pgx.Tx, orgID, requestID uuid.UUID, expectedCurrentStatus, newStatus string, reviewedBy *uuid.UUID, reviewNote *string) (*Request, error)
	ListRequests(ctx context.Context, orgID uuid.UUID, filter ListRequestsFilter) ([]RequestWithDetails, error)
	HasOverlap(ctx context.Context, orgID, employeeID uuid.UUID, startDate, endDate string) (bool, error)

	// Calendar & attendance integration
	ListCalendar(ctx context.Context, orgID uuid.UUID, year, month int) ([]CalendarEntry, error)
	IsOnApprovedLeave(ctx context.Context, orgID, employeeID uuid.UUID, date string) (bool, error)

	// Holidays
	ListHolidays(ctx context.Context, countryCode, startDate, endDate string) ([]PublicHoliday, error)

	// Transactions
	BeginTx(ctx context.Context) (pgx.Tx, error)
}

// OrgInfoProvider provides the narrow view of org data the leave service needs.
type OrgInfoProvider interface {
	GetOrgTimezone(ctx context.Context, orgID uuid.UUID) (string, error)
	GetOrgCountryCode(ctx context.Context, orgID uuid.UUID) (string, error)
	GetOrgWorkDays(ctx context.Context, orgID uuid.UUID) ([]int, error)
}

// ── Service ─────────────────────────────────────────────────────────────────

type ServiceOption func(*Service)

type Service struct {
	repo     RepositoryInterface
	orgRepo  OrgInfoProvider
	auditLog audit.Logger
}

func NewService(repo RepositoryInterface, orgRepo OrgInfoProvider, opts ...ServiceOption) *Service {
	s := &Service{repo: repo, orgRepo: orgRepo}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// WithAuditLog sets the audit logger for the service.
func WithAuditLog(al audit.Logger) ServiceOption {
	return func(s *Service) {
		s.auditLog = al
	}
}

func (s *Service) logAudit(ctx context.Context, entry audit.LogEntry) {
	if s.auditLog == nil {
		return
	}
	if err := s.auditLog.Log(ctx, entry); err != nil {
		// Audit failures must not break the main operation.
		_ = err
	}
}

// ── Policies ────────────────────────────────────────────────────────────────

func (s *Service) ListPolicies(ctx context.Context, orgID uuid.UUID) ([]Policy, error) {
	return s.repo.ListPolicies(ctx, orgID)
}

func (s *Service) CreatePolicy(ctx context.Context, orgID uuid.UUID, req CreatePolicyRequest) (*Policy, error) {
	p, err := s.repo.CreatePolicy(ctx, orgID, req)
	if err != nil {
		return nil, fmt.Errorf("create policy: %w", err)
	}

	s.logAudit(ctx, audit.LogEntry{
		OrgID: orgID, Action: "leave_policy.created",
		ResourceType: "leave_policy", ResourceID: p.ID, AfterState: p,
	})
	return p, nil
}

func (s *Service) UpdatePolicy(ctx context.Context, orgID, policyID uuid.UUID, req UpdatePolicyRequest) (*Policy, error) {
	p, err := s.repo.UpdatePolicy(ctx, orgID, policyID, req)
	if err != nil {
		return nil, fmt.Errorf("update policy: %w", err)
	}

	s.logAudit(ctx, audit.LogEntry{
		OrgID: orgID, Action: "leave_policy.updated",
		ResourceType: "leave_policy", ResourceID: p.ID, AfterState: p,
	})
	return p, nil
}

func (s *Service) DeactivatePolicy(ctx context.Context, orgID, policyID uuid.UUID) error {
	if err := s.repo.DeactivatePolicy(ctx, orgID, policyID); err != nil {
		return fmt.Errorf("deactivate policy: %w", err)
	}

	s.logAudit(ctx, audit.LogEntry{
		OrgID: orgID, Action: "leave_policy.deactivated",
		ResourceType: "leave_policy", ResourceID: policyID,
	})
	return nil
}

// ── Balances ────────────────────────────────────────────────────────────────

func (s *Service) ListBalances(ctx context.Context, orgID uuid.UUID, year int) ([]BalanceWithPolicy, error) {
	return s.repo.ListBalances(ctx, orgID, year)
}

func (s *Service) ListMyBalances(ctx context.Context, orgID, employeeID uuid.UUID, year int) ([]BalanceWithPolicy, error) {
	// Ensure balances exist for this employee for the requested year.
	if err := s.ensureEmployeeBalances(ctx, orgID, employeeID, year); err != nil {
		return nil, fmt.Errorf("ensure balances: %w", err)
	}
	return s.repo.ListEmployeeBalances(ctx, orgID, employeeID, year)
}

// ensureEmployeeBalances creates balance rows for an employee if they don't exist yet
// for the given year. This is called lazily on first access.
func (s *Service) ensureEmployeeBalances(ctx context.Context, orgID, employeeID uuid.UUID, year int) error {
	policies, err := s.repo.ListPolicies(ctx, orgID)
	if err != nil {
		return fmt.Errorf("list policies for balance init: %w", err)
	}
	for _, p := range policies {
		if err := s.repo.EnsureBalance(ctx, orgID, employeeID, p.ID, year, p.DaysPerYear); err != nil {
			return fmt.Errorf("ensure balance for policy %s: %w", p.Name, err)
		}
	}
	return nil
}

// ── Submit Request ──────────────────────────────────────────────────────────

func (s *Service) SubmitRequest(ctx context.Context, orgID, employeeID uuid.UUID, input SubmitRequestInput) (*Request, error) {
	// 1. Parse and validate dates.
	startDate, err := time.Parse("2006-01-02", input.StartDate)
	if err != nil {
		return nil, apperr.New(apperr.CodeValidation, "invalid start_date format, expected YYYY-MM-DD")
	}
	endDate, err := time.Parse("2006-01-02", input.EndDate)
	if err != nil {
		return nil, apperr.New(apperr.CodeValidation, "invalid end_date format, expected YYYY-MM-DD")
	}
	if endDate.Before(startDate) {
		return nil, apperr.New(apperr.CodeValidation, "end_date must be on or after start_date")
	}

	// 2. Reject cross-year requests (MVP limitation).
	if startDate.Year() != endDate.Year() {
		return nil, apperr.New(apperr.CodeValidation, "leave requests cannot span multiple years")
	}
	year := startDate.Year()

	// 3. Verify policy exists and is active.
	policy, err := s.repo.GetPolicy(ctx, orgID, input.LeavePolicyID)
	if err != nil {
		return nil, fmt.Errorf("get policy: %w", err)
	}
	if !policy.IsActive {
		return nil, apperr.New(apperr.CodeValidation, "leave policy is no longer active")
	}

	// 4. Calculate business days (exclude weekends + public holidays).
	totalDays, err := s.calculateBusinessDays(ctx, orgID, input.StartDate, input.EndDate)
	if err != nil {
		return nil, fmt.Errorf("calculate business days: %w", err)
	}
	if totalDays <= 0 {
		return nil, apperr.New(apperr.CodeValidation, "no working days in the selected date range")
	}

	// 5. Check for overlapping requests.
	overlap, err := s.repo.HasOverlap(ctx, orgID, employeeID, input.StartDate, input.EndDate)
	if err != nil {
		return nil, fmt.Errorf("check overlap: %w", err)
	}
	if overlap {
		return nil, apperr.New(apperr.CodeConflict, "you already have a pending or approved leave in this date range")
	}

	// 6. Ensure balance exists, then check availability inside a transaction.
	if err := s.ensureEmployeeBalances(ctx, orgID, employeeID, year); err != nil {
		return nil, fmt.Errorf("ensure balances: %w", err)
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Lock balance row.
	balance, err := s.repo.GetBalanceForUpdate(ctx, tx, orgID, employeeID, input.LeavePolicyID, year)
	if err != nil {
		return nil, fmt.Errorf("get balance for update: %w", err)
	}
	if balance.Available() < totalDays {
		return nil, apperr.New(apperr.CodeInsufficientBalance,
			fmt.Sprintf("insufficient leave balance: %.1f days available, %.1f requested", balance.Available(), totalDays))
	}

	// 7. Create request and update balance within the transaction.
	req, err := s.repo.CreateRequest(ctx, tx, orgID, employeeID, input.LeavePolicyID, input.StartDate, input.EndDate, totalDays, input.Reason)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	if err := s.repo.UpdateBalancePending(ctx, tx, balance.ID, totalDays); err != nil {
		return nil, fmt.Errorf("update pending: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit submit request: %w", err)
	}

	s.logAudit(ctx, audit.LogEntry{
		OrgID: orgID, ActorUserID: uuid.Nil, Action: "leave_request.submitted",
		ResourceType: "leave_request", ResourceID: req.ID, AfterState: req,
	})
	return req, nil
}

// ── Approve / Reject / Cancel ───────────────────────────────────────────────

func (s *Service) ApproveRequest(ctx context.Context, orgID, reviewerEmployeeID, requestID uuid.UUID) (*Request, error) {
	// Load the request first to get its details.
	existing, err := s.repo.GetRequest(ctx, orgID, requestID)
	if err != nil {
		return nil, fmt.Errorf("get request for approval: %w", err)
	}
	if existing.Status != "pending" {
		return nil, apperr.New(apperr.CodeConflict, fmt.Sprintf("request is already %s", existing.Status))
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Lock balance and move days from pending → used.
	year, _ := time.Parse("2006-01-02", existing.StartDate)
	balance, err := s.repo.GetBalanceForUpdate(ctx, tx, orgID, existing.EmployeeID, existing.LeavePolicyID, year.Year())
	if err != nil {
		return nil, fmt.Errorf("get balance for approval: %w", err)
	}

	if err := s.repo.ApproveBalanceUpdate(ctx, tx, balance.ID, existing.TotalDays); err != nil {
		return nil, fmt.Errorf("approve balance: %w", err)
	}

	req, err := s.repo.UpdateRequestStatus(ctx, tx, orgID, requestID, "pending", "approved", &reviewerEmployeeID, nil)
	if err != nil {
		return nil, fmt.Errorf("approve request: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit approve: %w", err)
	}

	s.logAudit(ctx, audit.LogEntry{
		OrgID: orgID, ActorUserID: uuid.Nil, Action: "leave_request.approved",
		ResourceType: "leave_request", ResourceID: requestID, AfterState: req,
	})
	return req, nil
}

func (s *Service) RejectRequest(ctx context.Context, orgID, reviewerEmployeeID, requestID uuid.UUID, note *string) (*Request, error) {
	existing, err := s.repo.GetRequest(ctx, orgID, requestID)
	if err != nil {
		return nil, fmt.Errorf("get request for rejection: %w", err)
	}
	if existing.Status != "pending" {
		return nil, apperr.New(apperr.CodeConflict, fmt.Sprintf("request is already %s", existing.Status))
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Restore pending days.
	year, _ := time.Parse("2006-01-02", existing.StartDate)
	balance, err := s.repo.GetBalanceForUpdate(ctx, tx, orgID, existing.EmployeeID, existing.LeavePolicyID, year.Year())
	if err != nil {
		return nil, fmt.Errorf("get balance for rejection: %w", err)
	}

	if err := s.repo.UpdateBalancePending(ctx, tx, balance.ID, -existing.TotalDays); err != nil {
		return nil, fmt.Errorf("restore pending: %w", err)
	}

	req, err := s.repo.UpdateRequestStatus(ctx, tx, orgID, requestID, "pending", "rejected", &reviewerEmployeeID, note)
	if err != nil {
		return nil, fmt.Errorf("reject request: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit reject: %w", err)
	}

	s.logAudit(ctx, audit.LogEntry{
		OrgID: orgID, ActorUserID: uuid.Nil, Action: "leave_request.rejected",
		ResourceType: "leave_request", ResourceID: requestID, AfterState: req,
	})
	return req, nil
}

func (s *Service) CancelRequest(ctx context.Context, orgID, employeeID, requestID uuid.UUID) (*Request, error) {
	existing, err := s.repo.GetRequest(ctx, orgID, requestID)
	if err != nil {
		return nil, fmt.Errorf("get request for cancellation: %w", err)
	}

	// Employee can only cancel their own requests.
	if existing.EmployeeID != employeeID {
		return nil, apperr.New(apperr.CodeForbidden, "you can only cancel your own leave requests")
	}

	// Can cancel pending or approved (future) requests.
	if existing.Status != "pending" && existing.Status != "approved" {
		return nil, apperr.New(apperr.CodeConflict, fmt.Sprintf("cannot cancel a %s request", existing.Status))
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	year, _ := time.Parse("2006-01-02", existing.StartDate)
	balance, err := s.repo.GetBalanceForUpdate(ctx, tx, orgID, existing.EmployeeID, existing.LeavePolicyID, year.Year())
	if err != nil {
		return nil, fmt.Errorf("get balance for cancel: %w", err)
	}

	if existing.Status == "pending" {
		// Restore pending_days.
		if err := s.repo.UpdateBalancePending(ctx, tx, balance.ID, -existing.TotalDays); err != nil {
			return nil, fmt.Errorf("restore pending on cancel: %w", err)
		}
	} else {
		// Approved: restore used_days (reverse of approval).
		if err := s.repo.ApproveBalanceUpdate(ctx, tx, balance.ID, -existing.TotalDays); err != nil {
			return nil, fmt.Errorf("restore used on cancel: %w", err)
		}
	}

	req, err := s.repo.UpdateRequestStatus(ctx, tx, orgID, requestID, existing.Status, "cancelled", nil, nil)
	if err != nil {
		return nil, fmt.Errorf("cancel request: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit cancel: %w", err)
	}

	s.logAudit(ctx, audit.LogEntry{
		OrgID: orgID, ActorUserID: uuid.Nil, Action: "leave_request.cancelled",
		ResourceType: "leave_request", ResourceID: requestID, AfterState: req,
	})
	return req, nil
}

// ── Calendar ────────────────────────────────────────────────────────────────

func (s *Service) GetCalendar(ctx context.Context, orgID uuid.UUID, year, month int) ([]CalendarEntry, error) {
	return s.repo.ListCalendar(ctx, orgID, year, month)
}

// ── List requests ───────────────────────────────────────────────────────────

func (s *Service) ListRequests(ctx context.Context, orgID uuid.UUID, filter ListRequestsFilter) ([]RequestWithDetails, error) {
	return s.repo.ListRequests(ctx, orgID, filter)
}

func (s *Service) ListMyRequests(ctx context.Context, orgID, employeeID uuid.UUID) ([]RequestWithDetails, error) {
	return s.repo.ListRequests(ctx, orgID, ListRequestsFilter{EmployeeID: &employeeID})
}

// ── Attendance integration ──────────────────────────────────────────────────

func (s *Service) IsOnApprovedLeave(ctx context.Context, orgID, employeeID uuid.UUID, date string) (bool, error) {
	return s.repo.IsOnApprovedLeave(ctx, orgID, employeeID, date)
}

// ── Business day calculation ────────────────────────────────────────────────

// calculateBusinessDays counts working days between startDate and endDate (inclusive),
// excluding weekends (per org work_days) and public holidays (per org country).
func (s *Service) calculateBusinessDays(ctx context.Context, orgID uuid.UUID, startDate, endDate string) (float64, error) {
	// Get org work days (e.g. [1,2,3,4,5] for Mon-Fri).
	workDays, err := s.orgRepo.GetOrgWorkDays(ctx, orgID)
	if err != nil {
		return 0, fmt.Errorf("get org work days: %w", err)
	}

	// Build a set for fast lookup.
	workDaySet := make(map[time.Weekday]bool)
	for _, wd := range workDays {
		workDaySet[time.Weekday(wd)] = true
	}

	// Get public holidays in the date range.
	countryCode, err := s.orgRepo.GetOrgCountryCode(ctx, orgID)
	if err != nil {
		return 0, fmt.Errorf("get org country: %w", err)
	}

	holidays, err := s.repo.ListHolidays(ctx, countryCode, startDate, endDate)
	if err != nil {
		return 0, fmt.Errorf("list holidays: %w", err)
	}

	holidaySet := make(map[string]bool)
	for _, h := range holidays {
		holidaySet[h.Date] = true
	}

	// Count working days.
	start, _ := time.Parse("2006-01-02", startDate)
	end, _ := time.Parse("2006-01-02", endDate)

	var count float64
	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		dateStr := d.Format("2006-01-02")
		if workDaySet[d.Weekday()] && !holidaySet[dateStr] {
			count++
		}
	}

	return count, nil
}

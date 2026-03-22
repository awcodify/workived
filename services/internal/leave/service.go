package leave

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/audit"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/email"
)

// ── Interfaces ──────────────────────────────────────────────────────────────

type RepositoryInterface interface {
	// Policies
	ListPolicies(ctx context.Context, orgID uuid.UUID) ([]Policy, error)
	GetPolicy(ctx context.Context, orgID, policyID uuid.UUID) (*Policy, error)
	CreatePolicy(ctx context.Context, orgID uuid.UUID, req CreatePolicyRequest) (*Policy, error)
	UpdatePolicy(ctx context.Context, orgID, policyID uuid.UUID, req UpdatePolicyRequest) (*Policy, error)
	DeactivatePolicy(ctx context.Context, orgID, policyID uuid.UUID) error
	CountPendingRequestsByPolicy(ctx context.Context, orgID, policyID uuid.UUID) (int, error)
	CountFutureApprovedRequestsByPolicy(ctx context.Context, orgID, policyID uuid.UUID) (int, error)

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
	CountPendingRequests(ctx context.Context, orgID uuid.UUID, managerEmployeeID *uuid.UUID) (int, error)
	HasOverlap(ctx context.Context, orgID, employeeID uuid.UUID, startDate, endDate string) (bool, error)

	// Calendar & attendance integration
	ListCalendar(ctx context.Context, orgID uuid.UUID, year, month int) ([]CalendarEntry, error)
	IsOnApprovedLeave(ctx context.Context, orgID, employeeID uuid.UUID, date string) (bool, error)

	// Holidays
	ListHolidays(ctx context.Context, countryCode, startDate, endDate string) ([]PublicHoliday, error)

	// Templates
	ListTemplates(ctx context.Context, countryCode string) ([]PolicyTemplate, error)
	GetTemplatesByIDs(ctx context.Context, ids []uuid.UUID) ([]PolicyTemplate, error)
	ImportPoliciesFromTemplates(ctx context.Context, tx pgx.Tx, orgID uuid.UUID, templates []PolicyTemplate) ([]Policy, error)
	CreateBalancesForAllEmployees(ctx context.Context, tx pgx.Tx, orgID, policyID uuid.UUID, year int, entitledDays float64) error

	// Rollover
	CreateBalanceWithCarryOver(ctx context.Context, orgID, employeeID, policyID uuid.UUID, year int, entitledDays, carriedOverDays float64) error

	// Transactions
	BeginTx(ctx context.Context) (pgx.Tx, error)
}

// OrgInfoProvider provides the narrow view of org data the leave service needs.
type OrgInfoProvider interface {
	GetOrgTimezone(ctx context.Context, orgID uuid.UUID) (string, error)
	GetOrgCountryCode(ctx context.Context, orgID uuid.UUID) (string, error)
	GetOrgWorkDays(ctx context.Context, orgID uuid.UUID) ([]int, error)
}

// EmployeeInfoProvider provides employee profile data for email notifications.
type EmployeeInfoProvider interface {
	GetEmployeeProfile(ctx context.Context, orgID, employeeID uuid.UUID) (name string, email *string, managerID *uuid.UUID, err error)
	VerifyManagerRelationship(ctx context.Context, orgID, employeeID, managerEmployeeID uuid.UUID) error
}

// TasksServiceInterface provides task management for approval workflows.
type TasksServiceInterface interface {
	CreateApprovalTask(ctx context.Context, orgID uuid.UUID, approvalType string, approvalID uuid.UUID, title, description string, requesterEmployeeID, assigneeID uuid.UUID, dueDate *string) error
	CompleteApprovalTask(ctx context.Context, approvalType string, approvalID uuid.UUID) error
	DeleteApprovalTask(ctx context.Context, approvalType string, approvalID uuid.UUID) error
}

// ── Service ─────────────────────────────────────────────────────────────────

type ServiceOption func(*Service)

type Service struct {
	repo         RepositoryInterface
	orgRepo      OrgInfoProvider
	employeeRepo EmployeeInfoProvider
	tasksService TasksServiceInterface
	auditLog     audit.Logger
	log          zerolog.Logger
	email        email.Sender
	appURL       string // e.g. "http://localhost:3000" for email links
}

func NewService(repo RepositoryInterface, orgRepo OrgInfoProvider, employeeRepo EmployeeInfoProvider, appURL string, opts ...ServiceOption) *Service {
	s := &Service{
		repo:         repo,
		orgRepo:      orgRepo,
		employeeRepo: employeeRepo,
		appURL:       appURL,
	}
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

// WithLogger sets the zerolog logger for the service.
func WithLogger(log zerolog.Logger) ServiceOption {
	return func(s *Service) {
		s.log = log
	}
}

// WithEmailSender sets the email sender for the service.
func WithEmailSender(e email.Sender) ServiceOption {
	return func(s *Service) {
		s.email = e
	}
}

// WithTasksService sets the tasks service for managing approval tasks.
func WithTasksService(ts TasksServiceInterface) ServiceOption {
	return func(s *Service) {
		s.tasksService = ts
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
	// 1. Check for pending requests - cannot delete if any exist
	pendingCount, err := s.repo.CountPendingRequestsByPolicy(ctx, orgID, policyID)
	if err != nil {
		return fmt.Errorf("count pending requests: %w", err)
	}
	if pendingCount > 0 {
		return apperr.New(
			apperr.CodeConflict,
			fmt.Sprintf("Cannot delete policy — %d pending request(s) exist. Reject or cancel them first.", pendingCount),
		)
	}

	// 2. Check for approved future leave - cannot delete if any exist
	futureCount, err := s.repo.CountFutureApprovedRequestsByPolicy(ctx, orgID, policyID)
	if err != nil {
		return fmt.Errorf("count future approved requests: %w", err)
	}
	if futureCount > 0 {
		return apperr.New(
			apperr.CodeConflict,
			fmt.Sprintf("Cannot delete policy — %d approved future leave(s) exist.", futureCount),
		)
	}

	// 3. Safe to deactivate
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
	defer func() { _ = tx.Rollback(ctx) }()

	// For unlimited policies, skip balance validation
	if !policy.IsUnlimited {
		// Lock balance row.
		balance, err := s.repo.GetBalanceForUpdate(ctx, tx, orgID, employeeID, input.LeavePolicyID, year)
		if err != nil {
			return nil, fmt.Errorf("get balance for update: %w", err)
		}
		if balance.Available() < totalDays {
			return nil, apperr.New(apperr.CodeUpgradeRequired,
				fmt.Sprintf("insufficient leave balance: %.1f days available, %.1f requested", balance.Available(), totalDays))
		}

		// Update pending balance
		if err := s.repo.UpdateBalancePending(ctx, tx, balance.ID, totalDays); err != nil {
			return nil, fmt.Errorf("update pending: %w", err)
		}
	}

	// 7. Create request (balance update already done above for non-unlimited).
	req, err := s.repo.CreateRequest(ctx, tx, orgID, employeeID, input.LeavePolicyID, input.StartDate, input.EndDate, totalDays, input.Reason)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit submit request: %w", err)
	}

	s.logAudit(ctx, audit.LogEntry{
		OrgID: orgID, ActorUserID: uuid.Nil, Action: "leave_request.submitted",
		ResourceType: "leave_request", ResourceID: req.ID, AfterState: req,
	})

	// Log business event
	s.log.Info().
		Str("org_id", orgID.String()).
		Str("request_id", req.ID.String()).
		Str("employee_id", employeeID.String()).
		Str("policy_id", req.LeavePolicyID.String()).
		Str("start_date", req.StartDate).
		Str("end_date", req.EndDate).
		Float64("total_days", req.TotalDays).
		Msg("leave.request.submitted")

	// Send email notification to manager (best effort - don't fail if email fails)
	if s.email != nil {
		go s.sendLeavePendingEmail(context.Background(), orgID, employeeID, req.ID, policy.Name, req.StartDate, req.EndDate, req.TotalDays, input.Reason)
	}

	// Create approval task (best effort - don't fail if task creation fails)
	if s.tasksService != nil {
		go s.createLeaveApprovalTask(context.Background(), orgID, employeeID, req, policy.Name)
	}

	return req, nil
}

// createLeaveApprovalTask creates an approval task for the leave request
func (s *Service) createLeaveApprovalTask(ctx context.Context, orgID, employeeID uuid.UUID, req *Request, policyName string) {
	// Skip if tasks service not wired up
	if s.tasksService == nil {
		s.log.Debug().Msg("tasks service not configured, skipping approval task creation")
		return
	}

	// Get employee name and manager ID for task title and assignment
	employeeName, _, managerID, err := s.employeeRepo.GetEmployeeProfile(ctx, orgID, employeeID)
	if err != nil {
		s.log.Warn().Err(err).Str("org_id", orgID.String()).Msg("failed to get employee profile for approval task")
		return
	}

	// Manager is required to assign approval task
	if managerID == nil {
		s.log.Warn().Str("employee_id", employeeID.String()).Msg("employee has no manager, cannot create approval task")
		return
	}

	// Calculate due date (3 days from now)
	dueDate := time.Now().AddDate(0, 0, 3).Format("2006-01-02")

	title := fmt.Sprintf("Approve Leave: %s (%s — %s)", employeeName, req.StartDate, req.EndDate)
	description := fmt.Sprintf("Leave request for %.1f days\nType: %s\nReason: %s",
		req.TotalDays,
		policyName,
		func() string {
			if req.Reason != nil {
				return *req.Reason
			}
			return "Not provided"
		}())

	err = s.tasksService.CreateApprovalTask(ctx, orgID, "leave", req.ID, title, description, employeeID, *managerID, &dueDate)
	if err != nil {
		s.log.Warn().Err(err).
			Str("org_id", orgID.String()).
			Str("request_id", req.ID.String()).
			Msg("failed to create leave approval task")
	}
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

	// Get policy to check if it's unlimited
	policy, err := s.repo.GetPolicy(ctx, orgID, existing.LeavePolicyID)
	if err != nil {
		return nil, fmt.Errorf("get policy: %w", err)
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// For non-unlimited policies, lock balance and move days from pending → used.
	if !policy.IsUnlimited {
		year, _ := time.Parse("2006-01-02", existing.StartDate)
		balance, err := s.repo.GetBalanceForUpdate(ctx, tx, orgID, existing.EmployeeID, existing.LeavePolicyID, year.Year())
		if err != nil {
			return nil, fmt.Errorf("get balance for approval: %w", err)
		}

		if err := s.repo.ApproveBalanceUpdate(ctx, tx, balance.ID, existing.TotalDays); err != nil {
			return nil, fmt.Errorf("approve balance: %w", err)
		}
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

	// Log business event
	s.log.Info().
		Str("org_id", orgID.String()).
		Str("request_id", requestID.String()).
		Str("reviewer_employee_id", reviewerEmployeeID.String()).
		Float64("total_days", req.TotalDays).
		Msg("leave.request.approved")

	// Send email notification to employee (best effort - don't fail if email fails)
	if s.email != nil {
		go s.sendLeaveApprovedEmail(context.Background(), orgID, req.EmployeeID, reviewerEmployeeID, requestID, nil)
	}

	// Complete approval task (best effort)
	if s.tasksService != nil {
		go func() {
			if err := s.tasksService.CompleteApprovalTask(context.Background(), "leave", requestID); err != nil {
				s.log.Warn().Err(err).Str("request_id", requestID.String()).Msg("failed to complete approval task")
			}
		}()
	}

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

	// Get policy to check if it's unlimited
	policy, err := s.repo.GetPolicy(ctx, orgID, existing.LeavePolicyID)
	if err != nil {
		return nil, fmt.Errorf("get policy: %w", err)
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// For non-unlimited policies, restore pending days.
	if !policy.IsUnlimited {
		year, _ := time.Parse("2006-01-02", existing.StartDate)
		balance, err := s.repo.GetBalanceForUpdate(ctx, tx, orgID, existing.EmployeeID, existing.LeavePolicyID, year.Year())
		if err != nil {
			return nil, fmt.Errorf("get balance for rejection: %w", err)
		}

		if err := s.repo.UpdateBalancePending(ctx, tx, balance.ID, -existing.TotalDays); err != nil {
			return nil, fmt.Errorf("restore pending: %w", err)
		}
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

	// Log business event
	noteStr := ""
	if note != nil {
		noteStr = *note
	}
	s.log.Info().
		Str("org_id", orgID.String()).
		Str("request_id", requestID.String()).
		Str("reviewer_employee_id", reviewerEmployeeID.String()).
		Str("reason", noteStr).
		Msg("leave.request.rejected")

	// Send email notification to employee (best effort - don't fail if email fails)
	if s.email != nil {
		go s.sendLeaveRejectedEmail(context.Background(), orgID, req.EmployeeID, reviewerEmployeeID, requestID, note)
	}

	// Complete approval task (best effort)
	if s.tasksService != nil {
		go func() {
			if err := s.tasksService.CompleteApprovalTask(context.Background(), "leave", requestID); err != nil {
				s.log.Warn().Err(err).Str("request_id", requestID.String()).Msg("failed to complete approval task")
			}
		}()
	}

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

	// Get policy to check if it's unlimited
	policy, err := s.repo.GetPolicy(ctx, orgID, existing.LeavePolicyID)
	if err != nil {
		return nil, fmt.Errorf("get policy: %w", err)
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// For non-unlimited policies, restore balance
	if !policy.IsUnlimited {
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

	// Delete approval task (best effort)
	if s.tasksService != nil {
		go func() {
			if err := s.tasksService.DeleteApprovalTask(context.Background(), "leave", requestID); err != nil {
				s.log.Warn().Err(err).Str("request_id", requestID.String()).Msg("failed to delete approval task")
			}
		}()
	}

	return req, nil
}

// ── Notifications ───────────────────────────────────────────────────────────

// GetNotificationCount returns the number of pending leave requests.
// For non-admins, only counts requests from direct reports.
func (s *Service) GetNotificationCount(ctx context.Context, orgID uuid.UUID, role string, managerEmployeeID *uuid.UUID) (int, error) {
	return s.repo.CountPendingRequests(ctx, orgID, managerEmployeeID)
}

// ── Calendar ────────────────────────────────────────────────────────────────

func (s *Service) GetCalendar(ctx context.Context, orgID uuid.UUID, year, month int) ([]CalendarEntry, error) {
	return s.repo.ListCalendar(ctx, orgID, year, month)
}

// ── List requests ───────────────────────────────────────────────────────────

func (s *Service) ListRequests(ctx context.Context, orgID uuid.UUID, filter ListRequestsFilter, role string, managerEmployeeID *uuid.UUID) ([]RequestWithDetails, error) {
	// If managerEmployeeID is provided, filter to only show direct reports
	if managerEmployeeID != nil {
		filter.ManagerEmployeeID = managerEmployeeID
	}
	return s.repo.ListRequests(ctx, orgID, filter)
}

func (s *Service) ListMyRequests(ctx context.Context, orgID, employeeID uuid.UUID) ([]RequestWithDetails, error) {
	return s.repo.ListRequests(ctx, orgID, ListRequestsFilter{EmployeeID: &employeeID})
}

func (s *Service) GetRequest(ctx context.Context, orgID, requestID uuid.UUID) (*Request, error) {
	return s.repo.GetRequest(ctx, orgID, requestID)
}

func (s *Service) VerifyManagerRelationship(ctx context.Context, orgID, employeeID, managerEmployeeID uuid.UUID) error {
	return s.employeeRepo.VerifyManagerRelationship(ctx, orgID, employeeID, managerEmployeeID)
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

// ListHolidays returns public holidays for the organisation's country in the given date range.
func (s *Service) ListHolidays(ctx context.Context, orgID uuid.UUID, startDate, endDate string) ([]PublicHoliday, error) {
	countryCode, err := s.orgRepo.GetOrgCountryCode(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("get org country: %w", err)
	}

	holidays, err := s.repo.ListHolidays(ctx, countryCode, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("list holidays: %w", err)
	}

	return holidays, nil
}

// ListTemplates returns policy templates for the org's country.
// If countryCode is provided, use that; otherwise use org's country.
func (s *Service) ListTemplates(ctx context.Context, orgID uuid.UUID, countryCode *string) ([]PolicyTemplate, error) {
	var country string
	if countryCode != nil && *countryCode != "" {
		country = *countryCode
	} else {
		// Auto-detect from org's country
		var err error
		country, err = s.orgRepo.GetOrgCountryCode(ctx, orgID)
		if err != nil {
			return nil, fmt.Errorf("get org country: %w", err)
		}
	}

	templates, err := s.repo.ListTemplates(ctx, country)
	if err != nil {
		return nil, fmt.Errorf("list templates: %w", err)
	}

	return templates, nil
}

// ImportPolicies creates policies from templates. Validates that templates match org's country.
// Skips templates whose policy name already exists (idempotent).
// Creates balances for all active employees.
func (s *Service) ImportPolicies(ctx context.Context, orgID uuid.UUID, input ImportPoliciesInput) ([]Policy, error) {
	// Get org's country code
	orgCountry, err := s.orgRepo.GetOrgCountryCode(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("get org country: %w", err)
	}

	// Fetch templates
	templates, err := s.repo.GetTemplatesByIDs(ctx, input.TemplateIDs)
	if err != nil {
		return nil, fmt.Errorf("get templates: %w", err)
	}

	// Validate all templates match org's country
	for _, tmpl := range templates {
		if tmpl.CountryCode != orgCountry {
			return nil, apperr.New(
				apperr.CodeValidation,
				fmt.Sprintf("template %s is for country %s, but org is in %s",
					tmpl.Name, tmpl.CountryCode, orgCountry),
			)
		}
	}

	// Start transaction
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Create policies from templates
	policies, err := s.repo.ImportPoliciesFromTemplates(ctx, tx, orgID, templates)
	if err != nil {
		return nil, fmt.Errorf("import policies from templates: %w", err)
	}

	// For each newly created policy, create balances for all active employees
	currentYear := time.Now().Year()
	for _, policy := range policies {
		if err := s.repo.CreateBalancesForAllEmployees(ctx, tx, orgID, policy.ID, currentYear, policy.DaysPerYear); err != nil {
			return nil, fmt.Errorf("create balances for policy %s: %w", policy.Name, err)
		}
	}

	// Commit
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit import: %w", err)
	}

	// Audit log
	s.logAudit(ctx, audit.LogEntry{
		OrgID: orgID, ActorUserID: uuid.Nil, Action: "leave_policies.imported",
		ResourceType: "leave_policy", ResourceID: uuid.Nil,
		AfterState: map[string]interface{}{
			"count": len(policies),
			"policy_names": func() []string {
				names := make([]string, len(policies))
				for i, p := range policies {
					names[i] = p.Name
				}
				return names
			}(),
		},
	})

	return policies, nil
}

// ── Email Notification Helpers ────────────────────────────────────────────────

func (s *Service) sendLeavePendingEmail(ctx context.Context, orgID, employeeID, requestID uuid.UUID, policyName, startDate, endDate string, totalDays float64, reason *string) {
	// Get employee info
	empName, _, managerID, err := s.employeeRepo.GetEmployeeProfile(ctx, orgID, employeeID)
	if err != nil {
		s.log.Warn().Err(err).Str("employee_id", employeeID.String()).Msg("failed to get employee profile for email")
		return
	}

	// If no manager, skip email
	if managerID == nil {
		s.log.Debug().Str("employee_id", employeeID.String()).Msg("employee has no manager, skipping leave pending email")
		return
	}

	// Get manager info
	managerName, managerEmail, _, err := s.employeeRepo.GetEmployeeProfile(ctx, orgID, *managerID)
	if err != nil {
		s.log.Warn().Err(err).Str("manager_id", managerID.String()).Msg("failed to get manager profile for email")
		return
	}

	// Skip if manager has no email
	if managerEmail == nil || *managerEmail == "" {
		s.log.Debug().Str("manager_id", managerID.String()).Msg("manager has no email, skipping leave pending notification")
		return
	}

	// Render template
	subject, bodyHTML, _, err := email.LeavePendingApprovalTemplate.Render(map[string]any{
		"ReviewerName": managerName,
		"EmployeeName": empName,
		"PolicyName":   policyName,
		"StartDate":    startDate,
		"EndDate":      endDate,
		"TotalDays":    fmt.Sprintf("%.1f", totalDays),
		"Reason":       reason,
		"AppURL":       s.appURL,
	})
	if err != nil {
		s.log.Error().Err(err).Msg("failed to render leave pending email template")
		return
	}

	// Send email
	if err := s.email.Send(email.Message{
		To:      []string{*managerEmail},
		Subject: subject,
		Body:    bodyHTML,
		IsHTML:  true,
	}); err != nil {
		s.log.Error().Err(err).Str("manager_email", *managerEmail).Msg("failed to send leave pending email")
		return
	}

	s.log.Info().Str("request_id", requestID.String()).Str("manager_email", *managerEmail).Msg("leave pending email sent")
}

func (s *Service) sendLeaveApprovedEmail(ctx context.Context, orgID, employeeID, reviewerEmployeeID, requestID uuid.UUID, reviewNote *string) {
	// Get leave request details
	req, err := s.repo.GetRequest(ctx, orgID, requestID)
	if err != nil {
		s.log.Warn().Err(err).Str("request_id", requestID.String()).Msg("failed to get request for approved email")
		return
	}

	// Get policy name
	policy, err := s.repo.GetPolicy(ctx, orgID, req.LeavePolicyID)
	if err != nil {
		s.log.Warn().Err(err).Str("policy_id", req.LeavePolicyID.String()).Msg("failed to get policy for approved email")
		return
	}

	// Get employee info
	empName, empEmail, _, err := s.employeeRepo.GetEmployeeProfile(ctx, orgID, employeeID)
	if err != nil {
		s.log.Warn().Err(err).Str("employee_id", employeeID.String()).Msg("failed to get employee profile for approved email")
		return
	}

	// Skip if employee has no email
	if empEmail == nil || *empEmail == "" {
		s.log.Debug().Str("employee_id", employeeID.String()).Msg("employee has no email, skipping leave approved notification")
		return
	}

	// Get reviewer name
	reviewerName, _, _, err := s.employeeRepo.GetEmployeeProfile(ctx, orgID, reviewerEmployeeID)
	if err != nil {
		s.log.Warn().Err(err).Str("reviewer_id", reviewerEmployeeID.String()).Msg("failed to get reviewer profile for approved email")
		reviewerName = "Manager" // fallback
	}

	// Render template
	subject, bodyHTML, _, err := email.LeaveApprovedTemplate.Render(map[string]any{
		"EmployeeName": empName,
		"ReviewerName": reviewerName,
		"PolicyName":   policy.Name,
		"StartDate":    req.StartDate,
		"EndDate":      req.EndDate,
		"TotalDays":    fmt.Sprintf("%.1f", req.TotalDays),
		"ReviewNote":   reviewNote,
		"AppURL":       s.appURL,
	})
	if err != nil {
		s.log.Error().Err(err).Msg("failed to render leave approved email template")
		return
	}

	// Send email
	if err := s.email.Send(email.Message{
		To:      []string{*empEmail},
		Subject: subject,
		Body:    bodyHTML,
		IsHTML:  true,
	}); err != nil {
		s.log.Error().Err(err).Str("employee_email", *empEmail).Msg("failed to send leave approved email")
		return
	}

	s.log.Info().Str("request_id", requestID.String()).Str("employee_email", *empEmail).Msg("leave approved email sent")
}

func (s *Service) sendLeaveRejectedEmail(ctx context.Context, orgID, employeeID, reviewerEmployeeID, requestID uuid.UUID, reviewNote *string) {
	// Get leave request details
	req, err := s.repo.GetRequest(ctx, orgID, requestID)
	if err != nil {
		s.log.Warn().Err(err).Str("request_id", requestID.String()).Msg("failed to get request for rejected email")
		return
	}

	// Get policy name
	policy, err := s.repo.GetPolicy(ctx, orgID, req.LeavePolicyID)
	if err != nil {
		s.log.Warn().Err(err).Str("policy_id", req.LeavePolicyID.String()).Msg("failed to get policy for rejected email")
		return
	}

	// Get employee info
	empName, empEmail, _, err := s.employeeRepo.GetEmployeeProfile(ctx, orgID, employeeID)
	if err != nil {
		s.log.Warn().Err(err).Str("employee_id", employeeID.String()).Msg("failed to get employee profile for rejected email")
		return
	}

	// Skip if employee has no email
	if empEmail == nil || *empEmail == "" {
		s.log.Debug().Str("employee_id", employeeID.String()).Msg("employee has no email, skipping leave rejected notification")
		return
	}

	// Get reviewer name
	reviewerName, _, _, err := s.employeeRepo.GetEmployeeProfile(ctx, orgID, reviewerEmployeeID)
	if err != nil {
		s.log.Warn().Err(err).Str("reviewer_id", reviewerEmployeeID.String()).Msg("failed to get reviewer profile for rejected email")
		reviewerName = "Manager" // fallback
	}

	// Render template
	subject, bodyHTML, _, err := email.LeaveRejectedTemplate.Render(map[string]any{
		"EmployeeName": empName,
		"ReviewerName": reviewerName,
		"PolicyName":   policy.Name,
		"StartDate":    req.StartDate,
		"EndDate":      req.EndDate,
		"TotalDays":    fmt.Sprintf("%.1f", req.TotalDays),
		"ReviewNote":   reviewNote,
		"AppURL":       s.appURL,
	})
	if err != nil {
		s.log.Error().Err(err).Msg("failed to render leave rejected email template")
		return
	}

	// Send email
	if err := s.email.Send(email.Message{
		To:      []string{*empEmail},
		Subject: subject,
		Body:    bodyHTML,
		IsHTML:  true,
	}); err != nil {
		s.log.Error().Err(err).Str("employee_email", *empEmail).Msg("failed to send leave rejected email")
		return
	}

	s.log.Info().Str("request_id", requestID.String()).Str("employee_email", *empEmail).Msg("leave rejected email sent")
}

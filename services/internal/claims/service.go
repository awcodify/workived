package claims

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/approval"
	"github.com/workived/services/internal/audit"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/email"
	"github.com/workived/services/pkg/paginate"
)

// RepositoryInterface defines the data access methods.
type RepositoryInterface interface {
	// Categories
	ListCategories(ctx context.Context, orgID uuid.UUID) ([]Category, error)
	GetCategory(ctx context.Context, orgID, id uuid.UUID) (*Category, error)
	CreateCategory(ctx context.Context, orgID uuid.UUID, req CreateCategoryRequest) (*Category, error)
	UpdateCategory(ctx context.Context, orgID, id uuid.UUID, req UpdateCategoryRequest) (*Category, error)
	DeactivateCategory(ctx context.Context, orgID, id uuid.UUID) error
	CountPendingClaimsByCategory(ctx context.Context, orgID, categoryID uuid.UUID) (int, error)

	// Templates
	ListTemplates(ctx context.Context, countryCode string) ([]CategoryTemplate, error)
	ImportCategoriesFromTemplates(ctx context.Context, orgID uuid.UUID, templates []CategoryTemplate) ([]Category, error)

	// Balances
	GetOrCreateBalance(ctx context.Context, orgID, employeeID, categoryID uuid.UUID, year, month int) (*ClaimBalance, error)
	UpdateBalanceOnApproval(ctx context.Context, orgID, employeeID, categoryID uuid.UUID, year, month int, amount int64) error
	UpdateBalanceOnRejection(ctx context.Context, orgID, employeeID, categoryID uuid.UUID, year, month int, amount int64) error
	ListBalancesByEmployee(ctx context.Context, orgID, employeeID uuid.UUID, year, month int) ([]ClaimBalanceWithCategory, error)
	CreateBalancesForAllEmployees(ctx context.Context, orgID, categoryID uuid.UUID, year, month int) error

	// Claims
	CreateClaim(ctx context.Context, orgID uuid.UUID, req SubmitClaimRequest, employeeID uuid.UUID, receiptURL *string) (*Claim, error)
	GetClaim(ctx context.Context, orgID, id uuid.UUID) (*Claim, error)
	ListClaims(ctx context.Context, orgID uuid.UUID, f ClaimFilters) ([]ClaimWithDetails, error)
	UpdateStatus(ctx context.Context, orgID, claimID uuid.UUID, fromStatus, toStatus string, reviewerEmployeeID *uuid.UUID, reviewNote *string) (*Claim, error)
	GetMonthlySpent(ctx context.Context, orgID, employeeID, categoryID uuid.UUID, claimDate string) (int64, error)
	GetMonthlySummary(ctx context.Context, orgID uuid.UUID, year, month int) ([]MonthlySummary, error)
}

// OrgInfoProvider provides organisation plan info for feature gating.
type OrgInfoProvider interface {
	GetOrgPlanInfo(ctx context.Context, orgID uuid.UUID) (plan string, limit *int, err error)
}

// EmployeeInfoProvider provides employee profile data for email notifications.
type EmployeeInfoProvider interface {
	GetEmployeeProfile(ctx context.Context, orgID, employeeID uuid.UUID) (name string, email *string, managerID *uuid.UUID, err error)
	VerifyManagerRelationship(ctx context.Context, orgID, employeeID, managerEmployeeID uuid.UUID) error
}

// TasksServiceInterface provides task management for approval workflows.
type TasksServiceInterface interface {
	CreateApprovalTask(ctx context.Context, orgID uuid.UUID, approvalType string, approvalID uuid.UUID, title, description string, assigneeID uuid.UUID, dueDate *string) error
	CompleteApprovalTask(ctx context.Context, approvalType string, approvalID uuid.UUID) error
	DeleteApprovalTask(ctx context.Context, approvalType string, approvalID uuid.UUID) error
}

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

type ServiceOption func(*Service)

func WithAuditLog(al audit.Logger) ServiceOption {
	return func(s *Service) {
		s.auditLog = al
	}
}

func WithLogger(log zerolog.Logger) ServiceOption {
	return func(s *Service) {
		s.log = log
	}
}

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
		s.log.Error().Err(err).Msg("audit log error")
	}
}

// ── Category Methods ──────────────────────────────────────────────────────────

func (s *Service) ListCategories(ctx context.Context, orgID uuid.UUID) ([]Category, error) {
	return s.repo.ListCategories(ctx, orgID)
}

func (s *Service) CreateCategory(ctx context.Context, orgID uuid.UUID, req CreateCategoryRequest, actorUserID ...uuid.UUID) (*Category, error) {
	cat, err := s.repo.CreateCategory(ctx, orgID, req)
	if err != nil {
		return nil, err
	}

	// Initialize balances for all active employees for current month
	now := time.Now()
	if err := s.repo.CreateBalancesForAllEmployees(ctx, orgID, cat.ID, now.Year(), int(now.Month())); err != nil {
		s.log.Warn().Err(err).Str("category_id", cat.ID.String()).Msg("failed to initialize claim balances")
		// Don't fail category creation if balance initialization fails
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "claim_category.created",
			ResourceType: "claim_category",
			ResourceID:   cat.ID,
			AfterState:   cat,
		})
	}

	return cat, nil
}

func (s *Service) UpdateCategory(ctx context.Context, orgID, id uuid.UUID, req UpdateCategoryRequest, actorUserID ...uuid.UUID) (*Category, error) {
	cat, err := s.repo.UpdateCategory(ctx, orgID, id, req)
	if err != nil {
		return nil, err
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "claim_category.updated",
			ResourceType: "claim_category",
			ResourceID:   id,
			AfterState:   cat,
		})
	}

	return cat, nil
}

func (s *Service) DeactivateCategory(ctx context.Context, orgID, id uuid.UUID, actorUserID ...uuid.UUID) error {
	// Get category details for better error messages
	category, err := s.repo.GetCategory(ctx, orgID, id)
	if err != nil {
		return err
	}

	// Check if category has pending claims
	pendingCount, err := s.repo.CountPendingClaimsByCategory(ctx, orgID, id)
	if err != nil {
		return fmt.Errorf("count pending claims: %w", err)
	}
	if pendingCount > 0 {
		return ErrCategoryHasPendingClaims(category.Name, pendingCount)
	}

	// Balances are preserved as historical records (ON DELETE RESTRICT protects them)
	// Historical approved/rejected claims keep their category_id even after deactivation

	if err := s.repo.DeactivateCategory(ctx, orgID, id); err != nil {
		return fmt.Errorf("deactivate category: %w", err)
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "claim_category.deactivated",
			ResourceType: "claim_category",
			ResourceID:   id,
		})
	}

	return nil
}

// ListTemplates returns category templates for the org's country.
func (s *Service) ListTemplates(ctx context.Context, orgID uuid.UUID, countryCode *string) ([]CategoryTemplate, error) {
	// If no country code provided, get it from organisation
	cc := ""
	if countryCode != nil && *countryCode != "" {
		cc = *countryCode
	} else {
		// Fetch org country code
		_, _, err := s.orgRepo.GetOrgPlanInfo(ctx, orgID)
		if err != nil {
			return nil, err
		}
		// Note: GetOrgPlanInfo doesn't return country code yet. Let's return empty for now
		// TODO: Update OrgInfoProvider interface to include country code
		return nil, apperr.New(apperr.CodeValidation, "country_code parameter is required")
	}

	return s.repo.ListTemplates(ctx, cc)
}

// ImportCategories imports categories from templates.
func (s *Service) ImportCategories(ctx context.Context, orgID uuid.UUID, req ImportCategoriesRequest, actorUserID ...uuid.UUID) ([]Category, int, error) {
	if len(req.TemplateIDs) == 0 {
		return nil, 0, apperr.New(apperr.CodeValidation, "template_ids cannot be empty")
	}

	// Fetch country code from organisation
	// Note: For now we'll fetch all templates and filter by IDs
	// TODO: Optimize by adding a method to fetch templates by IDs

	// For simplicity, let's assume all templates are for the same country
	// We'll need to get the org's country code first
	_, _, err := s.orgRepo.GetOrgPlanInfo(ctx, orgID)
	if err != nil {
		return nil, 0, err
	}
	var templateUUIDs []uuid.UUID
	for _, idStr := range req.TemplateIDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			return nil, 0, apperr.New(apperr.CodeValidation, fmt.Sprintf("invalid template_id: %s", idStr))
		}
		templateUUIDs = append(templateUUIDs, id)
	}

	// For now, we'll need to fetch templates by looping through countries
	// This is not ideal but works for the MVP
	var templates []CategoryTemplate
	for _, cc := range []string{"ID", "AE", "MY", "SG"} {
		countryTemplates, err := s.repo.ListTemplates(ctx, cc)
		if err != nil {
			continue
		}
		for _, tmpl := range countryTemplates {
			for _, wantedID := range templateUUIDs {
				if tmpl.ID == wantedID {
					templates = append(templates, tmpl)
					break
				}
			}
		}
	}

	if len(templates) == 0 {
		return nil, 0, apperr.New(apperr.CodeNotFound, "no templates found with provided IDs")
	}

	// Import categories
	created, err := s.repo.ImportCategoriesFromTemplates(ctx, orgID, templates)
	if err != nil {
		return nil, 0, err
	}

	// Initialize balances for all active employees for current month
	now := time.Now()
	for _, cat := range created {
		if err := s.repo.CreateBalancesForAllEmployees(ctx, orgID, cat.ID, now.Year(), int(now.Month())); err != nil {
			s.log.Warn().Err(err).Str("category_id", cat.ID.String()).Msg("failed to initialize claim balances")
			// Continue with other categories even if one fails
		}
	}

	// Log audit entry
	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       fmt.Sprintf("claim_categories.imported_%d", len(created)),
			ResourceType: "claim_category",
		})
	}

	return created, len(created), nil
}

// ── Claim Methods ─────────────────────────────────────────────────────────────

type ListResult struct {
	Claims []ClaimWithDetails
	Meta   paginate.Meta
}

func (s *Service) ListClaims(ctx context.Context, orgID uuid.UUID, f ClaimFilters, role string, managerEmployeeID *uuid.UUID) (*ListResult, error) {
	// If managerEmployeeID is provided, filter to only show direct reports
	if managerEmployeeID != nil {
		f.ManagerEmployeeID = managerEmployeeID
	}

	limit := paginate.ClampLimit(f.Limit)
	f.Limit = limit + 1

	claims, err := s.repo.ListClaims(ctx, orgID, f)
	if err != nil {
		return nil, err
	}

	hasMore := len(claims) > limit
	if hasMore {
		claims = claims[:limit]
	}

	var nextCursor string
	if hasMore && len(claims) > 0 {
		last := claims[len(claims)-1]
		nextCursor = paginate.Encode(paginate.Cursor{Value: last.CreatedAt.Format("2006-01-02T15:04:05Z07:00"), ID: last.ID.String()})
	}

	return &ListResult{
		Claims: claims,
		Meta:   paginate.Meta{NextCursor: nextCursor, HasMore: hasMore, Limit: limit},
	}, nil
}

func (s *Service) GetClaim(ctx context.Context, orgID, id uuid.UUID) (*Claim, error) {
	return s.repo.GetClaim(ctx, orgID, id)
}

func (s *Service) VerifyManagerRelationship(ctx context.Context, orgID, employeeID, managerEmployeeID uuid.UUID) error {
	return s.employeeRepo.VerifyManagerRelationship(ctx, orgID, employeeID, managerEmployeeID)
}

func (s *Service) SubmitClaim(ctx context.Context, orgID, employeeID uuid.UUID, req SubmitClaimRequest, receiptURL *string, actorUserID ...uuid.UUID) (*Claim, error) {
	// 1. Validate amount is positive
	if req.Amount <= 0 {
		return nil, ErrInvalidAmount()
	}

	// 2. Validate claim date is not in the future
	if req.ClaimDate.After(time.Now()) {
		return nil, ErrFutureDate()
	}

	// 3. Validate category exists and is active
	category, err := s.repo.GetCategory(ctx, orgID, req.CategoryID)
	if err != nil {
		if apperr.IsCode(err, apperr.CodeNotFound) {
			return nil, ErrCategoryNotFound()
		}
		return nil, err
	}
	if !category.IsActive {
		return nil, ErrCategoryInactive(category.Name)
	}

	// 4. Validate currency matches category
	if req.CurrencyCode != category.CurrencyCode {
		return nil, ErrCurrencyMismatch(category.Name, category.CurrencyCode, req.CurrencyCode)
	}

	// 5. Validate receipt requirement
	if category.RequiresReceipt && receiptURL == nil {
		return nil, ErrReceiptRequired(category.Name)
	}

	// 6. Check monthly budget limit (if category has one and is not unlimited)
	if category.MonthlyLimit != nil && !category.IsUnlimited {
		year := req.ClaimDate.Year()
		month := int(req.ClaimDate.Month())

		balance, err := s.repo.GetOrCreateBalance(ctx, orgID, employeeID, req.CategoryID, year, month)
		if err != nil {
			return nil, fmt.Errorf("failed to retrieve balance: %w", err)
		}

		// Calculate remaining budget
		remaining := *category.MonthlyLimit - balance.TotalSpent

		// Check if this claim would exceed the limit
		if req.Amount > remaining {
			return nil, ErrInsufficientBudget(
				category.Name,
				*category.MonthlyLimit,
				balance.TotalSpent,
				remaining,
				req.Amount,
				req.CurrencyCode,
			)
		}
	}

	// 7. Create the claim
	claim, err := s.repo.CreateClaim(ctx, orgID, req, employeeID, receiptURL)
	if err != nil {
		s.log.Error().Err(err).Str("org_id", orgID.String()).Str("employee_id", employeeID.String()).Msg("failed to create claim")
		return nil, fmt.Errorf("failed to create claim: %w", err)
	}

	// 8. Log audit trail
	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "claim.submitted",
			ResourceType: "claim",
			ResourceID:   claim.ID,
			AfterState:   claim,
		})
	}

	// 9. Log business event
	s.log.Info().
		Str("org_id", orgID.String()).
		Str("claim_id", claim.ID.String()).
		Str("employee_id", employeeID.String()).
		Str("category_id", claim.CategoryID.String()).
		Int64("amount", claim.Amount).
		Str("currency", claim.CurrencyCode).
		Bool("has_receipt", receiptURL != nil).
		Msg("claim.submitted")

	// 10. Send email notification to manager (best effort - don't fail if email fails)
	if s.email != nil {
		go s.sendClaimPendingEmail(context.Background(), orgID, employeeID, claim.ID, category.Name, claim.Amount, claim.CurrencyCode, claim.ClaimDate, &claim.Description)
	}

	// 11. Create approval task (best effort)
	if s.tasksService != nil {
		go s.createClaimApprovalTask(context.Background(), orgID, employeeID, claim, category.Name)
	}

	return claim, nil
}

// createClaimApprovalTask creates an approval task for the claim
func (s *Service) createClaimApprovalTask(ctx context.Context, orgID, employeeID uuid.UUID, claim *Claim, categoryName string) {
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

	// Determine title based on category
	amountStr := formatMoney(claim.Amount, claim.CurrencyCode)
	title := fmt.Sprintf("Approve Claim: %s — %s (%s)", employeeName, categoryName, amountStr)
	description := fmt.Sprintf("Claim submitted on %s\nCategory: %s\nAmount: %s\nDescription: %s",
		claim.ClaimDate.Format("2006-01-02"),
		categoryName,
		amountStr,
		claim.Description)

	err = s.tasksService.CreateApprovalTask(ctx, orgID, "claim", claim.ID, title, description, *managerID, &dueDate)
	if err != nil {
		s.log.Warn().Err(err).
			Str("org_id", orgID.String()).
			Str("claim_id", claim.ID.String()).
			Msg("failed to create claim approval task")
	}
}

// formatMoney formats a money amount with currency
func formatMoney(amount int64, currencyCode string) string {
	// Convert smallest unit to decimal
	decimal := float64(amount) / 100.0
	return fmt.Sprintf("%s %.2f", currencyCode, decimal)
}

func (s *Service) ApproveClaim(ctx context.Context, orgID, reviewerEmployeeID, claimID uuid.UUID, req *ApproveClaimRequest, actorUserID ...uuid.UUID) (*Claim, error) {
	var reviewNote *string
	if req != nil {
		reviewNote = req.ReviewNote
	}

	// Update status to approved
	approvedClaim, err := s.repo.UpdateStatus(ctx, orgID, claimID, approval.StatusPending, approval.StatusApproved, &reviewerEmployeeID, reviewNote)
	if err != nil {
		return nil, err
	}

	// Update balance - ensure balance exists and increment spent amount
	year := approvedClaim.ClaimDate.Year()
	month := int(approvedClaim.ClaimDate.Month())

	_, err = s.repo.GetOrCreateBalance(ctx, orgID, approvedClaim.EmployeeID, approvedClaim.CategoryID, year, month)
	if err != nil {
		// Log error but don't fail the approval
		s.log.Error().Err(err).Str("claim_id", claimID.String()).Msg("failed to get/create balance for approved claim")
	} else {
		err = s.repo.UpdateBalanceOnApproval(ctx, orgID, approvedClaim.EmployeeID, approvedClaim.CategoryID, year, month, approvedClaim.Amount)
		if err != nil {
			s.log.Error().Err(err).Str("claim_id", claimID.String()).Msg("failed to update balance for approved claim")
		}
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "claim.approved",
			ResourceType: "claim",
			ResourceID:   claimID,
			AfterState:   approvedClaim,
		})
	}

	// Log business event
	s.log.Info().
		Str("org_id", orgID.String()).
		Str("claim_id", claimID.String()).
		Str("reviewer_employee_id", reviewerEmployeeID.String()).
		Int64("amount", approvedClaim.Amount).
		Str("currency", approvedClaim.CurrencyCode).
		Msg("claim.approved")

	// Send email notification to employee (best effort - don't fail if email fails)
	if s.email != nil {
		go s.sendClaimApprovedEmail(context.Background(), orgID, approvedClaim.EmployeeID, reviewerEmployeeID, approvedClaim.ID, reviewNote)
	}

	// Complete approval task (best effort)
	if s.tasksService != nil {
		go func() {
			if err := s.tasksService.CompleteApprovalTask(context.Background(), "claim", claimID); err != nil {
				s.log.Warn().Err(err).Str("claim_id", claimID.String()).Msg("failed to complete approval task")
			}
		}()
	}

	return approvedClaim, nil
}

func (s *Service) RejectClaim(ctx context.Context, orgID, reviewerEmployeeID, claimID uuid.UUID, req RejectClaimRequest, actorUserID ...uuid.UUID) (*Claim, error) {
	claim, err := s.repo.UpdateStatus(ctx, orgID, claimID, approval.StatusPending, approval.StatusRejected, &reviewerEmployeeID, &req.ReviewNote)
	if err != nil {
		return nil, err
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "claim.rejected",
			ResourceType: "claim",
			ResourceID:   claimID,
			AfterState:   claim,
		})
	}

	// Log business event
	s.log.Info().
		Str("org_id", orgID.String()).
		Str("claim_id", claimID.String()).
		Str("reviewer_employee_id", reviewerEmployeeID.String()).
		Str("reason", req.ReviewNote).
		Msg("claim.rejected")

	// Send email notification to employee (best effort - don't fail if email fails)
	if s.email != nil {
		go s.sendClaimRejectedEmail(context.Background(), orgID, claim.EmployeeID, reviewerEmployeeID, claim.ID, &req.ReviewNote)
	}

	// Complete approval task (best effort)
	if s.tasksService != nil {
		go func() {
			if err := s.tasksService.CompleteApprovalTask(context.Background(), "claim", claimID); err != nil {
				s.log.Warn().Err(err).Str("claim_id", claimID.String()).Msg("failed to complete approval task")
			}
		}()
	}

	return claim, nil
}

func (s *Service) CancelClaim(ctx context.Context, orgID, employeeID, claimID uuid.UUID, actorUserID ...uuid.UUID) (*Claim, error) {
	// Verify claim belongs to employee
	claim, err := s.repo.GetClaim(ctx, orgID, claimID)
	if err != nil {
		return nil, err
	}
	if claim.EmployeeID != employeeID {
		return nil, apperr.New(apperr.CodeForbidden, "you can only cancel your own claims")
	}

	claim, err = s.repo.UpdateStatus(ctx, orgID, claimID, approval.StatusPending, approval.StatusCancelled, nil, nil)
	if err != nil {
		return nil, err
	}

	if len(actorUserID) > 0 {
		s.logAudit(ctx, audit.LogEntry{
			OrgID:        orgID,
			ActorUserID:  actorUserID[0],
			Action:       "claim.cancelled",
			ResourceType: "claim",
			ResourceID:   claimID,
			AfterState:   claim,
		})
	}

	// Delete approval task (best effort)
	if s.tasksService != nil {
		go func() {
			if err := s.tasksService.DeleteApprovalTask(context.Background(), "claim", claimID); err != nil {
				s.log.Warn().Err(err).Str("claim_id", claimID.String()).Msg("failed to delete approval task")
			}
		}()
	}

	return claim, nil
}

func (s *Service) GetMonthlySummary(ctx context.Context, orgID uuid.UUID, year, month int) ([]MonthlySummary, error) {
	return s.repo.GetMonthlySummary(ctx, orgID, year, month)
}

// ── Email Notification Helpers ────────────────────────────────────────────────

func (s *Service) sendClaimPendingEmail(ctx context.Context, orgID, employeeID, claimID uuid.UUID, categoryName string, amount int64, currencyCode string, claimDate time.Time, description *string) {
	// Get employee info
	empName, _, managerID, err := s.employeeRepo.GetEmployeeProfile(ctx, orgID, employeeID)
	if err != nil {
		s.log.Warn().Err(err).Str("employee_id", employeeID.String()).Msg("failed to get employee profile for email")
		return
	}

	// If no manager, skip email
	if managerID == nil {
		s.log.Debug().Str("employee_id", employeeID.String()).Msg("employee has no manager, skipping claim pending email")
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
		s.log.Debug().Str("manager_id", managerID.String()).Msg("manager has no email, skipping claim pending notification")
		return
	}

	// Format amount for display
	amountFormatted := fmt.Sprintf("%s %.2f", currencyCode, float64(amount)/100.0)

	// Render template
	subject, bodyHTML, _, err := email.ClaimPendingApprovalTemplate.Render(map[string]any{
		"ReviewerName":    managerName,
		"EmployeeName":    empName,
		"CategoryName":    categoryName,
		"AmountFormatted": amountFormatted,
		"ClaimDate":       claimDate.Format("2006-01-02"),
		"Description":     description,
		"AppURL":          s.appURL,
	})
	if err != nil {
		s.log.Error().Err(err).Msg("failed to render claim pending email template")
		return
	}

	// Send email
	if err := s.email.Send(email.Message{
		To:      []string{*managerEmail},
		Subject: subject,
		Body:    bodyHTML,
		IsHTML:  true,
	}); err != nil {
		s.log.Error().Err(err).Str("manager_email", *managerEmail).Msg("failed to send claim pending email")
		return
	}

	s.log.Info().Str("claim_id", claimID.String()).Str("manager_email", *managerEmail).Msg("claim pending email sent")
}

func (s *Service) sendClaimApprovedEmail(ctx context.Context, orgID, employeeID, reviewerEmployeeID, claimID uuid.UUID, reviewNote *string) {
	// Get claim details
	claim, err := s.repo.GetClaim(ctx, orgID, claimID)
	if err != nil {
		s.log.Warn().Err(err).Str("claim_id", claimID.String()).Msg("failed to get claim for approved email")
		return
	}

	// Get category name
	category, err := s.repo.GetCategory(ctx, orgID, claim.CategoryID)
	if err != nil {
		s.log.Warn().Err(err).Str("category_id", claim.CategoryID.String()).Msg("failed to get category for approved email")
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
		s.log.Debug().Str("employee_id", employeeID.String()).Msg("employee has no email, skipping claim approved notification")
		return
	}

	// Get reviewer name
	reviewerName, _, _, err := s.employeeRepo.GetEmployeeProfile(ctx, orgID, reviewerEmployeeID)
	if err != nil {
		s.log.Warn().Err(err).Str("reviewer_id", reviewerEmployeeID.String()).Msg("failed to get reviewer profile for approved email")
		reviewerName = "Manager" // fallback
	}

	// Format amount for display
	amountFormatted := fmt.Sprintf("%s %.2f", claim.CurrencyCode, float64(claim.Amount)/100.0)

	// Render template
	subject, bodyHTML, _, err := email.ClaimApprovedTemplate.Render(map[string]any{
		"EmployeeName":    empName,
		"ReviewerName":    reviewerName,
		"CategoryName":    category.Name,
		"AmountFormatted": amountFormatted,
		"ClaimDate":       claim.ClaimDate.Format("2006-01-02"),
		"ReviewNote":      reviewNote,
		"AppURL":          s.appURL,
	})
	if err != nil {
		s.log.Error().Err(err).Msg("failed to render claim approved email template")
		return
	}

	// Send email
	if err := s.email.Send(email.Message{
		To:      []string{*empEmail},
		Subject: subject,
		Body:    bodyHTML,
		IsHTML:  true,
	}); err != nil {
		s.log.Error().Err(err).Str("employee_email", *empEmail).Msg("failed to send claim approved email")
		return
	}

	s.log.Info().Str("claim_id", claimID.String()).Str("employee_email", *empEmail).Msg("claim approved email sent")
}

func (s *Service) sendClaimRejectedEmail(ctx context.Context, orgID, employeeID, reviewerEmployeeID, claimID uuid.UUID, reviewNote *string) {
	// Get claim details
	claim, err := s.repo.GetClaim(ctx, orgID, claimID)
	if err != nil {
		s.log.Warn().Err(err).Str("claim_id", claimID.String()).Msg("failed to get claim for rejected email")
		return
	}

	// Get category name
	category, err := s.repo.GetCategory(ctx, orgID, claim.CategoryID)
	if err != nil {
		s.log.Warn().Err(err).Str("category_id", claim.CategoryID.String()).Msg("failed to get category for rejected email")
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
		s.log.Debug().Str("employee_id", employeeID.String()).Msg("employee has no email, skipping claim rejected notification")
		return
	}

	// Get reviewer name
	reviewerName, _, _, err := s.employeeRepo.GetEmployeeProfile(ctx, orgID, reviewerEmployeeID)
	if err != nil {
		s.log.Warn().Err(err).Str("reviewer_id", reviewerEmployeeID.String()).Msg("failed to get reviewer profile for rejected email")
		reviewerName = "Manager" // fallback
	}

	// Format amount for display
	amountFormatted := fmt.Sprintf("%s %.2f", claim.CurrencyCode, float64(claim.Amount)/100.0)

	// Render template
	subject, bodyHTML, _, err := email.ClaimRejectedTemplate.Render(map[string]any{
		"EmployeeName":    empName,
		"ReviewerName":    reviewerName,
		"CategoryName":    category.Name,
		"AmountFormatted": amountFormatted,
		"ClaimDate":       claim.ClaimDate.Format("2006-01-02"),
		"ReviewNote":      reviewNote,
		"AppURL":          s.appURL,
	})
	if err != nil {
		s.log.Error().Err(err).Msg("failed to render claim rejected email template")
		return
	}

	// Send email
	if err := s.email.Send(email.Message{
		To:      []string{*empEmail},
		Subject: subject,
		Body:    bodyHTML,
		IsHTML:  true,
	}); err != nil {
		s.log.Error().Err(err).Str("employee_email", *empEmail).Msg("failed to send claim rejected email")
		return
	}

	s.log.Info().Str("claim_id", claimID.String()).Str("employee_email", *empEmail).Msg("claim rejected email sent")
}

// ── Balance Methods ───────────────────────────────────────────────────────────

// ensureEmployeeBalances creates balance rows for an employee if they don't exist yet
// for the given year/month. This is called lazily on first access.
func (s *Service) ensureEmployeeBalances(ctx context.Context, orgID, employeeID uuid.UUID, year, month int) error {
	categories, err := s.repo.ListCategories(ctx, orgID)
	if err != nil {
		return fmt.Errorf("list categories for balance init: %w", err)
	}
	for _, cat := range categories {
		if _, err := s.repo.GetOrCreateBalance(ctx, orgID, employeeID, cat.ID, year, month); err != nil {
			return fmt.Errorf("ensure balance for category %s: %w", cat.Name, err)
		}
	}
	return nil
}

// ListBalances returns claim balances for an employee in a specific month.
func (s *Service) ListBalances(ctx context.Context, orgID, employeeID uuid.UUID, year, month int) ([]ClaimBalanceWithCategory, error) {
	// Ensure balances exist for this employee for the requested year/month
	if err := s.ensureEmployeeBalances(ctx, orgID, employeeID, year, month); err != nil {
		return nil, fmt.Errorf("ensure balances: %w", err)
	}
	return s.repo.ListBalancesByEmployee(ctx, orgID, employeeID, year, month)
}

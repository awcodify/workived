package claims

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/workived/services/internal/approval"
	"github.com/workived/services/internal/audit"
	"github.com/workived/services/pkg/apperr"
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

type ServiceOption func(*Service)

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
		log.Printf("audit log error: %v", err)
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
		log.Printf("warning: failed to initialize balances for category %s: %v", cat.ID, err)
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
			log.Printf("warning: failed to initialize balances for category %s: %v", cat.ID, err)
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

func (s *Service) ListClaims(ctx context.Context, orgID uuid.UUID, f ClaimFilters) (*ListResult, error) {
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

	// 6. Check monthly budget limit (if category has one)
	if category.MonthlyLimit != nil {
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
		log.Printf("ERROR creating claim: %v", err)
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

	return claim, nil
}

func (s *Service) ApproveClaim(ctx context.Context, orgID, reviewerEmployeeID, claimID uuid.UUID, req *ApproveClaimRequest, actorUserID ...uuid.UUID) (*Claim, error) {
	log.Printf("[ApproveClaim] START - orgID=%s, reviewerEmployeeID=%s, claimID=%s", orgID, reviewerEmployeeID, claimID)

	var reviewNote *string
	if req != nil {
		reviewNote = req.ReviewNote
	}

	// Update status to approved
	approvedClaim, err := s.repo.UpdateStatus(ctx, orgID, claimID, approval.StatusPending, approval.StatusApproved, &reviewerEmployeeID, reviewNote)
	if err != nil {
		log.Printf("[ApproveClaim] ERROR - UpdateStatus failed: %v", err)
		return nil, err
	}
	log.Printf("[ApproveClaim] SUCCESS - Claim %s approved by employee %s", claimID, reviewerEmployeeID)

	// Update balance - ensure balance exists and increment spent amount
	year := approvedClaim.ClaimDate.Year()
	month := int(approvedClaim.ClaimDate.Month())

	_, err = s.repo.GetOrCreateBalance(ctx, orgID, approvedClaim.EmployeeID, approvedClaim.CategoryID, year, month)
	if err != nil {
		// Log error but don't fail the approval
		log.Printf("failed to get/create balance for approved claim %s: %v", claimID, err)
	} else {
		err = s.repo.UpdateBalanceOnApproval(ctx, orgID, approvedClaim.EmployeeID, approvedClaim.CategoryID, year, month, approvedClaim.Amount)
		if err != nil {
			log.Printf("failed to update balance for approved claim %s: %v", claimID, err)
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

	return claim, nil
}

func (s *Service) GetMonthlySummary(ctx context.Context, orgID uuid.UUID, year, month int) ([]MonthlySummary, error) {
	return s.repo.GetMonthlySummary(ctx, orgID, year, month)
}

// ── Balance Methods ───────────────────────────────────────────────────────────

// ListBalances returns claim balances for an employee in a specific month.
func (s *Service) ListBalances(ctx context.Context, orgID, employeeID uuid.UUID, year, month int) ([]ClaimBalanceWithCategory, error) {
	return s.repo.ListBalancesByEmployee(ctx, orgID, employeeID, year, month)
}

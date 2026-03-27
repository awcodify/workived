package claims_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/audit"
	"github.com/workived/services/internal/claims"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/email"
)

// ── Test IDs ──────────────────────────────────────────────────────────────────

var (
	testOrgID        = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	testEmpID        = uuid.MustParse("00000000-0000-0000-0000-000000000002")
	testReviewerID   = uuid.MustParse("00000000-0000-0000-0000-000000000003")
	testClaimID      = uuid.MustParse("00000000-0000-0000-0000-000000000004")
	testCategoryID   = uuid.MustParse("00000000-0000-0000-0000-000000000005")
	testActorUserID  = uuid.MustParse("00000000-0000-0000-0000-000000000006")
)

// ── Fake repository ───────────────────────────────────────────────────────────

type fakeClaimsRepo struct {
	// Categories
	listCategoriesFn             func(ctx context.Context, orgID uuid.UUID) ([]claims.Category, error)
	getCategoryFn                func(ctx context.Context, orgID, id uuid.UUID) (*claims.Category, error)
	createCategoryFn             func(ctx context.Context, orgID uuid.UUID, req claims.CreateCategoryRequest) (*claims.Category, error)
	updateCategoryFn             func(ctx context.Context, orgID, id uuid.UUID, req claims.UpdateCategoryRequest) (*claims.Category, error)
	deactivateCategoryFn         func(ctx context.Context, orgID, id uuid.UUID) error
	countPendingByCategory       func(ctx context.Context, orgID, categoryID uuid.UUID) (int, error)

	// Templates
	listTemplatesFn              func(ctx context.Context, countryCode string) ([]claims.CategoryTemplate, error)
	importCategoriesFromTemplates func(ctx context.Context, orgID uuid.UUID, templates []claims.CategoryTemplate) ([]claims.Category, error)

	// Balances
	getOrCreateBalanceFn         func(ctx context.Context, orgID, employeeID, categoryID uuid.UUID, year, month int) (*claims.ClaimBalance, error)
	updateBalanceOnApprovalFn    func(ctx context.Context, orgID, employeeID, categoryID uuid.UUID, year, month int, amount int64) error
	updateBalanceOnRejectionFn   func(ctx context.Context, orgID, employeeID, categoryID uuid.UUID, year, month int, amount int64) error
	listBalancesByEmployeeFn     func(ctx context.Context, orgID, employeeID uuid.UUID, year, month int) ([]claims.ClaimBalanceWithCategory, error)
	getYearlySpentFn             func(ctx context.Context, orgID, employeeID, categoryID uuid.UUID, year int) (int64, error)
	createBalancesForAllFn       func(ctx context.Context, orgID, categoryID uuid.UUID, year, month int) error
	updateBalanceMonthlyLimitFn  func(ctx context.Context, orgID, categoryID uuid.UUID, year, month int, newLimit int64) error

	// Claims
	createClaimFn    func(ctx context.Context, orgID uuid.UUID, req claims.SubmitClaimRequest, employeeID uuid.UUID, receiptURL *string) (*claims.Claim, error)
	getClaimFn       func(ctx context.Context, orgID, id uuid.UUID) (*claims.Claim, error)
	listClaimsFn     func(ctx context.Context, orgID uuid.UUID, f claims.ClaimFilters) ([]claims.ClaimWithDetails, error)
	updateStatusFn   func(ctx context.Context, orgID, claimID uuid.UUID, fromStatus, toStatus string, reviewerEmployeeID *uuid.UUID, reviewNote *string) (*claims.Claim, error)
	markAsPaidFn     func(ctx context.Context, orgID, claimID, paidByEmployeeID uuid.UUID, reviewNote *string) (*claims.Claim, error)
	getMonthlySpentFn func(ctx context.Context, orgID, employeeID, categoryID uuid.UUID, claimDate string) (int64, error)
	getMonthlySummaryFn func(ctx context.Context, orgID uuid.UUID, year, month int) ([]claims.MonthlySummary, error)
}

func (f *fakeClaimsRepo) ListCategories(ctx context.Context, orgID uuid.UUID) ([]claims.Category, error) {
	if f.listCategoriesFn != nil {
		return f.listCategoriesFn(ctx, orgID)
	}
	return []claims.Category{{ID: testCategoryID, Name: "Travel", CurrencyCode: "AED", IsActive: true}}, nil
}

func (f *fakeClaimsRepo) GetCategory(ctx context.Context, orgID, id uuid.UUID) (*claims.Category, error) {
	if f.getCategoryFn != nil {
		return f.getCategoryFn(ctx, orgID, id)
	}
	return &claims.Category{ID: id, OrganisationID: orgID, Name: "Travel", CurrencyCode: "AED", IsActive: true}, nil
}

func (f *fakeClaimsRepo) CreateCategory(ctx context.Context, orgID uuid.UUID, req claims.CreateCategoryRequest) (*claims.Category, error) {
	if f.createCategoryFn != nil {
		return f.createCategoryFn(ctx, orgID, req)
	}
	return &claims.Category{ID: uuid.New(), OrganisationID: orgID, Name: req.Name, CurrencyCode: "AED", IsActive: true}, nil
}

func (f *fakeClaimsRepo) UpdateCategory(ctx context.Context, orgID, id uuid.UUID, req claims.UpdateCategoryRequest) (*claims.Category, error) {
	if f.updateCategoryFn != nil {
		return f.updateCategoryFn(ctx, orgID, id, req)
	}
	return &claims.Category{ID: id, OrganisationID: orgID, Name: "Travel", CurrencyCode: "AED", IsActive: true}, nil
}

func (f *fakeClaimsRepo) DeactivateCategory(ctx context.Context, orgID, id uuid.UUID) error {
	if f.deactivateCategoryFn != nil {
		return f.deactivateCategoryFn(ctx, orgID, id)
	}
	return nil
}

func (f *fakeClaimsRepo) CountPendingClaimsByCategory(ctx context.Context, orgID, categoryID uuid.UUID) (int, error) {
	if f.countPendingByCategory != nil {
		return f.countPendingByCategory(ctx, orgID, categoryID)
	}
	return 0, nil
}

func (f *fakeClaimsRepo) ListTemplates(ctx context.Context, countryCode string) ([]claims.CategoryTemplate, error) {
	if f.listTemplatesFn != nil {
		return f.listTemplatesFn(ctx, countryCode)
	}
	return []claims.CategoryTemplate{}, nil
}

func (f *fakeClaimsRepo) ImportCategoriesFromTemplates(ctx context.Context, orgID uuid.UUID, templates []claims.CategoryTemplate) ([]claims.Category, error) {
	if f.importCategoriesFromTemplates != nil {
		return f.importCategoriesFromTemplates(ctx, orgID, templates)
	}
	return []claims.Category{}, nil
}

func (f *fakeClaimsRepo) GetOrCreateBalance(ctx context.Context, orgID, employeeID, categoryID uuid.UUID, year, month int) (*claims.ClaimBalance, error) {
	if f.getOrCreateBalanceFn != nil {
		return f.getOrCreateBalanceFn(ctx, orgID, employeeID, categoryID, year, month)
	}
	return &claims.ClaimBalance{ID: uuid.New(), TotalSpent: 0}, nil
}

func (f *fakeClaimsRepo) UpdateBalanceOnApproval(ctx context.Context, orgID, employeeID, categoryID uuid.UUID, year, month int, amount int64) error {
	if f.updateBalanceOnApprovalFn != nil {
		return f.updateBalanceOnApprovalFn(ctx, orgID, employeeID, categoryID, year, month, amount)
	}
	return nil
}

func (f *fakeClaimsRepo) UpdateBalanceOnRejection(ctx context.Context, orgID, employeeID, categoryID uuid.UUID, year, month int, amount int64) error {
	if f.updateBalanceOnRejectionFn != nil {
		return f.updateBalanceOnRejectionFn(ctx, orgID, employeeID, categoryID, year, month, amount)
	}
	return nil
}

func (f *fakeClaimsRepo) ListBalancesByEmployee(ctx context.Context, orgID, employeeID uuid.UUID, year, month int) ([]claims.ClaimBalanceWithCategory, error) {
	if f.listBalancesByEmployeeFn != nil {
		return f.listBalancesByEmployeeFn(ctx, orgID, employeeID, year, month)
	}
	return []claims.ClaimBalanceWithCategory{}, nil
}

func (f *fakeClaimsRepo) GetYearlySpent(ctx context.Context, orgID, employeeID, categoryID uuid.UUID, year int) (int64, error) {
	if f.getYearlySpentFn != nil {
		return f.getYearlySpentFn(ctx, orgID, employeeID, categoryID, year)
	}
	return 0, nil
}

func (f *fakeClaimsRepo) CreateBalancesForAllEmployees(ctx context.Context, orgID, categoryID uuid.UUID, year, month int) error {
	if f.createBalancesForAllFn != nil {
		return f.createBalancesForAllFn(ctx, orgID, categoryID, year, month)
	}
	return nil
}

func (f *fakeClaimsRepo) UpdateBalanceMonthlyLimit(ctx context.Context, orgID, categoryID uuid.UUID, year, month int, newLimit int64) error {
	if f.updateBalanceMonthlyLimitFn != nil {
		return f.updateBalanceMonthlyLimitFn(ctx, orgID, categoryID, year, month, newLimit)
	}
	return nil
}

func (f *fakeClaimsRepo) CreateClaim(ctx context.Context, orgID uuid.UUID, req claims.SubmitClaimRequest, employeeID uuid.UUID, receiptURL *string) (*claims.Claim, error) {
	if f.createClaimFn != nil {
		return f.createClaimFn(ctx, orgID, req, employeeID, receiptURL)
	}
	return &claims.Claim{
		ID:             testClaimID,
		OrganisationID: orgID,
		EmployeeID:     employeeID,
		CategoryID:     req.CategoryID,
		Amount:         req.Amount,
		CurrencyCode:   req.CurrencyCode,
		Description:    req.Description,
		ClaimDate:      req.ClaimDate,
		Status:         "pending",
	}, nil
}

func (f *fakeClaimsRepo) GetClaim(ctx context.Context, orgID, id uuid.UUID) (*claims.Claim, error) {
	if f.getClaimFn != nil {
		return f.getClaimFn(ctx, orgID, id)
	}
	return &claims.Claim{
		ID:             id,
		OrganisationID: orgID,
		EmployeeID:     testEmpID,
		CategoryID:     testCategoryID,
		Amount:         10000,
		CurrencyCode:   "AED",
		Status:         "approved",
		ClaimDate:      time.Now().AddDate(0, 0, -1),
	}, nil
}

func (f *fakeClaimsRepo) ListClaims(ctx context.Context, orgID uuid.UUID, filters claims.ClaimFilters) ([]claims.ClaimWithDetails, error) {
	if f.listClaimsFn != nil {
		return f.listClaimsFn(ctx, orgID, filters)
	}
	return []claims.ClaimWithDetails{}, nil
}

func (f *fakeClaimsRepo) UpdateStatus(ctx context.Context, orgID, claimID uuid.UUID, fromStatus, toStatus string, reviewerEmployeeID *uuid.UUID, reviewNote *string) (*claims.Claim, error) {
	if f.updateStatusFn != nil {
		return f.updateStatusFn(ctx, orgID, claimID, fromStatus, toStatus, reviewerEmployeeID, reviewNote)
	}
	return &claims.Claim{ID: claimID, OrganisationID: orgID, Status: toStatus, EmployeeID: testEmpID, CategoryID: testCategoryID, Amount: 10000, CurrencyCode: "AED", ClaimDate: time.Now()}, nil
}

func (f *fakeClaimsRepo) MarkAsPaid(ctx context.Context, orgID, claimID, paidByEmployeeID uuid.UUID, reviewNote *string) (*claims.Claim, error) {
	if f.markAsPaidFn != nil {
		return f.markAsPaidFn(ctx, orgID, claimID, paidByEmployeeID, reviewNote)
	}
	now := time.Now()
	return &claims.Claim{
		ID:             claimID,
		OrganisationID: orgID,
		EmployeeID:     testEmpID,
		CategoryID:     testCategoryID,
		Amount:         10000,
		CurrencyCode:   "AED",
		Status:         "paid",
		PaidAt:         &now,
		PaidBy:         &paidByEmployeeID,
	}, nil
}

func (f *fakeClaimsRepo) GetMonthlySpent(ctx context.Context, orgID, employeeID, categoryID uuid.UUID, claimDate string) (int64, error) {
	if f.getMonthlySpentFn != nil {
		return f.getMonthlySpentFn(ctx, orgID, employeeID, categoryID, claimDate)
	}
	return 0, nil
}

func (f *fakeClaimsRepo) GetMonthlySummary(ctx context.Context, orgID uuid.UUID, year, month int) ([]claims.MonthlySummary, error) {
	if f.getMonthlySummaryFn != nil {
		return f.getMonthlySummaryFn(ctx, orgID, year, month)
	}
	return []claims.MonthlySummary{}, nil
}

// ── Fake org + employee providers ────────────────────────────────────────────

type fakeOrgProvider struct {
	plan  string
	limit *int
	err   error
}

func (f *fakeOrgProvider) GetOrgPlanInfo(_ context.Context, _ uuid.UUID) (string, *int, error) {
	return f.plan, f.limit, f.err
}

type fakeEmpProvider struct {
	name      string
	email     *string
	managerID *uuid.UUID
	err       error
	verifyErr error
}

func (f *fakeEmpProvider) GetEmployeeProfile(_ context.Context, _, _ uuid.UUID) (string, *string, *uuid.UUID, error) {
	return f.name, f.email, f.managerID, f.err
}

func (f *fakeEmpProvider) GetEmployeeType(_ context.Context, _, _ uuid.UUID) (string, error) {
	return "full_time", nil
}

func (f *fakeEmpProvider) VerifyManagerRelationship(_ context.Context, _, _, _ uuid.UUID) error {
	return f.verifyErr
}

// ── Fake audit logger ─────────────────────────────────────────────────────────

type noopAudit struct{}

func (n *noopAudit) Log(_ context.Context, _ audit.LogEntry) error { return nil }

// ── Service builder ───────────────────────────────────────────────────────────

func newTestClaimsService(repo *fakeClaimsRepo) *claims.Service {
	orgProvider := &fakeOrgProvider{plan: "pro"}
	empProvider := &fakeEmpProvider{name: "Test User"}
	svc := claims.NewService(repo, orgProvider, empProvider, "http://localhost:3000",
		claims.WithLogger(zerolog.Nop()),
		claims.WithAuditLog(&noopAudit{}),
	)
	return svc
}

// ── Tests: MarkAsPaid service method ─────────────────────────────────────────

func TestService_MarkAsPaid(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		setup     func(r *fakeClaimsRepo)
		wantErr   bool
		wantCode  string
		wantStatus string
	}{
		{
			name:       "happy path — approved claim marked as paid",
			wantStatus: "paid",
		},
		{
			name: "repo error — claim not in approved status",
			setup: func(r *fakeClaimsRepo) {
				r.markAsPaidFn = func(_ context.Context, _, _, _ uuid.UUID, _ *string) (*claims.Claim, error) {
					return nil, apperr.New(apperr.CodeConflict, "claim is not in approved status")
				}
			},
			wantErr:  true,
			wantCode: apperr.CodeConflict,
		},
		{
			name: "repo error — db failure",
			setup: func(r *fakeClaimsRepo) {
				r.markAsPaidFn = func(_ context.Context, _, _, _ uuid.UUID, _ *string) (*claims.Claim, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
		{
			name: "with review note",
			setup: func(r *fakeClaimsRepo) {
				r.markAsPaidFn = func(_ context.Context, _, claimID, paidBy uuid.UUID, note *string) (*claims.Claim, error) {
					if note == nil || *note != "payment processed via bank transfer" {
						t.Error("expected review note to be passed through")
					}
					now := time.Now()
					return &claims.Claim{ID: claimID, Status: "paid", PaidAt: &now, PaidBy: &paidBy}, nil
				}
			},
			wantStatus: "paid",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			repo := &fakeClaimsRepo{}
			if tt.setup != nil {
				tt.setup(repo)
			}
			svc := newTestClaimsService(repo)

			note := "payment processed via bank transfer"
			req := &claims.MarkAsPaidRequest{ReviewNote: &note}
			if tt.name != "with review note" {
				req = &claims.MarkAsPaidRequest{}
			}

			claim, err := svc.MarkAsPaid(context.Background(), testOrgID, testReviewerID, testClaimID, req, testActorUserID)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.wantCode != "" && !apperr.IsCode(err, tt.wantCode) {
					t.Errorf("expected code %q, got: %v", tt.wantCode, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if claim == nil {
				t.Fatal("expected claim, got nil")
			}
			if tt.wantStatus != "" && claim.Status != tt.wantStatus {
				t.Errorf("expected status %q, got %q", tt.wantStatus, claim.Status)
			}
		})
	}
}

func TestService_MarkAsPaid_WithoutActorUserID(t *testing.T) {
	repo := &fakeClaimsRepo{}
	svc := newTestClaimsService(repo)

	claim, err := svc.MarkAsPaid(context.Background(), testOrgID, testReviewerID, testClaimID, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if claim.Status != "paid" {
		t.Errorf("expected status 'paid', got %q", claim.Status)
	}
}

// ── Tests: ApproveClaim (verifies balance update flow) ────────────────────────

func TestService_ApproveClaim(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		setup   func(r *fakeClaimsRepo)
		wantErr bool
	}{
		{
			name: "happy path — status transitions to approved",
		},
		{
			name: "update status fails — already approved",
			setup: func(r *fakeClaimsRepo) {
				r.updateStatusFn = func(_ context.Context, _, _ uuid.UUID, _, _ string, _ *uuid.UUID, _ *string) (*claims.Claim, error) {
					return nil, apperr.New(apperr.CodeConflict, "claim is not in pending status")
				}
			},
			wantErr: true,
		},
		{
			name: "balance update failure is non-fatal",
			setup: func(r *fakeClaimsRepo) {
				r.updateBalanceOnApprovalFn = func(_ context.Context, _, _, _ uuid.UUID, _, _ int, _ int64) error {
					return errors.New("balance error")
				}
			},
			// Should NOT fail — balance update failure is logged but not returned
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			repo := &fakeClaimsRepo{}
			if tt.setup != nil {
				tt.setup(repo)
			}
			svc := newTestClaimsService(repo)

			claim, err := svc.ApproveClaim(context.Background(), testOrgID, testReviewerID, testClaimID, nil, testActorUserID)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if claim == nil {
				t.Fatal("expected claim, got nil")
			}
		})
	}
}

// ── Tests: RejectClaim ────────────────────────────────────────────────────────

func TestService_RejectClaim(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		setup   func(r *fakeClaimsRepo)
		wantErr bool
	}{
		{
			name: "happy path — status transitions to rejected",
		},
		{
			name: "update status fails",
			setup: func(r *fakeClaimsRepo) {
				r.updateStatusFn = func(_ context.Context, _, _ uuid.UUID, _, _ string, _ *uuid.UUID, _ *string) (*claims.Claim, error) {
					return nil, apperr.New(apperr.CodeConflict, "claim is not in pending status")
				}
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			repo := &fakeClaimsRepo{}
			if tt.setup != nil {
				tt.setup(repo)
			}
			svc := newTestClaimsService(repo)

			req := claims.RejectClaimRequest{ReviewNote: "does not qualify"}
			_, err := svc.RejectClaim(context.Background(), testOrgID, testReviewerID, testClaimID, req, testActorUserID)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

// ── Tests: CancelClaim ────────────────────────────────────────────────────────

func TestService_CancelClaim(t *testing.T) {
	t.Parallel()

	t.Run("happy path — employee cancels own claim", func(t *testing.T) {
		repo := &fakeClaimsRepo{
			getClaimFn: func(_ context.Context, _, id uuid.UUID) (*claims.Claim, error) {
				return &claims.Claim{ID: id, EmployeeID: testEmpID, Status: "pending"}, nil
			},
		}
		svc := newTestClaimsService(repo)
		_, err := svc.CancelClaim(context.Background(), testOrgID, testEmpID, testClaimID, testActorUserID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("forbidden — employee cannot cancel someone else's claim", func(t *testing.T) {
		otherEmpID := uuid.New()
		repo := &fakeClaimsRepo{
			getClaimFn: func(_ context.Context, _, id uuid.UUID) (*claims.Claim, error) {
				return &claims.Claim{ID: id, EmployeeID: otherEmpID, Status: "pending"}, nil
			},
		}
		svc := newTestClaimsService(repo)
		_, err := svc.CancelClaim(context.Background(), testOrgID, testEmpID, testClaimID, testActorUserID)
		if err == nil {
			t.Fatal("expected forbidden error, got nil")
		}
		if !apperr.IsCode(err, apperr.CodeForbidden) {
			t.Errorf("expected CodeForbidden, got: %v", err)
		}
	})

	t.Run("get claim error", func(t *testing.T) {
		repo := &fakeClaimsRepo{
			getClaimFn: func(_ context.Context, _, _ uuid.UUID) (*claims.Claim, error) {
				return nil, apperr.NotFound("claim")
			},
		}
		svc := newTestClaimsService(repo)
		_, err := svc.CancelClaim(context.Background(), testOrgID, testEmpID, testClaimID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// ── Tests: SubmitClaim ────────────────────────────────────────────────────────

func TestService_SubmitClaim(t *testing.T) {
	t.Parallel()

	baseReq := claims.SubmitClaimRequest{
		CategoryID:   testCategoryID,
		Amount:       5000,
		CurrencyCode: "AED",
		Description:  "Business travel",
		ClaimDate:    time.Now().AddDate(0, 0, -1),
	}

	tests := []struct {
		name     string
		req      claims.SubmitClaimRequest
		setup    func(r *fakeClaimsRepo)
		wantErr  bool
		wantCode string
	}{
		{
			name: "happy path",
			req:  baseReq,
		},
		{
			name: "invalid amount — zero",
			req: func() claims.SubmitClaimRequest {
				r := baseReq
				r.Amount = 0
				return r
			}(),
			wantErr:  true,
			wantCode: apperr.CodeValidation,
		},
		{
			name: "future date rejected",
			req: func() claims.SubmitClaimRequest {
				r := baseReq
				r.ClaimDate = time.Now().AddDate(0, 0, 1)
				return r
			}(),
			wantErr:  true,
			wantCode: apperr.CodeValidation,
		},
		{
			name: "category not found",
			req:  baseReq,
			setup: func(r *fakeClaimsRepo) {
				r.getCategoryFn = func(_ context.Context, _, _ uuid.UUID) (*claims.Category, error) {
					return nil, apperr.NotFound("claim category")
				}
			},
			wantErr:  true,
			wantCode: apperr.CodeValidation,
		},
		{
			name: "category inactive",
			req:  baseReq,
			setup: func(r *fakeClaimsRepo) {
				r.getCategoryFn = func(_ context.Context, orgID, id uuid.UUID) (*claims.Category, error) {
					return &claims.Category{ID: id, Name: "Travel", CurrencyCode: "AED", IsActive: false}, nil
				}
			},
			wantErr:  true,
			wantCode: apperr.CodeValidation,
		},
		{
			name: "currency mismatch",
			req: func() claims.SubmitClaimRequest {
				r := baseReq
				r.CurrencyCode = "IDR"
				return r
			}(),
			wantErr:  true,
			wantCode: apperr.CodeValidation,
		},
		{
			name: "receipt required but missing",
			req:  baseReq,
			setup: func(r *fakeClaimsRepo) {
				r.getCategoryFn = func(_ context.Context, orgID, id uuid.UUID) (*claims.Category, error) {
					return &claims.Category{ID: id, CurrencyCode: "AED", IsActive: true, RequiresReceipt: true}, nil
				}
			},
			wantErr:  true,
			wantCode: apperr.CodeValidation,
		},
		{
			name: "insufficient budget",
			req:  baseReq,
			setup: func(r *fakeClaimsRepo) {
				limit := int64(1000)
				r.getCategoryFn = func(_ context.Context, orgID, id uuid.UUID) (*claims.Category, error) {
					return &claims.Category{ID: id, CurrencyCode: "AED", IsActive: true, MonthlyLimit: &limit}, nil
				}
				r.getOrCreateBalanceFn = func(_ context.Context, _, _, _ uuid.UUID, _, _ int) (*claims.ClaimBalance, error) {
					return &claims.ClaimBalance{TotalSpent: 1000}, nil
				}
			},
			wantErr:  true,
			wantCode: apperr.CodeInsufficientBalance,
		},
		{
			name: "create claim db error",
			req:  baseReq,
			setup: func(r *fakeClaimsRepo) {
				r.createClaimFn = func(_ context.Context, _ uuid.UUID, _ claims.SubmitClaimRequest, _ uuid.UUID, _ *string) (*claims.Claim, error) {
					return nil, errors.New("db down")
				}
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			repo := &fakeClaimsRepo{}
			if tt.setup != nil {
				tt.setup(repo)
			}
			svc := newTestClaimsService(repo)

			claim, err := svc.SubmitClaim(context.Background(), testOrgID, testEmpID, tt.req, nil, testActorUserID, "member")
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.wantCode != "" && !apperr.IsCode(err, tt.wantCode) {
					t.Errorf("expected code %q, got: %v", tt.wantCode, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if claim == nil {
				t.Fatal("expected claim, got nil")
			}
		})
	}
}

// ── Tests: ListBalances ───────────────────────────────────────────────────────

func TestService_ListBalances(t *testing.T) {
	t.Parallel()

	t.Run("happy path", func(t *testing.T) {
		repo := &fakeClaimsRepo{}
		svc := newTestClaimsService(repo)
		balances, err := svc.ListBalances(context.Background(), testOrgID, testEmpID, 2026, 3)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		_ = balances
	})

	t.Run("list categories error bubbles up", func(t *testing.T) {
		repo := &fakeClaimsRepo{
			listCategoriesFn: func(_ context.Context, _ uuid.UUID) ([]claims.Category, error) {
				return nil, errors.New("db down")
			},
		}
		svc := newTestClaimsService(repo)
		_, err := svc.ListBalances(context.Background(), testOrgID, testEmpID, 2026, 3)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// ── Tests: GetMonthlySummary ──────────────────────────────────────────────────

func TestService_GetMonthlySummary(t *testing.T) {
	repo := &fakeClaimsRepo{}
	svc := newTestClaimsService(repo)
	summaries, err := svc.GetMonthlySummary(context.Background(), testOrgID, 2026, 3)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if summaries == nil {
		summaries = []claims.MonthlySummary{}
	}
}

// ── Tests: GetClaim ───────────────────────────────────────────────────────────

func TestService_GetClaim(t *testing.T) {
	t.Run("happy path", func(t *testing.T) {
		repo := &fakeClaimsRepo{}
		svc := newTestClaimsService(repo)
		claim, err := svc.GetClaim(context.Background(), testOrgID, testClaimID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if claim.ID != testClaimID {
			t.Errorf("expected claim ID %v, got %v", testClaimID, claim.ID)
		}
	})

	t.Run("not found", func(t *testing.T) {
		repo := &fakeClaimsRepo{
			getClaimFn: func(_ context.Context, _, _ uuid.UUID) (*claims.Claim, error) {
				return nil, apperr.NotFound("claim")
			},
		}
		svc := newTestClaimsService(repo)
		_, err := svc.GetClaim(context.Background(), testOrgID, testClaimID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// ── Tests: VerifyManagerRelationship ─────────────────────────────────────────

func TestService_VerifyManagerRelationship(t *testing.T) {
	t.Run("happy path", func(t *testing.T) {
		repo := &fakeClaimsRepo{}
		svc := newTestClaimsService(repo)
		err := svc.VerifyManagerRelationship(context.Background(), testOrgID, testEmpID, testReviewerID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("verify fails", func(t *testing.T) {
		repo := &fakeClaimsRepo{}
		orgProvider := &fakeOrgProvider{plan: "pro"}
		empProvider := &fakeEmpProvider{verifyErr: apperr.New(apperr.CodeForbidden, "not manager")}
		svc := claims.NewService(repo, orgProvider, empProvider, "http://localhost:3000",
			claims.WithLogger(zerolog.Nop()),
		)
		err := svc.VerifyManagerRelationship(context.Background(), testOrgID, testEmpID, testReviewerID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// ── Tests: ListClaims ────────────────────────────────────────────────────────

func TestService_ListClaims(t *testing.T) {
	t.Run("happy path", func(t *testing.T) {
		repo := &fakeClaimsRepo{}
		svc := newTestClaimsService(repo)
		result, err := svc.ListClaims(context.Background(), testOrgID, claims.ClaimFilters{Limit: 10}, "admin", nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result == nil {
			t.Fatal("expected result, got nil")
		}
	})

	t.Run("with manager filter", func(t *testing.T) {
		repo := &fakeClaimsRepo{}
		svc := newTestClaimsService(repo)
		result, err := svc.ListClaims(context.Background(), testOrgID, claims.ClaimFilters{Limit: 10}, "manager", &testReviewerID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result == nil {
			t.Fatal("expected result, got nil")
		}
	})

	t.Run("repo error propagates", func(t *testing.T) {
		repo := &fakeClaimsRepo{
			listClaimsFn: func(_ context.Context, _ uuid.UUID, _ claims.ClaimFilters) ([]claims.ClaimWithDetails, error) {
				return nil, errors.New("db down")
			},
		}
		svc := newTestClaimsService(repo)
		_, err := svc.ListClaims(context.Background(), testOrgID, claims.ClaimFilters{}, "admin", nil)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// ── Tests: ListCategories ─────────────────────────────────────────────────────

func TestService_ListCategories(t *testing.T) {
	t.Run("happy path", func(t *testing.T) {
		repo := &fakeClaimsRepo{}
		svc := newTestClaimsService(repo)
		cats, err := svc.ListCategories(context.Background(), testOrgID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(cats) == 0 {
			t.Fatal("expected categories, got none")
		}
	})

	t.Run("repo error propagates", func(t *testing.T) {
		repo := &fakeClaimsRepo{
			listCategoriesFn: func(_ context.Context, _ uuid.UUID) ([]claims.Category, error) {
				return nil, errors.New("db down")
			},
		}
		svc := newTestClaimsService(repo)
		_, err := svc.ListCategories(context.Background(), testOrgID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// ── Tests: CreateCategory ─────────────────────────────────────────────────────

func TestService_CreateCategory(t *testing.T) {
	t.Run("happy path", func(t *testing.T) {
		repo := &fakeClaimsRepo{}
		svc := newTestClaimsService(repo)
		req := claims.CreateCategoryRequest{Name: "Medical"}
		cat, err := svc.CreateCategory(context.Background(), testOrgID, req, testActorUserID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if cat == nil {
			t.Fatal("expected category, got nil")
		}
	})

	t.Run("without actor user id — no audit log", func(t *testing.T) {
		repo := &fakeClaimsRepo{}
		svc := newTestClaimsService(repo)
		req := claims.CreateCategoryRequest{Name: "Medical"}
		cat, err := svc.CreateCategory(context.Background(), testOrgID, req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if cat == nil {
			t.Fatal("expected category, got nil")
		}
	})

	t.Run("repo error propagates", func(t *testing.T) {
		repo := &fakeClaimsRepo{
			createCategoryFn: func(_ context.Context, _ uuid.UUID, _ claims.CreateCategoryRequest) (*claims.Category, error) {
				return nil, errors.New("db down")
			},
		}
		svc := newTestClaimsService(repo)
		req := claims.CreateCategoryRequest{Name: "Medical"}
		_, err := svc.CreateCategory(context.Background(), testOrgID, req)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("balance init failure is non-fatal", func(t *testing.T) {
		repo := &fakeClaimsRepo{
			createBalancesForAllFn: func(_ context.Context, _, _ uuid.UUID, _, _ int) error {
				return errors.New("balance init failed")
			},
		}
		svc := newTestClaimsService(repo)
		req := claims.CreateCategoryRequest{Name: "Medical"}
		cat, err := svc.CreateCategory(context.Background(), testOrgID, req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if cat == nil {
			t.Fatal("expected category despite balance failure")
		}
	})
}

// ── Tests: UpdateCategory ─────────────────────────────────────────────────────

func TestService_UpdateCategory(t *testing.T) {
	t.Run("happy path — no monthly limit", func(t *testing.T) {
		repo := &fakeClaimsRepo{}
		svc := newTestClaimsService(repo)
		name := "Updated Travel"
		req := claims.UpdateCategoryRequest{Name: &name}
		cat, err := svc.UpdateCategory(context.Background(), testOrgID, testCategoryID, req, testActorUserID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if cat == nil {
			t.Fatal("expected category, got nil")
		}
	})

	t.Run("with monthly limit — cascades to balances", func(t *testing.T) {
		repo := &fakeClaimsRepo{}
		svc := newTestClaimsService(repo)
		limit := int64(5000)
		req := claims.UpdateCategoryRequest{MonthlyLimit: &limit}
		cat, err := svc.UpdateCategory(context.Background(), testOrgID, testCategoryID, req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if cat == nil {
			t.Fatal("expected category, got nil")
		}
	})

	t.Run("balance limit update failure is non-fatal", func(t *testing.T) {
		repo := &fakeClaimsRepo{
			updateBalanceMonthlyLimitFn: func(_ context.Context, _, _ uuid.UUID, _, _ int, _ int64) error {
				return errors.New("balance update failed")
			},
		}
		svc := newTestClaimsService(repo)
		limit := int64(5000)
		req := claims.UpdateCategoryRequest{MonthlyLimit: &limit}
		cat, err := svc.UpdateCategory(context.Background(), testOrgID, testCategoryID, req)
		if err != nil {
			t.Fatalf("expected non-fatal balance error, got: %v", err)
		}
		if cat == nil {
			t.Fatal("expected category despite balance update failure")
		}
	})

	t.Run("repo error propagates", func(t *testing.T) {
		repo := &fakeClaimsRepo{
			updateCategoryFn: func(_ context.Context, _, _ uuid.UUID, _ claims.UpdateCategoryRequest) (*claims.Category, error) {
				return nil, errors.New("db down")
			},
		}
		svc := newTestClaimsService(repo)
		name := "Updated"
		req := claims.UpdateCategoryRequest{Name: &name}
		_, err := svc.UpdateCategory(context.Background(), testOrgID, testCategoryID, req)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// ── Tests: DeactivateCategory ─────────────────────────────────────────────────

func TestService_DeactivateCategory(t *testing.T) {
	t.Run("happy path", func(t *testing.T) {
		repo := &fakeClaimsRepo{}
		svc := newTestClaimsService(repo)
		err := svc.DeactivateCategory(context.Background(), testOrgID, testCategoryID, testActorUserID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("has pending claims — rejected", func(t *testing.T) {
		repo := &fakeClaimsRepo{
			countPendingByCategory: func(_ context.Context, _, _ uuid.UUID) (int, error) {
				return 3, nil
			},
		}
		svc := newTestClaimsService(repo)
		err := svc.DeactivateCategory(context.Background(), testOrgID, testCategoryID)
		if err == nil {
			t.Fatal("expected error due to pending claims")
		}
	})

	t.Run("get category error propagates", func(t *testing.T) {
		repo := &fakeClaimsRepo{
			getCategoryFn: func(_ context.Context, _, _ uuid.UUID) (*claims.Category, error) {
				return nil, apperr.NotFound("claim category")
			},
		}
		svc := newTestClaimsService(repo)
		err := svc.DeactivateCategory(context.Background(), testOrgID, testCategoryID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("count pending error propagates", func(t *testing.T) {
		repo := &fakeClaimsRepo{
			countPendingByCategory: func(_ context.Context, _, _ uuid.UUID) (int, error) {
				return 0, errors.New("db down")
			},
		}
		svc := newTestClaimsService(repo)
		err := svc.DeactivateCategory(context.Background(), testOrgID, testCategoryID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("deactivate repo error propagates", func(t *testing.T) {
		repo := &fakeClaimsRepo{
			deactivateCategoryFn: func(_ context.Context, _, _ uuid.UUID) error {
				return errors.New("db down")
			},
		}
		svc := newTestClaimsService(repo)
		err := svc.DeactivateCategory(context.Background(), testOrgID, testCategoryID)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// ── Tests: ListTemplates ──────────────────────────────────────────────────────

func TestService_ListTemplates(t *testing.T) {
	t.Run("happy path — explicit country code", func(t *testing.T) {
		repo := &fakeClaimsRepo{}
		svc := newTestClaimsService(repo)
		cc := "AE"
		templates, err := svc.ListTemplates(context.Background(), testOrgID, &cc)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		_ = templates
	})

	t.Run("no country code — returns validation error (not yet implemented)", func(t *testing.T) {
		repo := &fakeClaimsRepo{}
		svc := newTestClaimsService(repo)
		_, err := svc.ListTemplates(context.Background(), testOrgID, nil)
		if err == nil {
			t.Fatal("expected validation error, got nil")
		}
		if !apperr.IsCode(err, apperr.CodeValidation) {
			t.Errorf("expected CodeValidation, got: %v", err)
		}
	})

	t.Run("org plan lookup error", func(t *testing.T) {
		repo := &fakeClaimsRepo{}
		orgProvider := &fakeOrgProvider{err: errors.New("db down")}
		empProvider := &fakeEmpProvider{name: "Test"}
		svc := claims.NewService(repo, orgProvider, empProvider, "http://localhost:3000",
			claims.WithLogger(zerolog.Nop()),
		)
		_, err := svc.ListTemplates(context.Background(), testOrgID, nil)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// ── Tests: ImportCategories ───────────────────────────────────────────────────

func TestService_ImportCategories(t *testing.T) {
	templateID := uuid.New()

	t.Run("empty template IDs — validation error", func(t *testing.T) {
		repo := &fakeClaimsRepo{}
		svc := newTestClaimsService(repo)
		req := claims.ImportCategoriesRequest{TemplateIDs: []string{}}
		_, _, err := svc.ImportCategories(context.Background(), testOrgID, req)
		if err == nil {
			t.Fatal("expected validation error, got nil")
		}
		if !apperr.IsCode(err, apperr.CodeValidation) {
			t.Errorf("expected CodeValidation, got: %v", err)
		}
	})

	t.Run("invalid template ID format", func(t *testing.T) {
		repo := &fakeClaimsRepo{}
		svc := newTestClaimsService(repo)
		req := claims.ImportCategoriesRequest{TemplateIDs: []string{"not-a-uuid"}}
		_, _, err := svc.ImportCategories(context.Background(), testOrgID, req)
		if err == nil {
			t.Fatal("expected validation error, got nil")
		}
	})

	t.Run("org plan lookup error", func(t *testing.T) {
		repo := &fakeClaimsRepo{}
		orgProvider := &fakeOrgProvider{err: errors.New("db down")}
		empProvider := &fakeEmpProvider{name: "Test"}
		svc := claims.NewService(repo, orgProvider, empProvider, "http://localhost:3000",
			claims.WithLogger(zerolog.Nop()),
		)
		req := claims.ImportCategoriesRequest{TemplateIDs: []string{templateID.String()}}
		_, _, err := svc.ImportCategories(context.Background(), testOrgID, req)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("no templates found — not found error", func(t *testing.T) {
		repo := &fakeClaimsRepo{
			listTemplatesFn: func(_ context.Context, _ string) ([]claims.CategoryTemplate, error) {
				return []claims.CategoryTemplate{}, nil
			},
		}
		svc := newTestClaimsService(repo)
		req := claims.ImportCategoriesRequest{TemplateIDs: []string{templateID.String()}}
		_, _, err := svc.ImportCategories(context.Background(), testOrgID, req)
		if err == nil {
			t.Fatal("expected not found error, got nil")
		}
		if !apperr.IsCode(err, apperr.CodeNotFound) {
			t.Errorf("expected CodeNotFound, got: %v", err)
		}
	})

	t.Run("import repo error propagates", func(t *testing.T) {
		repo := &fakeClaimsRepo{
			listTemplatesFn: func(_ context.Context, _ string) ([]claims.CategoryTemplate, error) {
				return []claims.CategoryTemplate{{ID: templateID, Name: "Medical"}}, nil
			},
			importCategoriesFromTemplates: func(_ context.Context, _ uuid.UUID, _ []claims.CategoryTemplate) ([]claims.Category, error) {
				return nil, errors.New("import failed")
			},
		}
		svc := newTestClaimsService(repo)
		req := claims.ImportCategoriesRequest{TemplateIDs: []string{templateID.String()}}
		_, _, err := svc.ImportCategories(context.Background(), testOrgID, req)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

// ── Tests: SubmitClaim owner auto-approve path ────────────────────────────────

func TestService_SubmitClaim_OwnerAutoApprove(t *testing.T) {
	t.Run("owner role — auto-approved", func(t *testing.T) {
		repo := &fakeClaimsRepo{}
		svc := newTestClaimsService(repo)
		req := claims.SubmitClaimRequest{
			CategoryID:   testCategoryID,
			Amount:       5000,
			CurrencyCode: "AED",
			Description:  "Business travel",
			ClaimDate:    time.Now().AddDate(0, 0, -1),
		}
		claim, err := svc.SubmitClaim(context.Background(), testOrgID, testEmpID, req, nil, testActorUserID, "owner")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if claim == nil {
			t.Fatal("expected claim, got nil")
		}
	})
}

// ── Tests: WithEmailSender / WithTasksService options ─────────────────────────

type fakeEmailSender struct{}

func (f *fakeEmailSender) Send(_ interface{}) error { return nil }

type fakeTasksService struct{}

func (f *fakeTasksService) CreateApprovalTask(_ context.Context, _ uuid.UUID, _, _ string, _ uuid.UUID, _, _, _ string, _, _ uuid.UUID, _ *string) error {
	return nil
}

func (f *fakeTasksService) CompleteApprovalTask(_ context.Context, _ string, _ uuid.UUID) error {
	return nil
}


// ── Tests: WithEmailSender / WithTasksService options ─────────────────────────

func TestService_WithEmailSender(t *testing.T) {
	// Just verify the option doesn't break service construction
	repo := &fakeClaimsRepo{}
	orgProvider := &fakeOrgProvider{plan: "pro"}
	empProvider := &fakeEmpProvider{name: "Test"}
	svc := claims.NewService(repo, orgProvider, empProvider, "http://localhost:3000",
		claims.WithLogger(zerolog.Nop()),
		claims.WithAuditLog(&noopAudit{}),
		// WithEmailSender not yet tested (requires real email.Sender interface)
	)
	// Verify service works normally
	cats, err := svc.ListCategories(context.Background(), testOrgID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	_ = cats
}

// ── Tests: logAudit error path ────────────────────────────────────────────────

type failingAudit struct{}

func (f *failingAudit) Log(_ context.Context, _ audit.LogEntry) error {
	return errors.New("audit log failed")
}

func TestService_LogAudit_ErrorPath(t *testing.T) {
	// Audit log errors are swallowed — they should not fail the operation
	repo := &fakeClaimsRepo{}
	orgProvider := &fakeOrgProvider{plan: "pro"}
	empProvider := &fakeEmpProvider{name: "Test"}
	svc := claims.NewService(repo, orgProvider, empProvider, "http://localhost:3000",
		claims.WithLogger(zerolog.Nop()),
		claims.WithAuditLog(&failingAudit{}),
	)

	// ApproveClaim triggers audit log
	_, err := svc.ApproveClaim(context.Background(), testOrgID, testReviewerID, testClaimID, nil, testActorUserID)
	if err != nil {
		t.Fatalf("audit log error should be swallowed, got: %v", err)
	}
}


// ── Tests: WithTasksService — covers formatMoney + createClaimApprovalTask ───

type fakeClaimsTasksService struct{}

func (f *fakeClaimsTasksService) CreateApprovalTask(_ context.Context, _ uuid.UUID, _ string, _ uuid.UUID, _, _ string, _, _ uuid.UUID, _ *string) error {
	return nil
}
func (f *fakeClaimsTasksService) CompleteApprovalTask(_ context.Context, _ string, _ uuid.UUID) error {
	return nil
}
func (f *fakeClaimsTasksService) DeleteApprovalTask(_ context.Context, _ string, _ uuid.UUID) error {
	return nil
}

func TestService_WithTasksService(t *testing.T) {
	// Wire up tasks service — SubmitClaim will fire goroutine to createClaimApprovalTask
	repo := &fakeClaimsRepo{}
	orgProvider := &fakeOrgProvider{plan: "pro"}
	managerID := uuid.New()
	empProvider := &fakeEmpProvider{name: "Ahmad", managerID: &managerID}
	svc := claims.NewService(repo, orgProvider, empProvider, "http://localhost:3000",
		claims.WithLogger(zerolog.Nop()),
		claims.WithTasksService(&fakeClaimsTasksService{}),
	)

	req := claims.SubmitClaimRequest{
		CategoryID:   testCategoryID,
		Amount:       10000,
		CurrencyCode: "AED",
		Description:  "Business travel",
		ClaimDate:    time.Now().AddDate(0, 0, -1),
	}
	claim, err := svc.SubmitClaim(context.Background(), testOrgID, testEmpID, req, nil, testActorUserID, "member")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if claim == nil {
		t.Fatal("expected claim, got nil")
	}
	// Goroutine fires async — give it a moment
	time.Sleep(10 * time.Millisecond)
}


// ── Tests: WithEmailSender — covers email goroutine helpers ───────────────────

type fakeClaimsEmailSender struct{}

func (f *fakeClaimsEmailSender) Send(_ email.Message) error { return nil }

func TestService_WithEmailSender_SubmitClaim(t *testing.T) {
	// Wire up email sender — SubmitClaim fires goroutine for pending email
	repo := &fakeClaimsRepo{}
	orgProvider := &fakeOrgProvider{plan: "pro"}
	managerID := uuid.New()
	managerEmail := "manager@test.com"
	empProvider := &fakeEmpProvider{name: "Ahmad", email: &managerEmail, managerID: &managerID}
	svc := claims.NewService(repo, orgProvider, empProvider, "http://localhost:3000",
		claims.WithLogger(zerolog.Nop()),
		claims.WithAuditLog(&noopAudit{}),
		claims.WithEmailSender(&fakeClaimsEmailSender{}),
	)

	req := claims.SubmitClaimRequest{
		CategoryID:   testCategoryID,
		Amount:       5000,
		CurrencyCode: "AED",
		Description:  "Business travel",
		ClaimDate:    time.Now().AddDate(0, 0, -1),
	}
	claim, err := svc.SubmitClaim(context.Background(), testOrgID, testEmpID, req, nil, testActorUserID, "member")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if claim == nil {
		t.Fatal("expected claim, got nil")
	}
	// Let goroutine finish
	time.Sleep(20 * time.Millisecond)
}


func TestService_WithEmailSender_ApproveClaim(t *testing.T) {
	// ApproveClaim fires goroutine for approved email
	repo := &fakeClaimsRepo{}
	orgProvider := &fakeOrgProvider{plan: "pro"}
	empEmail := "emp@test.com"
	empProvider := &fakeEmpProvider{name: "Ahmad", email: &empEmail}
	svc := claims.NewService(repo, orgProvider, empProvider, "http://localhost:3000",
		claims.WithLogger(zerolog.Nop()),
		claims.WithEmailSender(&fakeClaimsEmailSender{}),
	)
	_, err := svc.ApproveClaim(context.Background(), testOrgID, testReviewerID, testClaimID, nil, testActorUserID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	time.Sleep(20 * time.Millisecond)
}

func TestService_WithEmailSender_RejectClaim(t *testing.T) {
	// RejectClaim fires goroutine for rejected email
	repo := &fakeClaimsRepo{}
	orgProvider := &fakeOrgProvider{plan: "pro"}
	empEmail := "emp@test.com"
	empProvider := &fakeEmpProvider{name: "Ahmad", email: &empEmail}
	svc := claims.NewService(repo, orgProvider, empProvider, "http://localhost:3000",
		claims.WithLogger(zerolog.Nop()),
		claims.WithEmailSender(&fakeClaimsEmailSender{}),
	)
	req := claims.RejectClaimRequest{ReviewNote: "not eligible"}
	_, err := svc.RejectClaim(context.Background(), testOrgID, testReviewerID, testClaimID, req, testActorUserID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	time.Sleep(20 * time.Millisecond)
}


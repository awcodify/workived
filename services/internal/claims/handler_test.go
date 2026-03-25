package claims_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/claims"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// ── Fake service for handler tests ────────────────────────────────────────────

type fakeHandlerService struct {
	listCategoriesFn     func(ctx context.Context, orgID uuid.UUID) ([]claims.Category, error)
	createCategoryFn     func(ctx context.Context, orgID uuid.UUID, req claims.CreateCategoryRequest, actorUserID ...uuid.UUID) (*claims.Category, error)
	updateCategoryFn     func(ctx context.Context, orgID, id uuid.UUID, req claims.UpdateCategoryRequest, actorUserID ...uuid.UUID) (*claims.Category, error)
	deactivateCategoryFn func(ctx context.Context, orgID, id uuid.UUID, actorUserID ...uuid.UUID) error
	listTemplatesFn      func(ctx context.Context, orgID uuid.UUID, countryCode *string) ([]claims.CategoryTemplate, error)
	importCategoriesFn   func(ctx context.Context, orgID uuid.UUID, req claims.ImportCategoriesRequest, actorUserID ...uuid.UUID) ([]claims.Category, int, error)
	listBalancesFn       func(ctx context.Context, orgID, employeeID uuid.UUID, year, month int) ([]claims.ClaimBalanceWithCategory, error)
	listClaimsFn         func(ctx context.Context, orgID uuid.UUID, f claims.ClaimFilters, role string, managerEmployeeID *uuid.UUID) (*claims.ListResult, error)
	getClaimFn           func(ctx context.Context, orgID, id uuid.UUID) (*claims.Claim, error)
	submitClaimFn        func(ctx context.Context, orgID, employeeID uuid.UUID, req claims.SubmitClaimRequest, receiptURL *string, actorUserID uuid.UUID, role string) (*claims.Claim, error)
	approveClaimFn       func(ctx context.Context, orgID, reviewerEmployeeID, claimID uuid.UUID, req *claims.ApproveClaimRequest, actorUserID ...uuid.UUID) (*claims.Claim, error)
	rejectClaimFn        func(ctx context.Context, orgID, reviewerEmployeeID, claimID uuid.UUID, req claims.RejectClaimRequest, actorUserID ...uuid.UUID) (*claims.Claim, error)
	cancelClaimFn        func(ctx context.Context, orgID, employeeID, claimID uuid.UUID, actorUserID ...uuid.UUID) (*claims.Claim, error)
	markAsPaidFn         func(ctx context.Context, orgID, paidByEmployeeID, claimID uuid.UUID, req *claims.MarkAsPaidRequest, actorUserID ...uuid.UUID) (*claims.Claim, error)
	verifyManagerFn      func(ctx context.Context, orgID, employeeID, managerEmployeeID uuid.UUID) error
	getMonthlySummaryFn  func(ctx context.Context, orgID uuid.UUID, year, month int) ([]claims.MonthlySummary, error)
}

func (f *fakeHandlerService) ListCategories(ctx context.Context, orgID uuid.UUID) ([]claims.Category, error) {
	if f.listCategoriesFn != nil {
		return f.listCategoriesFn(ctx, orgID)
	}
	return []claims.Category{}, nil
}

func (f *fakeHandlerService) CreateCategory(ctx context.Context, orgID uuid.UUID, req claims.CreateCategoryRequest, actorUserID ...uuid.UUID) (*claims.Category, error) {
	if f.createCategoryFn != nil {
		return f.createCategoryFn(ctx, orgID, req, actorUserID...)
	}
	return &claims.Category{ID: uuid.New(), Name: req.Name}, nil
}

func (f *fakeHandlerService) UpdateCategory(ctx context.Context, orgID, id uuid.UUID, req claims.UpdateCategoryRequest, actorUserID ...uuid.UUID) (*claims.Category, error) {
	if f.updateCategoryFn != nil {
		return f.updateCategoryFn(ctx, orgID, id, req, actorUserID...)
	}
	return &claims.Category{ID: id}, nil
}

func (f *fakeHandlerService) DeactivateCategory(ctx context.Context, orgID, id uuid.UUID, actorUserID ...uuid.UUID) error {
	if f.deactivateCategoryFn != nil {
		return f.deactivateCategoryFn(ctx, orgID, id, actorUserID...)
	}
	return nil
}

func (f *fakeHandlerService) ListTemplates(ctx context.Context, orgID uuid.UUID, countryCode *string) ([]claims.CategoryTemplate, error) {
	if f.listTemplatesFn != nil {
		return f.listTemplatesFn(ctx, orgID, countryCode)
	}
	return []claims.CategoryTemplate{}, nil
}

func (f *fakeHandlerService) ImportCategories(ctx context.Context, orgID uuid.UUID, req claims.ImportCategoriesRequest, actorUserID ...uuid.UUID) ([]claims.Category, int, error) {
	if f.importCategoriesFn != nil {
		return f.importCategoriesFn(ctx, orgID, req, actorUserID...)
	}
	return []claims.Category{}, 0, nil
}

func (f *fakeHandlerService) ListBalances(ctx context.Context, orgID, employeeID uuid.UUID, year, month int) ([]claims.ClaimBalanceWithCategory, error) {
	if f.listBalancesFn != nil {
		return f.listBalancesFn(ctx, orgID, employeeID, year, month)
	}
	return []claims.ClaimBalanceWithCategory{}, nil
}

func (f *fakeHandlerService) ListClaims(ctx context.Context, orgID uuid.UUID, f2 claims.ClaimFilters, role string, managerEmployeeID *uuid.UUID) (*claims.ListResult, error) {
	if f.listClaimsFn != nil {
		return f.listClaimsFn(ctx, orgID, f2, role, managerEmployeeID)
	}
	return &claims.ListResult{Claims: []claims.ClaimWithDetails{}}, nil
}

func (f *fakeHandlerService) GetClaim(ctx context.Context, orgID, id uuid.UUID) (*claims.Claim, error) {
	if f.getClaimFn != nil {
		return f.getClaimFn(ctx, orgID, id)
	}
	return &claims.Claim{ID: id, Status: "approved"}, nil
}

func (f *fakeHandlerService) SubmitClaim(ctx context.Context, orgID, employeeID uuid.UUID, req claims.SubmitClaimRequest, receiptURL *string, actorUserID uuid.UUID, role string) (*claims.Claim, error) {
	if f.submitClaimFn != nil {
		return f.submitClaimFn(ctx, orgID, employeeID, req, receiptURL, actorUserID, role)
	}
	return &claims.Claim{ID: testClaimID, Status: "pending"}, nil
}

func (f *fakeHandlerService) ApproveClaim(ctx context.Context, orgID, reviewerEmployeeID, claimID uuid.UUID, req *claims.ApproveClaimRequest, actorUserID ...uuid.UUID) (*claims.Claim, error) {
	if f.approveClaimFn != nil {
		return f.approveClaimFn(ctx, orgID, reviewerEmployeeID, claimID, req, actorUserID...)
	}
	return &claims.Claim{ID: claimID, Status: "approved"}, nil
}

func (f *fakeHandlerService) RejectClaim(ctx context.Context, orgID, reviewerEmployeeID, claimID uuid.UUID, req claims.RejectClaimRequest, actorUserID ...uuid.UUID) (*claims.Claim, error) {
	if f.rejectClaimFn != nil {
		return f.rejectClaimFn(ctx, orgID, reviewerEmployeeID, claimID, req, actorUserID...)
	}
	return &claims.Claim{ID: claimID, Status: "rejected"}, nil
}

func (f *fakeHandlerService) CancelClaim(ctx context.Context, orgID, employeeID, claimID uuid.UUID, actorUserID ...uuid.UUID) (*claims.Claim, error) {
	if f.cancelClaimFn != nil {
		return f.cancelClaimFn(ctx, orgID, employeeID, claimID, actorUserID...)
	}
	return &claims.Claim{ID: claimID, Status: "cancelled"}, nil
}

func (f *fakeHandlerService) MarkAsPaid(ctx context.Context, orgID, paidByEmployeeID, claimID uuid.UUID, req *claims.MarkAsPaidRequest, actorUserID ...uuid.UUID) (*claims.Claim, error) {
	if f.markAsPaidFn != nil {
		return f.markAsPaidFn(ctx, orgID, paidByEmployeeID, claimID, req, actorUserID...)
	}
	return &claims.Claim{ID: claimID, Status: "paid"}, nil
}

func (f *fakeHandlerService) VerifyManagerRelationship(ctx context.Context, orgID, employeeID, managerEmployeeID uuid.UUID) error {
	if f.verifyManagerFn != nil {
		return f.verifyManagerFn(ctx, orgID, employeeID, managerEmployeeID)
	}
	return nil
}

func (f *fakeHandlerService) GetMonthlySummary(ctx context.Context, orgID uuid.UUID, year, month int) ([]claims.MonthlySummary, error) {
	if f.getMonthlySummaryFn != nil {
		return f.getMonthlySummaryFn(ctx, orgID, year, month)
	}
	return []claims.MonthlySummary{}, nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

var testUserID = uuid.MustParse("00000000-0000-0000-0000-000000000010")

var defaultClaimsEmpLookup = claims.EmployeeLookupFunc(func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) {
	return testEmpID, nil
})

func newClaimsRouter(svc claims.ServiceInterface) *gin.Engine {
	return newClaimsRouterWithRole(svc, middleware.RoleAdmin)
}

func newClaimsRouterWithRole(svc claims.ServiceInterface, role string) *gin.Engine {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("org_id", testOrgID)
		c.Set("user_id", testUserID)
		c.Set("role", role)
		c.Next()
	})
	h := claims.NewHandler(svc, defaultClaimsEmpLookup, nil, zerolog.Nop())
	h.RegisterRoutes(r.Group("/api/v1"))
	return r
}

func claimsJSONBody(v any) *bytes.Buffer {
	b, _ := json.Marshal(v)
	return bytes.NewBuffer(b)
}

func assertClaimsStatus(t *testing.T, w *httptest.ResponseRecorder, want int) {
	t.Helper()
	if w.Code != want {
		t.Errorf("status = %d, want %d; body: %s", w.Code, want, w.Body.String())
	}
}

func assertClaimsDataKey(t *testing.T, w *httptest.ResponseRecorder) {
	t.Helper()
	var body map[string]json.RawMessage
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to unmarshal body: %v", err)
	}
	if _, ok := body["data"]; !ok {
		t.Errorf("response body missing \"data\" key; got: %s", w.Body.String())
	}
}

// ── TestHandler_MarkAsPaid ────────────────────────────────────────────────────

func TestHandler_MarkAsPaid(t *testing.T) {
	tests := []struct {
		name       string
		claimID    string
		body       any
		svcFn      func(ctx context.Context, orgID, paidByEmployeeID, claimID uuid.UUID, req *claims.MarkAsPaidRequest, actorUserID ...uuid.UUID) (*claims.Claim, error)
		role       string
		empLookup  claims.EmployeeLookupFunc
		wantStatus int
	}{
		{
			name:       "200 — approved claim marked as paid",
			claimID:    testClaimID.String(),
			body:       map[string]string{},
			wantStatus: http.StatusOK,
		},
		{
			name:    "200 — with review note",
			claimID: testClaimID.String(),
			body:    map[string]string{"review_note": "paid via bank transfer"},
			svcFn: func(_ context.Context, _, _, claimID uuid.UUID, req *claims.MarkAsPaidRequest, _ ...uuid.UUID) (*claims.Claim, error) {
				if req == nil || req.ReviewNote == nil {
					t.Error("expected review_note to be passed")
				}
				return &claims.Claim{ID: claimID, Status: "paid"}, nil
			},
			wantStatus: http.StatusOK,
		},
		{
			name:       "400 — invalid claim UUID",
			claimID:    "not-a-uuid",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:    "409 — claim not in approved status",
			claimID: testClaimID.String(),
			svcFn: func(_ context.Context, _, _, _ uuid.UUID, _ *claims.MarkAsPaidRequest, _ ...uuid.UUID) (*claims.Claim, error) {
				return nil, apperr.New(apperr.CodeConflict, "claim is not in approved status")
			},
			wantStatus: http.StatusConflict,
		},
		{
			name:    "404 — claim not found",
			claimID: testClaimID.String(),
			svcFn: func(_ context.Context, _, _, _ uuid.UUID, _ *claims.MarkAsPaidRequest, _ ...uuid.UUID) (*claims.Claim, error) {
				return nil, apperr.NotFound("claim")
			},
			wantStatus: http.StatusNotFound,
		},
		{
			name:    "500 — employee lookup fails",
			claimID: testClaimID.String(),
			empLookup: claims.EmployeeLookupFunc(func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) {
				return uuid.Nil, apperr.NotFound("employee")
			}),
			wantStatus: http.StatusNotFound,
		},
		// Role-gating: only admin-level and finance roles can mark as paid
		{
			name:       "200 — hr_admin can mark as paid",
			claimID:    testClaimID.String(),
			role:       middleware.RoleHRAdmin,
			wantStatus: http.StatusOK,
		},
		{
			name:       "200 — finance can mark as paid",
			claimID:    testClaimID.String(),
			role:       middleware.RoleFinance,
			wantStatus: http.StatusOK,
		},
		{
			name:       "403 — manager cannot mark as paid",
			claimID:    testClaimID.String(),
			role:       middleware.RoleManager,
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "403 — member cannot mark as paid",
			claimID:    testClaimID.String(),
			role:       middleware.RoleMember,
			wantStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeHandlerService{}
			if tt.svcFn != nil {
				svc.markAsPaidFn = tt.svcFn
			}

			role := middleware.RoleAdmin
			if tt.role != "" {
				role = tt.role
			}

			r := gin.New()
			r.Use(func(c *gin.Context) {
				c.Set("org_id", testOrgID)
				c.Set("user_id", testUserID)
				c.Set("role", role)
				c.Next()
			})
			empLookup := defaultClaimsEmpLookup
			if tt.empLookup != nil {
				empLookup = tt.empLookup
			}
			h := claims.NewHandler(svc, empLookup, nil, zerolog.Nop())
			h.RegisterRoutes(r.Group("/api/v1"))

			var body *bytes.Buffer
			if tt.body != nil {
				body = claimsJSONBody(tt.body)
			} else {
				body = bytes.NewBuffer(nil)
			}

			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/claims/"+tt.claimID+"/pay", body)
			req.Header.Set("Content-Type", "application/json")
			r.ServeHTTP(w, req)

			assertClaimsStatus(t, w, tt.wantStatus)
			if tt.wantStatus == http.StatusOK {
				assertClaimsDataKey(t, w)
			}
		})
	}
}

// ── TestHandler_ApproveClaim ──────────────────────────────────────────────────

func TestHandler_ApproveClaim(t *testing.T) {
	tests := []struct {
		name       string
		claimID    string
		svcFn      func(ctx context.Context, orgID, reviewerEmployeeID, claimID uuid.UUID, req *claims.ApproveClaimRequest, actorUserID ...uuid.UUID) (*claims.Claim, error)
		wantStatus int
	}{
		{
			name:       "200 — claim approved",
			claimID:    testClaimID.String(),
			wantStatus: http.StatusOK,
		},
		{
			name:       "400 — invalid UUID",
			claimID:    "bad-uuid",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:    "409 — claim already approved",
			claimID: testClaimID.String(),
			svcFn: func(_ context.Context, _, _, _ uuid.UUID, _ *claims.ApproveClaimRequest, _ ...uuid.UUID) (*claims.Claim, error) {
				return nil, apperr.New(apperr.CodeConflict, "claim is not in pending status")
			},
			wantStatus: http.StatusConflict,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeHandlerService{}
			if tt.svcFn != nil {
				svc.approveClaimFn = tt.svcFn
			}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/claims/"+tt.claimID+"/approve", claimsJSONBody(map[string]string{}))
			req.Header.Set("Content-Type", "application/json")
			newClaimsRouter(svc).ServeHTTP(w, req)
			assertClaimsStatus(t, w, tt.wantStatus)
		})
	}
}

// ── TestHandler_RejectClaim ───────────────────────────────────────────────────

func TestHandler_RejectClaim(t *testing.T) {
	tests := []struct {
		name       string
		claimID    string
		body       any
		wantStatus int
	}{
		{
			name:       "200 — claim rejected with note",
			claimID:    testClaimID.String(),
			body:       map[string]string{"review_note": "does not qualify"},
			wantStatus: http.StatusOK,
		},
		{
			name:       "400 — missing required review_note",
			claimID:    testClaimID.String(),
			body:       map[string]string{},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "400 — invalid UUID",
			claimID:    "bad-id",
			body:       map[string]string{"review_note": "no"},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeHandlerService{}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/claims/"+tt.claimID+"/reject", claimsJSONBody(tt.body))
			req.Header.Set("Content-Type", "application/json")
			newClaimsRouter(svc).ServeHTTP(w, req)
			assertClaimsStatus(t, w, tt.wantStatus)
		})
	}
}

// ── TestHandler_CancelClaim ───────────────────────────────────────────────────

func TestHandler_CancelClaim(t *testing.T) {
	tests := []struct {
		name       string
		claimID    string
		svcFn      func(ctx context.Context, orgID, employeeID, claimID uuid.UUID, actorUserID ...uuid.UUID) (*claims.Claim, error)
		wantStatus int
	}{
		{
			name:       "200 — claim cancelled",
			claimID:    testClaimID.String(),
			wantStatus: http.StatusOK,
		},
		{
			name:       "400 — invalid UUID",
			claimID:    "bad-id",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:    "403 — cannot cancel someone else's claim",
			claimID: testClaimID.String(),
			svcFn: func(_ context.Context, _, _, _ uuid.UUID, _ ...uuid.UUID) (*claims.Claim, error) {
				return nil, apperr.New(apperr.CodeForbidden, "you can only cancel your own claims")
			},
			wantStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeHandlerService{}
			if tt.svcFn != nil {
				svc.cancelClaimFn = tt.svcFn
			}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/claims/"+tt.claimID+"/cancel", bytes.NewBufferString("{}"))
			req.Header.Set("Content-Type", "application/json")
			newClaimsRouter(svc).ServeHTTP(w, req)
			assertClaimsStatus(t, w, tt.wantStatus)
		})
	}
}

// ── TestHandler_GetClaim ──────────────────────────────────────────────────────

func TestHandler_GetClaim(t *testing.T) {
	tests := []struct {
		name       string
		claimID    string
		svcFn      func(ctx context.Context, orgID, id uuid.UUID) (*claims.Claim, error)
		wantStatus int
	}{
		{
			name:       "200 — returns claim",
			claimID:    testClaimID.String(),
			wantStatus: http.StatusOK,
		},
		{
			name:       "400 — invalid UUID",
			claimID:    "not-a-uuid",
			wantStatus: http.StatusBadRequest,
		},
		{
			name:    "404 — claim not found",
			claimID: testClaimID.String(),
			svcFn: func(_ context.Context, _, _ uuid.UUID) (*claims.Claim, error) {
				return nil, apperr.NotFound("claim")
			},
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeHandlerService{}
			if tt.svcFn != nil {
				svc.getClaimFn = tt.svcFn
			}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodGet, "/api/v1/claims/"+tt.claimID, nil)
			newClaimsRouter(svc).ServeHTTP(w, req)
			assertClaimsStatus(t, w, tt.wantStatus)
		})
	}
}

// ── TestHandler_ListCategories ────────────────────────────────────────────────

func TestHandler_ListCategories(t *testing.T) {
	t.Run("200 — returns categories", func(t *testing.T) {
		svc := &fakeHandlerService{
			listCategoriesFn: func(_ context.Context, _ uuid.UUID) ([]claims.Category, error) {
				return []claims.Category{{ID: testCategoryID, Name: "Travel"}}, nil
			},
		}
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/v1/claims/categories", nil)
		newClaimsRouter(svc).ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusOK)
		assertClaimsDataKey(t, w)
	})

	t.Run("500 — service error", func(t *testing.T) {
		svc := &fakeHandlerService{
			listCategoriesFn: func(_ context.Context, _ uuid.UUID) ([]claims.Category, error) {
				return nil, apperr.New(apperr.CodeInternal, "db error")
			},
		}
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/v1/claims/categories", nil)
		newClaimsRouter(svc).ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusInternalServerError)
	})
}

// ── TestHandler_CreateCategory ────────────────────────────────────────────────

func TestHandler_CreateCategory(t *testing.T) {
	tests := []struct {
		name       string
		body       any
		wantStatus int
	}{
		{
			name:       "201 — category created",
			body:       map[string]any{"name": "Meals", "requires_receipt": true},
			wantStatus: http.StatusCreated,
		},
		{
			name:       "400 — missing name",
			body:       map[string]any{"requires_receipt": true},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeHandlerService{}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodPost, "/api/v1/claims/categories", claimsJSONBody(tt.body))
			req.Header.Set("Content-Type", "application/json")
			newClaimsRouter(svc).ServeHTTP(w, req)
			assertClaimsStatus(t, w, tt.wantStatus)
		})
	}
}

// ── TestHandler_DeactivateCategory ───────────────────────────────────────────

func TestHandler_DeactivateCategory(t *testing.T) {
	t.Run("200 — category deactivated", func(t *testing.T) {
		svc := &fakeHandlerService{}
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodDelete, "/api/v1/claims/categories/"+testCategoryID.String(), nil)
		newClaimsRouter(svc).ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusOK)
	})

	t.Run("400 — invalid UUID", func(t *testing.T) {
		svc := &fakeHandlerService{}
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodDelete, "/api/v1/claims/categories/bad-uuid", nil)
		newClaimsRouter(svc).ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusBadRequest)
	})
}

// ── TestHandler_ListClaims ────────────────────────────────────────────────────

func TestHandler_ListClaims(t *testing.T) {
	t.Run("200 — admin role, no managerEmployeeID filter", func(t *testing.T) {
		var capturedManagerID *uuid.UUID
		svc := &fakeHandlerService{
			listClaimsFn: func(_ context.Context, _ uuid.UUID, _ claims.ClaimFilters, _ string, mid *uuid.UUID) (*claims.ListResult, error) {
				capturedManagerID = mid
				return &claims.ListResult{Claims: []claims.ClaimWithDetails{}}, nil
			},
		}
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/v1/claims", nil)
		newClaimsRouter(svc).ServeHTTP(w, req) // default role = admin
		assertClaimsStatus(t, w, http.StatusOK)
		if capturedManagerID != nil {
			t.Errorf("admin should pass nil managerEmployeeID, got %s", capturedManagerID)
		}
	})

	// Manager role uses the hierarchical filter (recursive CTE in repo walks their
	// full subordinate tree), so they pass their own employee_id as the root.
	t.Run("200 — manager role uses hierarchical subordinate filter", func(t *testing.T) {
		var capturedManagerID *uuid.UUID
		svc := &fakeHandlerService{
			listClaimsFn: func(_ context.Context, _ uuid.UUID, _ claims.ClaimFilters, _ string, mid *uuid.UUID) (*claims.ListResult, error) {
				capturedManagerID = mid
				return &claims.ListResult{Claims: []claims.ClaimWithDetails{}}, nil
			},
		}
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/v1/claims", nil)
		newClaimsRouterWithRole(svc, "manager").ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusOK)
		if capturedManagerID == nil {
			t.Error("manager role should pass managerEmployeeID for hierarchical subordinate filtering")
		}
	})

	t.Run("200 — member role uses managerEmployeeID filter", func(t *testing.T) {
		var capturedManagerID *uuid.UUID
		svc := &fakeHandlerService{
			listClaimsFn: func(_ context.Context, _ uuid.UUID, _ claims.ClaimFilters, _ string, mid *uuid.UUID) (*claims.ListResult, error) {
				capturedManagerID = mid
				return &claims.ListResult{Claims: []claims.ClaimWithDetails{}}, nil
			},
		}
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/v1/claims", nil)
		newClaimsRouterWithRole(svc, "member").ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusOK)
		if capturedManagerID == nil {
			t.Error("member role should pass managerEmployeeID (restrict to direct reports)")
		}
	})

	t.Run("500 — service error", func(t *testing.T) {
		svc := &fakeHandlerService{
			listClaimsFn: func(_ context.Context, _ uuid.UUID, _ claims.ClaimFilters, _ string, _ *uuid.UUID) (*claims.ListResult, error) {
				return nil, apperr.New(apperr.CodeInternal, "db error")
			},
		}
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/v1/claims", nil)
		newClaimsRouter(svc).ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusInternalServerError)
	})
}

// ── TestHandler_GetMonthlySummary ─────────────────────────────────────────────

func TestHandler_GetMonthlySummary(t *testing.T) {
	t.Run("200 — returns summary", func(t *testing.T) {
		svc := &fakeHandlerService{}
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/v1/claims/summary?year=2026&month=3", nil)
		newClaimsRouter(svc).ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusOK)
	})
}

// ── TestHandler_ListMyBalances ────────────────────────────────────────────────

func TestHandler_ListMyBalances(t *testing.T) {
	t.Run("200 — returns own balances", func(t *testing.T) {
		svc := &fakeHandlerService{}
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/v1/claims/balances/me", nil)
		newClaimsRouterWithRole(svc, "member").ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusOK)
	})

	t.Run("404 — employee not found", func(t *testing.T) {
		svc := &fakeHandlerService{}
		r := gin.New()
		r.Use(func(c *gin.Context) {
			c.Set("org_id", testOrgID)
			c.Set("user_id", testUserID)
			c.Set("role", "member")
			c.Next()
		})
		h := claims.NewHandler(svc, claims.EmployeeLookupFunc(func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) {
			return uuid.Nil, apperr.NotFound("employee")
		}), nil, zerolog.Nop())
		h.RegisterRoutes(r.Group("/api/v1"))

		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/v1/claims/balances/me", nil)
		r.ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusNotFound)
	})
}

// ── TestHandler_UpdateCategory ────────────────────────────────────────────────

func TestHandler_UpdateCategory(t *testing.T) {
	tests := []struct {
		name       string
		paramID    string
		body       any
		svcFn      func(ctx context.Context, orgID, id uuid.UUID, req claims.UpdateCategoryRequest, actorUserID ...uuid.UUID) (*claims.Category, error)
		wantStatus int
	}{
		{
			name:       "200 — happy path",
			paramID:    testCategoryID.String(),
			body:       map[string]any{"name": "Updated Travel"},
			wantStatus: http.StatusOK,
		},
		{
			name:       "400 — invalid UUID",
			paramID:    "not-a-uuid",
			body:       map[string]any{"name": "Updated Travel"},
			wantStatus: http.StatusBadRequest,
		},
		{
			name:    "500 — service error",
			paramID: testCategoryID.String(),
			body:    map[string]any{"name": "Updated Travel"},
			svcFn: func(_ context.Context, _, _ uuid.UUID, _ claims.UpdateCategoryRequest, _ ...uuid.UUID) (*claims.Category, error) {
				return nil, apperr.Internal()
			},
			wantStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &fakeHandlerService{}
			if tt.svcFn != nil {
				svc.updateCategoryFn = tt.svcFn
			}
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodPut, "/api/v1/claims/categories/"+tt.paramID, claimsJSONBody(tt.body))
			req.Header.Set("Content-Type", "application/json")
			newClaimsRouter(svc).ServeHTTP(w, req)
			assertClaimsStatus(t, w, tt.wantStatus)
		})
	}
}

// ── TestHandler_ListCategoryTemplates ─────────────────────────────────────────

func TestHandler_ListCategoryTemplates(t *testing.T) {
	t.Run("200 — no country code", func(t *testing.T) {
		svc := &fakeHandlerService{}
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/v1/claims/categories/templates", nil)
		newClaimsRouter(svc).ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusOK)
		assertClaimsDataKey(t, w)
	})

	t.Run("200 — with country code", func(t *testing.T) {
		svc := &fakeHandlerService{}
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/v1/claims/categories/templates?country_code=AE", nil)
		newClaimsRouter(svc).ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusOK)
	})

	t.Run("500 — service error", func(t *testing.T) {
		svc := &fakeHandlerService{
			listTemplatesFn: func(_ context.Context, _ uuid.UUID, _ *string) ([]claims.CategoryTemplate, error) {
				return nil, apperr.Internal()
			},
		}
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/v1/claims/categories/templates", nil)
		newClaimsRouter(svc).ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusInternalServerError)
	})
}

// ── TestHandler_ImportCategories ──────────────────────────────────────────────

func TestHandler_ImportCategories(t *testing.T) {
	templateID := uuid.New()

	t.Run("201 — happy path", func(t *testing.T) {
		svc := &fakeHandlerService{}
		w := httptest.NewRecorder()
		body := claimsJSONBody(claims.ImportCategoriesRequest{TemplateIDs: []string{templateID.String()}})
		req, _ := http.NewRequest(http.MethodPost, "/api/v1/claims/categories/import", body)
		req.Header.Set("Content-Type", "application/json")
		newClaimsRouter(svc).ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusCreated)
	})

	t.Run("400 — invalid JSON", func(t *testing.T) {
		svc := &fakeHandlerService{}
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodPost, "/api/v1/claims/categories/import", bytes.NewBufferString("{invalid"))
		req.Header.Set("Content-Type", "application/json")
		newClaimsRouter(svc).ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusBadRequest)
	})

	t.Run("500 — service error", func(t *testing.T) {
		svc := &fakeHandlerService{
			importCategoriesFn: func(_ context.Context, _ uuid.UUID, _ claims.ImportCategoriesRequest, _ ...uuid.UUID) ([]claims.Category, int, error) {
				return nil, 0, apperr.Internal()
			},
		}
		w := httptest.NewRecorder()
		body := claimsJSONBody(claims.ImportCategoriesRequest{TemplateIDs: []string{templateID.String()}})
		req, _ := http.NewRequest(http.MethodPost, "/api/v1/claims/categories/import", body)
		req.Header.Set("Content-Type", "application/json")
		newClaimsRouter(svc).ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusInternalServerError)
	})
}

// ── TestHandler_SubmitClaim ───────────────────────────────────────────────────

func TestHandler_SubmitClaim(t *testing.T) {
	t.Run("400 — multipart parse fails (not multipart)", func(t *testing.T) {
		svc := &fakeHandlerService{}
		w := httptest.NewRecorder()
		// Sending plain JSON instead of multipart — should fail multipart parsing
		req, _ := http.NewRequest(http.MethodPost, "/api/v1/claims", bytes.NewBufferString(`{"amount":5000}`))
		req.Header.Set("Content-Type", "application/json") // not multipart
		newClaimsRouterWithRole(svc, "member").ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusBadRequest)
	})

	t.Run("404 — employee lookup fails", func(t *testing.T) {
		svc := &fakeHandlerService{}
		r := gin.New()
		r.Use(func(c *gin.Context) {
			c.Set("org_id", testOrgID)
			c.Set("user_id", testUserID)
			c.Set("role", "member")
			c.Next()
		})
		h := claims.NewHandler(svc, claims.EmployeeLookupFunc(func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) {
			return uuid.Nil, apperr.NotFound("employee")
		}), nil, zerolog.Nop())
		h.RegisterRoutes(r.Group("/api/v1"))
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodPost, "/api/v1/claims", nil)
		r.ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusNotFound)
	})
}

// ── TestHandler_ListMyClaims ──────────────────────────────────────────────────

func TestHandler_ListMyClaims(t *testing.T) {
	t.Run("200 — happy path", func(t *testing.T) {
		svc := &fakeHandlerService{}
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/v1/claims/me", nil)
		newClaimsRouterWithRole(svc, "member").ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusOK)
	})

	t.Run("404 — employee lookup fails", func(t *testing.T) {
		svc := &fakeHandlerService{}
		r := gin.New()
		r.Use(func(c *gin.Context) {
			c.Set("org_id", testOrgID)
			c.Set("user_id", testUserID)
			c.Set("role", "member")
			c.Next()
		})
		h := claims.NewHandler(svc, claims.EmployeeLookupFunc(func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) {
			return uuid.Nil, apperr.NotFound("employee")
		}), nil, zerolog.Nop())
		h.RegisterRoutes(r.Group("/api/v1"))
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/v1/claims/me", nil)
		r.ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusNotFound)
	})

	t.Run("500 — service error", func(t *testing.T) {
		svc := &fakeHandlerService{
			listClaimsFn: func(_ context.Context, _ uuid.UUID, _ claims.ClaimFilters, _ string, _ *uuid.UUID) (*claims.ListResult, error) {
				return nil, apperr.Internal()
			},
		}
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/v1/claims/me", nil)
		newClaimsRouterWithRole(svc, "member").ServeHTTP(w, req)
		assertClaimsStatus(t, w, http.StatusInternalServerError)
	})
}

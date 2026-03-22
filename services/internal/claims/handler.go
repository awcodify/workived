package claims

import (
	"context"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/internal/platform/storage"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/paginate"
	"github.com/workived/services/pkg/validate"
)

// ServiceInterface defines the subset of Service that handlers depend on.
type ServiceInterface interface {
	// Categories
	ListCategories(ctx context.Context, orgID uuid.UUID) ([]Category, error)
	CreateCategory(ctx context.Context, orgID uuid.UUID, req CreateCategoryRequest, actorUserID ...uuid.UUID) (*Category, error)
	UpdateCategory(ctx context.Context, orgID, id uuid.UUID, req UpdateCategoryRequest, actorUserID ...uuid.UUID) (*Category, error)
	DeactivateCategory(ctx context.Context, orgID, id uuid.UUID, actorUserID ...uuid.UUID) error

	// Templates
	ListTemplates(ctx context.Context, orgID uuid.UUID, countryCode *string) ([]CategoryTemplate, error)
	ImportCategories(ctx context.Context, orgID uuid.UUID, req ImportCategoriesRequest, actorUserID ...uuid.UUID) ([]Category, int, error)

	// Balances
	ListBalances(ctx context.Context, orgID, employeeID uuid.UUID, year, month int) ([]ClaimBalanceWithCategory, error)

	// Claims
	ListClaims(ctx context.Context, orgID uuid.UUID, f ClaimFilters, role string, managerEmployeeID *uuid.UUID) (*ListResult, error)
	GetClaim(ctx context.Context, orgID, id uuid.UUID) (*Claim, error)
	SubmitClaim(ctx context.Context, orgID, employeeID uuid.UUID, req SubmitClaimRequest, receiptURL *string, actorUserID uuid.UUID, role string) (*Claim, error)
	ApproveClaim(ctx context.Context, orgID, reviewerEmployeeID, claimID uuid.UUID, req *ApproveClaimRequest, actorUserID ...uuid.UUID) (*Claim, error)
	RejectClaim(ctx context.Context, orgID, reviewerEmployeeID, claimID uuid.UUID, req RejectClaimRequest, actorUserID ...uuid.UUID) (*Claim, error)
	CancelClaim(ctx context.Context, orgID, employeeID, claimID uuid.UUID, actorUserID ...uuid.UUID) (*Claim, error)
	VerifyManagerRelationship(ctx context.Context, orgID, employeeID, managerEmployeeID uuid.UUID) error
	GetMonthlySummary(ctx context.Context, orgID uuid.UUID, year, month int) ([]MonthlySummary, error)
}

// EmployeeLookupFunc resolves user_id → employee_id.
type EmployeeLookupFunc func(ctx context.Context, orgID, userID uuid.UUID) (uuid.UUID, error)

type Handler struct {
	service       ServiceInterface
	empLookup     EmployeeLookupFunc
	storageClient *storage.Client
	log           zerolog.Logger
}

func NewHandler(service ServiceInterface, empLookup EmployeeLookupFunc, storageClient *storage.Client, log zerolog.Logger) *Handler {
	return &Handler{
		service:       service,
		empLookup:     empLookup,
		storageClient: storageClient,
		log:           log,
	}
}

// logAndRespondError logs the error with context and sends JSON response to client
func (h *Handler) logAndRespondError(c *gin.Context, err error, msg string, fields map[string]string) {
	event := h.log.Error().Err(err)
	for k, v := range fields {
		event = event.Str(k, v)
	}
	event.Msg(msg)
	c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	claims := rg.Group("/claims")

	// Categories — admin only
	claims.GET("/categories", middleware.Require(middleware.PermClaimsRead), h.ListCategories)
	claims.POST("/categories", middleware.Require(middleware.PermClaimsWrite), h.CreateCategory)
	claims.PUT("/categories/:id", middleware.Require(middleware.PermClaimsWrite), h.UpdateCategory)
	claims.DELETE("/categories/:id", middleware.Require(middleware.PermClaimsWrite), h.DeactivateCategory)

	// Templates — admin only
	claims.GET("/categories/templates", middleware.Require(middleware.PermClaimsRead), h.ListCategoryTemplates)
	claims.POST("/categories/import", middleware.Require(middleware.PermClaimsWrite), h.ImportCategories)

	// Balances — view own
	claims.GET("/balances/me", middleware.Require(middleware.PermSelfClaims), h.ListMyBalances)

	// Claims — submit & view own
	claims.POST("", middleware.Require(middleware.PermSelfClaims), h.SubmitClaim)
	claims.GET("", middleware.RequireAny(middleware.PermClaimsApprove, middleware.PermClaimsWrite, middleware.PermTeamClaimsApprove), h.ListClaims)
	claims.GET("/me", middleware.Require(middleware.PermSelfClaims), h.ListMyClaims)
	claims.GET("/:id", middleware.RequireAny(middleware.PermClaimsRead, middleware.PermSelfClaims), h.GetClaim)
	claims.POST("/:id/cancel", middleware.Require(middleware.PermSelfClaims), h.CancelClaim)

	// Approval — admin, manager, or direct report manager
	claims.POST("/:id/approve", middleware.RequireAny(middleware.PermClaimsApprove, middleware.PermTeamClaimsApprove, middleware.PermClaimsWrite), h.ApproveClaim)
	claims.POST("/:id/reject", middleware.RequireAny(middleware.PermClaimsApprove, middleware.PermTeamClaimsApprove, middleware.PermClaimsWrite), h.RejectClaim)

	// Reporting — approvers + admins
	claims.GET("/summary", middleware.RequireAny(middleware.PermClaimsApprove, middleware.PermClaimsWrite, middleware.PermTeamClaimsApprove), h.GetMonthlySummary)
}

// ── Category Handlers ─────────────────────────────────────────────────────────

func (h *Handler) ListCategories(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	categories, err := h.service.ListCategories(c.Request.Context(), orgID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": categories})
}

func (h *Handler) CreateCategory(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	var req CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	cat, err := h.service.CreateCategory(c.Request.Context(), orgID, req, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": cat})
}

func (h *Handler) UpdateCategory(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	var req UpdateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	cat, err := h.service.UpdateCategory(c.Request.Context(), orgID, id, req, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": cat})
}

func (h *Handler) DeactivateCategory(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := h.service.DeactivateCategory(c.Request.Context(), orgID, id, userID); err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "category deactivated"}})
}

func (h *Handler) ListCategoryTemplates(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	// Optional country_code query param
	countryCode := c.Query("country_code")
	var cc *string
	if countryCode != "" {
		cc = &countryCode
	}

	templates, err := h.service.ListTemplates(c.Request.Context(), orgID, cc)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": templates})
}

func (h *Handler) ImportCategories(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	var req ImportCategoriesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	categories, count, err := h.service.ImportCategories(c.Request.Context(), orgID, req, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"data": gin.H{
			"categories":    categories,
			"created_count": count,
		},
	})
}

// ── Balance Handlers ──────────────────────────────────────────────────────────

func (h *Handler) ListMyBalances(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	// Resolve user → employee
	employeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	// Parse year and month from query params, default to current
	now := time.Now()
	year, err := strconv.Atoi(c.DefaultQuery("year", strconv.Itoa(now.Year())))
	if err != nil {
		year = now.Year()
	}
	month, err := strconv.Atoi(c.DefaultQuery("month", strconv.Itoa(int(now.Month()))))
	if err != nil {
		month = int(now.Month())
	}

	balances, err := h.service.ListBalances(c.Request.Context(), orgID, employeeID, year, month)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": balances})
}

// ── Claim Handlers ────────────────────────────────────────────────────────────

func (h *Handler) SubmitClaim(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)
	role := middleware.RoleFromCtx(c)

	// Resolve user → employee
	employeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	// Parse multipart form
	if err := c.Request.ParseMultipartForm(10 << 20); err != nil { // 10 MB max
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	// Parse JSON fields from form
	var req SubmitClaimRequest

	// Parse category_id
	req.CategoryID, err = uuid.Parse(c.PostForm("category_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(fmt.Errorf("invalid category_id")))
		return
	}

	// Parse amount
	req.Amount, err = strconv.ParseInt(c.PostForm("amount"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(fmt.Errorf("invalid amount")))
		return
	}

	req.CurrencyCode = c.PostForm("currency_code")
	req.Description = c.PostForm("description")

	// Parse claim_date (YYYY-MM-DD format)
	claimDateStr := c.PostForm("claim_date")
	req.ClaimDate, err = time.Parse("2006-01-02", claimDateStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(fmt.Errorf("invalid claim_date format, expected YYYY-MM-DD")))
		return
	}

	if err := validate.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	// Handle receipt upload (optional)
	var receiptURL *string
	file, header, err := c.Request.FormFile("receipt")
	if err == nil {
		defer func() {
			if closeErr := file.Close(); closeErr != nil {
				h.log.Warn().Err(closeErr).Msg("failed to close uploaded file")
			}
		}()

		// Validate file type
		ext := strings.ToLower(filepath.Ext(header.Filename))
		if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".pdf" {
			c.JSON(http.StatusBadRequest, apperr.ValidationError(fmt.Errorf("invalid file type: only jpg, png, pdf allowed")))
			return
		}

		// Validate file size (10MB max)
		if header.Size > 10<<20 {
			c.JSON(http.StatusBadRequest, apperr.ValidationError(fmt.Errorf("file too large: max 10MB")))
			return
		}

		// Generate S3 key: {org_id}/claims/{claim_id}/{filename}
		claimID := uuid.New()
		key := fmt.Sprintf("%s/claims/%s/%s", orgID.String(), claimID.String(), header.Filename)

		// Upload to S3/MinIO
		contentType := header.Header.Get("Content-Type")
		if err := h.storageClient.Upload(c.Request.Context(), key, file, contentType); err != nil {
			h.log.Error().Err(err).Str("key", key).Msg("failed to upload receipt to storage")
			c.JSON(http.StatusInternalServerError, apperr.Response(apperr.New(apperr.CodeInternal, "file upload failed - please try again or contact support")))
			return
		}

		receiptURL = &key
	}

	claim, err := h.service.SubmitClaim(c.Request.Context(), orgID, employeeID, req, receiptURL, userID, role)
	if err != nil {
		h.logAndRespondError(c, err, "failed to submit claim", map[string]string{
			"org_id":      orgID.String(),
			"employee_id": employeeID.String(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": claim})
}

func (h *Handler) ListClaims(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)
	role := middleware.RoleFromCtx(c)

	// For non-admin roles, filter by direct reports (reporting_to relationship)
	// Admins (owner, admin, hr_admin) can see all claims
	var managerEmployeeID *uuid.UUID
	hasFullApprovalRights := role == "owner" || role == "admin" || role == "hr_admin" || role == "super_admin"

	if !hasFullApprovalRights {
		// Lookup current user's employee_id to filter by their direct reports
		empID, err := h.empLookup(c.Request.Context(), orgID, userID)
		if err != nil {
			h.logAndRespondError(c, err, "failed to lookup employee for claims filtering", map[string]string{
				"user_id": userID.String(),
				"org_id":  orgID.String(),
			})
			return
		}
		managerEmployeeID = &empID
	}

	f := ClaimFilters{
		Cursor: c.Query("cursor"),
	}
	if s := c.Query("status"); s != "" {
		f.Status = &s
	}
	if e := c.Query("employee_id"); e != "" {
		f.EmployeeID = &e
	}
	if cat := c.Query("category_id"); cat != "" {
		f.CategoryID = &cat
	}
	if sd := c.Query("start_date"); sd != "" {
		f.StartDate = &sd
	}
	if ed := c.Query("end_date"); ed != "" {
		f.EndDate = &ed
	}
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 {
		f.Limit = l
	} else {
		f.Limit = paginate.DefaultLimit
	}

	result, err := h.service.ListClaims(c.Request.Context(), orgID, f, role, managerEmployeeID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	// Generate presigned URLs for receipts
	for i := range result.Claims {
		if result.Claims[i].ReceiptURL != nil {
			url, err := h.storageClient.GetPresignedURL(c.Request.Context(), *result.Claims[i].ReceiptURL)
			if err == nil {
				result.Claims[i].ReceiptURL = &url
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data": result.Claims,
		"meta": result.Meta,
	})
}

func (h *Handler) ListMyClaims(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	employeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	empIDStr := employeeID.String()
	f := ClaimFilters{
		EmployeeID: &empIDStr,
		Cursor:     c.Query("cursor"),
	}
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 {
		f.Limit = l
	} else {
		f.Limit = paginate.DefaultLimit
	}

	result, err := h.service.ListClaims(c.Request.Context(), orgID, f, "", nil)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	// Generate presigned URLs
	for i := range result.Claims {
		if result.Claims[i].ReceiptURL != nil {
			url, err := h.storageClient.GetPresignedURL(c.Request.Context(), *result.Claims[i].ReceiptURL)
			if err == nil {
				result.Claims[i].ReceiptURL = &url
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"data": result.Claims,
		"meta": result.Meta,
	})
}

func (h *Handler) GetClaim(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	claim, err := h.service.GetClaim(c.Request.Context(), orgID, id)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	// Generate presigned URL for receipt
	if claim.ReceiptURL != nil {
		url, err := h.storageClient.GetPresignedURL(c.Request.Context(), *claim.ReceiptURL)
		if err == nil {
			claim.ReceiptURL = &url
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": claim})
}

func (h *Handler) ApproveClaim(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)
	role := middleware.RoleFromCtx(c)

	claimID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	reviewerEmployeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to lookup reviewer employee for approval", map[string]string{
			"org_id":   orgID.String(),
			"user_id":  userID.String(),
			"claim_id": claimID.String(),
		})
		return
	}

	// If not an admin, verify they are the actual manager of the claimant
	hasFullApprovalRights := role == "owner" || role == "admin" || role == "hr_admin" || role == "super_admin"
	if !hasFullApprovalRights {
		// Get the claim to check the reporting relationship
		claim, err := h.service.GetClaim(c.Request.Context(), orgID, claimID)
		if err != nil {
			h.logAndRespondError(c, err, "failed to get claim for verification", map[string]string{
				"org_id":   orgID.String(),
				"claim_id": claimID.String(),
			})
			return
		}

		// Verify the reviewer is the claimant's manager
		if err := h.service.VerifyManagerRelationship(c.Request.Context(), orgID, claim.EmployeeID, reviewerEmployeeID); err != nil {
			c.JSON(http.StatusForbidden, apperr.Response(apperr.New(apperr.CodeForbidden, "you can only approve claims from your direct reports")))
			return
		}
	}

	var req ApproveClaimRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Optional body
		req = ApproveClaimRequest{}
	}

	claim, err := h.service.ApproveClaim(c.Request.Context(), orgID, reviewerEmployeeID, claimID, &req, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to approve claim", map[string]string{
			"org_id":   orgID.String(),
			"claim_id": claimID.String(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": claim})
}

func (h *Handler) RejectClaim(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)
	role := middleware.RoleFromCtx(c)

	claimID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	reviewerEmployeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to lookup reviewer employee for rejection", map[string]string{
			"org_id":   orgID.String(),
			"user_id":  userID.String(),
			"claim_id": claimID.String(),
		})
		return
	}

	// If not an admin, verify they are the actual manager of the claimant
	hasFullApprovalRights := role == "owner" || role == "admin" || role == "hr_admin" || role == "super_admin"
	if !hasFullApprovalRights {
		// Get the claim to check the reporting relationship
		claim, err := h.service.GetClaim(c.Request.Context(), orgID, claimID)
		if err != nil {
			h.logAndRespondError(c, err, "failed to get claim for verification", map[string]string{
				"org_id":   orgID.String(),
				"claim_id": claimID.String(),
			})
			return
		}

		// Verify the reviewer is the claimant's manager
		if err := h.service.VerifyManagerRelationship(c.Request.Context(), orgID, claim.EmployeeID, reviewerEmployeeID); err != nil {
			c.JSON(http.StatusForbidden, apperr.Response(apperr.New(apperr.CodeForbidden, "you can only reject claims from your direct reports")))
			return
		}
	}

	var req RejectClaimRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	claim, err := h.service.RejectClaim(c.Request.Context(), orgID, reviewerEmployeeID, claimID, req, userID)
	if err != nil {
		h.logAndRespondError(c, err, "failed to reject claim", map[string]string{
			"org_id":   orgID.String(),
			"claim_id": claimID.String(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": claim})
}

func (h *Handler) CancelClaim(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)
	claimID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	employeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	claim, err := h.service.CancelClaim(c.Request.Context(), orgID, employeeID, claimID, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": claim})
}

func (h *Handler) GetMonthlySummary(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	year, _ := strconv.Atoi(c.Query("year"))
	month, _ := strconv.Atoi(c.Query("month"))

	summaries, err := h.service.GetMonthlySummary(c.Request.Context(), orgID, year, month)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": summaries})
}

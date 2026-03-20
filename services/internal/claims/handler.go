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

	// Claims
	ListClaims(ctx context.Context, orgID uuid.UUID, f ClaimFilters) (*ListResult, error)
	GetClaim(ctx context.Context, orgID, id uuid.UUID) (*Claim, error)
	SubmitClaim(ctx context.Context, orgID, employeeID uuid.UUID, req SubmitClaimRequest, receiptURL *string, actorUserID ...uuid.UUID) (*Claim, error)
	ApproveClaim(ctx context.Context, orgID, reviewerEmployeeID, claimID uuid.UUID, req *ApproveClaimRequest, actorUserID ...uuid.UUID) (*Claim, error)
	RejectClaim(ctx context.Context, orgID, reviewerEmployeeID, claimID uuid.UUID, req RejectClaimRequest, actorUserID ...uuid.UUID) (*Claim, error)
	CancelClaim(ctx context.Context, orgID, employeeID, claimID uuid.UUID, actorUserID ...uuid.UUID) (*Claim, error)
	GetMonthlySummary(ctx context.Context, orgID uuid.UUID, year, month int) ([]MonthlySummary, error)
}

// EmployeeLookupFunc resolves user_id → employee_id.
type EmployeeLookupFunc func(ctx context.Context, orgID, userID uuid.UUID) (uuid.UUID, error)

type Handler struct {
	service       ServiceInterface
	empLookup     EmployeeLookupFunc
	storageClient *storage.Client
}

func NewHandler(service ServiceInterface, empLookup EmployeeLookupFunc, storageClient *storage.Client) *Handler {
	return &Handler{
		service:       service,
		empLookup:     empLookup,
		storageClient: storageClient,
	}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	claims := rg.Group("/claims")

	// Categories — admin only
	claims.GET("/categories", middleware.Require(middleware.PermClaimsRead), h.ListCategories)
	claims.POST("/categories", middleware.Require(middleware.PermClaimsWrite), h.CreateCategory)
	claims.PUT("/categories/:id", middleware.Require(middleware.PermClaimsWrite), h.UpdateCategory)
	claims.DELETE("/categories/:id", middleware.Require(middleware.PermClaimsWrite), h.DeactivateCategory)

	// Claims — submit & view own
	claims.POST("", middleware.Require(middleware.PermSelfClaims), h.SubmitClaim)
	claims.GET("", middleware.Require(middleware.PermClaimsRead), h.ListClaims)
	claims.GET("/me", middleware.Require(middleware.PermSelfClaims), h.ListMyClaims)
	claims.GET("/:id", middleware.RequireAny(middleware.PermClaimsRead, middleware.PermSelfClaims), h.GetClaim)
	claims.POST("/:id/cancel", middleware.Require(middleware.PermSelfClaims), h.CancelClaim)

	// Approval — admin or manager
	claims.POST("/:id/approve", middleware.Require(middleware.PermClaimsApprove), h.ApproveClaim)
	claims.POST("/:id/reject", middleware.Require(middleware.PermClaimsApprove), h.RejectClaim)

	// Reporting
	claims.GET("/summary", middleware.Require(middleware.PermClaimsRead), h.GetMonthlySummary)
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

// ── Claim Handlers ────────────────────────────────────────────────────────────

func (h *Handler) SubmitClaim(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

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
	req.CategoryID, _ = uuid.Parse(c.PostForm("category_id"))
	req.Amount, _ = strconv.ParseInt(c.PostForm("amount"), 10, 64)
	req.CurrencyCode = c.PostForm("currency_code")
	req.Description = c.PostForm("description")

	// Parse claim_date (YYYY-MM-DD format)
	claimDateStr := c.PostForm("claim_date")
	req.ClaimDate, _ = time.Parse("2006-01-02", claimDateStr)

	if err := validate.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	// Handle receipt upload (optional)
	var receiptURL *string
	file, header, err := c.Request.FormFile("receipt")
	if err == nil {
		defer file.Close()

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
			c.JSON(http.StatusInternalServerError, apperr.Response(fmt.Errorf("file upload failed: %w", err)))
			return
		}

		receiptURL = &key
	}

	claim, err := h.service.SubmitClaim(c.Request.Context(), orgID, employeeID, req, receiptURL, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": claim})
}

func (h *Handler) ListClaims(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

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

	result, err := h.service.ListClaims(c.Request.Context(), orgID, f)
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

	result, err := h.service.ListClaims(c.Request.Context(), orgID, f)
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
	claimID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	reviewerEmployeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	var req ApproveClaimRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// Optional body
		req = ApproveClaimRequest{}
	}

	claim, err := h.service.ApproveClaim(c.Request.Context(), orgID, reviewerEmployeeID, claimID, &req, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": claim})
}

func (h *Handler) RejectClaim(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)
	claimID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	reviewerEmployeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
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
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
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

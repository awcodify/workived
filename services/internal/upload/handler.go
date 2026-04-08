package upload

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/validate"
)

// StoragePresigner generates presigned upload URLs.
type StoragePresigner interface {
	GetPresignedUploadURL(ctx context.Context, key, contentType string) (string, error)
}

// EmployeeLookupFunc resolves user_id → employee_id.
type EmployeeLookupFunc func(ctx context.Context, orgID, userID uuid.UUID) (uuid.UUID, error)

type Handler struct {
	storage   StoragePresigner
	empLookup EmployeeLookupFunc
	log       zerolog.Logger
}

func NewHandler(storage StoragePresigner, empLookup EmployeeLookupFunc, log zerolog.Logger) *Handler {
	return &Handler{storage: storage, empLookup: empLookup, log: log}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	uploads := rg.Group("/uploads")
	uploads.POST("/presign", middleware.Require(middleware.PermSelfAttendance), h.Presign)
}

// Presign generates a presigned S3 upload URL for attendance photos.
func (h *Handler) Presign(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	employeeID, err := h.empLookup(c.Request.Context(), orgID, userID)
	if err != nil {
		h.log.Error().Err(err).
			Str("org_id", orgID.String()).
			Str("user_id", userID.String()).
			Msg("failed to lookup employee for presign")
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	var req PresignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	// Determine file extension from content type
	ext := "jpg"
	if req.ContentType == "image/png" {
		ext = "png"
	}

	// Generate unique S3 key: {org_id}/attendance/{employee_id}/{purpose}_{timestamp}.{ext}
	timestamp := time.Now().UTC().Format("20060102-150405")
	key := fmt.Sprintf("%s/attendance/%s/%s_%s.%s",
		orgID.String(), employeeID.String(), req.Purpose, timestamp, ext)

	url, err := h.storage.GetPresignedUploadURL(c.Request.Context(), key, req.ContentType)
	if err != nil {
		h.log.Error().Err(err).
			Str("org_id", orgID.String()).
			Str("key", key).
			Msg("failed to generate presigned upload URL")
		c.JSON(http.StatusInternalServerError, apperr.Response(apperr.New(apperr.CodeInternal, "failed to generate upload URL")))
		return
	}

	h.log.Info().
		Str("org_id", orgID.String()).
		Str("employee_id", employeeID.String()).
		Str("purpose", req.Purpose).
		Str("key", key).
		Msg("upload.presign_generated")

	c.JSON(http.StatusOK, gin.H{"data": PresignResponse{
		UploadURL: url,
		Key:       key,
	}})
}

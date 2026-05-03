package upload

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
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

// StorageGetter retrieves files from storage.
type StorageGetter interface {
	Get(ctx context.Context, key string) (io.ReadCloser, string, error)
}

// EmployeeLookupFunc resolves user_id → employee_id.
type EmployeeLookupFunc func(ctx context.Context, orgID, userID uuid.UUID) (uuid.UUID, error)

type Handler struct {
	storage       StoragePresigner
	storageGetter StorageGetter
	empLookup     EmployeeLookupFunc
	apiURL        string // Base API URL for constructing public URLs
	log           zerolog.Logger
}

func NewHandler(storage StoragePresigner, storageGetter StorageGetter, empLookup EmployeeLookupFunc, apiURL string, log zerolog.Logger) *Handler {
	return &Handler{
		storage:       storage,
		storageGetter: storageGetter,
		empLookup:     empLookup,
		apiURL:        apiURL,
		log:           log,
	}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	uploads := rg.Group("/uploads")
	// Presign endpoint requires authentication
	uploads.POST("/presign", h.Presign)
	// Serve files with authentication and org-based permission check
	uploads.GET("/*key", h.ServeFile)
}

// Presign generates a presigned S3 upload URL for attendance photos and task attachments.
func (h *Handler) Presign(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)
	userID := middleware.UserIDFromCtx(c)

	var req PresignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	// Employee lookup only required for attendance photos
	var employeeID uuid.UUID
	if req.Purpose == "clock_in" || req.Purpose == "clock_out" {
		empID, err := h.empLookup(c.Request.Context(), orgID, userID)
		if err != nil {
			h.log.Error().Err(err).
				Str("org_id", orgID.String()).
				Str("user_id", userID.String()).
				Msg("failed to lookup employee for presign")
			apperr.Respond(c, err)
			return
		}
		employeeID = empID
	}

	// Determine file extension from content type
	ext := "jpg"
	switch req.ContentType {
	case "image/png":
		ext = "png"
	case "image/gif":
		ext = "gif"
	case "image/webp":
		ext = "webp"
	}

	// Generate unique S3 key based on purpose
	timestamp := time.Now().UTC().Format("20060102-150405")
	randomID := uuid.New().String()[:8]
	var key string

	switch req.Purpose {
	case "clock_in", "clock_out":
		// Attendance photos require employee lookup
		key = fmt.Sprintf("%s/attendance/%s/%s_%s.%s",
			orgID.String(), employeeID.String(), req.Purpose, timestamp, ext)
	case "task_attachment", "comment_attachment":
		// Task/comment attachments don't require employee lookup
		key = fmt.Sprintf("%s/%s/%s_%s.%s",
			orgID.String(), req.Purpose, timestamp, randomID, ext)
	default:
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "invalid purpose")))
		return
	}

	url, err := h.storage.GetPresignedUploadURL(c.Request.Context(), key, req.ContentType)
	if err != nil {
		h.log.Error().Err(err).
			Str("org_id", orgID.String()).
			Str("key", key).
			Msg("failed to generate presigned upload URL")
		c.JSON(http.StatusInternalServerError, apperr.Response(apperr.New(apperr.CodeInternal, "failed to generate upload URL")))
		return
	}

	logEvent := h.log.Info().
		Str("org_id", orgID.String()).
		Str("purpose", req.Purpose).
		Str("key", key)
	if req.Purpose == "clock_in" || req.Purpose == "clock_out" {
		logEvent.Str("employee_id", employeeID.String())
	}
	logEvent.Msg("upload.presign_generated")

	// Generate public URL using our API endpoint (authenticated)
	publicURL := fmt.Sprintf("%s/api/v1/uploads/%s", h.apiURL, key)

	c.JSON(http.StatusOK, gin.H{"data": PresignResponse{
		UploadURL: url,
		Key:       key,
		PublicURL: publicURL,
	}})
}

// ServeFile retrieves a file from S3 and serves it through our API.
// Requires authentication and verifies user belongs to the file's organisation.
func (h *Handler) ServeFile(c *gin.Context) {
	orgID := middleware.OrgIDFromCtx(c)

	// Extract key from URL path
	key := c.Param("key")
	if key == "" || key == "/" {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "missing file key")))
		return
	}
	// Remove leading slash
	if key[0] == '/' {
		key = key[1:]
	}

	// Security: Verify user has access to this file
	// Key format: {org_id}/{purpose}/{filename}
	// Extract org_id from key and verify it matches authenticated user's org
	parts := strings.SplitN(key, "/", 2)
	if len(parts) < 2 {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "invalid file key format")))
		return
	}

	keyOrgID, err := uuid.Parse(parts[0])
	if err != nil {
		c.JSON(http.StatusBadRequest, apperr.Response(apperr.New(apperr.CodeValidation, "invalid organisation ID in key")))
		return
	}

	// Verify user belongs to the organisation that owns this file
	if keyOrgID != orgID {
		h.log.Warn().
			Str("user_org_id", orgID.String()).
			Str("file_org_id", keyOrgID.String()).
			Str("key", key).
			Msg("upload.access_denied")
		c.JSON(http.StatusForbidden, apperr.Response(apperr.New(apperr.CodeForbidden, "access denied")))
		return
	}

	// Retrieve file from storage
	body, contentType, err := h.storageGetter.Get(c.Request.Context(), key)
	if err != nil {
		h.log.Error().Err(err).
			Str("key", key).
			Msg("failed to retrieve file from storage")
		c.JSON(http.StatusNotFound, apperr.Response(apperr.New(apperr.CodeNotFound, "file not found")))
		return
	}
	defer body.Close()

	// Set headers
	c.Header("Content-Type", contentType)
	c.Header("Cache-Control", "private, max-age=3600") // 1 hour cache for authenticated content

	// Stream file to response
	if _, err := io.Copy(c.Writer, body); err != nil {
		h.log.Error().Err(err).
			Str("key", key).
			Msg("failed to stream file")
		return
	}

	h.log.Info().
		Str("org_id", orgID.String()).
		Str("key", key).
		Str("content_type", contentType).
		Msg("upload.file_served")
}

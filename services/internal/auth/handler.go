package auth

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/validate"
	"golang.org/x/oauth2"
)

// ServiceInterface is the subset of Service that the handler depends on.
type ServiceInterface interface {
	Register(ctx context.Context, req RegisterRequest) (*User, error)
	Login(ctx context.Context, req LoginRequest) (*LoginResponse, string, error)
	Refresh(ctx context.Context, rawToken string) (*RefreshResponse, string, error)
	Logout(ctx context.Context, rawToken string) error
	VerifyEmail(ctx context.Context, req VerifyEmailRequest) error
	ResendVerificationEmail(ctx context.Context, userID uuid.UUID) error
	GetUserByID(ctx context.Context, userID uuid.UUID) (*User, error)
	ForgotPassword(ctx context.Context, req ForgotPasswordRequest) error
	ResetPassword(ctx context.Context, req ResetPasswordRequest) error
	// OAuth methods
	GenerateOAuthState(ctx context.Context) (string, error)
	GetGoogleOAuthConfig() *oauth2.Config
	LoginWithGoogle(ctx context.Context, code, state string) (*LoginResponse, string, error)
	GetAppURL() string
	// Logging methods
	LogInfo(msg string, fields map[string]interface{})
	LogWarn(msg string, fields map[string]interface{})
	LogError(msg string, err error, fields map[string]interface{})
}

type Handler struct {
	service ServiceInterface
}

func NewHandler(service ServiceInterface) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	auth := rg.Group("/auth")
	auth.POST("/register", h.Register)
	auth.POST("/login", h.Login)
	auth.POST("/refresh", h.Refresh)
	auth.POST("/logout", h.Logout)
	auth.POST("/verify-email", h.VerifyEmail)
	auth.POST("/forgot-password", h.ForgotPassword)
	auth.POST("/reset-password", h.ResetPassword)

	// OAuth routes
	auth.GET("/google", h.HandleGoogleLogin)
	auth.GET("/google/callback", h.HandleGoogleCallback)

	// MCP SSO endpoints (public)
	mcp := rg.Group("/mcp")
	mcp.GET("/login", h.HandleMCPLogin)
	mcp.POST("/auth", h.HandleMCPAuth)
}

// RegisterPublicRoutes registers auth routes that require authentication but not tenant context.
func (h *Handler) RegisterPublicRoutes(rg *gin.RouterGroup) {
	auth := rg.Group("/auth")
	auth.POST("/resend-verification", h.ResendVerificationEmail)
	auth.GET("/verification-status", h.CheckVerificationStatus)
}

func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	user, err := h.service.Register(c.Request.Context(), req)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": user})
}

func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	resp, refreshToken, err := h.service.Login(c.Request.Context(), req)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	// Refresh token in httpOnly cookie, access token in body
	c.SetCookie("refresh_token", refreshToken, 30*24*3600, "/", "", true, true)
	c.JSON(http.StatusOK, gin.H{"data": resp})
}

func (h *Handler) Refresh(c *gin.Context) {
	// Prefer cookie; fall back to body
	rawToken, _ := c.Cookie("refresh_token")
	if rawToken == "" {
		var req RefreshRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
			return
		}
		rawToken = req.RefreshToken
	}

	resp, newRefresh, err := h.service.Refresh(c.Request.Context(), rawToken)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.SetCookie("refresh_token", newRefresh, 30*24*3600, "/", "", true, true)
	c.JSON(http.StatusOK, gin.H{"data": resp})
}

func (h *Handler) Logout(c *gin.Context) {
	rawToken, _ := c.Cookie("refresh_token")
	if rawToken == "" {
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "logged out"}})
		return
	}

	_ = h.service.Logout(c.Request.Context(), rawToken)

	c.SetCookie("refresh_token", "", -1, "/", "", true, true)
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "logged out"}})
}

func (h *Handler) VerifyEmail(c *gin.Context) {
	var req VerifyEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := h.service.VerifyEmail(c.Request.Context(), req); err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "email verified"}})
}

func (h *Handler) ResendVerificationEmail(c *gin.Context) {
	userID := middleware.UserIDFromCtx(c)

	if err := h.service.ResendVerificationEmail(c.Request.Context(), userID); err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "verification email sent"}})
}

func (h *Handler) CheckVerificationStatus(c *gin.Context) {
	userID := middleware.UserIDFromCtx(c)

	user, err := h.service.GetUserByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"is_verified": user.IsVerified}})
}

func (h *Handler) ForgotPassword(c *gin.Context) {
	var req ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := h.service.ForgotPassword(c.Request.Context(), req); err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	// Always 200 — never reveal whether email exists
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "if that email is registered, a reset link has been sent"}})
}

func (h *Handler) ResetPassword(c *gin.Context) {
	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}
	if err := validate.Struct(req); err != nil {
		c.JSON(http.StatusBadRequest, apperr.ValidationError(err))
		return
	}

	if err := h.service.ResetPassword(c.Request.Context(), req); err != nil {
		c.JSON(apperr.HTTPStatus(err), apperr.Response(err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "password updated successfully"}})
}

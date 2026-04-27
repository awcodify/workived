package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/workived/services/internal/admin"
	"github.com/workived/services/internal/announcements"
	"github.com/workived/services/internal/attendance"
	"github.com/workived/services/internal/audit"
	"github.com/workived/services/internal/auth"
	"github.com/workived/services/internal/calendar"
	"github.com/workived/services/internal/claims"
	"github.com/workived/services/internal/dashboard"
	"github.com/workived/services/internal/department"
	"github.com/workived/services/internal/employee"
	"github.com/workived/services/internal/employmentchange"
	"github.com/workived/services/internal/jobtitle"
	"github.com/workived/services/internal/leave"
	"github.com/workived/services/internal/mcp"
	"github.com/workived/services/internal/mobile"
	"github.com/workived/services/internal/organisation"
	"github.com/workived/services/internal/platform/config"
	"github.com/workived/services/internal/platform/database"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/internal/platform/storage"
	"github.com/workived/services/internal/reports"
	"github.com/workived/services/internal/setup"
	"github.com/workived/services/internal/tasks"
	"github.com/workived/services/internal/upload"
	"github.com/workived/services/pkg/cache"
	"github.com/workived/services/pkg/email"
	"github.com/workived/services/pkg/logger"
)

// userRepoAdapter adapts auth.Repository to organisation.UserRepository interface.
type userRepoAdapter struct {
	authRepo *auth.Repository
}

func (u *userRepoAdapter) GetUserByID(ctx context.Context, id uuid.UUID) (*organisation.User, error) {
	authUser, err := u.authRepo.GetUserByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return &organisation.User{
		ID:         authUser.ID,
		Email:      authUser.Email,
		IsVerified: authUser.IsVerified,
	}, nil
}

func (u *userRepoAdapter) MarkEmailVerified(ctx context.Context, userID uuid.UUID) error {
	return u.authRepo.MarkEmailVerified(ctx, userID)
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		log := zerolog.New(os.Stderr).With().Timestamp().Logger()
		log.Fatal().Err(err).Msg("load config")
	}

	log := logger.New(cfg.Env)
	zerolog.SetGlobalLevel(logger.FromLevel(cfg.LogLevel))

	ctx := context.Background()

	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("connect database")
	}
	defer db.Close()

	rdb, err := database.ConnectRedis(ctx, cfg.RedisURL)
	if err != nil {
		log.Fatal().Err(err).Msg("connect redis")
	}
	defer func() { _ = rdb.Close() }()

	// Storage client (S3/MinIO)
	storageClient, err := storage.NewClient(ctx, storage.Config{
		Endpoint:        cfg.S3Endpoint,
		PublicEndpoint:  cfg.S3PublicEndpoint,
		Region:          cfg.S3Region,
		Bucket:          cfg.S3Bucket,
		AccessKeyID:     cfg.AWSAccessKeyID,
		SecretAccessKey: cfg.AWSSecretAccessKey,
		UseSSL:          cfg.S3UseSSL,
	})
	if err != nil {
		log.Fatal().Err(err).Msg("connect storage")
	}

	// Email sender
	var emailSender email.Sender
	if cfg.EmailEnabled {
		if cfg.ResendAPIKey != "" {
			emailSender = email.NewResendSender(email.ResendConfig{
				APIKey: cfg.ResendAPIKey,
				From:   cfg.EmailFrom,
			}, log)
			log.Info().
				Str("email_from", cfg.EmailFrom).
				Msg("email notifications enabled (Resend)")
		} else {
			emailSender = email.NewSMTPSender(email.SMTPConfig{
				Host:     cfg.SMTPHost,
				Port:     cfg.SMTPPort,
				Username: cfg.SMTPUser,
				Password: cfg.SMTPPass,
				From:     cfg.EmailFrom,
			}, log)
			log.Info().
				Str("smtp_host", cfg.SMTPHost).
				Int("smtp_port", cfg.SMTPPort).
				Str("email_from", cfg.EmailFrom).
				Msg("email notifications enabled (SMTP)")
		}
	} else {
		emailSender = &email.NoOpSender{}
		log.Info().Msg("email notifications disabled (using NoOpSender)")
	}

	// ── Repositories ─────────────────────────────────────────────────────────
	authRepo := auth.NewRepository(db)
	orgRepo := organisation.NewRepository(db)
	empRepo := employee.NewRepository(db)
	deptRepo := department.NewRepository(db)
	jtRepo := jobtitle.NewRepository(db)
	attRepo := attendance.NewRepository(db)
	leaveRepo := leave.NewRepository(db)
	claimsRepo := claims.NewRepository(db, log)
	tasksRepo := tasks.NewRepository(db, log)
	adminRepo := admin.NewRepository(db)
	auditRepo := audit.NewRepository(db)
	employmentChangeRepo := employmentchange.NewRepository(db)
	setupRepo := setup.NewRepository(db)
	calendarRepo := calendar.NewRepository(db)
	reportsRepo := reports.NewRepository(db)
	dashboardRepo := dashboard.NewRepository(db, log)
	annRepo := announcements.NewRepository(db)

	// ── Cache ────────────────────────────────────────────────────────────────
	cacheStore := cache.New(rdb, log)

	// ── Services ─────────────────────────────────────────────────────────────
	cachedOrgInfo := organisation.NewCachedOrgInfo(orgRepo, cacheStore)
	authSvc := auth.NewService(
		authRepo, orgRepo, cfg.JWTSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL,
		auth.WithEmailSender(emailSender),
		auth.WithAppURL(cfg.AppURL),
		auth.WithLogger(log),
		auth.WithRedis(rdb),
		auth.WithOAuthConfig(auth.OAuthConfig{
			GoogleClientID:     cfg.GoogleClientID,
			GoogleClientSecret: cfg.GoogleClientSecret,
			GoogleRedirectURL:  cfg.GoogleRedirectURL,
		}),
	)
	empSvc := employee.NewService(empRepo, orgRepo, employee.WithAuditLog(auditRepo), employee.WithEmploymentChangeRepo(employmentChangeRepo), employee.WithLogger(log), employee.WithCache(cacheStore))
	deptSvc := department.NewService(deptRepo, department.WithLogger(log), department.WithCache(cacheStore))
	jtSvc := jobtitle.NewService(jtRepo, jobtitle.WithLogger(log), jobtitle.WithCache(cacheStore))
	attSvc := attendance.NewService(attRepo, cachedOrgInfo, empRepo, log, attendance.WithCache(cacheStore), attendance.WithLeaveRepo(leave.NewRepository(db)))
	// Admin service for Pro license checking
	adminSvc := admin.NewService(adminRepo, admin.WithLogger(log), admin.WithCache(cacheStore))
	// Tasks service must be created before leave/claims to wire up approval task creation
	tasksSvc := tasks.NewService(tasksRepo, tasks.WithAuditLog(auditRepo), tasks.WithLogger(log), tasks.WithProLicenseChecker(adminSvc))
	claimsSvc := claims.NewService(claimsRepo, orgRepo, empRepo, cfg.AppURL, claims.WithAuditLog(auditRepo), claims.WithLogger(log), claims.WithEmailSender(emailSender), claims.WithTasksService(tasksSvc))
	leaveSvc := leave.NewService(leaveRepo, cachedOrgInfo, empRepo, cfg.AppURL, leave.WithLogger(log), leave.WithEmailSender(emailSender), leave.WithTasksService(tasksSvc), leave.WithCache(cacheStore))
	annSvc := announcements.NewService(annRepo, log)
	// Org service created after leave and announcements — needs both callbacks for post-invite hooks
	// Create a user repo adapter for org service
	userRepoAdapter := &userRepoAdapter{authRepo: authRepo}
	orgSvc := organisation.NewService(orgRepo, authRepo, authSvc, empRepo, userRepoAdapter, cfg.AppURL, organisation.WithAuditLog(auditRepo), organisation.WithLogger(log), organisation.WithEmailSender(emailSender), organisation.WithCache(cacheStore),
		organisation.WithOnEmployeeJoined(leaveSvc.InitBalancesForEmployee),
		organisation.WithOnEmployeeJoined(func(ctx context.Context, orgID, employeeID uuid.UUID) {
			emp, err := empRepo.GetByID(ctx, orgID, employeeID)
			if err != nil {
				log.Warn().Err(err).Str("employee_id", employeeID.String()).Msg("welcome announcement: failed to get employee")
				return
			}
			if err := annSvc.CreateWelcomeAnnouncement(ctx, orgID, emp.FullName); err != nil {
				log.Warn().Err(err).Str("employee_id", employeeID.String()).Msg("welcome announcement: failed to create")
			}
		}))
	setupSvc := setup.NewService(setupRepo, log)
	calendarSvc := calendar.NewService(calendarRepo, orgRepo, log)
	reportsSvc := reports.NewService(reportsRepo, log)
	dashboardSvc := dashboard.NewService(dashboardRepo, dashboard.WithLogger(log), dashboard.WithCache(cacheStore))

	// ── Handlers ─────────────────────────────────────────────────────────────
	authHandler := auth.NewHandler(authSvc)
	orgHandler := organisation.NewHandler(orgSvc)
	empHandler := employee.NewHandler(empSvc)
	deptHandler := department.NewHandler(deptSvc, log)
	jtHandler := jobtitle.NewHandler(jtSvc, log)
	attHandler := attendance.NewHandler(attSvc, func(ctx context.Context, orgID, userID uuid.UUID) (uuid.UUID, error) {
		emp, err := empRepo.GetByUserID(ctx, orgID, userID)
		if err != nil {
			return uuid.Nil, err
		}
		return emp.ID, nil
	}, storageClient, log)
	leaveHandler := leave.NewHandler(leaveSvc, func(ctx context.Context, orgID, userID uuid.UUID) (uuid.UUID, error) {
		emp, err := empRepo.GetByUserID(ctx, orgID, userID)
		if err != nil {
			return uuid.Nil, err
		}
		return emp.ID, nil
	}, log)

	claimsHandler := claims.NewHandler(claimsSvc, func(ctx context.Context, orgID, userID uuid.UUID) (uuid.UUID, error) {
		emp, err := empRepo.GetByUserID(ctx, orgID, userID)
		if err != nil {
			return uuid.Nil, err
		}
		return emp.ID, nil
	}, storageClient, log)

	tasksHandler := tasks.NewHandler(tasksSvc, func(ctx context.Context, orgID, userID uuid.UUID) (uuid.UUID, error) {
		emp, err := empRepo.GetByUserID(ctx, orgID, userID)
		if err != nil {
			return uuid.Nil, err
		}
		return emp.ID, nil
	}, log)

	uploadHandler := upload.NewHandler(
		storageClient,
		storageClient, // Also implements StorageGetter
		func(ctx context.Context, orgID, userID uuid.UUID) (uuid.UUID, error) {
			emp, err := empRepo.GetByUserID(ctx, orgID, userID)
			if err != nil {
				return uuid.Nil, err
			}
			return emp.ID, nil
		},
		cfg.APIURL,
		log,
	)

	setupHandler := setup.NewHandler(setupSvc, log)
	calendarHandler := calendar.NewHandler(calendarSvc, log)
	auditHandler := audit.NewHandler(auditRepo)
	employmentHistoryHandler := employmentchange.NewHandler(employmentChangeRepo)

	dashboardHandler := dashboard.NewHandler(dashboardSvc, log)
	annHandler := announcements.NewHandler(annSvc, func(ctx context.Context, orgID, userID uuid.UUID) (uuid.UUID, error) {
		emp, err := empRepo.GetByUserID(ctx, orgID, userID)
		if err != nil {
			return uuid.Nil, err
		}
		return emp.ID, nil
	}, log)

	reportsHandler := reports.NewHandler(reportsSvc, func(ctx context.Context, orgID, userID uuid.UUID) (uuid.UUID, error) {
		emp, err := empRepo.GetByUserID(ctx, orgID, userID)
		if err != nil {
			return uuid.Nil, err
		}
		return emp.ID, nil
	}, log)

	// Mobile service — aggregates data from multiple services
	mobileSvc := mobile.NewService(empSvc, attRepo, leaveSvc, claimsSvc, tasksRepo, attSvc, cachedOrgInfo, log, cacheStore)
	mobileHandler := mobile.NewHandler(mobileSvc)

	// Admin handler for feature flags
	adminHandler := admin.NewHandler(adminSvc, log)

	// ── Router ────────────────────────────────────────────────────────────────
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.RequestID())
	r.Use(middleware.Logger(log))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	r.GET("/readyz", func(c *gin.Context) {
		// Check database connectivity
		if err := db.Ping(c.Request.Context()); err != nil {
			log.Error().Err(err).Msg("database health check failed")
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable", "error": "database unreachable"})
			return
		}

		// Check Redis connectivity
		if err := rdb.Ping(c.Request.Context()).Err(); err != nil {
			log.Error().Err(err).Msg("redis health check failed")
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unavailable", "error": "redis unreachable"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})

	// API docs — Scalar UI at /docs, spec at /docs/openapi.yaml
	// Protected with HTTP Basic Auth; disabled if credentials not set.
	registerDocsRoutes(r, cfg.DocsUsername, cfg.DocsPassword)

	// Public health check — reachable through /api proxy (no versioning needed)
	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	v1 := r.Group("/api/v1")

	// Public auth routes
	authHandler.RegisterRoutes(v1)

	// Unauthenticated invitation routes (for verifying tokens before registration)
	orgHandler.RegisterUnauthenticatedRoutes(v1)

	// Auth-only routes (no tenant context — user may not belong to an org yet).
	authOnly := v1.Group("")
	authOnly.Use(middleware.Auth(cfg.JWTSecret))
	authHandler.RegisterPublicRoutes(authOnly)
	orgHandler.RegisterPublicRoutes(authOnly)

	// Authenticated + tenant-scoped routes.
	authed := v1.Group("")
	authed.Use(middleware.Auth(cfg.JWTSecret))
	authed.Use(middleware.TenantWithCache(orgRepo, cacheStore))
	authed.Use(middleware.RateLimiter(rdb, 600))

	orgHandler.RegisterRoutes(authed)
	empHandler.RegisterRoutes(authed)
	deptHandler.RegisterRoutes(authed)
	jtHandler.RegisterRoutes(authed)
	attHandler.RegisterRoutes(authed)
	leaveHandler.RegisterRoutes(authed)
	claimsHandler.RegisterRoutes(authed)
	tasksHandler.RegisterRoutes(authed)
	setupHandler.RegisterRoutes(authed)
	calendarHandler.RegisterRoutes(authed)
	auditHandler.RegisterRoutes(authed)
	employmentHistoryHandler.RegisterRoutes(authed)
	mobileHandler.RegisterRoutes(authed)
	uploadHandler.RegisterRoutes(authed)
	reportsHandler.RegisterRoutes(authed)
	dashboardHandler.RegisterRoutes(authed)
	annHandler.RegisterRoutes(authed)
	adminHandler.RegisterPublicRoutes(authed)

	// ── MCP: OAuth 2.0 + HTTP/SSE transport ──────────────────────────────────
	// mcpAPIURL = backend origin; used for OAuth metadata resource field and
	// for tool-call self-loop. Must NOT be the frontend AppURL (port 3000).
	mcpAPIURL := cfg.APIURL
	if mcpAPIURL == "" {
		mcpAPIURL = fmt.Sprintf("http://localhost:%d", cfg.Port)
	}

	// OAuth endpoints are public — no JWT middleware.
	// Claude Code performs full OAuth discovery before connecting to /mcp/sse.
	oauthHandler := mcp.NewOAuthHandler(mcpAPIURL, cfg.JWTSecret, log)
	r.GET("/.well-known/oauth-protected-resource", oauthHandler.ProtectedResourceMetadata)
	r.GET("/.well-known/oauth-protected-resource/*path", oauthHandler.ProtectedResourceMetadata)
	r.GET("/.well-known/oauth-authorization-server", oauthHandler.AuthorizationServerMetadata)
	r.GET("/.well-known/oauth-authorization-server/*path", oauthHandler.AuthorizationServerMetadata)
	r.GET("/.well-known/openid-configuration", oauthHandler.AuthorizationServerMetadata)
	r.GET("/.well-known/openid-configuration/*path", oauthHandler.AuthorizationServerMetadata)
	r.POST("/oauth/register", oauthHandler.Register)
	r.GET("/oauth/authorize", oauthHandler.Authorize)
	r.POST("/oauth/authorize", oauthHandler.AuthorizeSubmit)
	r.POST("/oauth/token", oauthHandler.Token)

	mcpHandler := mcp.NewHTTPHandler(mcpAPIURL, log)
	// /mcp/sse requires JWT — authenticates and creates the session.
	// /mcp/message authenticates via sessionId (session already carries auth context);
	// no JWT middleware here so Claude Code doesn't need to repeat Bearer on every POST.
	r.GET("/mcp/sse", middleware.Auth(cfg.JWTSecret), mcpHandler.HandleSSE)
	r.POST("/mcp/message", mcpHandler.HandleMessage)

	// ── Server ────────────────────────────────────────────────────────────────
	srv := &http.Server{
		Addr:        fmt.Sprintf(":%d", cfg.Port),
		Handler:     r,
		ReadTimeout: 15 * time.Second,
		// WriteTimeout must be 0 for SSE connections (long-lived streaming).
		WriteTimeout: 0,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Info().Int("port", cfg.Port).Msg("starting server")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("listen")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info().Msg("shutting down server")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("server forced to shutdown")
	}
}

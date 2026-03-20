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
	"github.com/workived/services/internal/attendance"
	"github.com/workived/services/internal/audit"
	"github.com/workived/services/internal/auth"
	"github.com/workived/services/internal/claims"
	"github.com/workived/services/internal/department"
	"github.com/workived/services/internal/employee"
	"github.com/workived/services/internal/leave"
	"github.com/workived/services/internal/organisation"
	"github.com/workived/services/internal/platform/config"
	"github.com/workived/services/internal/platform/database"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/internal/platform/storage"
	"github.com/workived/services/internal/tasks"
	"github.com/workived/services/pkg/email"
	"github.com/workived/services/pkg/logger"
)

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
			Msg("email notifications enabled")
	} else {
		emailSender = &email.NoOpSender{}
		log.Info().Msg("email notifications disabled (using NoOpSender)")
	}

	// ── Repositories ─────────────────────────────────────────────────────────
	authRepo := auth.NewRepository(db)
	orgRepo := organisation.NewRepository(db)
	empRepo := employee.NewRepository(db)
	deptRepo := department.NewRepository(db)
	attRepo := attendance.NewRepository(db)
	leaveRepo := leave.NewRepository(db)
	claimsRepo := claims.NewRepository(db, log)
	tasksRepo := tasks.NewRepository(db, log)
	adminRepo := admin.NewRepository(db)
	auditRepo := audit.NewRepository(db)

	// ── Services ─────────────────────────────────────────────────────────────
	authSvc := auth.NewService(authRepo, orgRepo, cfg.JWTSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)
	orgSvc := organisation.NewService(orgRepo, authRepo, authSvc, empRepo, cfg.AppURL, organisation.WithAuditLog(auditRepo), organisation.WithLogger(log), organisation.WithEmailSender(emailSender))
	empSvc := employee.NewService(empRepo, orgRepo, employee.WithAuditLog(auditRepo), employee.WithLogger(log))
	deptSvc := department.NewService(deptRepo, department.WithLogger(log))
	attSvc := attendance.NewService(attRepo, orgRepo, log)
	claimsSvc := claims.NewService(claimsRepo, orgRepo, empRepo, cfg.AppURL, claims.WithAuditLog(auditRepo), claims.WithLogger(log), claims.WithEmailSender(emailSender))
	leaveSvc := leave.NewService(leaveRepo, orgRepo, empRepo, cfg.AppURL, leave.WithLogger(log), leave.WithEmailSender(emailSender))
	tasksSvc := tasks.NewService(tasksRepo, tasks.WithAuditLog(auditRepo), tasks.WithLogger(log))
	adminSvc := admin.NewService(adminRepo, admin.WithLogger(log))

	// ── Handlers ─────────────────────────────────────────────────────────────
	authHandler := auth.NewHandler(authSvc)
	orgHandler := organisation.NewHandler(orgSvc)
	empHandler := employee.NewHandler(empSvc)
	deptHandler := department.NewHandler(deptSvc, log)
	adminHandler := admin.NewHandler(adminSvc, log)
	adminUIHandler, err := admin.NewUIHandler(adminSvc, authSvc)
	if err != nil {
		log.Fatal().Err(err).Msg("create admin UI handler")
	}
	attHandler := attendance.NewHandler(attSvc, func(ctx context.Context, orgID, userID uuid.UUID) (uuid.UUID, error) {
		emp, err := empRepo.GetByUserID(ctx, orgID, userID)
		if err != nil {
			return uuid.Nil, err
		}
		return emp.ID, nil
	}, log)
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
	registerDocsRoutes(r)

	v1 := r.Group("/api/v1")

	// Public auth routes
	authHandler.RegisterRoutes(v1)

	// Unauthenticated invitation routes (for verifying tokens before registration)
	orgHandler.RegisterUnauthenticatedRoutes(v1)

	// Auth-only routes (no tenant context — user may not belong to an org yet).
	authOnly := v1.Group("")
	authOnly.Use(middleware.Auth(cfg.JWTSecret))
	orgHandler.RegisterPublicRoutes(authOnly)

	// Authenticated + tenant-scoped routes.
	authed := v1.Group("")
	authed.Use(middleware.Auth(cfg.JWTSecret))
	authed.Use(middleware.Tenant(orgRepo))
	authed.Use(middleware.RateLimiter(rdb, 600))

	orgHandler.RegisterRoutes(authed)
	empHandler.RegisterRoutes(authed)
	deptHandler.RegisterRoutes(authed)
	attHandler.RegisterRoutes(authed)
	leaveHandler.RegisterRoutes(authed)
	claimsHandler.RegisterRoutes(authed)
	tasksHandler.RegisterRoutes(authed)

	// Admin routes (super_admin only — Workived internal team)
	adminHandler.RegisterRoutes(authOnly)

	// Admin UI (server-side rendered HTML for super_admin)
	adminUIHandler.RegisterUIRoutes(r, cfg.JWTSecret) // Register directly on router with auth

	// Public feature-flag check (auth-only, any user with a valid JWT + org)
	adminHandler.RegisterPublicRoutes(authOnly)

	// ── Server ────────────────────────────────────────────────────────────────
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
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

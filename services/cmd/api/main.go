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
	"go.uber.org/zap"

	"github.com/workived/services/internal/admin"
	"github.com/workived/services/internal/attendance"
	"github.com/workived/services/internal/audit"
	"github.com/workived/services/internal/auth"
	"github.com/workived/services/internal/department"
	"github.com/workived/services/internal/employee"
	"github.com/workived/services/internal/leave"
	"github.com/workived/services/internal/organisation"
	"github.com/workived/services/internal/platform/config"
	"github.com/workived/services/internal/platform/database"
	"github.com/workived/services/internal/platform/middleware"
)

func main() {
	log, _ := zap.NewProduction()
	defer func() { _ = log.Sync() }()

	cfg, err := config.Load()
	if err != nil {
		log.Fatal("load config", zap.Error(err))
	}

	ctx := context.Background()

	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal("connect database", zap.Error(err))
	}
	defer db.Close()

	rdb, err := database.ConnectRedis(ctx, cfg.RedisURL)
	if err != nil {
		log.Fatal("connect redis", zap.Error(err))
	}
	defer func() { _ = rdb.Close() }()

	// ── Repositories ─────────────────────────────────────────────────────────
	authRepo := auth.NewRepository(db)
	orgRepo := organisation.NewRepository(db)
	empRepo := employee.NewRepository(db)
	deptRepo := department.NewRepository(db)
	attRepo := attendance.NewRepository(db)
	leaveRepo := leave.NewRepository(db)
	adminRepo := admin.NewRepository(db)
	auditRepo := audit.NewRepository(db)

	// ── Services ─────────────────────────────────────────────────────────────
	authSvc := auth.NewService(authRepo, orgRepo, cfg.JWTSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)
	orgSvc := organisation.NewService(orgRepo, authRepo, authSvc, cfg.AppURL, organisation.WithAuditLog(auditRepo))
	empSvc := employee.NewService(empRepo, orgRepo, employee.WithAuditLog(auditRepo))
	deptSvc := department.NewService(deptRepo)
	attSvc := attendance.NewService(attRepo, orgRepo)
	leaveSvc := leave.NewService(leaveRepo, orgRepo)
	adminSvc := admin.NewService(adminRepo)

	// ── Handlers ─────────────────────────────────────────────────────────────
	authHandler := auth.NewHandler(authSvc)
	orgHandler := organisation.NewHandler(orgSvc)
	empHandler := employee.NewHandler(empSvc)
	deptHandler := department.NewHandler(deptSvc)
	adminHandler := admin.NewHandler(adminSvc)
	adminUIHandler, err := admin.NewUIHandler(adminSvc, authSvc)
	if err != nil {
		log.Fatal("create admin UI handler", zap.Error(err))
	}
	attHandler := attendance.NewHandler(attSvc, func(ctx context.Context, orgID, userID uuid.UUID) (uuid.UUID, error) {
		emp, err := empRepo.GetByUserID(ctx, orgID, userID)
		if err != nil {
			return uuid.Nil, err
		}
		return emp.ID, nil
	})
	leaveHandler := leave.NewHandler(leaveSvc, func(ctx context.Context, orgID, userID uuid.UUID) (uuid.UUID, error) {
		emp, err := empRepo.GetByUserID(ctx, orgID, userID)
		if err != nil {
			return uuid.Nil, err
		}
		return emp.ID, nil
	})

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

	// API docs — Scalar UI at /docs, spec at /docs/openapi.yaml
	registerDocsRoutes(r)

	v1 := r.Group("/api/v1")

	// Public auth routes
	authHandler.RegisterRoutes(v1)

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
		log.Info("starting server", zap.Int("port", cfg.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("listen", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info("shutting down server")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("server forced to shutdown", zap.Error(err))
	}
}

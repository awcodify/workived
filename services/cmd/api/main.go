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
	"go.uber.org/zap"

	"github.com/workived/services/internal/attendance"
	"github.com/workived/services/internal/auth"
	"github.com/workived/services/internal/department"
	"github.com/workived/services/internal/employee"
	"github.com/workived/services/internal/organisation"
	"github.com/workived/services/internal/platform/config"
	"github.com/workived/services/internal/platform/database"
	"github.com/workived/services/internal/platform/middleware"
)

func main() {
	log, _ := zap.NewProduction()
	defer log.Sync()

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
	defer rdb.Close()

	// ── Repositories ─────────────────────────────────────────────────────────
	authRepo := auth.NewRepository(db)
	orgRepo := organisation.NewRepository(db)
	empRepo := employee.NewRepository(db)
	deptRepo := department.NewRepository(db)
	attRepo := attendance.NewRepository(db)

	// ── Services ─────────────────────────────────────────────────────────────
	authSvc := auth.NewService(authRepo, orgRepo, cfg.JWTSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)
	orgSvc := organisation.NewService(orgRepo, authRepo)
	empSvc := employee.NewService(empRepo, orgRepo)
	deptSvc := department.NewService(deptRepo)
	attSvc := attendance.NewService(attRepo, orgRepo)

	// ── Handlers ─────────────────────────────────────────────────────────────
	authHandler := auth.NewHandler(authSvc)
	orgHandler := organisation.NewHandler(orgSvc)
	empHandler := employee.NewHandler(empSvc)
	deptHandler := department.NewHandler(deptSvc)
	attHandler := attendance.NewHandler(attSvc)

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

	// Authenticated routes
	authed := v1.Group("")
	authed.Use(middleware.Auth(cfg.JWTSecret))
	authed.Use(middleware.Tenant(orgRepo))
	authed.Use(middleware.RateLimiter(rdb, 600))

	orgHandler.RegisterRoutes(authed)
	empHandler.RegisterRoutes(authed)
	deptHandler.RegisterRoutes(authed)
	attHandler.RegisterRoutes(authed)

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

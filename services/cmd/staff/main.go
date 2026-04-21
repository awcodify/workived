package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/workived/services/internal/admin"
	"github.com/workived/services/internal/audit"
	"github.com/workived/services/internal/platform/config"
	"github.com/workived/services/internal/platform/database"
	"github.com/workived/services/internal/platform/storage"
	"github.com/workived/services/internal/staff"
	"github.com/workived/services/internal/tasks"
	"github.com/workived/services/pkg/cache"
	"github.com/workived/services/pkg/logger"
)

func main() {
	log := logger.New(os.Getenv("LOG_LEVEL"))

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load config")
	}

	ctx := context.Background()

	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer db.Close()

	// ── Redis Cache (optional) ───────────────────────────────────────────────
	var cacheStore *cache.Store
	if cfg.RedisURL != "" {
		rdb, err := database.ConnectRedis(ctx, cfg.RedisURL)
		if err != nil {
			log.Warn().Err(err).Msg("redis connection failed - continuing without cache")
		} else {
			cacheStore = cache.New(rdb, log)
			log.Info().Msg("redis cache connected")
			defer func() { _ = rdb.Close() }()
		}
	}

	// ── Repositories ─────────────────────────────────────────────────────────
	staffRepo := staff.NewRepository(db)
	adminRepo := admin.NewRepository(db)
	auditRepo := audit.NewRepository(db)
	tasksRepo := tasks.NewRepository(db, log)

	// ── Storage Client ───────────────────────────────────────────────────────
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
		log.Fatal().Err(err).Msg("failed to connect to storage")
	}

	// ── Services ─────────────────────────────────────────────────────────────
	staffSvc := staff.NewService(staffRepo, cfg.JWTSecret, cfg.JWTAccessTTL)
	tasksSvc := tasks.NewService(tasksRepo, tasks.WithAuditLog(auditRepo), tasks.WithLogger(log))

	// Build admin service with optional cache
	adminOpts := []admin.ServiceOption{admin.WithLogger(log), admin.WithConfig(cfg)}
	if cacheStore != nil {
		adminOpts = append(adminOpts, admin.WithCache(cacheStore))
	}
	adminSvc := admin.NewService(adminRepo, adminOpts...)

	// ── UI Handler ───────────────────────────────────────────────────────────
	adminUIHandler, err := admin.NewUIHandler(adminSvc, staffSvc, staffRepo)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to create admin UI handler")
	}

	// ── HTTP Server ──────────────────────────────────────────────────────────
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	if cfg.Env != "production" {
		r.Use(gin.Logger())
	}

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// ── Handlers ─────────────────────────────────────────────────────────────
	adminHandler := admin.NewHandler(adminSvc, log)

	// Import handler for data migration tools (requires tasks + storage + db)
	importHandler := admin.NewImportHandler(tasksSvc, storageClient, db, log)
	adminHandler = adminHandler.WithImportHandler(importHandler)
	adminUIHandler = adminUIHandler.WithImportHandler(importHandler)

	// Register admin UI routes at /_system
	adminUIHandler.RegisterUIRoutes(r, cfg.JWTSecret)

	// Register admin API routes at /api/v1/admin (requires staff auth)
	v1 := r.Group("/api/v1")
	v1.Use(staff.Auth(cfg.JWTSecret, staffRepo))
	adminHandler.RegisterStaffRoutes(v1)

	// Start server on different port (e.g., 8081)
	port := os.Getenv("STAFF_PORT")
	if port == "" {
		port = "8081"
	}

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  10 * time.Minute, // Long timeout for import operations with large downloads
		WriteTimeout: 10 * time.Minute, // Long timeout for import responses
		IdleTimeout:  2 * time.Minute,
	}

	// Graceful shutdown
	go func() {
		log.Info().Str("port", port).Msg("staff admin server started")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("server error")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("shutting down staff admin server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("server forced to shutdown")
	}

	log.Info().Msg("staff admin server stopped")
}

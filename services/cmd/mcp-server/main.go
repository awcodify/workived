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
	"github.com/rs/zerolog"

	"github.com/workived/services/internal/mcp"
	"github.com/workived/services/internal/platform/config"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/logger"
)

func main() {
	cfg, err := config.LoadMCP()
	if err != nil {
		log := zerolog.New(os.Stderr).With().Timestamp().Logger()
		log.Fatal().Err(err).Msg("load config")
	}

	log := logger.New(cfg.Env)
	zerolog.SetGlobalLevel(logger.FromLevel(cfg.LogLevel))

	// MCP_URL is the public-facing origin of this MCP server (e.g. https://ai.workived.com).
	// Falls back to API_URL if not set (backward compat with embedded mode).
	mcpURL := cfg.MCPURL
	if mcpURL == "" {
		mcpURL = cfg.APIURL
	}
	if mcpURL == "" {
		mcpURL = fmt.Sprintf("http://localhost:%d", cfg.Port)
	}

	// ── Router ────────────────────────────────────────────────────────────────
	gin.SetMode(gin.ReleaseMode)

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.RequestID())
	r.Use(middleware.Logger(log))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// ── OAuth 2.0 discovery + authorization ──────────────────────────────────
	// APIClient inside HTTPHandler calls the real API at API_URL.
	apiURL := cfg.APIURL
	if apiURL == "" {
		apiURL = fmt.Sprintf("http://localhost:%d", cfg.Port)
	}
	oauthHandler := mcp.NewOAuthHandler(mcpURL, apiURL, cfg.JWTSecret, log)
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

	// ── MCP SSE transport ────────────────────────────────────────────────────
	mcpHandler := mcp.NewHTTPHandler(mcpURL, apiURL, log)
	r.GET("/mcp/sse", middleware.Auth(cfg.JWTSecret), mcpHandler.HandleSSE)
	r.POST("/mcp/message", mcpHandler.HandleMessage)

	// ── Server ────────────────────────────────────────────────────────────────
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 0, // Must be 0 for SSE connections (long-lived streaming)
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Info().
			Int("port", cfg.Port).
			Str("mcp_url", mcpURL).
			Str("api_url", apiURL).
			Msg("mcp-server: starting")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("listen")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info().Msg("mcp-server: shutting down")

	mcpHandler.Shutdown()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("server forced to shutdown")
	}
}

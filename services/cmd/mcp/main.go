package main

import (
	"context"
	"flag"
	"os"

	"github.com/rs/zerolog"
	"github.com/workived/services/internal/mcp"
	"github.com/workived/services/internal/platform/config"
	"github.com/workived/services/pkg/logger"
)

func main() {
	// Parse command-line flags
	forceLogin := flag.Bool("login", false, "Force new login (ignore saved session)")
	logout := flag.Bool("logout", false, "Logout and delete saved session")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log := zerolog.New(os.Stderr).With().Timestamp().Logger()
		log.Fatal().Err(err).Msg("load config")
	}

	log := logger.New(cfg.Env)
	zerolog.SetGlobalLevel(logger.FromLevel(cfg.LogLevel))

	// Handle logout
	if *logout {
		if err := mcp.DeleteToken(); err != nil {
			log.Error().Err(err).Msg("failed to delete session")
			os.Exit(1)
		}
		log.Info().Msg("✅ Logged out successfully")
		return
	}

	ctx := context.Background()

	// Get app URL from environment (default to localhost for development)
	appURL := os.Getenv("WORKIVED_APP_URL")
	if appURL == "" {
		appURL = "http://localhost:8080" // Default for local development
		log.Info().Msg("WORKIVED_APP_URL not set, using http://localhost:8080")
	}

	// Create MCP server (100% API-based, no database needed!)
	server := mcp.NewServer(appURL, log)

	// Authenticate via SSO (browser-based, pure API flow)
	if err := server.AuthenticateWithSSO(ctx, appURL, *forceLogin); err != nil {
		log.Fatal().Err(err).Msg("MCP authentication failed")
	}

	log.Info().Msg("✅ Authenticated successfully - MCP server ready")

	// Run server (stdio mode for MCP protocol)
	if err := server.Run(ctx); err != nil {
		log.Fatal().Err(err).Msg("mcp server failed")
	}
}

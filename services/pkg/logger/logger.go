package logger

import (
	"io"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// New creates a new zerolog logger configured for the given environment.
// In production, logs are JSON formatted. In development, logs are pretty-printed.
func New(env string) zerolog.Logger {
	zerolog.TimeFieldFormat = time.RFC3339

	var output io.Writer = os.Stdout
	if env == "development" {
		output = zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: "15:04:05"}
	}

	return zerolog.New(output).
		With().
		Timestamp().
		Logger()
}

// FromLevel parses a log level string and returns the corresponding zerolog.Level.
// Defaults to InfoLevel if the input is invalid.
func FromLevel(level string) zerolog.Level {
	switch level {
	case "debug":
		return zerolog.DebugLevel
	case "info":
		return zerolog.InfoLevel
	case "warn":
		return zerolog.WarnLevel
	case "error":
		return zerolog.ErrorLevel
	case "fatal":
		return zerolog.FatalLevel
	default:
		return zerolog.InfoLevel
	}
}

// WithContext adds common context fields (org_id, user_id, request_id) to a logger
// from the Gin context. Returns the original logger if fields are not present.
func WithContext(log zerolog.Logger, c *gin.Context) zerolog.Logger {
	l := log

	// Add request_id if present
	if reqID, exists := c.Get("request_id"); exists {
		if id, ok := reqID.(string); ok {
			l = l.With().Str("request_id", id).Logger()
		}
	}

	// Add org_id if present (from tenant middleware)
	if orgID, exists := c.Get("org_id"); exists {
		if id, ok := orgID.(uuid.UUID); ok {
			l = l.With().Str("org_id", id.String()).Logger()
		}
	}

	// Add user_id if present (from auth middleware)
	if userID, exists := c.Get("user_id"); exists {
		if id, ok := userID.(uuid.UUID); ok {
			l = l.With().Str("user_id", id.String()).Logger()
		}
	}

	return l
}

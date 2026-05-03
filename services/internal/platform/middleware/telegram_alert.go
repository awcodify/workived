package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/workived/services/pkg/notify"
)

// bodyCapture wraps gin.ResponseWriter to record the response body.
type bodyCapture struct {
	gin.ResponseWriter
	buf bytes.Buffer
}

func (b *bodyCapture) Write(data []byte) (int, error) {
	b.buf.Write(data)
	return b.ResponseWriter.Write(data)
}

// TelegramAlert sends a Telegram message whenever the response status is >= 500.
// Must be placed AFTER gin.Recovery() so panics are caught before this runs.
func TelegramAlert(n notify.Notifier) gin.HandlerFunc {
	return func(c *gin.Context) {
		cap := &bodyCapture{ResponseWriter: c.Writer}
		c.Writer = cap

		c.Next()

		status := c.Writer.Status()
		if status < 500 {
			return
		}

		requestID := RequestIDFromCtx(c)
		errSummary := extractErrorSummary(cap.buf.Bytes())

		// Include org/user context when available
		var contextLines []string
		if orgID := c.GetString("org_id"); orgID != "" {
			contextLines = append(contextLines, "Org: "+orgID)
		}
		if userID := c.GetString("user_id"); userID != "" {
			contextLines = append(contextLines, "User: "+userID)
		}
		if q := c.Request.URL.RawQuery; q != "" {
			contextLines = append(contextLines, "Query: "+q)
		}

		msg := fmt.Sprintf(
			"🚨 %d Error\n%s %s\nRequest-ID: %s\nTime: %s\nError: %s",
			status,
			c.Request.Method,
			c.Request.URL.Path,
			requestID,
			time.Now().UTC().Format(time.RFC3339),
			errSummary,
		)
		if len(contextLines) > 0 {
			msg += "\n" + strings.Join(contextLines, "\n")
		}

		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			_ = n.Send(ctx, msg)
		}()
	}
}

// extractErrorSummary parses the JSON response body for {"error":{"code":"...","message":"..."}}.
// Falls back to raw body (truncated) if parsing fails.
func extractErrorSummary(body []byte) string {
	if len(body) == 0 {
		return "(empty response body)"
	}

	var envelope struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &envelope); err == nil && envelope.Error.Message != "" {
		if envelope.Error.Code != "" {
			return fmt.Sprintf("[%s] %s", envelope.Error.Code, envelope.Error.Message)
		}
		return envelope.Error.Message
	}

	// Fallback: raw body, capped at 200 chars
	raw := strings.TrimSpace(string(body))
	if len(raw) > 200 {
		raw = raw[:200] + "…"
	}
	return raw
}

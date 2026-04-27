package middleware

import (
	"context"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/workived/services/pkg/notify"
)

// TelegramAlert sends a Telegram message whenever the response status is >= 500.
// Must be placed AFTER gin.Recovery() so panics are caught before this runs.
func TelegramAlert(n notify.Notifier) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		status := c.Writer.Status()
		if status < 500 {
			return
		}

		requestID := RequestIDFromCtx(c)
		errSummary := c.Errors.ByType(gin.ErrorTypeAny).String()
		if errSummary == "" {
			errSummary = "(no error detail)"
		}

		msg := fmt.Sprintf(
			"🚨 500 Error\n%s %s\nStatus: %d\nRequest-ID: %s\nTime: %s\nErrors: %s",
			c.Request.Method,
			c.Request.URL.Path,
			status,
			requestID,
			time.Now().UTC().Format(time.RFC3339),
			errSummary,
		)

		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			_ = n.Send(ctx, msg)
		}()
	}
}

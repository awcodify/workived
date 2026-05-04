package webhook

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"github.com/workived/services/pkg/notify"
)

type Handler struct {
	notifier notify.Notifier
	token    string
	log      zerolog.Logger
}

func NewHandler(notifier notify.Notifier, token string, log zerolog.Logger) *Handler {
	return &Handler{notifier: notifier, token: token, log: log}
}

func (h *Handler) RegisterRoutes(r *gin.Engine) {
	r.POST("/webhooks/railway", h.Railway)
}

// Railway receives Railway platform events and forwards a summary to Telegram.
// Authentication via query parameter token (?token=xxx).
// RAILWAY_WEBHOOK_TOKEN must be set and included in the webhook URL configured in Railway.
func (h *Handler) Railway(c *gin.Context) {
	if h.token == "" {
		h.log.Error().Msg("railway webhook: RAILWAY_WEBHOOK_TOKEN not configured")
		c.Status(http.StatusInternalServerError)
		return
	}

	if c.Query("token") != h.token {
		h.log.Warn().Msg("railway webhook: invalid or missing token")
		c.Status(http.StatusUnauthorized)
		return
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}

	var p RailwayPayload
	if err := json.Unmarshal(body, &p); err != nil {
		c.Status(http.StatusBadRequest)
		return
	}

	msg := formatMessage(p)
	h.log.Info().Str("event_type", p.Type).Str("severity", p.Severity).Msg("railway webhook received")

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := h.notifier.Send(ctx, msg); err != nil {
			h.log.Error().Err(err).Str("event_type", p.Type).Msg("railway webhook: failed to send notification")
		}
	}()

	c.Status(http.StatusNoContent)
}

func formatMessage(p RailwayPayload) string {
	icon := eventIcon(p.Type)
	short := commitShort(p.Details.CommitHash)

	lines := []string{
		fmt.Sprintf("%s Railway: %s", icon, p.Type),
		fmt.Sprintf("Project:  %s / %s", p.Resource.Project.Name, p.Resource.Environment.Name),
		fmt.Sprintf("Service:  %s", p.Resource.Service.Name),
	}

	if p.Details.Branch != "" {
		lines = append(lines, fmt.Sprintf("Branch:   %s", p.Details.Branch))
	}
	if short != "" {
		commitLine := short
		if p.Details.CommitAuthor != "" {
			commitLine += " by " + p.Details.CommitAuthor
		}
		if p.Details.CommitMessage != "" {
			msg := p.Details.CommitMessage
			if len(msg) > 72 {
				msg = msg[:72] + "…"
			}
			commitLine += " — " + msg
		}
		lines = append(lines, fmt.Sprintf("Commit:   %s", commitLine))
	}
	if p.Details.Status != "" {
		lines = append(lines, fmt.Sprintf("Status:   %s", p.Details.Status))
	}
	if p.Timestamp != "" {
		lines = append(lines, fmt.Sprintf("Time:     %s", p.Timestamp))
	}

	return strings.Join(lines, "\n")
}

// eventIcon derives the icon from the event type, which is more reliable than
// the severity field Railway attaches to the payload.
func eventIcon(eventType string) string {
	switch eventType {
	case "Deployment.Crashed", "Deployment.OomKilled", "Deployment.Failed",
		"VolumeAlert.Triggered", "Monitor.Triggered":
		return "🔴"
	case "Deployment.Restarted", "Deployment.Removed", "Deployment.Waiting",
		"Deployment.NeedsApproval", "Monitor.Deleted":
		return "🟡"
	default:
		return "🟢"
	}
}

func commitShort(hash string) string {
	if len(hash) >= 7 {
		return hash[:7]
	}
	return hash
}

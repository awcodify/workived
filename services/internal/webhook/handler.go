package webhook

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
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
	secret   string
	log      zerolog.Logger
}

func NewHandler(notifier notify.Notifier, secret string, log zerolog.Logger) *Handler {
	return &Handler{notifier: notifier, secret: secret, log: log}
}

func (h *Handler) RegisterRoutes(r *gin.Engine) {
	r.POST("/webhooks/railway", h.Railway)
}

// Railway receives Railway platform events and forwards a summary to Telegram.
// Railway signs the body with HMAC-SHA256; the signature is in X-Railway-Signature
// as "sha256=<hex>". Set RAILWAY_WEBHOOK_SECRET to enable verification.
func (h *Handler) Railway(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}

	if h.secret != "" && !h.validSignature(body, c.GetHeader("X-Railway-Signature")) {
		h.log.Warn().Msg("railway webhook: invalid signature")
		c.Status(http.StatusUnauthorized)
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

func (h *Handler) validSignature(body []byte, header string) bool {
	const prefix = "sha256="
	if !strings.HasPrefix(header, prefix) {
		return false
	}
	expected, err := hex.DecodeString(strings.TrimPrefix(header, prefix))
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, []byte(h.secret))
	mac.Write(body)
	return hmac.Equal(mac.Sum(nil), expected)
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

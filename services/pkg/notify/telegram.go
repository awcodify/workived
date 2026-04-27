package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/rs/zerolog"
)

// Notifier sends text notifications to an alerting channel.
type Notifier interface {
	Send(ctx context.Context, msg string) error
}

// NoOpNotifier silently drops all messages (disabled state).
type NoOpNotifier struct{}

func (n *NoOpNotifier) Send(_ context.Context, _ string) error { return nil }

// TelegramNotifier sends messages via Telegram Bot API.
type TelegramNotifier struct {
	token  string
	chatID string
	log    zerolog.Logger
	client *http.Client
}

func NewTelegramNotifier(token, chatID string, log zerolog.Logger) *TelegramNotifier {
	return &TelegramNotifier{
		token:  token,
		chatID: chatID,
		log:    log,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (t *TelegramNotifier) Send(ctx context.Context, msg string) error {
	body, err := json.Marshal(map[string]string{
		"chat_id": t.chatID,
		"text":    msg,
	})
	if err != nil {
		return fmt.Errorf("marshal telegram payload: %w", err)
	}

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", t.token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build telegram request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := t.client.Do(req)
	if err != nil {
		return fmt.Errorf("telegram send: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.log.Error().
			Int("status", resp.StatusCode).
			Str("chat_id", t.chatID).
			RawJSON("response", body).
			Msg("notify.telegram: API error")
		return fmt.Errorf("telegram API returned %d: %s", resp.StatusCode, body)
	}

	t.log.Debug().Str("chat_id", t.chatID).Msg("notify.telegram: message sent")
	return nil
}

package email

import (
	"fmt"

	"github.com/resend/resend-go/v3"
	"github.com/rs/zerolog"
)

// ResendConfig holds Resend API configuration.
type ResendConfig struct {
	APIKey string
	From   string
}

// resendSender implements Sender using the Resend API.
type resendSender struct {
	client *resend.Client
	from   string
	log    zerolog.Logger
}

// NewResendSender creates a new Resend email sender.
func NewResendSender(config ResendConfig, log zerolog.Logger) Sender {
	client := resend.NewClient(config.APIKey)
	return &resendSender{
		client: client,
		from:   config.From,
		log:    log,
	}
}

// Send sends an email via the Resend API.
func (s *resendSender) Send(msg Message) error {
	if len(msg.To) == 0 {
		return fmt.Errorf("no recipients specified")
	}

	params := &resend.SendEmailRequest{
		From:    s.from,
		To:      msg.To,
		Subject: msg.Subject,
	}

	if msg.IsHTML {
		params.Html = msg.Body
	} else {
		params.Text = msg.Body
	}

	sent, err := s.client.Emails.Send(params)
	if err != nil {
		s.log.Error().
			Err(err).
			Strs("recipients", msg.To).
			Str("subject", msg.Subject).
			Msg("failed to send email via Resend")
		return fmt.Errorf("send email via resend: %w", err)
	}

	s.log.Info().
		Str("resend_id", sent.Id).
		Strs("recipients", msg.To).
		Str("subject", msg.Subject).
		Msg("email.sent")

	return nil
}

package email

import (
	"fmt"
	"net/smtp"
	"strings"

	"github.com/rs/zerolog"
)

// Sender sends emails via SMTP.
type Sender interface {
	Send(msg Message) error
}

// Message represents an email to be sent.
type Message struct {
	To      []string
	Subject string
	Body    string
	IsHTML  bool
}

// SMTPConfig holds SMTP server configuration.
type SMTPConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
}

// smtpSender implements Sender using net/smtp.
type smtpSender struct {
	config SMTPConfig
	log    zerolog.Logger
}

// NewSMTPSender creates a new SMTP email sender.
func NewSMTPSender(config SMTPConfig, log zerolog.Logger) Sender {
	return &smtpSender{
		config: config,
		log:    log,
	}
}

// Send sends an email via SMTP.
func (s *smtpSender) Send(msg Message) error {
	if len(msg.To) == 0 {
		return fmt.Errorf("no recipients specified")
	}

	// Build SMTP message
	body := s.buildMessage(msg)

	// SMTP auth (skip for mailcatcher in local dev)
	var auth smtp.Auth
	if s.config.Username != "" && s.config.Password != "" {
		auth = smtp.PlainAuth("", s.config.Username, s.config.Password, s.config.Host)
	}

	// Send email
	addr := fmt.Sprintf("%s:%d", s.config.Host, s.config.Port)
	err := smtp.SendMail(addr, auth, s.config.From, msg.To, []byte(body))
	if err != nil {
		s.log.Error().
			Err(err).
			Str("smtp_host", s.config.Host).
			Int("smtp_port", s.config.Port).
			Strs("recipients", msg.To).
			Str("subject", msg.Subject).
			Msg("failed to send email")
		return fmt.Errorf("send email: %w", err)
	}

	s.log.Info().
		Strs("recipients", msg.To).
		Str("subject", msg.Subject).
		Msg("email.sent")

	return nil
}

// buildMessage constructs the raw SMTP message with headers.
func (s *smtpSender) buildMessage(msg Message) string {
	var sb strings.Builder

	sb.WriteString("From: " + s.config.From + "\r\n")
	sb.WriteString("To: " + strings.Join(msg.To, ", ") + "\r\n")
	sb.WriteString("Subject: " + msg.Subject + "\r\n")

	if msg.IsHTML {
		sb.WriteString("MIME-Version: 1.0\r\n")
		sb.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	} else {
		sb.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	}

	sb.WriteString("\r\n")
	sb.WriteString(msg.Body)

	return sb.String()
}

// NoOpSender is a no-op email sender for testing.
type NoOpSender struct{}

// NewNoOpSender creates a sender that doesn't actually send emails.
func NewNoOpSender() Sender {
	return &NoOpSender{}
}

// Send does nothing.
func (n *NoOpSender) Send(msg Message) error {
	return nil
}

package email

import (
	"os"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewResendSender(t *testing.T) {
	log := zerolog.New(os.Stderr)
	sender := NewResendSender(ResendConfig{
		APIKey: "re_test_123",
		From:   "test@workived.com",
	}, log)

	assert.NotNil(t, sender)

	rs, ok := sender.(*resendSender)
	require.True(t, ok)
	assert.Equal(t, "test@workived.com", rs.from)
	assert.NotNil(t, rs.client)
}

func TestResendSender_Send_NoRecipients(t *testing.T) {
	log := zerolog.New(os.Stderr)
	sender := NewResendSender(ResendConfig{
		APIKey: "re_test_123",
		From:   "test@workived.com",
	}, log)

	err := sender.Send(Message{
		To:      []string{},
		Subject: "Test",
		Body:    "Hello",
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no recipients specified")
}

func TestResendSender_Send_InvalidAPIKey(t *testing.T) {
	log := zerolog.New(os.Stderr)
	sender := NewResendSender(ResendConfig{
		APIKey: "re_invalid_key",
		From:   "test@workived.com",
	}, log)

	// With an invalid key, Resend API returns an error
	err := sender.Send(Message{
		To:      []string{"user@example.com"},
		Subject: "Test",
		Body:    "<p>Hello</p>",
		IsHTML:  true,
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "send email via resend")
}

func TestResendSender_Send_PlainText(t *testing.T) {
	log := zerolog.New(os.Stderr)
	sender := NewResendSender(ResendConfig{
		APIKey: "re_invalid_key",
		From:   "test@workived.com",
	}, log)

	// Plain text email (also fails with invalid key, but tests the code path)
	err := sender.Send(Message{
		To:      []string{"user@example.com"},
		Subject: "Test",
		Body:    "Hello plain text",
		IsHTML:  false,
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "send email via resend")
}

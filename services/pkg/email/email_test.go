package email

import (
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildMessage(t *testing.T) {
	config := SMTPConfig{
		Host:     "localhost",
		Port:     1025,
		From:     "noreply@workived.com",
		Username: "",
		Password: "",
	}

	sender := NewSMTPSender(config, zerolog.Nop()).(*smtpSender)

	t.Run("plain text message", func(t *testing.T) {
		msg := Message{
			To:      []string{"user@example.com"},
			Subject: "Test Email",
			Body:    "Hello, World!",
			IsHTML:  false,
		}

		result := sender.buildMessage(msg)

		assert.Contains(t, result, "From: noreply@workived.com")
		assert.Contains(t, result, "To: user@example.com")
		assert.Contains(t, result, "Subject: Test Email")
		assert.Contains(t, result, "Content-Type: text/plain; charset=UTF-8")
		assert.Contains(t, result, "Hello, World!")
		assert.NotContains(t, result, "MIME-Version")
	})

	t.Run("HTML message", func(t *testing.T) {
		msg := Message{
			To:      []string{"user@example.com"},
			Subject: "Test HTML Email",
			Body:    "<h1>Hello</h1><p>World!</p>",
			IsHTML:  true,
		}

		result := sender.buildMessage(msg)

		assert.Contains(t, result, "From: noreply@workived.com")
		assert.Contains(t, result, "To: user@example.com")
		assert.Contains(t, result, "Subject: Test HTML Email")
		assert.Contains(t, result, "MIME-Version: 1.0")
		assert.Contains(t, result, "Content-Type: text/html; charset=UTF-8")
		assert.Contains(t, result, "<h1>Hello</h1><p>World!</p>")
	})

	t.Run("multiple recipients", func(t *testing.T) {
		msg := Message{
			To:      []string{"user1@example.com", "user2@example.com"},
			Subject: "Test Multiple",
			Body:    "Hello, everyone!",
			IsHTML:  false,
		}

		result := sender.buildMessage(msg)

		assert.Contains(t, result, "To: user1@example.com, user2@example.com")
	})
}

func TestSendValidation(t *testing.T) {
	config := SMTPConfig{
		Host: "localhost",
		Port: 1025,
		From: "noreply@workived.com",
	}

	sender := NewSMTPSender(config, zerolog.Nop())

	t.Run("returns error when no recipients", func(t *testing.T) {
		msg := Message{
			To:      []string{},
			Subject: "Test",
			Body:    "Body",
		}

		err := sender.Send(msg)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "no recipients")
	})
}

func TestNoOpSender(t *testing.T) {
	sender := NewNoOpSender()

	msg := Message{
		To:      []string{"user@example.com"},
		Subject: "Test",
		Body:    "Body",
	}

	err := sender.Send(msg)
	assert.NoError(t, err)
}

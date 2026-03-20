package email

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInvitationTemplate(t *testing.T) {
	data := map[string]string{
		"InviterName": "John Doe",
		"OrgName":     "Acme Corp",
		"InviteURL":   "https://app.workived.com/invite/abc123",
	}

	subject, html, text, err := InvitationTemplate.Render(data)
	require.NoError(t, err)

	// Check subject
	assert.Contains(t, subject, "Acme Corp")
	assert.Contains(t, subject, "Workived")

	// Check HTML
	assert.Contains(t, html, "John Doe")
	assert.Contains(t, html, "Acme Corp")
	assert.Contains(t, html, "https://app.workived.com/invite/abc123")
	assert.Contains(t, html, "<!DOCTYPE html>")

	// Check text
	assert.Contains(t, text, "John Doe")
	assert.Contains(t, text, "Acme Corp")
	assert.Contains(t, text, "https://app.workived.com/invite/abc123")
}

func TestPasswordResetTemplate(t *testing.T) {
	data := map[string]string{
		"UserName": "Jane Smith",
		"ResetURL": "https://app.workived.com/reset/xyz789",
	}

	subject, html, text, err := PasswordResetTemplate.Render(data)
	require.NoError(t, err)

	// Check subject
	assert.Contains(t, subject, "Reset")
	assert.Contains(t, subject, "password")

	// Check HTML
	assert.Contains(t, html, "Jane Smith")
	assert.Contains(t, html, "https://app.workived.com/reset/xyz789")

	// Check text
	assert.Contains(t, text, "Jane Smith")
	assert.Contains(t, text, "https://app.workived.com/reset/xyz789")
}

func TestWelcomeTemplate(t *testing.T) {
	data := map[string]string{
		"UserName": "Alice Johnson",
		"AppURL":   "https://app.workived.com",
	}

	subject, html, text, err := WelcomeTemplate.Render(data)
	require.NoError(t, err)

	// Check subject
	assert.Contains(t, subject, "Welcome")

	// Check HTML
	assert.Contains(t, html, "Alice Johnson")
	assert.Contains(t, html, "https://app.workived.com")

	// Check text
	assert.Contains(t, text, "Alice Johnson")
	assert.Contains(t, text, "https://app.workived.com")
}

func TestTemplateRenderError(t *testing.T) {
	// Test with invalid template syntax
	invalidTemplate := Template{
		Subject:  "{{.Missing",
		BodyHTML: "{{.Field}}",
		BodyText: "{{.Field}}",
	}

	_, _, _, err := invalidTemplate.Render(map[string]string{})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "parse subject template")
}

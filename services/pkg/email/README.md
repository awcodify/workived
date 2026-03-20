# Email Package

Email sending infrastructure with SMTP support and pre-built templates.

## Features

- **SMTP sender**: Standard SMTP email delivery (supports mailcatcher for local dev)
- **NoOp sender**: Silent sender for testing
- **Pre-built templates**: Invitation, password reset, welcome emails
- **HTML + Plain text**: Automatic multi-part emails
- **Logging**: Structured logging with zerolog

## Quick Start

### Setup (Local Development with Mailcatcher)

1. **Start mailcatcher** (already in docker-compose.yml):
   ```bash
   docker-compose up -d mailcatcher
   ```

2. **Configure environment** (.env):
   ```env
   SMTP_HOST=localhost
   SMTP_PORT=1025
   SMTP_USER=
   SMTP_PASS=
   EMAIL_FROM=noreply@workived.com
   ```

3. **View sent emails**: http://localhost:1080

### Usage

#### Basic Email

```go
import (
    "github.com/workived/services/pkg/email"
    "github.com/rs/zerolog"
)

// Create sender
config := email.SMTPConfig{
    Host:     cfg.SMTPHost,
    Port:     cfg.SMTPPort,
    Username: cfg.SMTPUser,
    Password: cfg.SMTPPass,
    From:     cfg.EmailFrom,
}
sender := email.NewSMTPSender(config, log)

// Send email
msg := email.Message{
    To:      []string{"user@example.com"},
    Subject: "Test Email",
    Body:    "Hello, World!",
    IsHTML:  false,
}
err := sender.Send(msg)
```

#### Using Templates

```go
// Prepare data
data := map[string]string{
    "InviterName": "John Doe",
    "OrgName":     "Acme Corp",
    "InviteURL":   "https://app.workived.com/invite/abc123",
}

// Render template
subject, bodyHTML, bodyText, err := email.InvitationTemplate.Render(data)
if err != nil {
    return err
}

// Send HTML email
msg := email.Message{
    To:      []string{"newmember@example.com"},
    Subject: subject,
    Body:    bodyHTML,
    IsHTML:  true,
}
err = sender.Send(msg)
```

## Available Templates

### InvitationTemplate
Used for organisation invitations.

**Data fields:**
- `InviterName` - Name of person sending invite
- `OrgName` - Organisation name
- `InviteURL` - Full invitation acceptance URL

### PasswordResetTemplate
Used for password reset requests.

**Data fields:**
- `UserName` - User's display name
- `ResetURL` - Password reset link

### WelcomeTemplate
Used for new user welcome emails.

**Data fields:**
- `UserName` - User's display name
- `AppURL` - Application base URL

## Testing

### Run tests
```bash
go test ./pkg/email/... -v
```

### Use NoOpSender in tests
```go
sender := email.NewNoOpSender()
// Emails won't actually be sent
```

## Production Setup

For production, use a real SMTP provider (SendGrid, AWS SES, etc.):

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
EMAIL_FROM=noreply@yourdomain.com
```

## Logging

All email sends are logged with structured fields:
- **Success**: `email.sent` with recipients and subject
- **Failure**: `failed to send email` with error details

Example log output:
```json
{
  "level": "info",
  "recipients": ["user@example.com"],
  "subject": "Welcome to Workived",
  "message": "email.sent"
}
```

## Architecture

```
pkg/email/
├── email.go           # Core sender interfaces and SMTP implementation
├── email_test.go      # Sender tests
├── templates.go       # Pre-built email templates
├── templates_test.go  # Template rendering tests
└── README.md          # This file
```

## Future Enhancements

- [ ] Attachment support
- [ ] Template variable validation
- [ ] Rate limiting
- [ ] Retry logic with exponential backoff
- [ ] Email queue for async sending
- [ ] Bounce/complaint handling

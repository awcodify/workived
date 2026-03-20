package email

import (
	"bytes"
	"fmt"
	"html/template"
)

// Template represents an email template.
type Template struct {
	Subject  string
	BodyHTML string
	BodyText string
}

// Templates for common email types.
var (
	// InvitationTemplate is used for organisation invitations.
	InvitationTemplate = Template{
		Subject:  "You've been invited to join {{.OrgName}} on Workived",
		BodyHTML: invitationHTML,
		BodyText: invitationText,
	}

	// PasswordResetTemplate is used for password reset requests.
	PasswordResetTemplate = Template{
		Subject:  "Reset your Workived password",
		BodyHTML: passwordResetHTML,
		BodyText: passwordResetText,
	}

	// WelcomeTemplate is used for new user welcome emails.
	WelcomeTemplate = Template{
		Subject:  "Welcome to Workived",
		BodyHTML: welcomeHTML,
		BodyText: welcomeText,
	}
)

// Render renders the template with the given data.
func (t Template) Render(data any) (subject, bodyHTML, bodyText string, err error) {
	// Render subject
	subjTmpl, err := template.New("subject").Parse(t.Subject)
	if err != nil {
		return "", "", "", fmt.Errorf("parse subject template: %w", err)
	}
	var subjBuf bytes.Buffer
	if err := subjTmpl.Execute(&subjBuf, data); err != nil {
		return "", "", "", fmt.Errorf("execute subject template: %w", err)
	}
	subject = subjBuf.String()

	// Render HTML body
	htmlTmpl, err := template.New("html").Parse(t.BodyHTML)
	if err != nil {
		return "", "", "", fmt.Errorf("parse HTML template: %w", err)
	}
	var htmlBuf bytes.Buffer
	if err := htmlTmpl.Execute(&htmlBuf, data); err != nil {
		return "", "", "", fmt.Errorf("execute HTML template: %w", err)
	}
	bodyHTML = htmlBuf.String()

	// Render text body
	textTmpl, err := template.New("text").Parse(t.BodyText)
	if err != nil {
		return "", "", "", fmt.Errorf("parse text template: %w", err)
	}
	var textBuf bytes.Buffer
	if err := textTmpl.Execute(&textBuf, data); err != nil {
		return "", "", "", fmt.Errorf("execute text template: %w", err)
	}
	bodyText = textBuf.String()

	return subject, bodyHTML, bodyText, nil
}

const invitationHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #6357E8; font-size: 24px; margin-bottom: 20px;">You've been invited!</h1>
        <p>Hi there,</p>
        <p><strong>{{.InviterName}}</strong> has invited you to join <strong>{{.OrgName}}</strong> on Workived.</p>
        <p style="margin: 30px 0;">
            <a href="{{.InviteURL}}" style="background: #6357E8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation</a>
        </p>
        <p style="font-size: 14px; color: #666;">
            This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
        </p>
    </div>
</body>
</html>`

const invitationText = `You've been invited!

Hi there,

{{.InviterName}} has invited you to join {{.OrgName}} on Workived.

Accept your invitation here:
{{.InviteURL}}

This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.`

const passwordResetHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #6357E8; font-size: 24px; margin-bottom: 20px;">Reset your password</h1>
        <p>Hi {{.UserName}},</p>
        <p>We received a request to reset your Workived password.</p>
        <p style="margin: 30px 0;">
            <a href="{{.ResetURL}}" style="background: #6357E8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
        </p>
        <p style="font-size: 14px; color: #666;">
            This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
    </div>
</body>
</html>`

const passwordResetText = `Reset your password

Hi {{.UserName}},

We received a request to reset your Workived password.

Reset your password here:
{{.ResetURL}}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.`

const welcomeHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #6357E8; font-size: 24px; margin-bottom: 20px;">Welcome to Workived! 🎉</h1>
        <p>Hi {{.UserName}},</p>
        <p>Thanks for signing up! We're excited to help you manage your team.</p>
        <p>Here's what you can do next:</p>
        <ul>
            <li>Invite your team members</li>
            <li>Set up departments and work schedules</li>
            <li>Configure leave policies</li>
        </ul>
        <p style="margin: 30px 0;">
            <a href="{{.AppURL}}" style="background: #6357E8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Get Started</a>
        </p>
        <p style="font-size: 14px; color: #666;">
            Need help? Reply to this email or check out our docs.
        </p>
    </div>
</body>
</html>`

const welcomeText = `Welcome to Workived! 🎉

Hi {{.UserName}},

Thanks for signing up! We're excited to help you manage your team.

Here's what you can do next:
- Invite your team members
- Set up departments and work schedules
- Configure leave policies

Get started here:
{{.AppURL}}

Need help? Reply to this email or check out our docs.`

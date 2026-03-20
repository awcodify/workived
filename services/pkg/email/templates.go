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

	// ClaimPendingApprovalTemplate notifies managers of new claim submissions.
	ClaimPendingApprovalTemplate = Template{
		Subject:  "New claim from {{.EmployeeName}} requires your approval",
		BodyHTML: claimPendingApprovalHTML,
		BodyText: claimPendingApprovalText,
	}

	// ClaimApprovedTemplate notifies employees when their claim is approved.
	ClaimApprovedTemplate = Template{
		Subject:  "Your {{.CategoryName}} claim has been approved",
		BodyHTML: claimApprovedHTML,
		BodyText: claimApprovedText,
	}

	// ClaimRejectedTemplate notifies employees when their claim is rejected.
	ClaimRejectedTemplate = Template{
		Subject:  "Your {{.CategoryName}} claim has been rejected",
		BodyHTML: claimRejectedHTML,
		BodyText: claimRejectedText,
	}

	// LeavePendingApprovalTemplate notifies managers of new leave requests.
	LeavePendingApprovalTemplate = Template{
		Subject:  "New leave request from {{.EmployeeName}} requires your approval",
		BodyHTML: leavePendingApprovalHTML,
		BodyText: leavePendingApprovalText,
	}

	// LeaveApprovedTemplate notifies employees when their leave is approved.
	LeaveApprovedTemplate = Template{
		Subject:  "Your leave request has been approved",
		BodyHTML: leaveApprovedHTML,
		BodyText: leaveApprovedText,
	}

	// LeaveRejectedTemplate notifies employees when their leave is rejected.
	LeaveRejectedTemplate = Template{
		Subject:  "Your leave request has been rejected",
		BodyHTML: leaveRejectedHTML,
		BodyText: leaveRejectedText,
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

// ── Claims Notifications ──────────────────────────────────────────────────────

const claimPendingApprovalHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #6357E8; font-size: 24px; margin-bottom: 20px;">New Claim Requires Your Approval</h1>
        <p>Hi {{.ReviewerName}},</p>
        <p><strong>{{.EmployeeName}}</strong> has submitted a new claim that requires your approval.</p>
        <div style="background: #F5F5F5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Category:</strong> {{.CategoryName}}</p>
            <p style="margin: 5px 0;"><strong>Amount:</strong> {{.AmountFormatted}}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> {{.ClaimDate}}</p>
            {{if .Description}}<p style="margin: 5px 0;"><strong>Description:</strong> {{.Description}}</p>{{end}}
        </div>
        <p style="margin: 30px 0;">
            <a href="{{.AppURL}}/claims?view=pending" style="background: #6357E8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Review Claim</a>
        </p>
    </div>
</body>
</html>`

const claimPendingApprovalText = `New Claim Requires Your Approval

Hi {{.ReviewerName}},

{{.EmployeeName}} has submitted a new claim that requires your approval.

Category: {{.CategoryName}}
Amount: {{.AmountFormatted}}
Date: {{.ClaimDate}}
{{if .Description}}Description: {{.Description}}{{end}}

Review the claim here:
{{.AppURL}}/claims?view=pending`

const claimApprovedHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #12A05C; font-size: 24px; margin-bottom: 20px;">✓ Your Claim Has Been Approved</h1>
        <p>Hi {{.EmployeeName}},</p>
        <p>Good news! Your claim has been approved by <strong>{{.ReviewerName}}</strong>.</p>
        <div style="background: #E8F7EE; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #12A05C;">
            <p style="margin: 5px 0;"><strong>Category:</strong> {{.CategoryName}}</p>
            <p style="margin: 5px 0;"><strong>Amount:</strong> {{.AmountFormatted}}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> {{.ClaimDate}}</p>
            {{if .ReviewNote}}<p style="margin: 5px 0;"><strong>Note:</strong> {{.ReviewNote}}</p>{{end}}
        </div>
        <p style="margin: 30px 0;">
            <a href="{{.AppURL}}/claims" style="background: #6357E8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View All Claims</a>
        </p>
    </div>
</body>
</html>`

const claimApprovedText = `✓ Your Claim Has Been Approved

Hi {{.EmployeeName}},

Good news! Your claim has been approved by {{.ReviewerName}}.

Category: {{.CategoryName}}
Amount: {{.AmountFormatted}}
Date: {{.ClaimDate}}
{{if .ReviewNote}}Note: {{.ReviewNote}}{{end}}

View all your claims here:
{{.AppURL}}/claims`

const claimRejectedHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #D44040; font-size: 24px; margin-bottom: 20px;">Your Claim Has Been Rejected</h1>
        <p>Hi {{.EmployeeName}},</p>
        <p>Your claim has been rejected by <strong>{{.ReviewerName}}</strong>.</p>
        <div style="background: #FDECEC; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D44040;">
            <p style="margin: 5px 0;"><strong>Category:</strong> {{.CategoryName}}</p>
            <p style="margin: 5px 0;"><strong>Amount:</strong> {{.AmountFormatted}}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> {{.ClaimDate}}</p>
            {{if .ReviewNote}}<p style="margin: 5px 0;"><strong>Reason:</strong> {{.ReviewNote}}</p>{{end}}
        </div>
        <p style="font-size: 14px; color: #666;">
            If you have questions, please contact your manager or HR.
        </p>
    </div>
</body>
</html>`

const claimRejectedText = `Your Claim Has Been Rejected

Hi {{.EmployeeName}},

Your claim has been rejected by {{.ReviewerName}}.

Category: {{.CategoryName}}
Amount: {{.AmountFormatted}}
Date: {{.ClaimDate}}
{{if .ReviewNote}}Reason: {{.ReviewNote}}{{end}}

If you have questions, please contact your manager or HR.`

// ── Leave Notifications ───────────────────────────────────────────────────────

const leavePendingApprovalHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #6357E8; font-size: 24px; margin-bottom: 20px;">New Leave Request Requires Your Approval</h1>
        <p>Hi {{.ReviewerName}},</p>
        <p><strong>{{.EmployeeName}}</strong> has submitted a new leave request that requires your approval.</p>
        <div style="background: #F5F5F5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Leave Type:</strong> {{.PolicyName}}</p>
            <p style="margin: 5px 0;"><strong>Period:</strong> {{.StartDate}} to {{.EndDate}}</p>
            <p style="margin: 5px 0;"><strong>Duration:</strong> {{.TotalDays}} day(s)</p>
            {{if .Reason}}<p style="margin: 5px 0;"><strong>Reason:</strong> {{.Reason}}</p>{{end}}
        </div>
        <p style="margin: 30px 0;">
            <a href="{{.AppURL}}/leave?view=pending" style="background: #6357E8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Review Request</a>
        </p>
    </div>
</body>
</html>`

const leavePendingApprovalText = `New Leave Request Requires Your Approval

Hi {{.ReviewerName}},

{{.EmployeeName}} has submitted a new leave request that requires your approval.

Leave Type: {{.PolicyName}}
Period: {{.StartDate}} to {{.EndDate}}
Duration: {{.TotalDays}} day(s)
{{if .Reason}}Reason: {{.Reason}}{{end}}

Review the request here:
{{.AppURL}}/leave?view=pending`

const leaveApprovedHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #12A05C; font-size: 24px; margin-bottom: 20px;">✓ Your Leave Request Has Been Approved</h1>
        <p>Hi {{.EmployeeName}},</p>
        <p>Good news! Your leave request has been approved by <strong>{{.ReviewerName}}</strong>.</p>
        <div style="background: #E8F7EE; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #12A05C;">
            <p style="margin: 5px 0;"><strong>Leave Type:</strong> {{.PolicyName}}</p>
            <p style="margin: 5px 0;"><strong>Period:</strong> {{.StartDate}} to {{.EndDate}}</p>
            <p style="margin: 5px 0;"><strong>Duration:</strong> {{.TotalDays}} day(s)</p>
            {{if .ReviewNote}}<p style="margin: 5px 0;"><strong>Note:</strong> {{.ReviewNote}}</p>{{end}}
        </div>
        <p style="font-size: 14px; color: #666;">
            Enjoy your time off!
        </p>
        <p style="margin: 30px 0;">
            <a href="{{.AppURL}}/leave" style="background: #6357E8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View All Requests</a>
        </p>
    </div>
</body>
</html>`

const leaveApprovedText = `✓ Your Leave Request Has Been Approved

Hi {{.EmployeeName}},

Good news! Your leave request has been approved by {{.ReviewerName}}.

Leave Type: {{.PolicyName}}
Period: {{.StartDate}} to {{.EndDate}}
Duration: {{.TotalDays}} day(s)
{{if .ReviewNote}}Note: {{.ReviewNote}}{{end}}

Enjoy your time off!

View all your requests here:
{{.AppURL}}/leave`

const leaveRejectedHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #D44040; font-size: 24px; margin-bottom: 20px;">Your Leave Request Has Been Rejected</h1>
        <p>Hi {{.EmployeeName}},</p>
        <p>Your leave request has been rejected by <strong>{{.ReviewerName}}</strong>.</p>
        <div style="background: #FDECEC; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D44040;">
            <p style="margin: 5px 0;"><strong>Leave Type:</strong> {{.PolicyName}}</p>
            <p style="margin: 5px 0;"><strong>Period:</strong> {{.StartDate}} to {{.EndDate}}</p>
            <p style="margin: 5px 0;"><strong>Duration:</strong> {{.TotalDays}} day(s)</p>
            {{if .ReviewNote}}<p style="margin: 5px 0;"><strong>Reason:</strong> {{.ReviewNote}}</p>{{end}}
        </div>
        <p style="font-size: 14px; color: #666;">
            If you have questions, please contact your manager or HR.
        </p>
    </div>
</body>
</html>`

const leaveRejectedText = `Your Leave Request Has Been Rejected

Hi {{.EmployeeName}},

Your leave request has been rejected by {{.ReviewerName}}.

Leave Type: {{.PolicyName}}
Period: {{.StartDate}} to {{.EndDate}}
Duration: {{.TotalDays}} day(s)
{{if .ReviewNote}}Reason: {{.ReviewNote}}{{end}}

If you have questions, please contact your manager or HR.`

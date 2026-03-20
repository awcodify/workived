package approval

import (
	"time"

	"github.com/google/uuid"
)

// Status constants — shared by leave_requests and claims.
// Every approvable entity follows: pending → approved | rejected | cancelled
const (
	StatusPending   = "pending"
	StatusApproved  = "approved"
	StatusRejected  = "rejected"
	StatusCancelled = "cancelled"
)

// ReviewInfo contains the common reviewer metadata embedded in approval workflows.
// Both leave_requests and claims tables have these exact columns.
type ReviewInfo struct {
	ReviewedBy *uuid.UUID `json:"reviewed_by,omitempty"` // Employee ID of reviewer
	ReviewedAt *time.Time `json:"reviewed_at,omitempty"`
	ReviewNote *string    `json:"review_note,omitempty"` // Optional comment (required for rejection)
}

// ValidStatus returns true if the status is one of the valid approval statuses.
func ValidStatus(status string) bool {
	switch status {
	case StatusPending, StatusApproved, StatusRejected, StatusCancelled:
		return true
	default:
		return false
	}
}

// IsFinalStatus returns true if the status cannot be changed (terminal state).
func IsFinalStatus(status string) bool {
	return status == StatusApproved || status == StatusRejected || status == StatusCancelled
}

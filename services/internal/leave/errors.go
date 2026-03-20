package leave

import (
	"fmt"
	"time"

	"github.com/workived/services/pkg/apperr"
)

// ── Balance Errors ────────────────────────────────────────────────────────────
// All errors use base apperr codes (CodeValidation, CodeConflict, CodeUpgradeRequired, etc.)
// Domain context is in the message, not the error code.

// ErrInsufficientBalance returns an error when leave balance is insufficient
// Uses CodeUpgradeRequired (402) to signal balance/quota limitation
func ErrInsufficientBalance(policyName string, available, requested float64) *apperr.AppError {
	return apperr.New(apperr.CodeUpgradeRequired, fmt.Sprintf(
		"Insufficient leave balance for '%s'. Available: %.1f days, Requested: %.1f days",
		policyName, available, requested,
	))
}

// ErrNegativeBalance returns an error when balance calculation results in negative
func ErrNegativeBalance(policyName string) *apperr.AppError {
	return apperr.New(apperr.CodeValidation, fmt.Sprintf(
		"operation would result in negative balance for '%s'",
		policyName,
	))
}

// ── Date Validation Errors ────────────────────────────────────────────────────

// ErrInvalidDateRange returns an error when end date is before start date
func ErrInvalidDateRange() *apperr.AppError {
	return apperr.New(apperr.CodeValidation, "end date must be on or after start date")
}

// ErrPastDateNotAllowed returns an error when requesting leave for past dates
func ErrPastDateNotAllowed() *apperr.AppError {
	return apperr.New(apperr.CodeValidation, "cannot request leave for past dates")
}

// ErrOverlappingRequest returns an error when leave dates overlap with existing request
func ErrOverlappingRequest(startDate, endDate time.Time) *apperr.AppError {
	return apperr.New(apperr.CodeConflict, fmt.Sprintf(
		"you already have a pending or approved leave request between %s and %s",
		startDate.Format("2006-01-02"),
		endDate.Format("2006-01-02"),
	))
}

// ── Policy Errors ─────────────────────────────────────────────────────────────

// ErrPolicyNotFound returns an error when policy doesn't exist
func ErrPolicyNotFound() *apperr.AppError {
	return apperr.New(apperr.CodeNotFound, "selected leave policy does not exist")
}

// ErrPolicyInactive returns an error when policy is inactive
func ErrPolicyInactive(policyName string) *apperr.AppError {
	return apperr.New(apperr.CodeValidation, fmt.Sprintf(
		"the leave policy '%s' is currently inactive",
		policyName,
	))
}

// ErrPolicyHasPendingRequests returns an error when trying to delete/deactivate policy with pending requests
func ErrPolicyHasPendingRequests(policyName string, pendingCount int) *apperr.AppError {
	return apperr.New(apperr.CodeConflict, fmt.Sprintf(
		"cannot deactivate policy '%s': %d pending request%s must be approved or rejected first",
		policyName,
		pendingCount,
		pluralize(pendingCount),
	))
}

// ── Work Days Errors ──────────────────────────────────────────────────────────

// ErrInvalidWorkDays returns an error when working days calculation is invalid
func ErrInvalidWorkDays() *apperr.AppError {
	return apperr.New(apperr.CodeValidation, "requested leave period contains no working days")
}

// ── Helper Functions ──────────────────────────────────────────────────────────

// pluralize returns "s" for counts != 1, otherwise empty string
func pluralize(count int) string {
	if count == 1 {
		return ""
	}
	return "s"
}

package claims

import (
	"fmt"

	"github.com/workived/services/pkg/apperr"
)

// ── Validation Errors ─────────────────────────────────────────────────────────
// All errors use base apperr codes (CodeValidation, CodeConflict, etc.)
// Domain context is in the message, not the error code.

// ErrInvalidAmount returns an error for invalid claim amounts
func ErrInvalidAmount() *apperr.AppError {
	return apperr.New(apperr.CodeValidation, "claim amount must be greater than zero")
}

// ErrFutureDate returns an error for future claim dates
func ErrFutureDate() *apperr.AppError {
	return apperr.New(apperr.CodeValidation, "claim date cannot be in the future")
}

// ErrCategoryNotFound returns an error when category doesn't exist
func ErrCategoryNotFound() *apperr.AppError {
	return apperr.New(apperr.CodeValidation, "selected claim category does not exist")
}

// ErrCategoryInactive returns an error when category is inactive
func ErrCategoryInactive(categoryName string) *apperr.AppError {
	return apperr.New(apperr.CodeValidation, fmt.Sprintf(
		"the category '%s' is currently inactive and cannot accept new claims",
		categoryName,
	))
}

// ErrCurrencyMismatch returns an error when claim currency doesn't match category
func ErrCurrencyMismatch(categoryName, categoryCurrency, claimCurrency string) *apperr.AppError {
	return apperr.New(apperr.CodeValidation, fmt.Sprintf(
		"currency mismatch: category '%s' uses %s, but claim uses %s",
		categoryName, categoryCurrency, claimCurrency,
	))
}

// ErrReceiptRequired returns an error when receipt is missing but required
func ErrReceiptRequired(categoryName string) *apperr.AppError {
	return apperr.New(apperr.CodeValidation, fmt.Sprintf(
		"a receipt is required for claims under the '%s' category",
		categoryName,
	))
}

// ErrInsufficientBudget returns an error when monthly budget is exceeded
// Uses CodeUpgradeRequired (402) to signal payment/budget limitation
func ErrInsufficientBudget(categoryName string, limit, spent, remaining, requested int64, currency string) *apperr.AppError {
	return apperr.NewWithDetails(apperr.CodeUpgradeRequired, fmt.Sprintf(
		"Insufficient budget for '%s'. Monthly limit: %s %s, Already spent: %s %s, Remaining: %s %s, Requested: %s %s",
		categoryName,
		formatAmount(limit), currency,
		formatAmount(spent), currency,
		formatAmount(remaining), currency,
		formatAmount(requested), currency,
	), map[string]any{
		"category_name": categoryName,
		"limit":         limit,
		"spent":         spent,
		"remaining":     remaining,
		"requested":     requested,
		"currency":      currency,
	})
}

// ErrCategoryHasPendingClaims returns an error when trying to delete/deactivate category with pending claims
func ErrCategoryHasPendingClaims(categoryName string, pendingCount int) *apperr.AppError {
	return apperr.New(apperr.CodeConflict, fmt.Sprintf(
		"cannot deactivate category '%s': %d pending claim%s must be approved or rejected first",
		categoryName,
		pendingCount,
		pluralize(pendingCount),
	))
}

// ── Helper Functions ──────────────────────────────────────────────────────────

// formatAmount formats an amount with thousand separators (e.g., 1000000 → "1,000,000")
func formatAmount(amount int64) string {
	if amount < 0 {
		return "-" + formatAmount(-amount)
	}
	if amount < 1000 {
		return fmt.Sprintf("%d", amount)
	}
	return formatAmount(amount/1000) + "," + fmt.Sprintf("%03d", amount%1000)
}

// pluralize returns "s" for counts != 1, otherwise empty string
func pluralize(count int) string {
	if count == 1 {
		return ""
	}
	return "s"
}

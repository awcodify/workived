package apperr

import (
	"errors"
	"net/http"
)

const (
	CodeNotFound        = "NOT_FOUND"
	CodeUnauthorized    = "UNAUTHORIZED"
	CodeForbidden       = "FORBIDDEN"
	CodeValidation      = "VALIDATION_ERROR"
	CodeUpgradeRequired = "UPGRADE_REQUIRED"
	CodeConflict        = "CONFLICT"
	CodeInternal        = "INTERNAL_ERROR"
)

type AppError struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Field   string         `json:"field,omitempty"`
	Details map[string]any `json:"details,omitempty"`
}

func (e *AppError) Error() string {
	return e.Message
}

func New(code, message string) *AppError {
	return &AppError{Code: code, Message: message}
}

func NewField(code, message, field string) *AppError {
	return &AppError{Code: code, Message: message, Field: field}
}

func NewWithDetails(code, message string, details map[string]any) *AppError {
	return &AppError{Code: code, Message: message, Details: details}
}

func NotFound(resource string) *AppError {
	return &AppError{Code: CodeNotFound, Message: resource + " not found"}
}

func Unauthorized() *AppError {
	return &AppError{Code: CodeUnauthorized, Message: "authentication required"}
}

func Forbidden() *AppError {
	return &AppError{Code: CodeForbidden, Message: "access denied"}
}

func Conflict(message string) *AppError {
	return &AppError{Code: CodeConflict, Message: message}
}

func Internal() *AppError {
	return &AppError{Code: CodeInternal, Message: "an internal error occurred"}
}

// IsCode returns true if err is an *AppError with the given code.
func IsCode(err error, code string) bool {
	var e *AppError
	if errors.As(err, &e) {
		return e.Code == code
	}
	return false
}

// ValidationError wraps a raw validation error into a response body.
func ValidationError(err error) map[string]any {
	return map[string]any{
		"error": &AppError{
			Code:    CodeValidation,
			Message: err.Error(),
		},
	}
}

// Response wraps any error into a JSON-serialisable envelope.
func Response(err error) map[string]any {
	var e *AppError
	if errors.As(err, &e) {
		return map[string]any{"error": e}
	}
	return map[string]any{"error": Internal()}
}

// HTTPStatus maps an AppError code to an HTTP status code.
// Only handles common/global error codes.
func HTTPStatus(err error) int {
	var e *AppError
	if errors.As(err, &e) {
		switch e.Code {
		case CodeNotFound:
			return http.StatusNotFound
		case CodeUnauthorized:
			return http.StatusUnauthorized
		case CodeForbidden:
			return http.StatusForbidden
		case CodeValidation:
			return http.StatusBadRequest
		case CodeUpgradeRequired:
			return http.StatusPaymentRequired
		case CodeConflict:
			return http.StatusConflict
		}
	}
	return http.StatusInternalServerError
}

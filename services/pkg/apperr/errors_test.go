package apperr_test

import (
	"errors"
	"net/http"
	"testing"

	"github.com/workived/services/pkg/apperr"
)

func TestHTTPStatus(t *testing.T) {
	tests := []struct {
		code       string
		wantStatus int
	}{
		{apperr.CodeNotFound, http.StatusNotFound},
		{apperr.CodeUnauthorized, http.StatusUnauthorized},
		{apperr.CodeForbidden, http.StatusForbidden},
		{apperr.CodeValidation, http.StatusBadRequest},
		{apperr.CodeUpgradeRequired, http.StatusPaymentRequired},
		{apperr.CodeInsufficientBalance, http.StatusUnprocessableEntity},
		{apperr.CodeConflict, http.StatusConflict},
		{apperr.CodeInternal, http.StatusInternalServerError},
		{"UNKNOWN_CODE", http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(tt.code, func(t *testing.T) {
			err := apperr.New(tt.code, "test")
			got := apperr.HTTPStatus(err)
			if got != tt.wantStatus {
				t.Errorf("HTTPStatus(%q) = %d, want %d", tt.code, got, tt.wantStatus)
			}
		})
	}

	t.Run("non-AppError returns 500", func(t *testing.T) {
		got := apperr.HTTPStatus(errors.New("plain error"))
		if got != http.StatusInternalServerError {
			t.Errorf("HTTPStatus(plain error) = %d, want %d", got, http.StatusInternalServerError)
		}
	})
}

func TestIsCode(t *testing.T) {
	t.Run("matches AppError code", func(t *testing.T) {
		err := apperr.New(apperr.CodeNotFound, "not found")
		if !apperr.IsCode(err, apperr.CodeNotFound) {
			t.Error("expected IsCode to return true")
		}
	})

	t.Run("does not match different code", func(t *testing.T) {
		err := apperr.New(apperr.CodeNotFound, "not found")
		if apperr.IsCode(err, apperr.CodeForbidden) {
			t.Error("expected IsCode to return false")
		}
	})

	t.Run("returns false for non-AppError", func(t *testing.T) {
		if apperr.IsCode(errors.New("plain"), apperr.CodeNotFound) {
			t.Error("expected IsCode to return false for plain error")
		}
	})
}

func TestResponse(t *testing.T) {
	t.Run("wraps AppError", func(t *testing.T) {
		err := apperr.New(apperr.CodeValidation, "bad input")
		resp := apperr.Response(err)
		e, ok := resp["error"].(*apperr.AppError)
		if !ok {
			t.Fatal("expected *AppError in response")
		}
		if e.Code != apperr.CodeValidation {
			t.Errorf("code = %q, want %q", e.Code, apperr.CodeValidation)
		}
	})

	t.Run("wraps plain error as internal", func(t *testing.T) {
		resp := apperr.Response(errors.New("oops"))
		e, ok := resp["error"].(*apperr.AppError)
		if !ok {
			t.Fatal("expected *AppError in response")
		}
		if e.Code != apperr.CodeInternal {
			t.Errorf("code = %q, want %q", e.Code, apperr.CodeInternal)
		}
	})
}

func TestNewWithDetails(t *testing.T) {
	details := map[string]any{"limit": 100}
	err := apperr.NewWithDetails(apperr.CodeInsufficientBalance, "over budget", details)
	if err.Code != apperr.CodeInsufficientBalance {
		t.Errorf("code = %q, want %q", err.Code, apperr.CodeInsufficientBalance)
	}
	if err.Details["limit"] != 100 {
		t.Errorf("details[limit] = %v, want 100", err.Details["limit"])
	}
}

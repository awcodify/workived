package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRegisterDocsRoutes_WithCredentials(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	registerDocsRoutes(r, "admin", "secret")

	t.Run("401 — no credentials", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/docs", nil)
		r.ServeHTTP(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", w.Code)
		}
	})

	t.Run("401 — wrong credentials", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/docs", nil)
		req.SetBasicAuth("admin", "wrong")
		r.ServeHTTP(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", w.Code)
		}
	})

	t.Run("200 — correct credentials on /docs", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/docs", nil)
		req.SetBasicAuth("admin", "secret")
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d", w.Code)
		}
		if ct := w.Header().Get("Content-Type"); ct != "text/html; charset=utf-8" {
			t.Errorf("expected text/html content type, got %s", ct)
		}
	})

	t.Run("200 — correct credentials on /docs/openapi.yaml", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/docs/openapi.yaml", nil)
		req.SetBasicAuth("admin", "secret")
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("expected 200, got %d", w.Code)
		}
	})
}

func TestRegisterDocsRoutes_DisabledWhenNoCredentials(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name     string
		username string
		password string
	}{
		{"empty username", "", "secret"},
		{"empty password", "admin", ""},
		{"both empty", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := gin.New()
			registerDocsRoutes(r, tt.username, tt.password)

			w := httptest.NewRecorder()
			req, _ := http.NewRequest(http.MethodGet, "/docs", nil)
			r.ServeHTTP(w, req)
			if w.Code != http.StatusNotFound {
				t.Errorf("expected 404 (route not registered), got %d", w.Code)
			}
		})
	}
}

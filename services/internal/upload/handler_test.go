package upload_test

import (
	"io"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/upload"
)

func init() {
	gin.SetMode(gin.TestMode)
}

var (
	testOrgID  = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	testEmpID  = uuid.MustParse("00000000-0000-0000-0000-000000000002")
	testUserID = uuid.MustParse("00000000-0000-0000-0000-000000000003")
)

// ── Mock storage presigner ────────────────────────────────────────────────────

type mockPresigner struct {
	uploadFn func(ctx context.Context, key, contentType string) (string, error)
	getFn    func(ctx context.Context, key string) (io.ReadCloser, string, error)
}

func (m *mockPresigner) GetPresignedUploadURL(ctx context.Context, key, contentType string) (string, error) {
	if m.uploadFn != nil {
		return m.uploadFn(ctx, key, contentType)
	}
	return "https://s3.example.com/presigned-upload", nil
}

func (m *mockPresigner) Get(ctx context.Context, key string) (io.ReadCloser, string, error) {
	if m.getFn != nil {
		return m.getFn(ctx, key)
	}
	return io.NopCloser(strings.NewReader("mock file content")), "image/jpeg", nil
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func newRouter(presigner *mockPresigner, empErr error) *gin.Engine {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("org_id", testOrgID)
		c.Set("user_id", testUserID)
		c.Set("role", "member")
		c.Next()
	})
	lookup := upload.EmployeeLookupFunc(func(_ context.Context, _, _ uuid.UUID) (uuid.UUID, error) {
		if empErr != nil {
			return uuid.Nil, empErr
		}
		return testEmpID, nil
	})
	h := upload.NewHandler(presigner, presigner, lookup, "http://localhost:8080", zerolog.Nop())
	h.RegisterRoutes(r.Group("/api/v1"))
	return r
}

func jsonBody(t *testing.T, v any) *bytes.Buffer {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return bytes.NewBuffer(b)
}

func assertStatus(t *testing.T, w *httptest.ResponseRecorder, want int) {
	t.Helper()
	if w.Code != want {
		t.Errorf("status = %d, want %d; body: %s", w.Code, want, w.Body.String())
	}
}

// ── Tests ────────────────────────────────────────────────────────────────────

func TestPresign_Success_ClockIn(t *testing.T) {
	presigner := &mockPresigner{
		uploadFn: func(_ context.Context, key, contentType string) (string, error) {
			if !strings.Contains(key, "clock_in") {
				t.Errorf("key %q should contain clock_in", key)
			}
			if contentType != "image/jpeg" {
				t.Errorf("contentType = %q, want image/jpeg", contentType)
			}
			return "https://s3.example.com/presigned-upload", nil
		},
	}

	r := newRouter(presigner, nil)
	body := jsonBody(t, map[string]string{
		"content_type": "image/jpeg",
		"purpose":      "clock_in",
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/uploads/presign", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusOK)

	var resp struct {
		Data upload.PresignResponse `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if resp.Data.UploadURL != "https://s3.example.com/presigned-upload" {
		t.Errorf("upload_url = %q, want presigned URL", resp.Data.UploadURL)
	}
	if resp.Data.PublicURL == "" {
		t.Error("public_url should not be empty")
	}
	if !strings.Contains(resp.Data.Key, testOrgID.String()) {
		t.Errorf("key %q should contain org_id", resp.Data.Key)
	}
	if !strings.Contains(resp.Data.Key, testEmpID.String()) {
		t.Errorf("key %q should contain employee_id", resp.Data.Key)
	}
}

func TestPresign_Success_ClockOut_PNG(t *testing.T) {
	presigner := &mockPresigner{
		uploadFn: func(_ context.Context, key, contentType string) (string, error) {
			if !strings.Contains(key, "clock_out") {
				t.Errorf("key %q should contain clock_out", key)
			}
			if !strings.HasSuffix(key, ".png") {
				t.Errorf("key %q should end with .png", key)
			}
			if contentType != "image/png" {
				t.Errorf("contentType = %q, want image/png", contentType)
			}
			return "https://s3.example.com/presigned-upload", nil
		},
	}

	r := newRouter(presigner, nil)
	body := jsonBody(t, map[string]string{
		"content_type": "image/png",
		"purpose":      "clock_out",
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/uploads/presign", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusOK)
}

func TestPresign_InvalidContentType(t *testing.T) {
	presigner := &mockPresigner{uploadFn: func(_ context.Context, _, _ string) (string, error) {
		t.Fatal("should not call presigner on validation error")
		return "", nil
	}}

	r := newRouter(presigner, nil)
	body := jsonBody(t, map[string]string{
		"content_type": "application/pdf",
		"purpose":      "clock_in",
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/uploads/presign", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusBadRequest)
}

func TestPresign_InvalidPurpose(t *testing.T) {
	presigner := &mockPresigner{uploadFn: func(_ context.Context, _, _ string) (string, error) {
		t.Fatal("should not call presigner on validation error")
		return "", nil
	}}

	r := newRouter(presigner, nil)
	body := jsonBody(t, map[string]string{
		"content_type": "image/jpeg",
		"purpose":      "receipt",
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/uploads/presign", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusBadRequest)
}

func TestPresign_MissingBody(t *testing.T) {
	presigner := &mockPresigner{uploadFn: func(_ context.Context, _, _ string) (string, error) {
		t.Fatal("should not call presigner on validation error")
		return "", nil
	}}

	r := newRouter(presigner, nil)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/uploads/presign", strings.NewReader("{}"))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusBadRequest)
}

func TestPresign_EmpLookupError(t *testing.T) {
	presigner := &mockPresigner{uploadFn: func(_ context.Context, _, _ string) (string, error) {
		t.Fatal("should not call presigner when emp lookup fails")
		return "", nil
	}}

	r := newRouter(presigner, errors.New("employee not found"))
	body := jsonBody(t, map[string]string{
		"content_type": "image/jpeg",
		"purpose":      "clock_in",
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/uploads/presign", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusInternalServerError)
}

func TestPresign_StorageError(t *testing.T) {
	presigner := &mockPresigner{
		uploadFn: func(_ context.Context, _, _ string) (string, error) {
			return "", errors.New("s3 unavailable")
		},
	}

	r := newRouter(presigner, nil)
	body := jsonBody(t, map[string]string{
		"content_type": "image/jpeg",
		"purpose":      "clock_in",
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/uploads/presign", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusInternalServerError)
}

func TestPresign_KeyContainsAttendancePath(t *testing.T) {
	var capturedKey string
	presigner := &mockPresigner{
		uploadFn: func(_ context.Context, key, _ string) (string, error) {
			capturedKey = key
			return "https://s3.example.com/presigned", nil
		},
	}

	r := newRouter(presigner, nil)
	body := jsonBody(t, map[string]string{
		"content_type": "image/jpeg",
		"purpose":      "clock_in",
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/uploads/presign", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusOK)
	if !strings.Contains(capturedKey, "/attendance/") {
		t.Errorf("key %q should contain /attendance/", capturedKey)
	}
	if !strings.HasSuffix(capturedKey, ".jpg") {
		t.Errorf("key %q should end with .jpg", capturedKey)
	}
}

// ── Sprint 24: Task & Comment Attachment Tests ───────────────────────────────

func TestPresign_TaskAttachment_WebP(t *testing.T) {
	presigner := &mockPresigner{
		uploadFn: func(_ context.Context, key, contentType string) (string, error) {
			if !strings.Contains(key, "task_attachment") {
				t.Errorf("key %q should contain task_attachment", key)
			}
			if !strings.HasSuffix(key, ".webp") {
				t.Errorf("key %q should end with .webp", key)
			}
			if contentType != "image/webp" {
				t.Errorf("contentType = %q, want image/webp", contentType)
			}
			// Task attachments should NOT contain employee_id or attendance/
			if strings.Contains(key, "attendance/") {
				t.Errorf("task attachment key %q should not contain attendance/", key)
			}
			return "https://s3.example.com/presigned-upload", nil
		},
	}

	r := newRouter(presigner, nil)
	body := jsonBody(t, map[string]string{
		"content_type": "image/webp",
		"purpose":      "task_attachment",
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/uploads/presign", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusOK)

	var resp struct {
		Data upload.PresignResponse `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !strings.Contains(resp.Data.Key, testOrgID.String()) {
		t.Errorf("key %q should contain org_id", resp.Data.Key)
	}
}

func TestPresign_CommentAttachment_GIF(t *testing.T) {
	presigner := &mockPresigner{
		uploadFn: func(_ context.Context, key, contentType string) (string, error) {
			if !strings.Contains(key, "comment_attachment") {
				t.Errorf("key %q should contain comment_attachment", key)
			}
			if !strings.HasSuffix(key, ".gif") {
				t.Errorf("key %q should end with .gif", key)
			}
			if contentType != "image/gif" {
				t.Errorf("contentType = %q, want image/gif", contentType)
			}
			return "https://s3.example.com/presigned-upload", nil
		},
	}

	r := newRouter(presigner, nil)
	body := jsonBody(t, map[string]string{
		"content_type": "image/gif",
		"purpose":      "comment_attachment",
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/uploads/presign", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assertStatus(t, w, http.StatusOK)
}

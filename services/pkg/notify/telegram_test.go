package notify

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rs/zerolog"
)

func TestNoOpNotifier(t *testing.T) {
	n := &NoOpNotifier{}
	if err := n.Send(context.Background(), "hello"); err != nil {
		t.Errorf("NoOpNotifier.Send unexpected error: %v", err)
	}
}

func TestTelegramNotifier_Send_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("expected application/json content-type")
		}
		var body map[string]string
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("decode body: %v", err)
		}
		if body["chat_id"] != "123" {
			t.Errorf("unexpected chat_id: %s", body["chat_id"])
		}
		if body["text"] != "hello world" {
			t.Errorf("unexpected text: %s", body["text"])
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer srv.Close()

	n := NewTelegramNotifier("testtoken", "123", zerolog.Nop())
	// Override URL by replacing the client with one pointing at test server.
	// We patch the URL via the token in the format string, so instead we
	// swap the underlying client transport.
	n.client.Transport = &prefixTransport{base: srv.URL, token: "testtoken"}

	if err := n.Send(context.Background(), "hello world"); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestTelegramNotifier_Send_NonOK(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer srv.Close()

	n := NewTelegramNotifier("badtoken", "123", zerolog.Nop())
	n.client.Transport = &prefixTransport{base: srv.URL, token: "badtoken"}

	err := n.Send(context.Background(), "msg")
	if err == nil {
		t.Error("expected error for non-200 response")
	}
}

// prefixTransport rewrites the Telegram API URL to point at a test server.
type prefixTransport struct {
	base  string
	token string
}

func (p *prefixTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	r2 := r.Clone(r.Context())
	r2.URL.Scheme = "http"
	r2.URL.Host = r.URL.Host
	// Replace telegram host with test server host
	newURL := *r.URL
	newURL.Host = p.base[7:] // strip "http://"
	newURL.Scheme = "http"
	newURL.Path = "/bot" + p.token + "/sendMessage"
	r2.URL = &newURL
	return http.DefaultTransport.RoundTrip(r2)
}

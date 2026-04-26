package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/rs/zerolog"
)

// APIClient handles authenticated HTTP requests to the Workived API
type APIClient struct {
	baseURL        string
	accessToken    string
	refreshToken   string
	httpClient     *http.Client
	log            zerolog.Logger
	onTokenRefresh func(accessToken string) // Callback when token is refreshed
}

// NewAPIClient creates a new API client
func NewAPIClient(baseURL, accessToken, refreshToken string, log zerolog.Logger) *APIClient {
	return &APIClient{
		baseURL:      baseURL,
		accessToken:  accessToken,
		refreshToken: refreshToken,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		log: log,
	}
}

// SetOnTokenRefresh sets a callback for when the access token is refreshed
func (c *APIClient) SetOnTokenRefresh(callback func(accessToken string)) {
	c.onTokenRefresh = callback
}

// Get makes an authenticated GET request
func (c *APIClient) Get(ctx context.Context, path string, params map[string]string) ([]byte, error) {
	reqURL := c.baseURL + path

	// Add query parameters
	if len(params) > 0 {
		u, err := url.Parse(reqURL)
		if err != nil {
			return nil, fmt.Errorf("invalid URL: %w", err)
		}
		q := u.Query()
		for k, v := range params {
			q.Set(k, v)
		}
		u.RawQuery = q.Encode()
		reqURL = u.String()
	}

	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	return c.do(req)
}

// Post makes an authenticated POST request
func (c *APIClient) Post(ctx context.Context, path string, body interface{}) ([]byte, error) {
	jsonData, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+path, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	return c.do(req)
}

// Put makes an authenticated PUT request
func (c *APIClient) Put(ctx context.Context, path string, body interface{}) ([]byte, error) {
	jsonData, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "PUT", c.baseURL+path, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	return c.do(req)
}

// Delete makes an authenticated DELETE request
func (c *APIClient) Delete(ctx context.Context, path string, params ...map[string]string) ([]byte, error) {
	reqURL := c.baseURL + path

	// Add query parameters if provided
	if len(params) > 0 && len(params[0]) > 0 {
		u, err := url.Parse(reqURL)
		if err != nil {
			return nil, fmt.Errorf("invalid URL: %w", err)
		}
		q := u.Query()
		for k, v := range params[0] {
			q.Set(k, v)
		}
		u.RawQuery = q.Encode()
		reqURL = u.String()
	}

	req, err := http.NewRequestWithContext(ctx, "DELETE", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	return c.do(req)
}

// do executes the HTTP request with authentication
func (c *APIClient) do(req *http.Request) ([]byte, error) {
	// Add authorization header
	req.Header.Set("Authorization", "Bearer "+c.accessToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	// Handle 401 - token expired, try to refresh
	if resp.StatusCode == http.StatusUnauthorized {
		c.log.Info().Msg("Access token expired, refreshing...")

		if err := c.refreshAccessToken(); err != nil {
			return nil, fmt.Errorf("token refresh failed: %w", err)
		}

		// Retry the request with new token
		req.Header.Set("Authorization", "Bearer "+c.accessToken)
		resp, err = c.httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("retry request failed: %w", err)
		}
		defer resp.Body.Close()

		body, err = io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("read retry response: %w", err)
		}
	}

	// Check for error status codes
	if resp.StatusCode >= 400 {
		var errResp struct {
			Error struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := json.Unmarshal(body, &errResp); err == nil && errResp.Error.Message != "" {
			return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, errResp.Error.Message)
		}
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	return body, nil
}

// refreshAccessToken refreshes the access token using the refresh token via API
func (c *APIClient) refreshAccessToken() error {
	refreshURL := c.baseURL + "/api/v1/auth/refresh"

	// API expects refresh token in request body
	reqBody := map[string]string{
		"refresh_token": c.refreshToken,
	}
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("marshal refresh request: %w", err)
	}

	req, err := http.NewRequest("POST", refreshURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("create refresh request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("refresh request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("refresh failed (%d): %s", resp.StatusCode, string(body))
	}

	var refreshResp struct {
		Data struct {
			AccessToken string `json:"access_token"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&refreshResp); err != nil {
		return fmt.Errorf("decode refresh response: %w", err)
	}

	c.accessToken = refreshResp.Data.AccessToken
	c.log.Info().Msg("Access token refreshed via API")

	// Notify callback if set
	if c.onTokenRefresh != nil {
		c.onTokenRefresh(c.accessToken)
	}

	return nil
}

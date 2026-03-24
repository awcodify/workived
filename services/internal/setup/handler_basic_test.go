package setup

import (
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
)

// Minimal handler tests  - just enough to test route registration and basic structure
// Full business logic is tested in service_test.go

func TestHandler_Creation(t *testing.T) {
	repo := &MockRepository{}
	svc := &Service{repo: repo, logger: zerolog.Nop()}
	handler := NewHandler(svc, zerolog.Nop())

	assert.NotNil(t, handler)
	assert.NotNil(t, handler.service)
	assert.NotNil(t, handler.logger)
}

func TestHandler_RoutesRegistered(t *testing.T) {
	repo := &MockRepository{}
	svc := &Service{repo: repo, logger: zerolog.Nop()}
	handler := NewHandler(svc, zerolog.Nop())

	gin.SetMode(gin.TestMode)
	router := gin.New()

	handler.RegisterRoutes(router.Group(""))

	routes := router.Routes()
	assert.Greater(t, len(routes), 0, "Should have registered routes")

	// Check that expected routes exist
	routePaths := make([]string, len(routes))
	for i, route := range routes {
		routePaths[i] = route.Path
	}

	// Verify key endpoints are registered
	hasStatusRoute := false
	hasTemplatesRoute := false
	hasCompleteRoute := false
	hasSkipRoute := false

	for _, path := range routePaths {
		if path == "/setup/status" {
			hasStatusRoute = true
		}
		if path == "/setup/templates" {
			hasTemplatesRoute = true
		}
		if path == "/setup/complete" {
			hasCompleteRoute = true
		}
		if path == "/setup/skip" {
			hasSkipRoute = true
		}
	}

	assert.True(t, hasStatusRoute, "Should have /setup/status route")
	assert.True(t, hasTemplatesRoute, "Should have /setup/templates route")
	assert.True(t, hasCompleteRoute, "Should have /setup/complete route")
	assert.True(t, hasSkipRoute, "Should have /setup/skip route")
}

func TestHandler_NewHandlerSetsFields(t *testing.T) {
	repo := &MockRepository{}
	svc := &Service{repo: repo, logger: zerolog.Nop()}
	logger := zerolog.New(nil)

	handler := NewHandler(svc, logger)

	assert.Equal(t, svc, handler.service)
	// Logger field is set but may be wrapped, so just check it's not nil
	assert.NotNil(t, handler.logger)
}

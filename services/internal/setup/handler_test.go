//go:build ignore
// +build ignore

package setup

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/workived/services/pkg/apperr"
)

// MockService implements a mock service for testing
type MockService struct {
	GetSetupStatusFunc        func(ctx context.Context, orgID uuid.UUID) (*SetupStatus, error)
	GetTemplatesFunc          func(ctx context.Context, orgID uuid.UUID) (*SetupTemplatesResponse, error)
	CompleteSetupFunc         func(ctx context.Context, orgID uuid.UUID, req *CompleteSetupRequest) (*CompleteSetupResponse, error)
	SkipSetupFunc             func(ctx context.Context, orgID uuid.UUID) error
	ValidateCompleteSetupFunc func(req *CompleteSetupRequest) error
}

func (m *MockService) GetSetupStatus(ctx context.Context, orgID uuid.UUID) (*SetupStatus, error) {
	if m.GetSetupStatusFunc != nil {
		return m.GetSetupStatusFunc(ctx, orgID)
	}
	return nil, errors.New("not implemented")
}

func (m *MockService) GetTemplates(ctx context.Context, orgID uuid.UUID) (*SetupTemplatesResponse, error) {
	if m.GetTemplatesFunc != nil {
		return m.GetTemplatesFunc(ctx, orgID)
	}
	return nil, errors.New("not implemented")
}

func (m *MockService) CompleteSetup(ctx context.Context, orgID uuid.UUID, req *CompleteSetupRequest) (*CompleteSetupResponse, error) {
	if m.CompleteSetupFunc != nil {
		return m.CompleteSetupFunc(ctx, orgID, req)
	}
	return nil, errors.New("not implemented")
}

func (m *MockService) SkipSetup(ctx context.Context, orgID uuid.UUID) error {
	if m.SkipSetupFunc != nil {
		return m.SkipSetupFunc(ctx, orgID)
	}
	return errors.New("not implemented")
}

func (m *MockService) ValidateCompleteSetupRequest(req *CompleteSetupRequest) error {
	if m.ValidateCompleteSetupFunc != nil {
		return m.ValidateCompleteSetupFunc(req)
	}
	return nil
}

func setupTestRouter(handler *Handler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Simulate middleware setting orgID in context
	router.Use(func(c *gin.Context) {
		orgID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
		c.Set("org_id", orgID)
		c.Next()
	})

	handler.RegisterRoutes(router.Group(""))
	return router
}

func TestHandler_GetSetupStatus_Success(t *testing.T) {
	mockRepo := &MockRepository{
		GetSetupStatusFunc: func(ctx context.Context, orgID uuid.UUID) (*SetupStatus, error) {
			completedAt := time.Now()
			return &SetupStatus{
				NeedsSetup:           false,
				Skipped:              false,
				CompletedAt:          &completedAt,
				WorkScheduleExists:   true,
				LeavePoliciesCount:   3,
				ClaimCategoriesCount: 5,
				MembersCount:         1,
			}, nil
		},
	}
	svc := NewService(mockRepo, zerolog.Nop())
	handler := NewHandler(svc, zerolog.Nop())
	router := setupTestRouter(handler)

	req := httptest.NewRequest(http.MethodGet, "/setup/status", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	data, ok := response["data"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, false, data["needs_setup"])
}

func TestHandler_GetSetupStatus_ServiceError(t *testing.T) {
	mockRepo := &MockRepository{
		GetSetupStatusFunc: func(ctx context.Context, orgID uuid.UUID) (*SetupStatus, error) {
			return nil, errors.New("database error")
		},
	}
	svc := NewService(mockRepo, zerolog.Nop())
	handler := NewHandler(svc, zerolog.Nop())
	router := setupTestRouter(handler)

	req := httptest.NewRequest(http.MethodGet, "/setup/status", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestHandler_GetTemplates_Success(t *testing.T) {
	mockSvc := &MockService{
		GetTemplatesFunc: func(ctx context.Context, orgID uuid.UUID) (*SetupTemplatesResponse, error) {
			return &SetupTemplatesResponse{
				WorkSchedules: []WorkScheduleTemplate{
					{
						ID:          uuid.New(),
						CountryCode: "ID",
						Name:        "Standard Office Hours",
						WorkDays:    []int{1, 2, 3, 4, 5},
						StartTime:   "08:00",
						EndTime:     "17:00",
					},
				},
				LeavePolicies: []LeavePolicyTemplate{
					{
						ID:                  uuid.New(),
						CountryCode:         "ID",
						Name:                "Annual Leave",
						EntitledDaysPerYear: 12,
					},
				},
				ClaimCategories: []ClaimCategoryTemplate{
					{
						ID:          uuid.New(),
						CountryCode: "ID",
						Name:        "Transport",
					},
				},
			}, nil
		},
	}

	handler := NewHandler(mockSvc, zerolog.Nop())
	router := setupTestRouter(handler)

	req := httptest.NewRequest(http.MethodGet, "/setup/templates", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	data, ok := response["data"].(map[string]interface{})
	require.True(t, ok)
	assert.NotNil(t, data["work_schedules"])
}

func TestHandler_GetTemplates_ServiceError(t *testing.T) {
	mockRepo := &MockRepository{
		GetOrganisationCountryCodeFunc: func(ctx context.Context, orgID uuid.UUID) (string, error) {
			return "", errors.New("database error")
		},
	}
	svc := NewService(mockRepo, zerolog.Nop())
	handler := NewHandler(svc, zerolog.Nop())
	router := setupTestRouter(handler)

	req := httptest.NewRequest(http.MethodGet, "/setup/templates", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestHandler_CompleteSetup_Success(t *testing.T) {
	templateID := uuid.New()
	mockSvc := &MockService{
		ValidateCompleteSetupFunc: func(req *CompleteSetupRequest) error {
			return nil
		},
		CompleteSetupFunc: func(ctx context.Context, orgID uuid.UUID, req *CompleteSetupRequest) (*CompleteSetupResponse, error) {
			return &CompleteSetupResponse{
				Success:          true,
				WorkScheduleID:   uuid.New(),
				LeavePolicyIDs:   []uuid.UUID{uuid.New()},
				ClaimCategoryIDs: []uuid.UUID{uuid.New()},
				InvitationIDs:    []uuid.UUID{},
			}, nil
		},
	}

	handler := NewHandler(mockSvc, zerolog.Nop())
	router := setupTestRouter(handler)

	requestBody := CompleteSetupRequest{
		WorkSchedule: WorkScheduleChoice{
			TemplateID: &templateID,
		},
		LeavePolicies: LeavePolicySelection{
			TemplateIDs: []uuid.UUID{uuid.New()},
		},
		ClaimCategories: ClaimCategorySelection{
			TemplateIDs: []uuid.UUID{uuid.New()},
		},
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest(http.MethodPost, "/setup/complete", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	data, ok := response["data"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, true, data["success"])
}

func TestHandler_CompleteSetup_InvalidJSON(t *testing.T) {
	mockSvc := &MockService{}
	handler := NewHandler(mockSvc, zerolog.Nop())
	router := setupTestRouter(handler)

	req := httptest.NewRequest(http.MethodPost, "/setup/complete", bytes.NewBufferString("invalid json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandler_CompleteSetup_ValidationError(t *testing.T) {
	mockSvc := &MockService{
		ValidateCompleteSetupFunc: func(req *CompleteSetupRequest) error {
			return errors.New("validation failed")
		},
	}

	handler := NewHandler(mockSvc, zerolog.Nop())
	router := setupTestRouter(handler)

	requestBody := CompleteSetupRequest{}
	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest(http.MethodPost, "/setup/complete", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestHandler_CompleteSetup_ServiceError(t *testing.T) {
	templateID := uuid.New()
	mockSvc := &MockService{
		ValidateCompleteSetupFunc: func(req *CompleteSetupRequest) error {
			return nil
		},
		CompleteSetupFunc: func(ctx context.Context, orgID uuid.UUID, req *CompleteSetupRequest) (*CompleteSetupResponse, error) {
			return nil, apperr.Internal()
		},
	}

	handler := NewHandler(mockSvc, zerolog.Nop())
	router := setupTestRouter(handler)

	requestBody := CompleteSetupRequest{
		WorkSchedule: WorkScheduleChoice{
			TemplateID: &templateID,
		},
		LeavePolicies: LeavePolicySelection{
			TemplateIDs: []uuid.UUID{uuid.New()},
		},
		ClaimCategories: ClaimCategorySelection{
			TemplateIDs: []uuid.UUID{uuid.New()},
		},
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest(http.MethodPost, "/setup/complete", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestHandler_SkipSetup_Success(t *testing.T) {
	mockSvc := &MockService{
		SkipSetupFunc: func(ctx context.Context, orgID uuid.UUID) error {
			return nil
		},
	}

	handler := NewHandler(mockSvc, zerolog.Nop())
	router := setupTestRouter(handler)

	req := httptest.NewRequest(http.MethodPost, "/setup/skip", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	data, ok := response["data"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, true, data["skipped"])
}

func TestHandler_SkipSetup_ServiceError(t *testing.T) {
	mockSvc := &MockService{
		SkipSetupFunc: func(ctx context.Context, orgID uuid.UUID) error {
			return apperr.Internal()
		},
	}

	handler := NewHandler(mockSvc, zerolog.Nop())
	router := setupTestRouter(handler)

	req := httptest.NewRequest(http.MethodPost, "/setup/skip", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestNewHandler(t *testing.T) {
	svc := &Service{}
	logger := zerolog.Nop()

	handler := NewHandler(svc, logger)

	assert.NotNil(t, handler)
	assert.Equal(t, svc, handler.service)
}

func TestRegisterRoutes(t *testing.T) {
	mockSvc := &MockService{}
	handler := NewHandler(mockSvc, zerolog.Nop())

	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler.RegisterRoutes(router.Group(""))

	// Verify routes are registered by checking they don't return 404
	routes := router.Routes()
	assert.Greater(t, len(routes), 0)
}

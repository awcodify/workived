package setup

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// MockRepository implements mock repository for service testing
type MockRepository struct {
	GetSetupStatusFunc                  func(ctx context.Context, orgID uuid.UUID) (*SetupStatus, error)
	GetOrganisationCountryCodeFunc      func(ctx context.Context, orgID uuid.UUID) (string, error)
	GetWorkScheduleTemplatesFunc        func(ctx context.Context, countryCode string) ([]WorkScheduleTemplate, error)
	GetLeavePolicyTemplatesFunc         func(ctx context.Context, countryCode string) ([]LeavePolicyTemplate, error)
	GetClaimCategoryTemplatesFunc       func(ctx context.Context, countryCode string) ([]ClaimCategoryTemplate, error)
	MarkSetupCompleteFunc               func(ctx context.Context, tx pgx.Tx, orgID uuid.UUID) error
	MarkSetupSkippedFunc                func(ctx context.Context, orgID uuid.UUID) error
	CreateWorkScheduleFromTemplateFunc  func(ctx context.Context, tx pgx.Tx, orgID, templateID uuid.UUID) (uuid.UUID, error)
	CreateCustomWorkScheduleFunc        func(ctx context.Context, tx pgx.Tx, orgID uuid.UUID, input *CustomScheduleInput) (uuid.UUID, error)
	CreateLeavePolicyFromTemplateFunc   func(ctx context.Context, tx pgx.Tx, orgID, templateID uuid.UUID, custom *LeavePolicyCustomization) (uuid.UUID, error)
	CreateClaimCategoryFromTemplateFunc func(ctx context.Context, tx pgx.Tx, orgID, templateID uuid.UUID, custom *ClaimCategoryCustomization) (uuid.UUID, error)
	CreateInvitationFunc                func(ctx context.Context, tx pgx.Tx, orgID uuid.UUID, email, role string) (uuid.UUID, error)
	BeginTxFunc                         func(ctx context.Context) (pgx.Tx, error)
}

func (m *MockRepository) GetSetupStatus(ctx context.Context, orgID uuid.UUID) (*SetupStatus, error) {
	if m.GetSetupStatusFunc != nil {
		return m.GetSetupStatusFunc(ctx, orgID)
	}
	return nil, errors.New("not implemented")
}

func (m *MockRepository) GetOrganisationCountryCode(ctx context.Context, orgID uuid.UUID) (string, error) {
	if m.GetOrganisationCountryCodeFunc != nil {
		return m.GetOrganisationCountryCodeFunc(ctx, orgID)
	}
	return "", errors.New("not implemented")
}

func (m *MockRepository) GetWorkScheduleTemplates(ctx context.Context, countryCode string) ([]WorkScheduleTemplate, error) {
	if m.GetWorkScheduleTemplatesFunc != nil {
		return m.GetWorkScheduleTemplatesFunc(ctx, countryCode)
	}
	return nil, errors.New("not implemented")
}

func (m *MockRepository) GetLeavePolicyTemplates(ctx context.Context, countryCode string) ([]LeavePolicyTemplate, error) {
	if m.GetLeavePolicyTemplatesFunc != nil {
		return m.GetLeavePolicyTemplatesFunc(ctx, countryCode)
	}
	return nil, errors.New("not implemented")
}

func (m *MockRepository) GetClaimCategoryTemplates(ctx context.Context, countryCode string) ([]ClaimCategoryTemplate, error) {
	if m.GetClaimCategoryTemplatesFunc != nil {
		return m.GetClaimCategoryTemplatesFunc(ctx, countryCode)
	}
	return nil, errors.New("not implemented")
}

func (m *MockRepository) MarkSetupComplete(ctx context.Context, tx pgx.Tx, orgID uuid.UUID) error {
	if m.MarkSetupCompleteFunc != nil {
		return m.MarkSetupCompleteFunc(ctx, tx, orgID)
	}
	return errors.New("not implemented")
}

func (m *MockRepository) MarkSetupSkipped(ctx context.Context, orgID uuid.UUID) error {
	if m.MarkSetupSkippedFunc != nil {
		return m.MarkSetupSkippedFunc(ctx, orgID)
	}
	return errors.New("not implemented")
}

func (m *MockRepository) CreateWorkScheduleFromTemplate(ctx context.Context, tx pgx.Tx, orgID, templateID uuid.UUID) (uuid.UUID, error) {
	if m.CreateWorkScheduleFromTemplateFunc != nil {
		return m.CreateWorkScheduleFromTemplateFunc(ctx, tx, orgID, templateID)
	}
	return uuid.Nil, errors.New("not implemented")
}

func (m *MockRepository) CreateCustomWorkSchedule(ctx context.Context, tx pgx.Tx, orgID uuid.UUID, input *CustomScheduleInput) (uuid.UUID, error) {
	if m.CreateCustomWorkScheduleFunc != nil {
		return m.CreateCustomWorkScheduleFunc(ctx, tx, orgID, input)
	}
	return uuid.Nil, errors.New("not implemented")
}

func (m *MockRepository) CreateLeavePolicyFromTemplate(ctx context.Context, tx pgx.Tx, orgID, templateID uuid.UUID, custom *LeavePolicyCustomization) (uuid.UUID, error) {
	if m.CreateLeavePolicyFromTemplateFunc != nil {
		return m.CreateLeavePolicyFromTemplateFunc(ctx, tx, orgID, templateID, custom)
	}
	return uuid.Nil, errors.New("not implemented")
}

func (m *MockRepository) CreateClaimCategoryFromTemplate(ctx context.Context, tx pgx.Tx, orgID, templateID uuid.UUID, custom *ClaimCategoryCustomization) (uuid.UUID, error) {
	if m.CreateClaimCategoryFromTemplateFunc != nil {
		return m.CreateClaimCategoryFromTemplateFunc(ctx, tx, orgID, templateID, custom)
	}
	return uuid.Nil, errors.New("not implemented")
}

func (m *MockRepository) CreateInvitation(ctx context.Context, tx pgx.Tx, orgID uuid.UUID, email, role string) (uuid.UUID, error) {
	if m.CreateInvitationFunc != nil {
		return m.CreateInvitationFunc(ctx, tx, orgID, email, role)
	}
	return uuid.Nil, errors.New("not implemented")
}

func (m *MockRepository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	if m.BeginTxFunc != nil {
		return m.BeginTxFunc(ctx)
	}
	return nil, errors.New("not implemented")
}

// MockTx implements a simple mock transaction
type MockTx struct {
	CommitFunc   func(ctx context.Context) error
	RollbackFunc func(ctx context.Context) error
}

func (m *MockTx) Begin(ctx context.Context) (pgx.Tx, error)                 { return nil, nil }
func (m *MockTx) BeginFunc(ctx context.Context, f func(pgx.Tx) error) error { return nil }
func (m *MockTx) Commit(ctx context.Context) error {
	if m.CommitFunc != nil {
		return m.CommitFunc(ctx)
	}
	return nil
}
func (m *MockTx) Rollback(ctx context.Context) error {
	if m.RollbackFunc != nil {
		return m.RollbackFunc(ctx)
	}
	return nil
}
func (m *MockTx) CopyFrom(ctx context.Context, tableName pgx.Identifier, columnNames []string, rowSrc pgx.CopyFromSource) (int64, error) {
	return 0, nil
}
func (m *MockTx) SendBatch(ctx context.Context, b *pgx.Batch) pgx.BatchResults { return nil }
func (m *MockTx) LargeObjects() pgx.LargeObjects                               { return pgx.LargeObjects{} }
func (m *MockTx) Prepare(ctx context.Context, name, sql string) (*pgconn.StatementDescription, error) {
	return nil, nil
}
func (m *MockTx) Exec(ctx context.Context, sql string, arguments ...interface{}) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}
func (m *MockTx) Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	return nil, nil
}
func (m *MockTx) QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row { return nil }
func (m *MockTx) Conn() *pgx.Conn                                                       { return nil }

// Service validation logic tests
func TestValidateCompleteSetupRequest_ValidWithTemplate(t *testing.T) {
	svc := &Service{repo: &Repository{}}

	templateID := uuid.New()
	req := &CompleteSetupRequest{
		WorkSchedule: WorkScheduleChoice{TemplateID: &templateID},
		LeavePolicies: LeavePolicySelection{
			TemplateIDs: []uuid.UUID{uuid.New()},
		},
		ClaimCategories: ClaimCategorySelection{
			TemplateIDs: []uuid.UUID{uuid.New()},
		},
	}

	err := svc.ValidateCompleteSetupRequest(req)
	assert.NoError(t, err)
}

func TestValidateCompleteSetupRequest_ValidWithCustomSchedule(t *testing.T) {
	svc := &Service{repo: &Repository{}}

	req := &CompleteSetupRequest{
		WorkSchedule: WorkScheduleChoice{
			CustomSchedule: &CustomScheduleInput{
				Name:      "Custom Mon-Fri",
				WorkDays:  []int{1, 2, 3, 4, 5},
				StartTime: "08:00",
				EndTime:   "17:00",
			},
		},
		LeavePolicies:   LeavePolicySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
		ClaimCategories: ClaimCategorySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
	}

	err := svc.ValidateCompleteSetupRequest(req)
	assert.NoError(t, err)
}

func TestValidateCompleteSetupRequest_BothTemplateAndCustom(t *testing.T) {
	svc := &Service{repo: &Repository{}}

	templateID := uuid.New()
	req := &CompleteSetupRequest{
		WorkSchedule: WorkScheduleChoice{
			TemplateID:     &templateID,
			CustomSchedule: &CustomScheduleInput{Name: "Custom", WorkDays: []int{1}},
		},
		LeavePolicies:   LeavePolicySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
		ClaimCategories: ClaimCategorySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
	}

	err := svc.ValidateCompleteSetupRequest(req)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not both")
}

func TestValidateCompleteSetupRequest_NoWorkSchedule(t *testing.T) {
	svc := &Service{repo: &Repository{}}

	req := &CompleteSetupRequest{
		WorkSchedule:    WorkScheduleChoice{},
		LeavePolicies:   LeavePolicySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
		ClaimCategories: ClaimCategorySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
	}

	err := svc.ValidateCompleteSetupRequest(req)
	assert.Error(t, err)
}

func TestValidateCompleteSetupRequest_NoLeavePolicies(t *testing.T) {
	svc := &Service{repo: &Repository{}}

	templateID := uuid.New()
	req := &CompleteSetupRequest{
		WorkSchedule:    WorkScheduleChoice{TemplateID: &templateID},
		LeavePolicies:   LeavePolicySelection{TemplateIDs: []uuid.UUID{}},
		ClaimCategories: ClaimCategorySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
	}

	err := svc.ValidateCompleteSetupRequest(req)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "at least one leave policy")
}

func TestValidateCompleteSetupRequest_NoClaimCategories(t *testing.T) {
	svc := &Service{repo: &Repository{}}

	templateID := uuid.New()
	req := &CompleteSetupRequest{
		WorkSchedule:    WorkScheduleChoice{TemplateID: &templateID},
		LeavePolicies:   LeavePolicySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
		ClaimCategories: ClaimCategorySelection{},
	}

	err := svc.ValidateCompleteSetupRequest(req)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "at least one claim category")
}

// TestValidateCompleteSetupRequest_TooManyInvitations removed - invitations no longer part of setup

func TestValidateCompleteSetupRequest_CustomScheduleEmptyName(t *testing.T) {
	svc := &Service{repo: &Repository{}}

	req := &CompleteSetupRequest{
		WorkSchedule: WorkScheduleChoice{
			CustomSchedule: &CustomScheduleInput{Name: "", WorkDays: []int{1, 2}},
		},
		LeavePolicies:   LeavePolicySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
		ClaimCategories: ClaimCategorySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
	}

	err := svc.ValidateCompleteSetupRequest(req)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "name must be 1-100 characters")
}

func TestValidateCompleteSetupRequest_CustomScheduleTooManyDays(t *testing.T) {
	svc := &Service{repo: &Repository{}}

	req := &CompleteSetupRequest{
		WorkSchedule: WorkScheduleChoice{
			CustomSchedule: &CustomScheduleInput{
				Name:     "Custom",
				WorkDays: []int{1, 2, 3, 4, 5, 6, 7, 1}, // 8 days
			},
		},
		LeavePolicies:   LeavePolicySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
		ClaimCategories: ClaimCategorySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
	}

	err := svc.ValidateCompleteSetupRequest(req)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "1-7 work days")
}

func TestValidateCompleteSetupRequest_CustomScheduleInvalidDay(t *testing.T) {
	svc := &Service{repo: &Repository{}}

	req := &CompleteSetupRequest{
		WorkSchedule: WorkScheduleChoice{
			CustomSchedule: &CustomScheduleInput{
				Name:     "Custom",
				WorkDays: []int{1, 2, 9}, // 9 invalid
			},
		},
		LeavePolicies:   LeavePolicySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
		ClaimCategories: ClaimCategorySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
	}

	err := svc.ValidateCompleteSetupRequest(req)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid work day")
}

// Service business logic tests

func TestNewService(t *testing.T) {
	repo := &MockRepository{}
	logger := zerolog.Nop()

	svc := NewService(repo, logger)

	assert.NotNil(t, svc)
	assert.Equal(t, repo, svc.repo)
}

func TestService_GetSetupStatus_Success(t *testing.T) {
	orgID := uuid.New()
	completedAt := time.Now()

	mockRepo := &MockRepository{
		GetSetupStatusFunc: func(ctx context.Context, id uuid.UUID) (*SetupStatus, error) {
			assert.Equal(t, orgID, id)
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
	status, err := svc.GetSetupStatus(context.Background(), orgID)

	require.NoError(t, err)
	assert.False(t, status.NeedsSetup)
	assert.True(t, status.WorkScheduleExists)
	assert.Equal(t, 3, status.LeavePoliciesCount)
}

func TestService_GetSetupStatus_RepositoryError(t *testing.T) {
	orgID := uuid.New()

	mockRepo := &MockRepository{
		GetSetupStatusFunc: func(ctx context.Context, id uuid.UUID) (*SetupStatus, error) {
			return nil, errors.New("database error")
		},
	}

	svc := NewService(mockRepo, zerolog.Nop())
	_, err := svc.GetSetupStatus(context.Background(), orgID)

	require.Error(t, err)
}

func TestService_GetTemplates_Success(t *testing.T) {
	orgID := uuid.New()

	mockRepo := &MockRepository{
		GetOrganisationCountryCodeFunc: func(ctx context.Context, id uuid.UUID) (string, error) {
			return "ID", nil
		},
		GetWorkScheduleTemplatesFunc: func(ctx context.Context, countryCode string) ([]WorkScheduleTemplate, error) {
			return []WorkScheduleTemplate{
				{ID: uuid.New(), CountryCode: "ID", Name: "Standard Office"},
			}, nil
		},
		GetLeavePolicyTemplatesFunc: func(ctx context.Context, countryCode string) ([]LeavePolicyTemplate, error) {
			return []LeavePolicyTemplate{
				{ID: uuid.New(), CountryCode: "ID", Name: "Annual Leave"},
			}, nil
		},
		GetClaimCategoryTemplatesFunc: func(ctx context.Context, countryCode string) ([]ClaimCategoryTemplate, error) {
			return []ClaimCategoryTemplate{
				{ID: uuid.New(), CountryCode: "ID", Name: "Transport"},
			}, nil
		},
	}

	svc := NewService(mockRepo, zerolog.Nop())
	templates, err := svc.GetTemplates(context.Background(), orgID)

	require.NoError(t, err)
	assert.Len(t, templates.WorkSchedules, 1)
	assert.Len(t, templates.LeavePolicies, 1)
	assert.Len(t, templates.ClaimCategories, 1)
}

func TestService_GetTemplates_CountryCodeError(t *testing.T) {
	orgID := uuid.New()

	mockRepo := &MockRepository{
		GetOrganisationCountryCodeFunc: func(ctx context.Context, id uuid.UUID) (string, error) {
			return "", errors.New("database error")
		},
	}

	svc := NewService(mockRepo, zerolog.Nop())
	_, err := svc.GetTemplates(context.Background(), orgID)

	require.Error(t, err)
}

func TestService_GetTemplates_WorkScheduleTemplatesError(t *testing.T) {
	orgID := uuid.New()

	mockRepo := &MockRepository{
		GetOrganisationCountryCodeFunc: func(ctx context.Context, id uuid.UUID) (string, error) {
			return "ID", nil
		},
		GetWorkScheduleTemplatesFunc: func(ctx context.Context, countryCode string) ([]WorkScheduleTemplate, error) {
			return nil, errors.New("database error")
		},
	}

	svc := NewService(mockRepo, zerolog.Nop())
	_, err := svc.GetTemplates(context.Background(), orgID)

	require.Error(t, err)
}

func TestService_GetTemplates_LeavePolicyTemplatesError(t *testing.T) {
	orgID := uuid.New()

	mockRepo := &MockRepository{
		GetOrganisationCountryCodeFunc: func(ctx context.Context, id uuid.UUID) (string, error) {
			return "ID", nil
		},
		GetWorkScheduleTemplatesFunc: func(ctx context.Context, countryCode string) ([]WorkScheduleTemplate, error) {
			return []WorkScheduleTemplate{}, nil
		},
		GetLeavePolicyTemplatesFunc: func(ctx context.Context, countryCode string) ([]LeavePolicyTemplate, error) {
			return nil, errors.New("database error")
		},
	}

	svc := NewService(mockRepo, zerolog.Nop())
	_, err := svc.GetTemplates(context.Background(), orgID)

	require.Error(t, err)
}

func TestService_GetTemplates_ClaimCategoryTemplatesError(t *testing.T) {
	orgID := uuid.New()

	mockRepo := &MockRepository{
		GetOrganisationCountryCodeFunc: func(ctx context.Context, id uuid.UUID) (string, error) {
			return "ID", nil
		},
		GetWorkScheduleTemplatesFunc: func(ctx context.Context, countryCode string) ([]WorkScheduleTemplate, error) {
			return []WorkScheduleTemplate{}, nil
		},
		GetLeavePolicyTemplatesFunc: func(ctx context.Context, countryCode string) ([]LeavePolicyTemplate, error) {
			return []LeavePolicyTemplate{}, nil
		},
		GetClaimCategoryTemplatesFunc: func(ctx context.Context, countryCode string) ([]ClaimCategoryTemplate, error) {
			return nil, errors.New("database error")
		},
	}

	svc := NewService(mockRepo, zerolog.Nop())
	_, err := svc.GetTemplates(context.Background(), orgID)

	require.Error(t, err)
}

func TestService_SkipSetup_Success(t *testing.T) {
	orgID := uuid.New()

	mockRepo := &MockRepository{
		GetSetupStatusFunc: func(ctx context.Context, id uuid.UUID) (*SetupStatus, error) {
			return &SetupStatus{NeedsSetup: true}, nil
		},
		MarkSetupSkippedFunc: func(ctx context.Context, id uuid.UUID) error {
			assert.Equal(t, orgID, id)
			return nil
		},
	}

	svc := NewService(mockRepo, zerolog.Nop())
	err := svc.SkipSetup(context.Background(), orgID)

	require.NoError(t, err)
}

func TestService_SkipSetup_AlreadyCompleted(t *testing.T) {
	orgID := uuid.New()

	mockRepo := &MockRepository{
		GetSetupStatusFunc: func(ctx context.Context, id uuid.UUID) (*SetupStatus, error) {
			return &SetupStatus{NeedsSetup: false}, nil
		},
	}

	svc := NewService(mockRepo, zerolog.Nop())
	err := svc.SkipSetup(context.Background(), orgID)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "already completed or skipped")
}

func TestService_SkipSetup_GetStatusError(t *testing.T) {
	orgID := uuid.New()

	mockRepo := &MockRepository{
		GetSetupStatusFunc: func(ctx context.Context, id uuid.UUID) (*SetupStatus, error) {
			return nil, errors.New("database error")
		},
	}

	svc := NewService(mockRepo, zerolog.Nop())
	err := svc.SkipSetup(context.Background(), orgID)

	require.Error(t, err)
}

func TestService_SkipSetup_MarkSkippedError(t *testing.T) {
	orgID := uuid.New()

	mockRepo := &MockRepository{
		GetSetupStatusFunc: func(ctx context.Context, id uuid.UUID) (*SetupStatus, error) {
			return &SetupStatus{NeedsSetup: true}, nil
		},
		MarkSetupSkippedFunc: func(ctx context.Context, id uuid.UUID) error {
			return errors.New("database error")
		},
	}

	svc := NewService(mockRepo, zerolog.Nop())
	err := svc.SkipSetup(context.Background(), orgID)

	require.Error(t, err)
}

func TestService_CompleteSetup_Success(t *testing.T) {
	orgID := uuid.New()
	templateID := uuid.New()
	leaveTemplateID := uuid.New()
	claimTemplateID := uuid.New()

	mockTx := &MockTx{}

	mockRepo := &MockRepository{
		GetSetupStatusFunc: func(ctx context.Context, id uuid.UUID) (*SetupStatus, error) {
			return &SetupStatus{NeedsSetup: true}, nil
		},
		BeginTxFunc: func(ctx context.Context) (pgx.Tx, error) {
			return mockTx, nil
		},
		CreateWorkScheduleFromTemplateFunc: func(ctx context.Context, tx pgx.Tx, oid, tid uuid.UUID) (uuid.UUID, error) {
			return uuid.New(), nil
		},
		CreateLeavePolicyFromTemplateFunc: func(ctx context.Context, tx pgx.Tx, oid, tid uuid.UUID, custom *LeavePolicyCustomization) (uuid.UUID, error) {
			return uuid.New(), nil
		},
		CreateClaimCategoryFromTemplateFunc: func(ctx context.Context, tx pgx.Tx, oid, tid uuid.UUID, custom *ClaimCategoryCustomization) (uuid.UUID, error) {
			return uuid.New(), nil
		},
		MarkSetupCompleteFunc: func(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
			return nil
		},
	}

	svc := NewService(mockRepo, zerolog.Nop())
	req := &CompleteSetupRequest{
		WorkSchedule: WorkScheduleChoice{TemplateID: &templateID},
		LeavePolicies: LeavePolicySelection{
			TemplateIDs: []uuid.UUID{leaveTemplateID},
		},
		ClaimCategories: ClaimCategorySelection{
			TemplateIDs: []uuid.UUID{claimTemplateID},
		},
	}

	result, err := svc.CompleteSetup(context.Background(), orgID, req)

	require.NoError(t, err)
	assert.True(t, result.Success)
	assert.NotEqual(t, uuid.Nil, result.WorkScheduleID)
	assert.Len(t, result.LeavePolicyIDs, 1)
	assert.Len(t, result.ClaimCategoryIDs, 1)
}

func TestService_CompleteSetup_AlreadyCompleted(t *testing.T) {
	orgID := uuid.New()
	templateID := uuid.New()

	mockRepo := &MockRepository{
		GetSetupStatusFunc: func(ctx context.Context, id uuid.UUID) (*SetupStatus, error) {
			return &SetupStatus{NeedsSetup: false}, nil
		},
	}

	svc := NewService(mockRepo, zerolog.Nop())
	req := &CompleteSetupRequest{
		WorkSchedule:    WorkScheduleChoice{TemplateID: &templateID},
		LeavePolicies:   LeavePolicySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
		ClaimCategories: ClaimCategorySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
	}

	_, err := svc.CompleteSetup(context.Background(), orgID, req)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "already completed or skipped")
}

func TestService_CompleteSetup_GetStatusError(t *testing.T) {
	orgID := uuid.New()
	templateID := uuid.New()

	mockRepo := &MockRepository{
		GetSetupStatusFunc: func(ctx context.Context, id uuid.UUID) (*SetupStatus, error) {
			return nil, errors.New("database error")
		},
	}

	svc := NewService(mockRepo, zerolog.Nop())
	req := &CompleteSetupRequest{
		WorkSchedule:    WorkScheduleChoice{TemplateID: &templateID},
		LeavePolicies:   LeavePolicySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
		ClaimCategories: ClaimCategorySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
	}

	_, err := svc.CompleteSetup(context.Background(), orgID, req)

	require.Error(t, err)
}

func TestService_CompleteSetup_BeginTxError(t *testing.T) {
	orgID := uuid.New()
	templateID := uuid.New()

	mockRepo := &MockRepository{
		GetSetupStatusFunc: func(ctx context.Context, id uuid.UUID) (*SetupStatus, error) {
			return &SetupStatus{NeedsSetup: true}, nil
		},
		BeginTxFunc: func(ctx context.Context) (pgx.Tx, error) {
			return nil, errors.New("transaction error")
		},
	}

	svc := NewService(mockRepo, zerolog.Nop())
	req := &CompleteSetupRequest{
		WorkSchedule:    WorkScheduleChoice{TemplateID: &templateID},
		LeavePolicies:   LeavePolicySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
		ClaimCategories: ClaimCategorySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
	}

	_, err := svc.CompleteSetup(context.Background(), orgID, req)

	require.Error(t, err)
}

func TestService_CompleteSetup_CreateWorkScheduleError(t *testing.T) {
	orgID := uuid.New()
	templateID := uuid.New()
	mockTx := &MockTx{}

	mockRepo := &MockRepository{
		GetSetupStatusFunc: func(ctx context.Context, id uuid.UUID) (*SetupStatus, error) {
			return &SetupStatus{NeedsSetup: true}, nil
		},
		BeginTxFunc: func(ctx context.Context) (pgx.Tx, error) {
			return mockTx, nil
		},
		CreateWorkScheduleFromTemplateFunc: func(ctx context.Context, tx pgx.Tx, oid, tid uuid.UUID) (uuid.UUID, error) {
			return uuid.Nil, errors.New("create error")
		},
	}

	svc := NewService(mockRepo, zerolog.Nop())
	req := &CompleteSetupRequest{
		WorkSchedule:    WorkScheduleChoice{TemplateID: &templateID},
		LeavePolicies:   LeavePolicySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
		ClaimCategories: ClaimCategorySelection{TemplateIDs: []uuid.UUID{uuid.New()}},
	}

	_, err := svc.CompleteSetup(context.Background(), orgID, req)

	require.Error(t, err)
}

func TestService_CompleteSetup_CustomWorkSchedule(t *testing.T) {
	orgID := uuid.New()
	leaveTemplateID := uuid.New()
	claimTemplateID := uuid.New()
	mockTx := &MockTx{}

	mockRepo := &MockRepository{
		GetSetupStatusFunc: func(ctx context.Context, id uuid.UUID) (*SetupStatus, error) {
			return &SetupStatus{NeedsSetup: true}, nil
		},
		BeginTxFunc: func(ctx context.Context) (pgx.Tx, error) {
			return mockTx, nil
		},
		CreateCustomWorkScheduleFunc: func(ctx context.Context, tx pgx.Tx, oid uuid.UUID, input *CustomScheduleInput) (uuid.UUID, error) {
			assert.Equal(t, "Custom Schedule", input.Name)
			return uuid.New(), nil
		},
		CreateLeavePolicyFromTemplateFunc: func(ctx context.Context, tx pgx.Tx, oid, tid uuid.UUID, custom *LeavePolicyCustomization) (uuid.UUID, error) {
			return uuid.New(), nil
		},
		CreateClaimCategoryFromTemplateFunc: func(ctx context.Context, tx pgx.Tx, oid, tid uuid.UUID, custom *ClaimCategoryCustomization) (uuid.UUID, error) {
			return uuid.New(), nil
		},
		MarkSetupCompleteFunc: func(ctx context.Context, tx pgx.Tx, id uuid.UUID) error {
			return nil
		},
	}

	svc := NewService(mockRepo, zerolog.Nop())
	req := &CompleteSetupRequest{
		WorkSchedule: WorkScheduleChoice{
			CustomSchedule: &CustomScheduleInput{
				Name:      "Custom Schedule",
				WorkDays:  []int{1, 2, 3, 4, 5},
				StartTime: "09:00",
				EndTime:   "18:00",
			},
		},
		LeavePolicies: LeavePolicySelection{
			TemplateIDs: []uuid.UUID{leaveTemplateID},
		},
		ClaimCategories: ClaimCategorySelection{
			TemplateIDs: []uuid.UUID{claimTemplateID},
		},
	}

	result, err := svc.CompleteSetup(context.Background(), orgID, req)

	require.NoError(t, err)
	assert.True(t, result.Success)
}

// TestService_CompleteSetup_WithInvitations removed - invitations no longer part of setup

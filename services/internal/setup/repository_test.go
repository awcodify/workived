package setup

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Note: These tests require a test database. Run with TEST_DATABASE_URL env var
// or skip with `go test -short` to run only unit tests without database.

func getTestDB(t *testing.T) *pgxpool.Pool {
	if testing.Short() {
		t.Skip("Skipping database tests in short mode")
	}

	// Use existing docker-compose database for tests
	//nolint:gosec // hardcoded test credentials are acceptable in tests
	dbURL := "postgres://workived:workived@localhost:5432/workived?sslmode=disable"

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		t.Skipf("Skipping database tests: %v", err)
	}

	return pool
}

func setupTestOrg(t *testing.T, db *pgxpool.Pool) uuid.UUID {
	orgID := uuid.New()

	query := `
		INSERT INTO organisations (id, organisation_id, name, country_code, timezone, currency_code)
		VALUES ($1, $1, 'Test Org', 'ID', 'Asia/Jakarta', 'IDR')
	`

	_, err := db.Exec(context.Background(), query, orgID)
	require.NoError(t, err)

	return orgID
}

func cleanupTestOrg(t *testing.T, db *pgxpool.Pool, orgID uuid.UUID) {
	// Clean up in reverse order of foreign key dependencies
	tables := []string{
		"invitations",
		"claims",
		"claim_categories",
		"leave_requests",
		"leave_balances",
		"leave_policies",
		"work_schedules",
		"organisation_members",
		"organisations",
	}

	for _, table := range tables {
		query := "DELETE FROM " + table + " WHERE organisation_id = $1"
		_, _ = db.Exec(context.Background(), query, orgID)
	}
}

func TestNewRepository(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	repo := NewRepository(db)

	assert.NotNil(t, repo)
	assert.Equal(t, db, repo.db)
}

func TestRepository_GetSetupStatus(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	defer cleanupTestOrg(t, db, orgID)

	repo := NewRepository(db)

	status, err := repo.GetSetupStatus(context.Background(), orgID)

	require.NoError(t, err)
	assert.True(t, status.NeedsSetup)
	assert.False(t, status.Skipped)
	assert.Nil(t, status.CompletedAt)
	assert.False(t, status.WorkScheduleExists)
	assert.Equal(t, 0, status.LeavePoliciesCount)
	assert.Equal(t, 0, status.ClaimCategoriesCount)
}

func TestRepository_GetSetupStatus_NotFound(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	repo := NewRepository(db)
	nonExistentID := uuid.New()

	_, err := repo.GetSetupStatus(context.Background(), nonExistentID)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestRepository_GetOrganisationCountryCode(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	defer cleanupTestOrg(t, db, orgID)

	repo := NewRepository(db)

	countryCode, err := repo.GetOrganisationCountryCode(context.Background(), orgID)

	require.NoError(t, err)
	assert.Equal(t, "ID", countryCode)
}

func TestRepository_GetOrganisationCountryCode_NotFound(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	repo := NewRepository(db)
	nonExistentID := uuid.New()

	_, err := repo.GetOrganisationCountryCode(context.Background(), nonExistentID)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestRepository_GetWorkScheduleTemplates(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	repo := NewRepository(db)

	templates, err := repo.GetWorkScheduleTemplates(context.Background(), "ID")

	require.NoError(t, err)
	assert.NotEmpty(t, templates)

	// Verify structure
	for _, tmpl := range templates {
		assert.NotEqual(t, uuid.Nil, tmpl.ID)
		assert.Equal(t, "ID", tmpl.CountryCode)
		assert.NotEmpty(t, tmpl.Name)
		assert.NotEmpty(t, tmpl.WorkDays)
		assert.NotEmpty(t, tmpl.StartTime)
		assert.NotEmpty(t, tmpl.EndTime)
	}
}

func TestRepository_GetLeavePolicyTemplates(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	repo := NewRepository(db)

	templates, err := repo.GetLeavePolicyTemplates(context.Background(), "ID")

	require.NoError(t, err)
	assert.NotEmpty(t, templates)

	// Verify structure
	for _, tmpl := range templates {
		assert.NotEqual(t, uuid.Nil, tmpl.ID)
		assert.Equal(t, "ID", tmpl.CountryCode)
		assert.NotEmpty(t, tmpl.Name)
		assert.Greater(t, tmpl.EntitledDaysPerYear, float64(0))
	}
}

func TestRepository_GetClaimCategoryTemplates(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	repo := NewRepository(db)

	templates, err := repo.GetClaimCategoryTemplates(context.Background(), "ID")

	require.NoError(t, err)
	assert.NotEmpty(t, templates)

	// Verify structure
	for _, tmpl := range templates {
		assert.NotEqual(t, uuid.Nil, tmpl.ID)
		assert.Equal(t, "ID", tmpl.CountryCode)
		assert.NotEmpty(t, tmpl.Name)
	}
}

func TestRepository_MarkSetupSkipped(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	defer cleanupTestOrg(t, db, orgID)

	repo := NewRepository(db)

	err := repo.MarkSetupSkipped(context.Background(), orgID)
	require.NoError(t, err)

	// Verify it was marked as skipped
	status, err := repo.GetSetupStatus(context.Background(), orgID)
	require.NoError(t, err)
	assert.True(t, status.Skipped)
	assert.False(t, status.NeedsSetup)
}

func TestRepository_BeginTx(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	repo := NewRepository(db)

	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)
	assert.NotNil(t, tx)

	// Clean up
	_ = tx.Rollback(context.Background())
}

func TestRepository_MarkSetupComplete(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	defer cleanupTestOrg(t, db, orgID)

	repo := NewRepository(db)

	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)
	defer func() { _ = tx.Rollback(context.Background()) }()

	err = repo.MarkSetupComplete(context.Background(), tx, orgID)
	require.NoError(t, err)

	err = tx.Commit(context.Background())
	require.NoError(t, err)

	// Verify setup was marked complete
	status, err := repo.GetSetupStatus(context.Background(), orgID)
	require.NoError(t, err)
	assert.False(t, status.NeedsSetup)
	assert.NotNil(t, status.CompletedAt)
	assert.False(t, status.Skipped)
}

func TestRepository_CreateWorkScheduleFromTemplate(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	defer cleanupTestOrg(t, db, orgID)

	repo := NewRepository(db)

	// Get a template ID
	templates, err := repo.GetWorkScheduleTemplates(context.Background(), "ID")
	require.NoError(t, err)
	require.NotEmpty(t, templates)
	templateID := templates[0].ID

	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)
	defer func() { _ = tx.Rollback(context.Background()) }()

	scheduleID, err := repo.CreateWorkScheduleFromTemplate(context.Background(), tx, orgID, templateID)

	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, scheduleID)

	_ = tx.Commit(context.Background())
}

func TestRepository_CreateCustomWorkSchedule(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	defer cleanupTestOrg(t, db, orgID)

	repo := NewRepository(db)

	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)
	defer func() { _ = tx.Rollback(context.Background()) }()

	input := &CustomScheduleInput{
		Name:      "Test Custom Schedule",
		WorkDays:  []int{1, 2, 3, 4, 5},
		StartTime: "09:00",
		EndTime:   "17:00",
	}

	scheduleID, err := repo.CreateCustomWorkSchedule(context.Background(), tx, orgID, input)

	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, scheduleID)

	_ = tx.Commit(context.Background())
}

func TestRepository_CreateLeavePolicyFromTemplate(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	defer cleanupTestOrg(t, db, orgID)

	repo := NewRepository(db)

	// Get a template ID
	templates, err := repo.GetLeavePolicyTemplates(context.Background(), "ID")
	require.NoError(t, err)
	require.NotEmpty(t, templates)
	templateID := templates[0].ID

	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)
	defer func() { _ = tx.Rollback(context.Background()) }()

	policyID, err := repo.CreateLeavePolicyFromTemplate(context.Background(), tx, orgID, templateID, nil)

	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, policyID)

	_ = tx.Commit(context.Background())
}

func TestRepository_CreateLeavePolicyFromTemplate_WithCustomization(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	defer cleanupTestOrg(t, db, orgID)

	repo := NewRepository(db)

	// Get a template ID
	templates, err := repo.GetLeavePolicyTemplates(context.Background(), "ID")
	require.NoError(t, err)
	require.NotEmpty(t, templates)
	templateID := templates[0].ID

	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)
	defer func() { _ = tx.Rollback(context.Background()) }()

	customDays := 15.0
	customization := &LeavePolicyCustomization{
		DaysPerYear: &customDays,
	}

	policyID, err := repo.CreateLeavePolicyFromTemplate(context.Background(), tx, orgID, templateID, customization)

	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, policyID)

	_ = tx.Commit(context.Background())
}

func TestRepository_CreateClaimCategoryFromTemplate(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	defer cleanupTestOrg(t, db, orgID)

	repo := NewRepository(db)

	// Get a template ID
	templates, err := repo.GetClaimCategoryTemplates(context.Background(), "ID")
	require.NoError(t, err)
	require.NotEmpty(t, templates)

	// Find a template with a monthly limit
	var templateID uuid.UUID
	for _, tmpl := range templates {
		if tmpl.MonthlyLimit != nil {
			templateID = tmpl.ID
			break
		}
	}

	if templateID == uuid.Nil {
		t.Skip("No claim category template with monthly limit found")
	}

	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)
	defer func() { _ = tx.Rollback(context.Background()) }()

	categoryID, err := repo.CreateClaimCategoryFromTemplate(context.Background(), tx, orgID, templateID, nil)

	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, categoryID)

	_ = tx.Commit(context.Background())
}

func TestRepository_CreateClaimCategoryFromTemplate_WithCustomization(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	defer cleanupTestOrg(t, db, orgID)

	repo := NewRepository(db)

	// Get a template ID
	templates, err := repo.GetClaimCategoryTemplates(context.Background(), "ID")
	require.NoError(t, err)
	require.NotEmpty(t, templates)

	// Find a template with a monthly limit
	var templateID uuid.UUID
	for _, tmpl := range templates {
		if tmpl.MonthlyLimit != nil {
			templateID = tmpl.ID
			break
		}
	}

	if templateID == uuid.Nil {
		t.Skip("No claim category template with monthly limit found")
	}

	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)
	defer func() { _ = tx.Rollback(context.Background()) }()

	customLimit := int64(500000)
	customization := &ClaimCategoryCustomization{
		MonthlyLimit: &customLimit,
	}

	categoryID, err := repo.CreateClaimCategoryFromTemplate(context.Background(), tx, orgID, templateID, customization)

	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, categoryID)

	_ = tx.Commit(context.Background())
}

func TestRepository_CreateInvitation(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	defer cleanupTestOrg(t, db, orgID)

	repo := NewRepository(db)

	tx, err := repo.BeginTx(context.Background())
	require.NoError(t, err)
	defer func() { _ = tx.Rollback(context.Background()) }()

	invitationID, err := repo.CreateInvitation(context.Background(), tx, orgID, "test@example.com", "member")

	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, invitationID)

	_ = tx.Commit(context.Background())
}

func TestRepository_IntegrationFlow(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	defer cleanupTestOrg(t, db, orgID)

	repo := NewRepository(db)
	ctx := context.Background()

	// Step 1: Check initial setup status
	status, err := repo.GetSetupStatus(ctx, orgID)
	require.NoError(t, err)
	assert.True(t, status.NeedsSetup)

	// Step 2: Get templates
	wsTemplates, err := repo.GetWorkScheduleTemplates(ctx, "ID")
	require.NoError(t, err)
	require.NotEmpty(t, wsTemplates)

	lpTemplates, err := repo.GetLeavePolicyTemplates(ctx, "ID")
	require.NoError(t, err)
	require.NotEmpty(t, lpTemplates)

	ccTemplates, err := repo.GetClaimCategoryTemplates(ctx, "ID")
	require.NoError(t, err)
	require.NotEmpty(t, ccTemplates)

	// Step 3: Complete setup in transaction
	tx, err := repo.BeginTx(ctx)
	require.NoError(t, err)
	defer func() { _ = tx.Rollback(ctx) }()

	// Create work schedule
	scheduleID, err := repo.CreateWorkScheduleFromTemplate(ctx, tx, orgID, wsTemplates[0].ID)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, scheduleID)

	// Create leave policy
	policyID, err := repo.CreateLeavePolicyFromTemplate(ctx, tx, orgID, lpTemplates[0].ID, nil)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, policyID)

	// Find template with monthly limit for claim category
	var claimTemplateID uuid.UUID
	for _, tmpl := range ccTemplates {
		if tmpl.MonthlyLimit != nil {
			claimTemplateID = tmpl.ID
			break
		}
	}
	require.NotEqual(t, uuid.Nil, claimTemplateID, "Need template with monthly limit")

	// Create claim category
	categoryID, err := repo.CreateClaimCategoryFromTemplate(ctx, tx, orgID, claimTemplateID, nil)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, categoryID)

	// Mark setup complete
	err = repo.MarkSetupComplete(ctx, tx, orgID)
	require.NoError(t, err)

	// Commit transaction
	err = tx.Commit(ctx)
	require.NoError(t, err)

	// Step 4: Verify setup is complete
	time.Sleep(100 * time.Millisecond) // Small delay for DB update
	finalStatus, err := repo.GetSetupStatus(ctx, orgID)
	require.NoError(t, err)
	assert.False(t, finalStatus.NeedsSetup)
	assert.NotNil(t, finalStatus.CompletedAt)
	assert.True(t, finalStatus.WorkScheduleExists)
	assert.Greater(t, finalStatus.LeavePoliciesCount, 0)
	assert.Greater(t, finalStatus.ClaimCategoriesCount, 0)
}

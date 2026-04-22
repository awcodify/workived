package employee_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/workived/services/internal/employee"
)

// Note: These tests require a test database. Run with TEST_DATABASE_URL env var
// or skip with `go test -short` to run only unit tests without database.

func getTestDB(t *testing.T) *pgxpool.Pool {
	if testing.Short() {
		t.Skip("Skipping database tests in short mode")
	}

	// Use existing docker-compose database for tests
	//nolint:gosec // hardcoded test credentials are acceptable in tests
	dbURL := "postgres://workived:password@localhost:5432/workived?sslmode=disable"

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Skipf("Skipping database tests: %v", err)
	}

	// pgxpool.New doesn't connect eagerly — ping to verify DB is reachable
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		t.Skipf("Skipping database tests (DB not reachable): %v", err)
	}

	return pool
}

func setupTestOrg(t *testing.T, db *pgxpool.Pool) uuid.UUID {
	orgID := uuid.New()

	query := `
		INSERT INTO organisations (id, name, slug, country_code, timezone, currency_code, work_days, plan, plan_employee_limit)
		VALUES ($1, $2, $3, $4, $5, $6, ARRAY[1,2,3,4,5], $7, $8)
	`

	slug := "test-org-" + orgID.String()[:8]
	_, err := db.Exec(context.Background(), query, orgID, "Test Org", slug, "AE", "Asia/Dubai", "AED", "free", 25)
	require.NoError(t, err)

	return orgID
}

func setupTestUser(t *testing.T, db *pgxpool.Pool) uuid.UUID {
	userID := uuid.New()

	query := `
		INSERT INTO users (id, email, full_name, password_hash)
		VALUES ($1, $2, $3, $4)
	`

	_, err := db.Exec(context.Background(), query, userID, userID.String()+"@example.com", "Test User", "hash")
	require.NoError(t, err)

	return userID
}

func setupTestWorkSchedule(t *testing.T, db *pgxpool.Pool, orgID uuid.UUID) uuid.UUID {
	scheduleID := uuid.New()

	query := `
		INSERT INTO work_schedules (id, organisation_id, name, work_days, start_time, end_time)
		VALUES ($1, $2, $3, ARRAY[1,2,3,4,5], '09:00:00', '18:00:00')
	`

	_, err := db.Exec(context.Background(), query, scheduleID, orgID, "Test Schedule")
	require.NoError(t, err)

	return scheduleID
}

func cleanupTestData(t *testing.T, db *pgxpool.Pool, orgID uuid.UUID, userIDs ...uuid.UUID) {
	// Clean up in reverse order of foreign key dependencies
	tables := []string{
		"leave_requests",
		"leave_balances",
		"employment_changes",
		"employee_documents",
		"organisation_members",
		"employees",
		"departments",
		"work_schedules",
		"organisations",
	}

	for _, table := range tables {
		query := "DELETE FROM " + table + " WHERE organisation_id = $1"
		_, _ = db.Exec(context.Background(), query, orgID)
	}

	// Clean up users
	for _, userID := range userIDs {
		_, _ = db.Exec(context.Background(), "DELETE FROM users WHERE id = $1", userID)
	}
}

func TestNewRepository(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	repo := employee.NewRepository(db)

	assert.NotNil(t, repo)
}

func TestRepository_Create(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	userID := setupTestUser(t, db)
	scheduleID := setupTestWorkSchedule(t, db, orgID)
	defer cleanupTestData(t, db, orgID, userID)

	repo := employee.NewRepository(db)

	email := "ahmad.rashid@example.com"

	req := employee.CreateEmployeeRequest{
		UserID:         &userID,
		FullName:       "Ahmad Rashid",
		Email:          &email,
		EmploymentType: "full_time",
		StartDate:      "2026-04-01",
		WorkScheduleID: scheduleID,
	}

	emp, err := repo.Create(context.Background(), orgID, req)

	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, emp.ID)
	assert.Equal(t, orgID, emp.OrganisationID)
	assert.Equal(t, "Ahmad Rashid", emp.FullName)
	assert.NotNil(t, emp.Email)
	assert.Equal(t, email, *emp.Email)
	assert.Equal(t, "full_time", emp.EmploymentType)
	assert.NotNil(t, emp.UserID)
	assert.Equal(t, userID, *emp.UserID)
}

func TestRepository_GetByID(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	userID := setupTestUser(t, db)
	scheduleID := setupTestWorkSchedule(t, db, orgID)
	defer cleanupTestData(t, db, orgID, userID)

	repo := employee.NewRepository(db)

	// Create employee
	email := "sarah.chen@example.com"
	createReq := employee.CreateEmployeeRequest{
		UserID:         &userID,
		FullName:       "Sarah Chen",
		Email:          &email,
		EmploymentType: "full_time",
		StartDate:      "2026-04-01",
		WorkScheduleID: scheduleID,
	}

	created, err := repo.Create(context.Background(), orgID, createReq)
	require.NoError(t, err)

	// Test: Get by ID (same org)
	emp, err := repo.GetByID(context.Background(), orgID, created.ID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, emp.ID)
	assert.Equal(t, "Sarah Chen", emp.FullName)

	// Test: Get by ID (different org) — should not find
	otherOrgID := uuid.New()
	_, err = repo.GetByID(context.Background(), otherOrgID, created.ID)
	assert.Error(t, err) // Should fail org_id check
}

func TestRepository_GetByUserID(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	userID := setupTestUser(t, db)
	scheduleID := setupTestWorkSchedule(t, db, orgID)
	defer cleanupTestData(t, db, orgID, userID)

	repo := employee.NewRepository(db)

	// Create employee linked to user
	email := userID.String() + "@example.com"
	createReq := employee.CreateEmployeeRequest{
		UserID:         &userID,
		FullName:       "Test User Employee",
		Email:          &email,
		EmploymentType: "full_time",
		StartDate:      "2026-04-01",
		WorkScheduleID: scheduleID,
	}

	created, err := repo.Create(context.Background(), orgID, createReq)
	require.NoError(t, err)

	// Test: Get by user ID
	emp, err := repo.GetByUserID(context.Background(), orgID, userID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, emp.ID)
	assert.NotNil(t, emp.UserID)
	assert.Equal(t, userID, *emp.UserID)

	// Test: Get by user ID (different org) — should not find
	otherOrgID := uuid.New()
	_, err = repo.GetByUserID(context.Background(), otherOrgID, userID)
	assert.Error(t, err) // Multi-tenancy check
}

func TestRepository_List(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	userID1 := setupTestUser(t, db)
	userID2 := setupTestUser(t, db)
	scheduleID := setupTestWorkSchedule(t, db, orgID)
	defer cleanupTestData(t, db, orgID, userID1, userID2)

	repo := employee.NewRepository(db)

	email1 := "ahmad@example.com"
	email2 := "sarah@example.com"

	// Create test employees
	emp1Req := employee.CreateEmployeeRequest{
		UserID:         &userID1,
		FullName:       "Ahmad Rashid",
		Email:          &email1,
		EmploymentType: "full_time",
		StartDate:      "2026-04-01",
		WorkScheduleID: scheduleID,
	}
	emp2Req := employee.CreateEmployeeRequest{
		UserID:         &userID2,
		FullName:       "Sarah Chen",
		Email:          &email2,
		EmploymentType: "part_time",
		StartDate:      "2026-04-01",
		WorkScheduleID: scheduleID,
	}

	_, err := repo.Create(context.Background(), orgID, emp1Req)
	require.NoError(t, err)
	_, err = repo.Create(context.Background(), orgID, emp2Req)
	require.NoError(t, err)

	// Test: List all
	result, err := repo.List(context.Background(), orgID, employee.ListFilters{Limit: 10})
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(result), 2)

	// Test: List with status filter
	activeStatus := "active"
	resultActive, err := repo.List(context.Background(), orgID, employee.ListFilters{
		Limit:  10,
		Status: &activeStatus,
	})
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(resultActive), 2)

	// Test: List with search
	search := "Ahmad"
	resultSearch, err := repo.List(context.Background(), orgID, employee.ListFilters{
		Limit:  10,
		Search: &search,
	})
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(resultSearch), 1)
	// Verify actual search worked
	found := false
	for _, e := range resultSearch {
		if e.FullName == "Ahmad Rashid" {
			found = true
			break
		}
	}
	assert.True(t, found, "Should find Ahmad Rashid in search results")

	// Test: List with limit
	resultLimit, err := repo.List(context.Background(), orgID, employee.ListFilters{Limit: 1})
	require.NoError(t, err)
	assert.LessOrEqual(t, len(resultLimit), 2) // May return limit+1 for pagination

	// Test: Multi-tenancy — different org should not see employees
	otherOrgID := uuid.New()
	resultOther, err := repo.List(context.Background(), otherOrgID, employee.ListFilters{Limit: 10})
	require.NoError(t, err)
	assert.Equal(t, 0, len(resultOther)) // Should be empty
}

func TestRepository_CountActive(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	userID := setupTestUser(t, db)
	scheduleID := setupTestWorkSchedule(t, db, orgID)
	defer cleanupTestData(t, db, orgID, userID)

	repo := employee.NewRepository(db)

	// Initial count should be 0
	count, err := repo.CountActive(context.Background(), orgID)
	require.NoError(t, err)
	assert.Equal(t, 0, count)

	// Create an active employee
	email := "active@example.com"
	createReq := employee.CreateEmployeeRequest{
		UserID:         &userID,
		FullName:       "Active Employee",
		Email:          &email,
		EmploymentType: "full_time",
		StartDate:      "2026-04-01",
		WorkScheduleID: scheduleID,
	}

	_, err = repo.Create(context.Background(), orgID, createReq)
	require.NoError(t, err)

	// Count should be 1
	count, err = repo.CountActive(context.Background(), orgID)
	require.NoError(t, err)
	assert.Equal(t, 1, count)

	// Test: Multi-tenancy — different org should have count 0
	otherOrgID := uuid.New()
	otherCount, err := repo.CountActive(context.Background(), otherOrgID)
	require.NoError(t, err)
	assert.Equal(t, 0, otherCount)
}

func TestRepository_Update(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	userID := setupTestUser(t, db)
	scheduleID := setupTestWorkSchedule(t, db, orgID)
	defer cleanupTestData(t, db, orgID, userID)

	repo := employee.NewRepository(db)

	// Create employee
	email := "original@example.com"
	createReq := employee.CreateEmployeeRequest{
		UserID:         &userID,
		FullName:       "Original Name",
		Email:          &email,
		EmploymentType: "full_time",
		StartDate:      "2026-04-01",
		WorkScheduleID: scheduleID,
	}

	created, err := repo.Create(context.Background(), orgID, createReq)
	require.NoError(t, err)

	// Update employee
	phone := "+971501234567"
	updatedName := "Updated Name"
	jobTitle := "Senior Engineer"
	baseSalary := int64(10000000)

	updateReq := employee.UpdateEmployeeRequest{
		FullName:   &updatedName,
		Phone:      &phone,
		JobTitle:   &jobTitle,
		BaseSalary: &baseSalary,
	}

	updated, err := repo.Update(context.Background(), orgID, created.ID, updateReq)
	require.NoError(t, err)
	assert.Equal(t, created.ID, updated.ID)
	assert.Equal(t, "Updated Name", updated.FullName)
	assert.NotNil(t, updated.Phone)
	assert.Equal(t, "+971501234567", *updated.Phone)
	assert.NotNil(t, updated.JobTitle)
	assert.Equal(t, "Senior Engineer", *updated.JobTitle)
	assert.NotNil(t, updated.BaseSalary)
	assert.Equal(t, int64(10000000), *updated.BaseSalary)

	// Test: Update in different org should fail
	otherOrgID := uuid.New()
	_, err = repo.Update(context.Background(), otherOrgID, created.ID, updateReq)
	assert.Error(t, err) // Multi-tenancy check
}

func TestRepository_SoftDelete(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	userID := setupTestUser(t, db)
	scheduleID := setupTestWorkSchedule(t, db, orgID)
	defer cleanupTestData(t, db, orgID, userID)

	repo := employee.NewRepository(db)

	// Create employee
	email := "delete@example.com"
	createReq := employee.CreateEmployeeRequest{
		UserID:         &userID,
		FullName:       "To Delete",
		Email:          &email,
		EmploymentType: "full_time",
		StartDate:      "2026-04-01",
		WorkScheduleID: scheduleID,
	}

	created, err := repo.Create(context.Background(), orgID, createReq)
	require.NoError(t, err)

	// Soft delete
	err = repo.SoftDelete(context.Background(), orgID, created.ID)
	require.NoError(t, err)

	// Verify is_active = false
	emp, err := repo.GetByID(context.Background(), orgID, created.ID)
	require.NoError(t, err)
	assert.False(t, emp.IsActive)

	// Test: Delete in different org should fail
	otherOrgID := uuid.New()
	err = repo.SoftDelete(context.Background(), otherOrgID, created.ID)
	assert.Error(t, err) // Multi-tenancy check
}

func TestRepository_GetDirectReports(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	scheduleID := setupTestWorkSchedule(t, db, orgID)
	user1 := setupTestUser(t, db)
	user2 := setupTestUser(t, db)
	defer cleanupTestData(t, db, orgID, user1, user2)

	repo := employee.NewRepository(db)

	mgrEmail := "manager@example.com"
	reportEmail := "report@example.com"

	// Create manager
	managerReq := employee.CreateEmployeeRequest{
		UserID:         &user1,
		FullName:       "Manager",
		Email:          &mgrEmail,
		EmploymentType: "full_time",
		StartDate:      "2026-04-01",
		WorkScheduleID: scheduleID,
	}
	manager, err := repo.Create(context.Background(), orgID, managerReq)
	require.NoError(t, err)

	// Create direct report
	reportReq := employee.CreateEmployeeRequest{
		UserID:         &user2,
		FullName:       "Direct Report",
		Email:          &reportEmail,
		EmploymentType: "full_time",
		StartDate:      "2026-04-01",
		ReportingTo:    &manager.ID,
		WorkScheduleID: scheduleID,
	}
	_, err = repo.Create(context.Background(), orgID, reportReq)
	require.NoError(t, err)

	// Get direct reports
	reports, err := repo.GetDirectReports(context.Background(), orgID, manager.ID)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(reports), 1)

	// Verify the report is in the list
	found := false
	for _, r := range reports {
		if r.FullName == "Direct Report" {
			found = true
			assert.NotNil(t, r.ReportingTo)
			assert.Equal(t, manager.ID, *r.ReportingTo)
			break
		}
	}
	assert.True(t, found, "Should find direct report")

	// Test: Multi-tenancy — different org should not see reports
	otherOrgID := uuid.New()
	otherReports, err := repo.GetDirectReports(context.Background(), otherOrgID, manager.ID)
	require.NoError(t, err)
	assert.Equal(t, 0, len(otherReports))
}

func TestRepository_GetWorkload(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	scheduleID := setupTestWorkSchedule(t, db, orgID)
	userID := setupTestUser(t, db)
	defer cleanupTestData(t, db, orgID, userID)

	repo := employee.NewRepository(db)

	// Create employee
	email := "workload@example.com"
	createReq := employee.CreateEmployeeRequest{
		UserID:         &userID,
		FullName:       "Workload Test",
		Email:          &email,
		EmploymentType: "full_time",
		StartDate:      "2026-04-01",
		WorkScheduleID: scheduleID,
	}

	_, err := repo.Create(context.Background(), orgID, createReq)
	require.NoError(t, err)

	// Get workload (should not error even with no tasks/leaves)
	workload, err := repo.GetWorkload(context.Background(), orgID)
	require.NoError(t, err)
	assert.NotNil(t, workload)

	// Test: Multi-tenancy
	otherOrgID := uuid.New()
	otherWorkload, err := repo.GetWorkload(context.Background(), otherOrgID)
	require.NoError(t, err)
	assert.Equal(t, 0, len(otherWorkload))
}

func TestRepository_ListAllActive(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	orgID := setupTestOrg(t, db)
	scheduleID := setupTestWorkSchedule(t, db, orgID)
	userID1 := setupTestUser(t, db)
	userID2 := setupTestUser(t, db)
	defer cleanupTestData(t, db, orgID, userID1, userID2)

	repo := employee.NewRepository(db)

	activeEmail := "active@example.com"
	inactiveEmail := "inactive@example.com"

	// Create active employee
	activeReq := employee.CreateEmployeeRequest{
		UserID:         &userID1,
		FullName:       "Active Employee",
		Email:          &activeEmail,
		EmploymentType: "full_time",
		StartDate:      "2026-04-01",
		WorkScheduleID: scheduleID,
	}
	active, err := repo.Create(context.Background(), orgID, activeReq)
	require.NoError(t, err)

	// Create another employee then soft delete
	inactiveReq := employee.CreateEmployeeRequest{
		UserID:         &userID2,
		FullName:       "To Deactivate",
		Email:          &inactiveEmail,
		EmploymentType: "full_time",
		StartDate:      "2026-04-01",
		WorkScheduleID: scheduleID,
	}
	inactive, err := repo.Create(context.Background(), orgID, inactiveReq)
	require.NoError(t, err)

	err = repo.SoftDelete(context.Background(), orgID, inactive.ID)
	require.NoError(t, err)

	// List all active — should only return the active one
	allActive, err := repo.ListAllActive(context.Background(), orgID)
	require.NoError(t, err)

	// Verify only active employees are returned
	for _, emp := range allActive {
		assert.True(t, emp.IsActive, "All returned employees should be active")
		assert.NotEqual(t, inactive.ID, emp.ID, "Inactive employee should not be in list")
	}

	// Verify active employee is in the list
	found := false
	for _, emp := range allActive {
		if emp.ID == active.ID {
			found = true
			break
		}
	}
	assert.True(t, found, "Active employee should be in AllActive list")

	// Test: Multi-tenancy
	otherOrgID := uuid.New()
	otherActive, err := repo.ListAllActive(context.Background(), otherOrgID)
	require.NoError(t, err)
	assert.Equal(t, 0, len(otherActive))
}

package admin

import (
	"context"
	"testing"

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

func TestListOrganisations(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	repo := NewRepository(db)
	ctx := context.Background()

	// Test should return list without error
	orgs, err := repo.ListOrganisations(ctx)
	require.NoError(t, err)
	assert.NotNil(t, orgs)
	// May have seeded orgs from migrations, so just verify it returns data
}

func TestGetOrganisationDetail(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	repo := NewRepository(db)
	ctx := context.Background()

	// Test with non-existent ID should return NotFound error
	nonExistentID := uuid.New()
	_, err := repo.GetOrganisationDetail(ctx, nonExistentID)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestUpdateOrganisationStatus(t *testing.T) {
	db := getTestDB(t)
	defer db.Close()

	repo := NewRepository(db)
	ctx := context.Background()

	// Test with non-existent ID should return NotFound error
	nonExistentID := uuid.New()
	err := repo.UpdateOrganisationStatus(ctx, nonExistentID, false)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

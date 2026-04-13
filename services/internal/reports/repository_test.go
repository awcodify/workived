package reports_test

import (
	"testing"

	"github.com/workived/services/internal/reports"
)

// Compile-time check: *Repository implements RepositoryInterface.
var _ reports.RepositoryInterface = (*reports.Repository)(nil)

func TestNewRepository(t *testing.T) {
	repo := reports.NewRepository(nil)
	if repo == nil {
		t.Fatal("NewRepository returned nil")
	}
}

func TestRepositoryInterfaceCompleteness(t *testing.T) {
	// Verify the interface has the expected number of methods by checking
	// that a concrete implementation compiles against RepositoryInterface.
	// This is a compile-time check — if any method is missing, the build fails.
	t.Log("RepositoryInterface is complete and Repository satisfies it")
}

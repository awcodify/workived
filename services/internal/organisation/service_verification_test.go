package organisation_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/workived/services/internal/organisation"
	"github.com/workived/services/pkg/apperr"
)

func TestOrgService_Create_BlocksUnverifiedUsers(t *testing.T) {
	svc, _, userRepo := newTestService(t)
	ownerID := uuid.New()

	t.Run("unverified user cannot create org", func(t *testing.T) {
		// Create unverified user
		userRepo.createUnverifiedUser(ownerID)

		_, err := svc.Create(context.Background(), ownerID, organisation.CreateOrgRequest{
			Name:         "Test Org",
			Slug:         "testorg",
			CountryCode:  "ID",
			Timezone:     "Asia/Jakarta",
			CurrencyCode: "IDR",
		})

		if err == nil {
			t.Fatal("expected error for unverified user, got nil")
		}

		if !apperr.IsCode(err, apperr.CodeForbidden) {
			t.Errorf("expected FORBIDDEN error, got: %v", err)
		}

		if err.Error() != "please verify your email before creating an organisation" {
			t.Errorf("unexpected error message: %v", err)
		}
	})

	t.Run("verified user can create org", func(t *testing.T) {
		verifiedOwnerID := uuid.New()
		userRepo.createVerifiedUser(verifiedOwnerID)

		resp, err := svc.Create(context.Background(), verifiedOwnerID, organisation.CreateOrgRequest{
			Name:         "Verified Org",
			Slug:         "verifiedorg",
			CountryCode:  "ID",
			Timezone:     "Asia/Jakarta",
			CurrencyCode: "IDR",
		})

		if err != nil {
			t.Fatalf("verified user should be able to create org: %v", err)
		}

		if resp.Organisation.Name != "Verified Org" {
			t.Errorf("org name = %q, want %q", resp.Organisation.Name, "Verified Org")
		}
	})
}

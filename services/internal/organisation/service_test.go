package organisation_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/workived/services/internal/organisation"
	"github.com/workived/services/pkg/apperr"
)

// ── Fakes ────────────────────────────────────────────────────────────────────

type fakeRepo struct {
	orgs        map[uuid.UUID]*organisation.Organisation
	members     map[string]*organisation.Member // key: orgID+userID
	invitations map[string]*organisation.Invitation // key: tokenHash

	// Error injection
	createInvitationErr  error
	acceptInvitationErr  error
	getOrgPlanInfoErr    error
	getDetailErr         error
	updateErr            error
	transferOwnershipErr error
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		orgs:        make(map[uuid.UUID]*organisation.Organisation),
		members:     make(map[string]*organisation.Member),
		invitations: make(map[string]*organisation.Invitation),
	}
}

func memberKey(orgID, userID uuid.UUID) string {
	return orgID.String() + ":" + userID.String()
}

func (f *fakeRepo) Create(_ context.Context, req organisation.CreateOrgRequest, ownerID uuid.UUID) (*organisation.Organisation, error) {
	org := &organisation.Organisation{
		ID:          uuid.New(),
		Name:        req.Name,
		Slug:        req.Slug,
		CountryCode: req.CountryCode,
		Timezone:    req.Timezone,
		CurrencyCode: req.CurrencyCode,
		WorkDays:    []int{1, 2, 3, 4, 5},
		Plan:        "free",
		IsActive:    true,
		CreatedAt:   time.Now().UTC(),
	}
	limit := 25
	org.PlanEmployeeLimit = &limit
	f.orgs[org.ID] = org

	m := &organisation.Member{
		ID:       uuid.New(),
		UserID:   ownerID,
		OrgID:    org.ID,
		Role:     "owner",
		IsActive: true,
		JoinedAt: time.Now().UTC(),
	}
	f.members[memberKey(org.ID, ownerID)] = m
	return org, nil
}

func (f *fakeRepo) GetByID(_ context.Context, orgID uuid.UUID) (*organisation.Organisation, error) {
	org, ok := f.orgs[orgID]
	if !ok {
		return nil, apperr.NotFound("organisation")
	}
	return org, nil
}

func (f *fakeRepo) GetOrgPlanInfo(_ context.Context, orgID uuid.UUID) (string, *int, error) {
	if f.getOrgPlanInfoErr != nil {
		return "", nil, f.getOrgPlanInfoErr
	}
	org, ok := f.orgs[orgID]
	if !ok {
		return "", nil, apperr.NotFound("organisation")
	}
	return org.Plan, org.PlanEmployeeLimit, nil
}

func (f *fakeRepo) GetMemberOrgID(_ context.Context, userID uuid.UUID) (uuid.UUID, string, error) {
	for _, m := range f.members {
		if m.UserID == userID && m.IsActive {
			return m.OrgID, m.Role, nil
		}
	}
	return uuid.Nil, "", errors.New("no membership")
}

func (f *fakeRepo) GetActiveMember(_ context.Context, orgID, userID uuid.UUID) (*organisation.Member, error) {
	m, ok := f.members[memberKey(orgID, userID)]
	if !ok || !m.IsActive {
		return nil, nil
	}
	return m, nil
}

func (f *fakeRepo) GetDetail(_ context.Context, orgID uuid.UUID) (*organisation.OrgDetail, error) {
	if f.getDetailErr != nil {
		return nil, f.getDetailErr
	}
	org, ok := f.orgs[orgID]
	if !ok {
		return nil, apperr.NotFound("organisation")
	}
	d := &organisation.OrgDetail{
		Organisation: *org,
		OwnerName:    "Fake Owner",
	}
	// Count active members as a proxy for employee count in tests.
	for _, m := range f.members {
		if m.OrgID == orgID && m.IsActive {
			d.EmployeeCount++
		}
	}
	return d, nil
}

func (f *fakeRepo) Update(_ context.Context, orgID uuid.UUID, req organisation.UpdateOrgRequest) (*organisation.Organisation, error) {
	if f.updateErr != nil {
		return nil, f.updateErr
	}
	org, ok := f.orgs[orgID]
	if !ok {
		return nil, apperr.NotFound("organisation")
	}
	if req.Name != nil {
		org.Name = *req.Name
	}
	if req.Slug != nil {
		org.Slug = *req.Slug
	}
	if req.CountryCode != nil {
		org.CountryCode = *req.CountryCode
	}
	if req.Timezone != nil {
		org.Timezone = *req.Timezone
	}
	if req.CurrencyCode != nil {
		org.CurrencyCode = *req.CurrencyCode
	}
	return org, nil
}

func (f *fakeRepo) TransferOwnership(_ context.Context, orgID, currentOwnerID, newOwnerID uuid.UUID) error {
	if f.transferOwnershipErr != nil {
		return f.transferOwnershipErr
	}
	currentKey := memberKey(orgID, currentOwnerID)
	cm, ok := f.members[currentKey]
	if !ok || cm.Role != "owner" {
		return apperr.Forbidden()
	}
	newKey := memberKey(orgID, newOwnerID)
	nm, ok := f.members[newKey]
	if !ok || !nm.IsActive {
		return apperr.NotFound("member")
	}
	cm.Role = "admin"
	nm.Role = "owner"
	return nil
}

func (f *fakeRepo) CreateInvitation(_ context.Context, orgID uuid.UUID, email, role string, invitedBy uuid.UUID, tokenHash string, employeeID *uuid.UUID, expiresAt time.Time) (*organisation.Invitation, error) {
	if f.createInvitationErr != nil {
		return nil, f.createInvitationErr
	}
	inv := &organisation.Invitation{
		ID:         uuid.New(),
		OrgID:      orgID,
		Email:      email,
		Role:       role,
		InvitedBy:  invitedBy,
		TokenHash:  tokenHash,
		EmployeeID: employeeID,
		ExpiresAt:  expiresAt,
		CreatedAt:  time.Now().UTC(),
	}
	f.invitations[tokenHash] = inv
	return inv, nil
}

func (f *fakeRepo) GetInvitationByToken(_ context.Context, tokenHash string) (*organisation.Invitation, error) {
	inv, ok := f.invitations[tokenHash]
	if !ok {
		return nil, apperr.NotFound("invitation")
	}
	return inv, nil
}

func (f *fakeRepo) AcceptInvitation(_ context.Context, p organisation.AcceptParams) (*organisation.Member, error) {
	if f.acceptInvitationErr != nil {
		return nil, f.acceptInvitationErr
	}
	// Mark invitation accepted
	for _, inv := range f.invitations {
		if inv.ID == p.InvitationID {
			if inv.AcceptedAt != nil {
				return nil, apperr.Conflict("invitation already accepted")
			}
			now := time.Now().UTC()
			inv.AcceptedAt = &now
			break
		}
	}
	m := &organisation.Member{
		ID:         uuid.New(),
		UserID:     p.UserID,
		OrgID:      p.OrgID,
		EmployeeID: p.EmployeeID,
		Role:       p.Role,
		IsActive:   true,
		JoinedAt:   time.Now().UTC(),
	}
	f.members[memberKey(p.OrgID, p.UserID)] = m
	return m, nil
}

func (f *fakeRepo) RevokeInvitation(_ context.Context, orgID, invitationID uuid.UUID) error {
	for hash, inv := range f.invitations {
		if inv.ID == invitationID && inv.OrgID == orgID && inv.AcceptedAt == nil {
			delete(f.invitations, hash)
			return nil
		}
	}
	return apperr.NotFound("invitation")
}

func (f *fakeRepo) ListPendingInvitations(_ context.Context, orgID uuid.UUID) ([]organisation.Invitation, error) {
	var result []organisation.Invitation
	now := time.Now().UTC()
	for _, inv := range f.invitations {
		if inv.OrgID == orgID && inv.AcceptedAt == nil && inv.ExpiresAt.After(now) {
			result = append(result, *inv)
		}
	}
	return result, nil
}

// ── Fake auth token creator ──────────────────────────────────────────────────

type fakeAuthTokenCreator struct {
	err error
}

func (f *fakeAuthTokenCreator) CreateToken(_ context.Context, _ uuid.UUID, _, _ string, _ time.Time) error {
	return f.err
}

// ── Fake access token issuer ─────────────────────────────────────────────────

type fakeTokenIssuer struct {
	err       error
	failAfter int // fail starting from this call number (0 = always fail, -1 = never fail)
	calls     int
}

func (f *fakeTokenIssuer) IssueAccessToken(_, _ uuid.UUID, _ string) (string, error) {
	f.calls++
	if f.err != nil && (f.failAfter < 0 || f.calls > f.failAfter) {
		return "", f.err
	}
	return "fake-jwt-token", nil
}

// ── Test helpers ─────────────────────────────────────────────────────────────

func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func newTestService(t *testing.T) (*organisation.Service, *fakeRepo) {
	t.Helper()
	repo := newFakeRepo()
	svc := organisation.NewService(repo, &fakeAuthTokenCreator{}, &fakeTokenIssuer{}, "https://app.workived.com")
	return svc, repo
}

func newTestServiceWithIssuer(t *testing.T, issuer *fakeTokenIssuer) (*organisation.Service, *fakeRepo) {
	t.Helper()
	repo := newFakeRepo()
	svc := organisation.NewService(repo, &fakeAuthTokenCreator{}, issuer, "https://app.workived.com")
	return svc, repo
}

func setupOrgAndInvitation(t *testing.T, svc *organisation.Service, repo *fakeRepo) (uuid.UUID, uuid.UUID, *organisation.InviteResponse) {
	t.Helper()
	ctx := context.Background()
	ownerID := uuid.New()

	resp, err := svc.Create(ctx, ownerID, organisation.CreateOrgRequest{
		Name: "Test Org", Slug: "testorg", CountryCode: "ID", Timezone: "Asia/Jakarta", CurrencyCode: "IDR",
	})
	if err != nil {
		t.Fatalf("create org: %v", err)
	}

	inv, err := svc.InviteMember(ctx, resp.Organisation.ID, ownerID, organisation.InviteMemberRequest{
		Email: "invite@example.com",
		Role:  "member",
	})
	if err != nil {
		t.Fatalf("invite member: %v", err)
	}

	return resp.Organisation.ID, ownerID, inv
}

// ── Tests ────────────────────────────────────────────────────────────────────

func TestOrgService_Create(t *testing.T) {
	svc, _ := newTestService(t)

	resp, err := svc.Create(context.Background(), uuid.New(), organisation.CreateOrgRequest{
		Name: "Workived", Slug: "workived", CountryCode: "ID", Timezone: "Asia/Jakarta", CurrencyCode: "IDR",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Organisation.Name != "Workived" {
		t.Errorf("name = %q, want %q", resp.Organisation.Name, "Workived")
	}
	if resp.Organisation.Plan != "free" {
		t.Errorf("plan = %q, want %q", resp.Organisation.Plan, "free")
	}
	if resp.AccessToken == "" {
		t.Error("access token should not be empty")
	}
}

func TestOrgService_InviteMember(t *testing.T) {
	t.Run("success returns invite URL", func(t *testing.T) {
		svc, _ := newTestService(t)
		orgID, ownerID, inv := setupOrgAndInvitation(t, svc, nil)
		_ = orgID
		_ = ownerID

		if inv.Email != "invite@example.com" {
			t.Errorf("email = %q, want %q", inv.Email, "invite@example.com")
		}
		if inv.Role != "member" {
			t.Errorf("role = %q, want %q", inv.Role, "member")
		}
		if inv.InviteURL == "" {
			t.Error("invite URL should not be empty")
		}
	})

	t.Run("pro role rejected on free plan", func(t *testing.T) {
		svc, _ := newTestService(t)
		ctx := context.Background()
		ownerID := uuid.New()

		resp, _ := svc.Create(ctx, ownerID, organisation.CreateOrgRequest{
			Name: "Free Org", Slug: "freeorg", CountryCode: "ID", Timezone: "Asia/Jakarta", CurrencyCode: "IDR",
		})

		_, err := svc.InviteMember(ctx, resp.Organisation.ID, ownerID, organisation.InviteMemberRequest{
			Email: "hr@example.com",
			Role:  "hr_admin",
		})
		if err == nil {
			t.Fatal("expected error for pro role on free plan")
		}
		if !apperr.IsCode(err, apperr.CodeUpgradeRequired) {
			t.Errorf("expected UPGRADE_REQUIRED, got %v", err)
		}
	})

	t.Run("pro role allowed on pro plan", func(t *testing.T) {
		svc, repo := newTestService(t)
		ctx := context.Background()
		ownerID := uuid.New()

		resp, _ := svc.Create(ctx, ownerID, organisation.CreateOrgRequest{
			Name: "Pro Org", Slug: "proorg", CountryCode: "AE", Timezone: "Asia/Dubai", CurrencyCode: "AED",
		})
		// Upgrade to pro
		repo.orgs[resp.Organisation.ID].Plan = "pro"
		repo.orgs[resp.Organisation.ID].PlanEmployeeLimit = nil

		inv, err := svc.InviteMember(ctx, resp.Organisation.ID, ownerID, organisation.InviteMemberRequest{
			Email: "hr@example.com",
			Role:  "hr_admin",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if inv.Role != "hr_admin" {
			t.Errorf("role = %q, want %q", inv.Role, "hr_admin")
		}
	})
}

func TestOrgService_AcceptInvitation(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		svc, repo := newTestService(t)
		orgID, _, inv := setupOrgAndInvitation(t, svc, repo)

		// Extract raw token from URL (after ?token=)
		rawToken := extractTokenFromURL(inv.InviteURL)

		inviteeID := uuid.New()
		resp, err := svc.AcceptInvitation(context.Background(), inviteeID, organisation.AcceptInvitationRequest{
			Token: rawToken,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.AccessToken == "" {
			t.Error("access token should not be empty")
		}
		if resp.Organisation.ID != orgID {
			t.Errorf("org ID = %s, want %s", resp.Organisation.ID, orgID)
		}
		if resp.Member.Role != "member" {
			t.Errorf("role = %q, want %q", resp.Member.Role, "member")
		}
	})

	t.Run("expired invitation rejected", func(t *testing.T) {
		svc, repo := newTestService(t)
		_, _, inv := setupOrgAndInvitation(t, svc, repo)

		rawToken := extractTokenFromURL(inv.InviteURL)
		tokenHash := hashToken(rawToken)

		// Expire the invitation
		repo.invitations[tokenHash].ExpiresAt = time.Now().UTC().Add(-1 * time.Hour)

		_, err := svc.AcceptInvitation(context.Background(), uuid.New(), organisation.AcceptInvitationRequest{
			Token: rawToken,
		})
		if err == nil {
			t.Fatal("expected error for expired invitation")
		}
		if !apperr.IsCode(err, apperr.CodeValidation) {
			t.Errorf("expected VALIDATION_ERROR, got %v", err)
		}
	})

	t.Run("already accepted invitation rejected", func(t *testing.T) {
		svc, repo := newTestService(t)
		_, _, inv := setupOrgAndInvitation(t, svc, repo)

		rawToken := extractTokenFromURL(inv.InviteURL)
		tokenHash := hashToken(rawToken)

		// Mark as already accepted
		now := time.Now().UTC()
		repo.invitations[tokenHash].AcceptedAt = &now

		_, err := svc.AcceptInvitation(context.Background(), uuid.New(), organisation.AcceptInvitationRequest{
			Token: rawToken,
		})
		if err == nil {
			t.Fatal("expected error for already accepted invitation")
		}
		if !apperr.IsCode(err, apperr.CodeConflict) {
			t.Errorf("expected CONFLICT, got %v", err)
		}
	})

	t.Run("already a member rejected", func(t *testing.T) {
		svc, repo := newTestService(t)
		orgID, _, inv := setupOrgAndInvitation(t, svc, repo)

		rawToken := extractTokenFromURL(inv.InviteURL)

		// Add the invitee as an existing member
		existingUserID := uuid.New()
		repo.members[memberKey(orgID, existingUserID)] = &organisation.Member{
			ID: uuid.New(), UserID: existingUserID, OrgID: orgID,
			Role: "member", IsActive: true, JoinedAt: time.Now().UTC(),
		}

		_, err := svc.AcceptInvitation(context.Background(), existingUserID, organisation.AcceptInvitationRequest{
			Token: rawToken,
		})
		if err == nil {
			t.Fatal("expected error for existing member")
		}
		if !apperr.IsCode(err, apperr.CodeConflict) {
			t.Errorf("expected CONFLICT, got %v", err)
		}
	})

	t.Run("invalid token rejected", func(t *testing.T) {
		svc, _ := newTestService(t)

		_, err := svc.AcceptInvitation(context.Background(), uuid.New(), organisation.AcceptInvitationRequest{
			Token: "totally-invalid-token",
		})
		if err == nil {
			t.Fatal("expected error for invalid token")
		}
	})

	t.Run("token issuer error propagates", func(t *testing.T) {
		// failAfter: 1 — Create succeeds (call 1), AcceptInvitation fails (call 2+)
		issuer := &fakeTokenIssuer{err: errors.New("jwt signing failed"), failAfter: 1}
		svc, repo := newTestServiceWithIssuer(t, issuer)
		_, _, inv := setupOrgAndInvitation(t, svc, repo)

		rawToken := extractTokenFromURL(inv.InviteURL)

		_, err := svc.AcceptInvitation(context.Background(), uuid.New(), organisation.AcceptInvitationRequest{
			Token: rawToken,
		})
		if err == nil {
			t.Fatal("expected error when token issuer fails")
		}
	})
}

func TestOrgService_RevokeInvitation(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		svc, repo := newTestService(t)
		orgID, _, inv := setupOrgAndInvitation(t, svc, repo)

		err := svc.RevokeInvitation(context.Background(), orgID, inv.ID)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("not found", func(t *testing.T) {
		svc, _ := newTestService(t)

		err := svc.RevokeInvitation(context.Background(), uuid.New(), uuid.New())
		if err == nil {
			t.Fatal("expected error for non-existent invitation")
		}
	})
}

func TestOrgService_ListPendingInvitations(t *testing.T) {
	svc, repo := newTestService(t)
	orgID, _, _ := setupOrgAndInvitation(t, svc, repo)

	invitations, err := svc.ListPendingInvitations(context.Background(), orgID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(invitations) != 1 {
		t.Errorf("got %d invitations, want 1", len(invitations))
	}
}

func TestOrgService_GetDetail(t *testing.T) {
	tests := []struct {
		name      string
		setup     func(svc *organisation.Service, repo *fakeRepo) uuid.UUID
		wantErr   string
		wantOwner string
	}{
		{
			name: "happy path returns detail",
			setup: func(svc *organisation.Service, repo *fakeRepo) uuid.UUID {
				ownerID := uuid.New()
				resp, err := svc.Create(context.Background(), ownerID, organisation.CreateOrgRequest{
					Name: "Detail Org", Slug: "detailorg", CountryCode: "ID", Timezone: "Asia/Jakarta", CurrencyCode: "IDR",
				})
				if err != nil {
					t.Fatalf("create org: %v", err)
				}
				return resp.Organisation.ID
			},
			wantOwner: "Fake Owner",
		},
		{
			name: "org not found returns NOT_FOUND",
			setup: func(_ *organisation.Service, _ *fakeRepo) uuid.UUID {
				return uuid.New() // non-existent org
			},
			wantErr: apperr.CodeNotFound,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc, repo := newTestService(t)
			orgID := tt.setup(svc, repo)

			detail, err := svc.GetDetail(context.Background(), orgID)
			if tt.wantErr != "" {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if !apperr.IsCode(err, tt.wantErr) {
					t.Errorf("error code = %v, want %s", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if detail.OwnerName != tt.wantOwner {
				t.Errorf("owner name = %q, want %q", detail.OwnerName, tt.wantOwner)
			}
		})
	}
}

func TestOrgService_Update(t *testing.T) {
	newStr := func(s string) *string { return &s }

	tests := []struct {
		name          string
		req           organisation.UpdateOrgRequest
		employeeCount int
		repoErr       error
		wantErr       string
		wantName      string
	}{
		{
			name:     "happy path updates name",
			req:      organisation.UpdateOrgRequest{Name: newStr("New Name")},
			wantName: "New Name",
		},
		{
			name:          "country locked when employees exist",
			req:           organisation.UpdateOrgRequest{CountryCode: newStr("AE")},
			employeeCount: 1,
			wantErr:       apperr.CodeValidation,
		},
		{
			name:          "timezone locked when employees exist",
			req:           organisation.UpdateOrgRequest{Timezone: newStr("Asia/Dubai")},
			employeeCount: 3,
			wantErr:       apperr.CodeValidation,
		},
		{
			name:          "currency locked when employees exist",
			req:           organisation.UpdateOrgRequest{CurrencyCode: newStr("AED")},
			employeeCount: 2,
			wantErr:       apperr.CodeValidation,
		},
		{
			name:    "slug conflict from repo returns CONFLICT",
			req:     organisation.UpdateOrgRequest{Slug: newStr("taken")},
			repoErr: apperr.Conflict("an organisation with this slug already exists"),
			wantErr: apperr.CodeConflict,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc, repo := newTestService(t)
			ctx := context.Background()

			ownerID := uuid.New()
			resp, err := svc.Create(ctx, ownerID, organisation.CreateOrgRequest{
				Name: "Update Org", Slug: "updateorg", CountryCode: "ID", Timezone: "Asia/Jakarta", CurrencyCode: "IDR",
			})
			if err != nil {
				t.Fatalf("create org: %v", err)
			}
			if tt.repoErr != nil {
				repo.updateErr = tt.repoErr
			}

			result, err := svc.Update(ctx, resp.Organisation.ID, tt.req, tt.employeeCount)
			if tt.wantErr != "" {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if !apperr.IsCode(err, tt.wantErr) {
					t.Errorf("error code = %v, want %s", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.wantName != "" && result.Name != tt.wantName {
				t.Errorf("name = %q, want %q", result.Name, tt.wantName)
			}
		})
	}
}

func TestOrgService_TransferOwnership(t *testing.T) {
	tests := []struct {
		name    string
		setup   func(svc *organisation.Service, repo *fakeRepo) (orgID, ownerID uuid.UUID, newOwnerID uuid.UUID)
		wantErr string
	}{
		{
			name: "happy path transfers ownership",
			setup: func(svc *organisation.Service, repo *fakeRepo) (uuid.UUID, uuid.UUID, uuid.UUID) {
				ctx := context.Background()
				ownerID := uuid.New()
				resp, err := svc.Create(ctx, ownerID, organisation.CreateOrgRequest{
					Name: "Transfer Org", Slug: "transferorg", CountryCode: "ID", Timezone: "Asia/Jakarta", CurrencyCode: "IDR",
				})
				if err != nil {
					t.Fatalf("create org: %v", err)
				}
				newOwnerID := uuid.New()
				repo.members[memberKey(resp.Organisation.ID, newOwnerID)] = &organisation.Member{
					ID: uuid.New(), UserID: newOwnerID, OrgID: resp.Organisation.ID,
					Role: "admin", IsActive: true, JoinedAt: time.Now().UTC(),
				}
				return resp.Organisation.ID, ownerID, newOwnerID
			},
		},
		{
			name: "self-transfer returns VALIDATION_ERROR",
			setup: func(svc *organisation.Service, repo *fakeRepo) (uuid.UUID, uuid.UUID, uuid.UUID) {
				ctx := context.Background()
				ownerID := uuid.New()
				resp, err := svc.Create(ctx, ownerID, organisation.CreateOrgRequest{
					Name: "Self Transfer Org", Slug: "selftransferorg", CountryCode: "ID", Timezone: "Asia/Jakarta", CurrencyCode: "IDR",
				})
				if err != nil {
					t.Fatalf("create org: %v", err)
				}
				return resp.Organisation.ID, ownerID, ownerID // same user
			},
			wantErr: apperr.CodeValidation,
		},
		{
			name: "new owner not a member returns NOT_FOUND",
			setup: func(svc *organisation.Service, repo *fakeRepo) (uuid.UUID, uuid.UUID, uuid.UUID) {
				ctx := context.Background()
				ownerID := uuid.New()
				resp, err := svc.Create(ctx, ownerID, organisation.CreateOrgRequest{
					Name: "NotMember Org", Slug: "notmemberorg", CountryCode: "ID", Timezone: "Asia/Jakarta", CurrencyCode: "IDR",
				})
				if err != nil {
					t.Fatalf("create org: %v", err)
				}
				return resp.Organisation.ID, ownerID, uuid.New() // random user not in org
			},
			wantErr: apperr.CodeNotFound,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc, repo := newTestService(t)
			orgID, ownerID, newOwnerID := tt.setup(svc, repo)

			req := organisation.TransferOwnershipRequest{NewOwnerUserID: newOwnerID}
			err := svc.TransferOwnership(context.Background(), orgID, ownerID, req)
			if tt.wantErr != "" {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if !apperr.IsCode(err, tt.wantErr) {
					t.Errorf("error code = %v, want %s", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func extractTokenFromURL(url string) string {
	// URL format: https://app.workived.com/invite?token=<raw>
	const prefix = "?token="
	for i := 0; i < len(url); i++ {
		if i+len(prefix) <= len(url) && url[i:i+len(prefix)] == prefix {
			return url[i+len(prefix):]
		}
	}
	return ""
}

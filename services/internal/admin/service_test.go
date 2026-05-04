package admin

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/workived/services/pkg/cache"
)

// ── fakeLicenseRepo ──────────────────────────────────────────────────────────

type fakeLicenseRepo struct {
	license              *ProLicense
	createErr            error
	updateErr            error
	updateOrgPlanCalls   []orgPlanCall
	updateOrgPlanErr     error
	activeCount          int
	activeCountErr       error
}

type orgPlanCall struct {
	orgID         uuid.UUID
	plan          string
	employeeLimit *int
}

func (f *fakeLicenseRepo) CreateProLicense(_ context.Context, _ CreateProLicenseRequest, _, _ uuid.UUID) (*ProLicense, error) {
	return f.license, f.createErr
}

func (f *fakeLicenseRepo) UpdateProLicense(_ context.Context, _ uuid.UUID, _ UpdateProLicenseRequest) (*ProLicense, error) {
	return f.license, f.updateErr
}

func (f *fakeLicenseRepo) UpdateOrgPlan(_ context.Context, orgID uuid.UUID, plan string, limit *int) error {
	f.updateOrgPlanCalls = append(f.updateOrgPlanCalls, orgPlanCall{orgID, plan, limit})
	return f.updateOrgPlanErr
}

func (f *fakeLicenseRepo) CountActiveProLicenses(_ context.Context, _ uuid.UUID) (int, error) {
	return f.activeCount, f.activeCountErr
}

func newSvcWithFakeLicRepo(fake *fakeLicenseRepo) *Service {
	return &Service{licRepo: fake, log: zerolog.Nop()}
}

// ── Tests ────────────────────────────────────────────────────────────────────

func TestCreateProLicense_SetsOrgPlanToPro(t *testing.T) {
	orgID := uuid.New()
	fake := &fakeLicenseRepo{
		license: &ProLicense{ID: uuid.New(), OrganisationID: orgID, Status: "active", StartsAt: time.Now(), ExpiresAt: time.Now().Add(30 * 24 * time.Hour)},
	}
	svc := newSvcWithFakeLicRepo(fake)

	_, err := svc.CreateProLicense(context.Background(), CreateProLicenseRequest{OrganisationID: orgID}, uuid.New())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(fake.updateOrgPlanCalls) != 1 {
		t.Fatalf("expected 1 UpdateOrgPlan call, got %d", len(fake.updateOrgPlanCalls))
	}
	call := fake.updateOrgPlanCalls[0]
	if call.plan != "pro" {
		t.Errorf("expected plan=pro, got %q", call.plan)
	}
	if call.employeeLimit != nil {
		t.Errorf("expected nil limit for pro, got %v", *call.employeeLimit)
	}
}

func TestUpdateProLicense_CancelledNoRemaining_RevertsToFree(t *testing.T) {
	orgID := uuid.New()
	fake := &fakeLicenseRepo{
		license:     &ProLicense{ID: uuid.New(), OrganisationID: orgID, Status: "cancelled", StartsAt: time.Now(), ExpiresAt: time.Now().Add(30 * 24 * time.Hour)},
		activeCount: 0,
	}
	svc := newSvcWithFakeLicRepo(fake)
	status := "cancelled"

	_, err := svc.UpdateProLicense(context.Background(), uuid.New(), UpdateProLicenseRequest{Status: &status})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(fake.updateOrgPlanCalls) != 1 {
		t.Fatalf("expected 1 UpdateOrgPlan call, got %d", len(fake.updateOrgPlanCalls))
	}
	call := fake.updateOrgPlanCalls[0]
	if call.plan != "free" {
		t.Errorf("expected plan=free, got %q", call.plan)
	}
	if call.employeeLimit == nil || *call.employeeLimit != 15 {
		t.Errorf("expected limit=15, got %v", call.employeeLimit)
	}
}

func TestUpdateProLicense_CancelledOtherActive_KeepsPro(t *testing.T) {
	orgID := uuid.New()
	fake := &fakeLicenseRepo{
		license:     &ProLicense{ID: uuid.New(), OrganisationID: orgID, Status: "cancelled", StartsAt: time.Now(), ExpiresAt: time.Now().Add(30 * 24 * time.Hour)},
		activeCount: 1, // another active license exists
	}
	svc := newSvcWithFakeLicRepo(fake)
	status := "cancelled"

	_, err := svc.UpdateProLicense(context.Background(), uuid.New(), UpdateProLicenseRequest{Status: &status})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(fake.updateOrgPlanCalls) != 0 {
		t.Errorf("expected no UpdateOrgPlan call when another active license exists, got %d", len(fake.updateOrgPlanCalls))
	}
}

func TestUpdateProLicense_StatusNotChanged_NoOrgPlanUpdate(t *testing.T) {
	orgID := uuid.New()
	expiresAt := time.Now().Add(60 * 24 * time.Hour)
	fake := &fakeLicenseRepo{
		license: &ProLicense{ID: uuid.New(), OrganisationID: orgID, Status: "active", StartsAt: time.Now(), ExpiresAt: time.Now().Add(30 * 24 * time.Hour)},
	}
	svc := newSvcWithFakeLicRepo(fake)

	_, err := svc.UpdateProLicense(context.Background(), uuid.New(), UpdateProLicenseRequest{ExpiresAt: &expiresAt})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(fake.updateOrgPlanCalls) != 0 {
		t.Errorf("expected no UpdateOrgPlan call when status not changed, got %d", len(fake.updateOrgPlanCalls))
	}
}

func TestCreateProLicense_RepoError_Propagates(t *testing.T) {
	fake := &fakeLicenseRepo{createErr: errors.New("db down")}
	svc := newSvcWithFakeLicRepo(fake)

	_, err := svc.CreateProLicense(context.Background(), CreateProLicenseRequest{}, uuid.New())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

func testCacheStore(t *testing.T) *cache.Store {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return cache.New(rdb, zerolog.Nop())
}

func TestEvaluateFlag(t *testing.T) {
	orgID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	userID := uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
	otherOrg := uuid.MustParse("cccccccc-cccc-cccc-cccc-cccccccccccc")
	otherUser := uuid.MustParse("dddddddd-dddd-dddd-dddd-dddddddddddd")

	tests := []struct {
		name   string
		flag   FeatureFlag
		orgID  *uuid.UUID
		userID *uuid.UUID
		want   bool
	}{
		{
			name:   "disabled flag returns false",
			flag:   FeatureFlag{IsEnabled: false, Scope: "global"},
			orgID:  &orgID,
			userID: &userID,
			want:   false,
		},
		{
			name:   "global enabled returns true",
			flag:   FeatureFlag{IsEnabled: true, Scope: "global"},
			orgID:  &orgID,
			userID: &userID,
			want:   true,
		},
		{
			name: "org scope with matching org",
			flag: FeatureFlag{
				IsEnabled: true,
				Scope:     "org",
				TargetIDs: map[string]interface{}{
					"org_ids": []interface{}{orgID.String()},
				},
			},
			orgID:  &orgID,
			userID: &userID,
			want:   true,
		},
		{
			name: "org scope with non-matching org",
			flag: FeatureFlag{
				IsEnabled: true,
				Scope:     "org",
				TargetIDs: map[string]interface{}{
					"org_ids": []interface{}{otherOrg.String()},
				},
			},
			orgID:  &orgID,
			userID: &userID,
			want:   false,
		},
		{
			name: "user scope with matching user",
			flag: FeatureFlag{
				IsEnabled: true,
				Scope:     "user",
				TargetIDs: map[string]interface{}{
					"user_ids": []interface{}{userID.String()},
				},
			},
			orgID:  &orgID,
			userID: &userID,
			want:   true,
		},
		{
			name: "user scope with non-matching user",
			flag: FeatureFlag{
				IsEnabled: true,
				Scope:     "user",
				TargetIDs: map[string]interface{}{
					"user_ids": []interface{}{otherUser.String()},
				},
			},
			orgID:  &orgID,
			userID: &userID,
			want:   false,
		},
		{
			name:   "org scope with nil orgID",
			flag:   FeatureFlag{IsEnabled: true, Scope: "org"},
			orgID:  nil,
			userID: &userID,
			want:   false,
		},
		{
			name:   "user scope with nil userID",
			flag:   FeatureFlag{IsEnabled: true, Scope: "user"},
			orgID:  &orgID,
			userID: nil,
			want:   false,
		},
		{
			name: "org scope with nil target_ids",
			flag: FeatureFlag{
				IsEnabled: true,
				Scope:     "org",
				TargetIDs: nil,
			},
			orgID:  &orgID,
			userID: &userID,
			want:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := evaluateFlag(&tt.flag, tt.orgID, tt.userID)
			if got != tt.want {
				t.Errorf("evaluateFlag() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestListFeatureFlagsCached(t *testing.T) {
	store := testCacheStore(t)
	ctx := context.Background()

	flags := []FeatureFlag{
		{FeatureKey: "attendance", IsEnabled: true, Scope: "global"},
		{FeatureKey: "claims", IsEnabled: false, Scope: "org"},
	}

	cache.Set(ctx, store, featureFlagsCacheKey, flags, featureFlagsCacheTTL)

	got, ok := cache.Get[[]FeatureFlag](ctx, store, featureFlagsCacheKey)
	if !ok {
		t.Fatal("expected cache hit")
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 flags, got %d", len(got))
	}
	if got[0].FeatureKey != "attendance" {
		t.Errorf("expected 'attendance', got %q", got[0].FeatureKey)
	}

	store.Delete(ctx, featureFlagsCacheKey)
	_, ok = cache.Get[[]FeatureFlag](ctx, store, featureFlagsCacheKey)
	if ok {
		t.Fatal("expected cache miss after invalidation")
	}
}

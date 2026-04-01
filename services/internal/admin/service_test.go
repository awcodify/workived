package admin

import (
	"context"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/workived/services/pkg/cache"
)

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

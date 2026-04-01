package organisation_test

import (
	"context"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/workived/services/pkg/cache"
)

func testCache(t *testing.T) *cache.Store {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return cache.New(rdb, zerolog.Nop())
}

func TestCachedOrgInfo_Timezone(t *testing.T) {
	store := testCache(t)
	ctx := context.Background()
	orgID := uuid.New()

	key := cache.OrgKey(orgID, "org", "tz")
	cache.Set(ctx, store, key, "Asia/Jakarta", 10*60*1_000_000_000)

	got, ok := cache.Get[string](ctx, store, key)
	if !ok {
		t.Fatal("expected cache hit for timezone")
	}
	if got != "Asia/Jakarta" {
		t.Errorf("expected Asia/Jakarta, got %q", got)
	}
}

func TestCachedOrgInfo_CountryCode(t *testing.T) {
	store := testCache(t)
	ctx := context.Background()
	orgID := uuid.New()

	key := cache.OrgKey(orgID, "org", "cc")
	cache.Set(ctx, store, key, "ID", 10*60*1_000_000_000)

	got, ok := cache.Get[string](ctx, store, key)
	if !ok {
		t.Fatal("expected cache hit for country code")
	}
	if got != "ID" {
		t.Errorf("expected ID, got %q", got)
	}
}

func TestCachedOrgInfo_WorkDays(t *testing.T) {
	store := testCache(t)
	ctx := context.Background()
	orgID := uuid.New()

	key := cache.OrgKey(orgID, "org", "workdays")
	days := []int{1, 2, 3, 4, 5}
	cache.Set(ctx, store, key, days, 10*60*1_000_000_000)

	got, ok := cache.Get[[]int](ctx, store, key)
	if !ok {
		t.Fatal("expected cache hit for work days")
	}
	if len(got) != 5 || got[0] != 1 || got[4] != 5 {
		t.Errorf("expected [1,2,3,4,5], got %v", got)
	}
}

func TestCachedOrgInfo_InvalidationClearsAll(t *testing.T) {
	store := testCache(t)
	ctx := context.Background()
	orgID := uuid.New()

	cache.Set(ctx, store, cache.OrgKey(orgID, "org", "tz"), "Asia/Jakarta", 10*60*1_000_000_000)
	cache.Set(ctx, store, cache.OrgKey(orgID, "org", "cc"), "ID", 10*60*1_000_000_000)
	cache.Set(ctx, store, cache.OrgKey(orgID, "org", "workdays"), []int{1, 2, 3, 4, 5}, 10*60*1_000_000_000)

	store.DeletePattern(ctx, cache.OrgPatternKey(orgID, "org"))

	for _, suffix := range []string{"tz", "cc", "workdays"} {
		_, ok := cache.Get[string](ctx, store, cache.OrgKey(orgID, "org", suffix))
		if ok {
			t.Errorf("expected cache miss for %s after invalidation", suffix)
		}
	}
}

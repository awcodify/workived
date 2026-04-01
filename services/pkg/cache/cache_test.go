package cache_test

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/workived/services/pkg/cache"
)

func setup(t *testing.T) (*cache.Store, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	store := cache.New(rdb, zerolog.Nop())
	return store, mr
}

func TestGetSet(t *testing.T) {
	store, _ := setup(t)
	ctx := context.Background()

	type payload struct {
		Name string `json:"name"`
		Age  int    `json:"age"`
	}

	t.Run("miss returns false", func(t *testing.T) {
		_, ok := cache.Get[payload](ctx, store, "nonexistent")
		if ok {
			t.Fatal("expected miss, got hit")
		}
	})

	t.Run("hit after set", func(t *testing.T) {
		cache.Set(ctx, store, "key1", payload{Name: "Alice", Age: 30}, time.Minute)
		val, ok := cache.Get[payload](ctx, store, "key1")
		if !ok {
			t.Fatal("expected hit, got miss")
		}
		if val.Name != "Alice" || val.Age != 30 {
			t.Errorf("got %+v, want Alice/30", val)
		}
	})
}

func TestGetSetSlice(t *testing.T) {
	store, _ := setup(t)
	ctx := context.Background()

	items := []string{"a", "b", "c"}
	cache.Set(ctx, store, "list", items, time.Minute)

	got, ok := cache.Get[[]string](ctx, store, "list")
	if !ok {
		t.Fatal("expected hit")
	}
	if len(got) != 3 || got[0] != "a" || got[2] != "c" {
		t.Errorf("got %v, want [a b c]", got)
	}
}

func TestDelete(t *testing.T) {
	store, _ := setup(t)
	ctx := context.Background()

	cache.Set(ctx, store, "k1", "v1", time.Minute)
	cache.Set(ctx, store, "k2", "v2", time.Minute)

	store.Delete(ctx, "k1")

	_, ok := cache.Get[string](ctx, store, "k1")
	if ok {
		t.Fatal("k1 should be deleted")
	}
	_, ok = cache.Get[string](ctx, store, "k2")
	if !ok {
		t.Fatal("k2 should still exist")
	}
}

func TestDeletePattern(t *testing.T) {
	store, _ := setup(t)
	ctx := context.Background()

	orgID := uuid.New()
	cache.Set(ctx, store, cache.OrgKey(orgID, "dept", "list"), "depts", time.Minute)
	cache.Set(ctx, store, cache.OrgKey(orgID, "dept", "item:1"), "dept1", time.Minute)
	cache.Set(ctx, store, cache.OrgKey(orgID, "emp", "list"), "emps", time.Minute)

	// Delete only dept keys
	store.DeletePattern(ctx, cache.OrgPatternKey(orgID, "dept"))

	_, ok := cache.Get[string](ctx, store, cache.OrgKey(orgID, "dept", "list"))
	if ok {
		t.Fatal("dept:list should be deleted")
	}
	_, ok = cache.Get[string](ctx, store, cache.OrgKey(orgID, "dept", "item:1"))
	if ok {
		t.Fatal("dept:item:1 should be deleted")
	}
	_, ok = cache.Get[string](ctx, store, cache.OrgKey(orgID, "emp", "list"))
	if !ok {
		t.Fatal("emp:list should still exist")
	}
}

func TestKeyHelpers(t *testing.T) {
	orgID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	itemID := uuid.MustParse("22222222-2222-2222-2222-222222222222")

	tests := []struct {
		name string
		got  string
		want string
	}{
		{"OrgKey", cache.OrgKey(orgID, "dept", "list"), "org:11111111-1111-1111-1111-111111111111:dept:list"},
		{"OrgListKey", cache.OrgListKey(orgID, "emp"), "org:11111111-1111-1111-1111-111111111111:emp:list"},
		{"OrgItemKey", cache.OrgItemKey(orgID, itemID, "emp"), "org:11111111-1111-1111-1111-111111111111:emp:22222222-2222-2222-2222-222222222222"},
		{"OrgPatternKey", cache.OrgPatternKey(orgID, "leave"), "org:11111111-1111-1111-1111-111111111111:leave:*"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.got != tt.want {
				t.Errorf("got %q, want %q", tt.got, tt.want)
			}
		})
	}
}

func TestDeleteEmpty(t *testing.T) {
	store, _ := setup(t)
	ctx := context.Background()
	// Should not panic
	store.Delete(ctx)
}

package middleware_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
	"github.com/workived/services/internal/platform/middleware"
	"github.com/workived/services/pkg/cache"
)

func init() {
	gin.SetMode(gin.TestMode)
}

type mockOrgRepo struct {
	member          *middleware.OrgMember
	err             error
	callCount       atomic.Int32
	memberOrgID     uuid.UUID
	memberOrgRole   string
	memberOrgHasSub bool
	memberOrgErr    error
}

func (m *mockOrgRepo) GetMember(_ context.Context, _, _ uuid.UUID) (*middleware.OrgMember, error) {
	m.callCount.Add(1)
	return m.member, m.err
}

func (m *mockOrgRepo) GetMemberOrgID(_ context.Context, _ uuid.UUID) (uuid.UUID, string, bool, error) {
	return m.memberOrgID, m.memberOrgRole, m.memberOrgHasSub, m.memberOrgErr
}

func setupTenantCache(t *testing.T) *cache.Store {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return cache.New(rdb, zerolog.Nop())
}

func newTenantRouter(orgRepo middleware.OrgRepository, cacheStore *cache.Store, orgID, userID uuid.UUID) *gin.Engine {
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_id", userID)
		c.Set("org_id", orgID)
		c.Next()
	})
	r.Use(middleware.TenantWithCache(orgRepo, cacheStore))
	r.GET("/test", func(c *gin.Context) {
		m := middleware.OrgMemberFromCtx(c)
		if m == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "no member"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"role": m.Role})
	})
	return r
}

func doRequest(router *gin.Engine) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	router.ServeHTTP(w, req)
	return w
}

func TestTenantWithCache_HitsDBOnFirstCall(t *testing.T) {
	orgID := uuid.New()
	userID := uuid.New()
	empID := uuid.New()
	store := setupTenantCache(t)

	repo := &mockOrgRepo{
		member: &middleware.OrgMember{
			OrgID:       orgID,
			UserID:      userID,
			Role:        "owner",
			EmployeeID:  &empID,
			IsActive:    true,
			OrgPlan:     "free",
			OrgTimezone: "Asia/Jakarta",
		},
	}

	router := newTenantRouter(repo, store, orgID, userID)
	w := doRequest(router)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if repo.callCount.Load() != 1 {
		t.Fatalf("expected 1 DB call, got %d", repo.callCount.Load())
	}
}

func TestTenantWithCache_UsesCacheOnSecondCall(t *testing.T) {
	orgID := uuid.New()
	userID := uuid.New()
	store := setupTenantCache(t)

	repo := &mockOrgRepo{
		member: &middleware.OrgMember{
			OrgID:       orgID,
			UserID:      userID,
			Role:        "admin",
			IsActive:    true,
			OrgPlan:     "pro",
			OrgTimezone: "Asia/Dubai",
		},
	}

	router := newTenantRouter(repo, store, orgID, userID)

	w := doRequest(router)
	if w.Code != http.StatusOK {
		t.Fatalf("first request: expected 200, got %d", w.Code)
	}

	w = doRequest(router)
	if w.Code != http.StatusOK {
		t.Fatalf("second request: expected 200, got %d", w.Code)
	}

	if repo.callCount.Load() != 1 {
		t.Fatalf("expected 1 DB call (cache hit on 2nd), got %d", repo.callCount.Load())
	}
}

func TestTenantWithCache_NilCacheFallsThrough(t *testing.T) {
	orgID := uuid.New()
	userID := uuid.New()

	repo := &mockOrgRepo{
		member: &middleware.OrgMember{
			OrgID:       orgID,
			UserID:      userID,
			Role:        "member",
			IsActive:    true,
			OrgPlan:     "free",
			OrgTimezone: "UTC",
		},
	}

	router := newTenantRouter(repo, nil, orgID, userID)

	doRequest(router)
	doRequest(router)

	if repo.callCount.Load() != 2 {
		t.Fatalf("expected 2 DB calls (no cache), got %d", repo.callCount.Load())
	}
}

func TestTenantWithCache_InactiveMemberRejected(t *testing.T) {
	orgID := uuid.New()
	userID := uuid.New()
	store := setupTenantCache(t)

	repo := &mockOrgRepo{
		member: &middleware.OrgMember{
			OrgID:    orgID,
			UserID:   userID,
			Role:     "member",
			IsActive: false,
			OrgPlan:  "free",
		},
	}

	router := newTenantRouter(repo, store, orgID, userID)
	w := doRequest(router)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for inactive member, got %d", w.Code)
	}
}

func TestTenantWithCache_NilOrgIDLookupsFromDB(t *testing.T) {
	store := setupTenantCache(t)
	userID := uuid.New()
	orgID := uuid.New()

	repo := &mockOrgRepo{
		memberOrgID:   orgID,
		memberOrgRole: "owner",
		member: &middleware.OrgMember{
			OrgID:    orgID,
			UserID:   userID,
			Role:     "owner",
			IsActive: true,
		},
	}

	// JWT has nil orgID, but middleware should look it up from database
	router := newTenantRouter(repo, store, uuid.Nil, userID)
	w := doRequest(router)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if repo.callCount.Load() != 1 {
		t.Fatalf("expected 1 DB call to GetMember, got %d", repo.callCount.Load())
	}
}

func TestTenantWithCache_NilOrgIDNoMembershipRejected(t *testing.T) {
	store := setupTenantCache(t)
	repo := &mockOrgRepo{
		memberOrgID:  uuid.Nil, // User has no org
		memberOrgErr: nil,
		member:       &middleware.OrgMember{IsActive: true},
	}

	router := newTenantRouter(repo, store, uuid.Nil, uuid.New())
	w := doRequest(router)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for user with no org, got %d", w.Code)
	}
}

func TestInvalidateTenantCache(t *testing.T) {
	orgID := uuid.New()
	userID := uuid.New()
	store := setupTenantCache(t)

	repo := &mockOrgRepo{
		member: &middleware.OrgMember{
			OrgID:       orgID,
			UserID:      userID,
			Role:        "owner",
			IsActive:    true,
			OrgPlan:     "free",
			OrgTimezone: "UTC",
		},
	}

	router := newTenantRouter(repo, store, orgID, userID)

	doRequest(router)
	if repo.callCount.Load() != 1 {
		t.Fatal("expected 1 call after first request")
	}

	middleware.InvalidateTenantCache(store, context.Background(), orgID, userID)

	doRequest(router)
	if repo.callCount.Load() != 2 {
		t.Fatalf("expected 2 calls after invalidate, got %d", repo.callCount.Load())
	}
}

func TestInvalidateTenantCacheForOrg(t *testing.T) {
	orgID := uuid.New()
	user1 := uuid.New()
	user2 := uuid.New()
	store := setupTenantCache(t)

	repo1 := &mockOrgRepo{
		member: &middleware.OrgMember{
			OrgID: orgID, UserID: user1, Role: "owner", IsActive: true, OrgPlan: "free", OrgTimezone: "UTC",
		},
	}
	repo2 := &mockOrgRepo{
		member: &middleware.OrgMember{
			OrgID: orgID, UserID: user2, Role: "member", IsActive: true, OrgPlan: "free", OrgTimezone: "UTC",
		},
	}

	r1 := newTenantRouter(repo1, store, orgID, user1)
	r2 := newTenantRouter(repo2, store, orgID, user2)

	doRequest(r1)
	doRequest(r2)

	middleware.InvalidateTenantCacheForOrg(store, context.Background(), orgID)

	doRequest(r1)
	doRequest(r2)

	if repo1.callCount.Load() != 2 {
		t.Fatalf("user1: expected 2 calls after org invalidation, got %d", repo1.callCount.Load())
	}
	if repo2.callCount.Load() != 2 {
		t.Fatalf("user2: expected 2 calls after org invalidation, got %d", repo2.callCount.Load())
	}
}

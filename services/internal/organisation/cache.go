package organisation

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/workived/services/pkg/cache"
)

const (
	cacheModule = "org"
	cacheTTL    = 10 * time.Minute
)

// WithCache sets the cache store for the service.
func WithCache(c *cache.Store) ServiceOption {
	return func(s *Service) {
		s.cache = c
	}
}

// ── Cached reads ─────────────────────────────────────────────────────────────

func (s *Service) getCached(ctx context.Context, orgID uuid.UUID) (*Organisation, error) {
	if s.cache != nil {
		key := cache.OrgKey(orgID, cacheModule, "info")
		if v, ok := cache.Get[Organisation](ctx, s.cache, key); ok {
			return &v, nil
		}
	}

	org, err := s.repo.GetByID(ctx, orgID)
	if err != nil {
		return nil, err
	}

	if s.cache != nil {
		cache.Set(ctx, s.cache, cache.OrgKey(orgID, cacheModule, "info"), *org, cacheTTL)
	}
	return org, nil
}

func (s *Service) getDetailCached(ctx context.Context, orgID uuid.UUID) (*OrgDetail, error) {
	if s.cache != nil {
		key := cache.OrgKey(orgID, cacheModule, "detail")
		if v, ok := cache.Get[OrgDetail](ctx, s.cache, key); ok {
			return &v, nil
		}
	}

	detail, err := s.repo.GetDetail(ctx, orgID)
	if err != nil {
		return nil, err
	}

	if s.cache != nil {
		cache.Set(ctx, s.cache, cache.OrgKey(orgID, cacheModule, "detail"), *detail, cacheTTL)
	}
	return detail, nil
}

// ── Invalidation ────────────────────────────────────────────────────────────

func (s *Service) invalidateCache(ctx context.Context, orgID uuid.UUID) {
	if s.cache != nil {
		s.cache.DeletePattern(ctx, cache.OrgPatternKey(orgID, cacheModule))
	}
}

// ── Cached OrgInfo provider (for attendance, leave, claims) ─────────────────

// CachedOrgInfo wraps the repository and caches timezone/country lookups.
// It satisfies the attendance.OrgInfoProvider and similar interfaces.
type CachedOrgInfo struct {
	repo  *Repository
	cache *cache.Store
}

// NewCachedOrgInfo creates a new CachedOrgInfo. If cacheStore is nil, falls through to DB.
func NewCachedOrgInfo(repo *Repository, cacheStore *cache.Store) *CachedOrgInfo {
	return &CachedOrgInfo{repo: repo, cache: cacheStore}
}

func (c *CachedOrgInfo) GetOrgTimezone(ctx context.Context, orgID uuid.UUID) (string, error) {
	if c.cache != nil {
		key := cache.OrgKey(orgID, cacheModule, "tz")
		if v, ok := cache.Get[string](ctx, c.cache, key); ok {
			return v, nil
		}
	}

	tz, err := c.repo.GetOrgTimezone(ctx, orgID)
	if err != nil {
		return "", err
	}

	if c.cache != nil {
		cache.Set(ctx, c.cache, cache.OrgKey(orgID, cacheModule, "tz"), tz, cacheTTL)
	}
	return tz, nil
}

func (c *CachedOrgInfo) GetOrgCountryCode(ctx context.Context, orgID uuid.UUID) (string, error) {
	if c.cache != nil {
		key := cache.OrgKey(orgID, cacheModule, "cc")
		if v, ok := cache.Get[string](ctx, c.cache, key); ok {
			return v, nil
		}
	}

	cc, err := c.repo.GetOrgCountryCode(ctx, orgID)
	if err != nil {
		return "", err
	}

	if c.cache != nil {
		cache.Set(ctx, c.cache, cache.OrgKey(orgID, cacheModule, "cc"), cc, cacheTTL)
	}
	return cc, nil
}

func (c *CachedOrgInfo) GetOrgWorkDays(ctx context.Context, orgID uuid.UUID) ([]int, error) {
	if c.cache != nil {
		key := cache.OrgKey(orgID, cacheModule, "workdays")
		if v, ok := cache.Get[[]int](ctx, c.cache, key); ok {
			return v, nil
		}
	}

	days, err := c.repo.GetOrgWorkDays(ctx, orgID)
	if err != nil {
		return nil, err
	}

	if c.cache != nil {
		cache.Set(ctx, c.cache, cache.OrgKey(orgID, cacheModule, "workdays"), days, cacheTTL)
	}
	return days, nil
}

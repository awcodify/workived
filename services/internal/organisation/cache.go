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

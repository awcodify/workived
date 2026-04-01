package department

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/workived/services/pkg/cache"
)

const (
	cacheModule = "dept"
	cacheTTL    = 10 * time.Minute
)

// WithCache sets the cache store for the service.
func WithCache(c *cache.Store) ServiceOption {
	return func(s *Service) {
		s.cache = c
	}
}

// ── Cached overrides ─────────────────────────────────────────────────────────

func (s *Service) listCached(ctx context.Context, orgID uuid.UUID) ([]Department, error) {
	if s.cache != nil {
		key := cache.OrgListKey(orgID, cacheModule)
		if v, ok := cache.Get[[]Department](ctx, s.cache, key); ok {
			return v, nil
		}
	}

	depts, err := s.repo.List(ctx, orgID)
	if err != nil {
		return nil, err
	}

	if s.cache != nil {
		cache.Set(ctx, s.cache, cache.OrgListKey(orgID, cacheModule), depts, cacheTTL)
	}
	return depts, nil
}

func (s *Service) invalidateCache(ctx context.Context, orgID uuid.UUID) {
	if s.cache != nil {
		s.cache.DeletePattern(ctx, cache.OrgPatternKey(orgID, cacheModule))
	}
}

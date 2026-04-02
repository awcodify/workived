package employee

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/workived/services/pkg/cache"
)

const (
	cacheModule = "emp"
	cacheTTL    = 5 * time.Minute
)

// WithCache sets the cache store for the service.
func WithCache(c *cache.Store) ServiceOption {
	return func(s *Service) {
		s.cache = c
	}
}

// ── Cached reads ─────────────────────────────────────────────────────────────

func (s *Service) getCached(ctx context.Context, orgID, id uuid.UUID) (*EmployeeWithManager, error) {
	if s.cache != nil {
		key := cache.OrgItemKey(orgID, id, cacheModule)
		if v, ok := cache.Get[EmployeeWithManager](ctx, s.cache, key); ok {
			return &v, nil
		}
	}

	emp, err := s.repo.GetByID(ctx, orgID, id)
	if err != nil {
		return nil, err
	}

	if s.cache != nil {
		cache.Set(ctx, s.cache, cache.OrgItemKey(orgID, id, cacheModule), *emp, cacheTTL)
	}
	return emp, nil
}

func (s *Service) getByUserIDCached(ctx context.Context, orgID, userID uuid.UUID) (*Employee, error) {
	if s.cache != nil {
		key := cache.OrgKey(orgID, cacheModule, "user:"+userID.String())
		if v, ok := cache.Get[Employee](ctx, s.cache, key); ok {
			return &v, nil
		}
	}

	emp, err := s.repo.GetByUserID(ctx, orgID, userID)
	if err != nil {
		return nil, err
	}

	if s.cache != nil {
		cache.Set(ctx, s.cache, cache.OrgKey(orgID, cacheModule, "user:"+userID.String()), *emp, cacheTTL)
	}
	return emp, nil
}

func (s *Service) countActiveCached(ctx context.Context, orgID uuid.UUID) (int, error) {
	if s.cache != nil {
		key := cache.OrgKey(orgID, cacheModule, "count_active")
		if v, ok := cache.Get[int](ctx, s.cache, key); ok {
			return v, nil
		}
	}

	count, err := s.repo.CountActive(ctx, orgID)
	if err != nil {
		return 0, err
	}

	if s.cache != nil {
		cache.Set(ctx, s.cache, cache.OrgKey(orgID, cacheModule, "count_active"), count, cacheTTL)
	}
	return count, nil
}

func (s *Service) listAllActiveCached(ctx context.Context, orgID uuid.UUID) ([]Employee, error) {
	if s.cache != nil {
		key := cache.OrgKey(orgID, cacheModule, "all_active")
		if v, ok := cache.Get[[]Employee](ctx, s.cache, key); ok {
			return v, nil
		}
	}

	emps, err := s.repo.ListAllActive(ctx, orgID)
	if err != nil {
		return nil, err
	}

	if s.cache != nil {
		cache.Set(ctx, s.cache, cache.OrgKey(orgID, cacheModule, "all_active"), emps, cacheTTL)
	}
	return emps, nil
}

// ── Invalidation ────────────────────────────────────────────────────────────

func (s *Service) invalidateCache(ctx context.Context, orgID uuid.UUID) {
	if s.cache != nil {
		s.cache.DeletePattern(ctx, cache.OrgPatternKey(orgID, cacheModule))
	}
}

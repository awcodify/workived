package leave

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/workived/services/pkg/cache"
)

const (
	cacheModule = "leave"
	cacheTTL    = 10 * time.Minute
)

// WithCache sets the cache store for the service.
func WithCache(c *cache.Store) ServiceOption {
	return func(s *Service) {
		s.cache = c
	}
}

// ── Cached reads ─────────────────────────────────────────────────────────────

func (s *Service) listPoliciesCached(ctx context.Context, orgID uuid.UUID) ([]Policy, error) {
	if s.cache != nil {
		key := cache.OrgKey(orgID, cacheModule, "policies")
		if v, ok := cache.Get[[]Policy](ctx, s.cache, key); ok {
			return v, nil
		}
	}

	policies, err := s.repo.ListPolicies(ctx, orgID)
	if err != nil {
		return nil, err
	}

	if s.cache != nil {
		cache.Set(ctx, s.cache, cache.OrgKey(orgID, cacheModule, "policies"), policies, cacheTTL)
	}
	return policies, nil
}

func (s *Service) getPolicyCached(ctx context.Context, orgID, policyID uuid.UUID) (*Policy, error) {
	if s.cache != nil {
		key := cache.OrgKey(orgID, cacheModule, "policy:"+policyID.String())
		if v, ok := cache.Get[Policy](ctx, s.cache, key); ok {
			return &v, nil
		}
	}

	policy, err := s.repo.GetPolicy(ctx, orgID, policyID)
	if err != nil {
		return nil, err
	}

	if s.cache != nil {
		cache.Set(ctx, s.cache, cache.OrgKey(orgID, cacheModule, "policy:"+policyID.String()), *policy, cacheTTL)
	}
	return policy, nil
}

// ── Invalidation ────────────────────────────────────────────────────────────

func (s *Service) invalidatePolicyCache(ctx context.Context, orgID uuid.UUID) {
	if s.cache != nil {
		s.cache.DeletePattern(ctx, cache.OrgPatternKey(orgID, cacheModule))
	}
}

package attendance

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/workived/services/pkg/cache"
)

const (
	cacheModule = "work-sched"
	cacheTTL    = 10 * time.Minute
)

// ServiceOption configures an attendance Service.
type ServiceOption func(*Service)

// WithCache sets the cache store for the service.
func WithCache(c *cache.Store) ServiceOption {
	return func(s *Service) {
		s.cache = c
	}
}

// WithLeaveRepo injects the leave provider so week views can show on_leave status.
func WithLeaveRepo(lr LeaveInfoProvider) ServiceOption {
	return func(s *Service) {
		s.leaveRepo = lr
	}
}

// ── Cached overrides ─────────────────────────────────────────────────────────

func (s *Service) listWorkSchedulesCached(ctx context.Context, orgID uuid.UUID) ([]WorkScheduleListItem, error) {
	if s.cache != nil {
		key := cache.OrgListKey(orgID, cacheModule)
		if v, ok := cache.Get[[]WorkScheduleListItem](ctx, s.cache, key); ok {
			return v, nil
		}
	}

	schedules, err := s.repo.ListWorkSchedules(ctx, orgID)
	if err != nil {
		return nil, err
	}

	if s.cache != nil {
		cache.Set(ctx, s.cache, cache.OrgListKey(orgID, cacheModule), schedules, cacheTTL)
	}
	return schedules, nil
}

func (s *Service) getScheduleForEmployeeCached(ctx context.Context, orgID, employeeID uuid.UUID) (*WorkSchedule, error) {
	if s.cache != nil {
		key := fmt.Sprintf("org:%s:%s:emp:%s", orgID, cacheModule, employeeID)
		if v, ok := cache.Get[*WorkSchedule](ctx, s.cache, key); ok {
			return v, nil
		}
	}

	ws, err := s.repo.GetScheduleForEmployee(ctx, orgID, employeeID)
	if err != nil {
		return nil, err
	}

	if s.cache != nil {
		key := fmt.Sprintf("org:%s:%s:emp:%s", orgID, cacheModule, employeeID)
		cache.Set(ctx, s.cache, key, ws, cacheTTL)
	}
	return ws, nil
}

func (s *Service) invalidateScheduleCache(ctx context.Context, orgID uuid.UUID) {
	if s.cache != nil {
		s.cache.DeletePattern(ctx, cache.OrgPatternKey(orgID, cacheModule))
	}
}

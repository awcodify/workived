package dashboard

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/workived/services/pkg/apperr"
	"github.com/workived/services/pkg/cache"
)

const queryCacheTTL = 5 * time.Minute

type Service struct {
	repo   RepositoryInterface
	engine *Engine
	cache  *cache.Store
	log    zerolog.Logger
}

type ServiceOption func(*Service)

func WithCache(c *cache.Store) ServiceOption {
	return func(s *Service) { s.cache = c }
}

func WithLogger(log zerolog.Logger) ServiceOption {
	return func(s *Service) { s.log = log }
}

func NewService(repo RepositoryInterface, opts ...ServiceOption) *Service {
	s := &Service{
		repo:   repo,
		engine: &Engine{},
		log:    zerolog.Nop(),
	}
	for _, o := range opts {
		o(s)
	}
	return s
}

// ── Dashboards ────────────────────────────────────────────────────────────────

func (s *Service) ListDashboards(ctx context.Context, orgID uuid.UUID) ([]Dashboard, error) {
	return s.repo.ListDashboards(ctx, orgID)
}

func (s *Service) CreateDashboard(ctx context.Context, orgID, userID uuid.UUID, input CreateDashboardInput) (*Dashboard, error) {
	d, err := s.repo.CreateDashboard(ctx, orgID, userID, input)
	if err != nil {
		return nil, fmt.Errorf("create dashboard: %w", err)
	}
	s.log.Info().
		Str("org_id", orgID.String()).
		Str("dashboard_id", d.ID.String()).
		Str("name", d.Name).
		Msg("dashboard.created")
	return d, nil
}

func (s *Service) UpdateDashboard(ctx context.Context, orgID, id uuid.UUID, input UpdateDashboardInput) (*Dashboard, error) {
	d, err := s.repo.UpdateDashboard(ctx, orgID, id, input)
	if err != nil {
		return nil, fmt.Errorf("update dashboard: %w", err)
	}
	s.log.Info().
		Str("org_id", orgID.String()).
		Str("dashboard_id", id.String()).
		Msg("dashboard.updated")
	return d, nil
}

func (s *Service) DeleteDashboard(ctx context.Context, orgID, id uuid.UUID) error {
	if err := s.repo.DeleteDashboard(ctx, orgID, id); err != nil {
		return fmt.Errorf("delete dashboard: %w", err)
	}
	s.log.Info().
		Str("org_id", orgID.String()).
		Str("dashboard_id", id.String()).
		Msg("dashboard.deleted")
	return nil
}

// ── Widgets ───────────────────────────────────────────────────────────────────

func (s *Service) ListWidgets(ctx context.Context, orgID, dashboardID uuid.UUID) ([]Widget, error) {
	return s.repo.ListWidgets(ctx, orgID, dashboardID)
}

func (s *Service) CreateWidget(ctx context.Context, orgID, dashboardID uuid.UUID, input CreateWidgetInput) (*Widget, error) {
	if err := s.validateQueryConfig(ctx, orgID, input.QueryConfig); err != nil {
		return nil, err
	}
	w, err := s.repo.CreateWidget(ctx, orgID, dashboardID, input)
	if err != nil {
		return nil, fmt.Errorf("create widget: %w", err)
	}
	s.log.Info().
		Str("org_id", orgID.String()).
		Str("dashboard_id", dashboardID.String()).
		Str("widget_id", w.ID.String()).
		Str("widget_type", w.WidgetType).
		Msg("dashboard.widget.created")
	return w, nil
}

func (s *Service) UpdateWidget(ctx context.Context, orgID, dashboardID, widgetID uuid.UUID, input UpdateWidgetInput) (*Widget, error) {
	if err := s.validateQueryConfig(ctx, orgID, input.QueryConfig); err != nil {
		return nil, err
	}
	w, err := s.repo.UpdateWidget(ctx, orgID, dashboardID, widgetID, input)
	if err != nil {
		return nil, fmt.Errorf("update widget: %w", err)
	}
	s.log.Info().
		Str("org_id", orgID.String()).
		Str("widget_id", widgetID.String()).
		Msg("dashboard.widget.updated")
	return w, nil
}

func (s *Service) DeleteWidget(ctx context.Context, orgID, dashboardID, widgetID uuid.UUID) error {
	if err := s.repo.DeleteWidget(ctx, orgID, dashboardID, widgetID); err != nil {
		return fmt.Errorf("delete widget: %w", err)
	}
	s.log.Info().
		Str("org_id", orgID.String()).
		Str("widget_id", widgetID.String()).
		Msg("dashboard.widget.deleted")
	return nil
}

// ── Query execution ───────────────────────────────────────────────────────────

func (s *Service) ExecuteQuery(ctx context.Context, orgID uuid.UUID, input ExecuteQueryInput, orgTimezone string) (*QueryResult, error) {
	// Load active custom field defs for this org
	fieldDefs, err := s.repo.ListActiveFieldDefs(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("load field defs: %w", err)
	}

	// Build parameterized SQL
	built, err := s.engine.Build(orgID, input.QueryConfig, fieldDefs, orgTimezone)
	if err != nil {
		return nil, apperr.New(apperr.CodeValidation, err.Error())
	}

	// Cache key: org + sha256(query_config_json)
	cacheKey := s.queryCacheKey(orgID, input.QueryConfig)

	if s.cache != nil {
		if cached, ok := cache.Get[QueryResult](ctx, s.cache, cacheKey); ok {
			s.log.Debug().Str("cache_key", cacheKey).Msg("dashboard.query.cache_hit")
			return &cached, nil
		}
	}

	// Execute with statement timeout
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	rows, err := s.repo.RunQuery(timeoutCtx, built.SQL, built.Args)
	if err != nil {
		s.log.Error().Err(err).
			Str("org_id", orgID.String()).
			Str("source", input.QueryConfig.Source).
			Msg("dashboard.query.error")
		return nil, fmt.Errorf("execute query: %w", err)
	}

	result := s.buildResult(input.QueryConfig, rows)

	if s.cache != nil {
		cache.Set(ctx, s.cache, cacheKey, *result, queryCacheTTL)
	}

	s.log.Debug().
		Str("org_id", orgID.String()).
		Str("source", input.QueryConfig.Source).
		Int("rows", len(rows)).
		Msg("dashboard.query.executed")

	return result, nil
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func (s *Service) validateQueryConfig(ctx context.Context, orgID uuid.UUID, cfg QueryConfig) error {
	if cfg.Source == "" {
		return nil // empty config is allowed (widget saving before first preview)
	}
	fieldDefs, err := s.repo.ListActiveFieldDefs(ctx, orgID)
	if err != nil {
		return fmt.Errorf("load field defs: %w", err)
	}
	_, err = s.engine.Build(orgID, cfg, fieldDefs, "UTC")
	if err != nil {
		return apperr.New(apperr.CodeValidation, err.Error())
	}
	return nil
}

func (s *Service) queryCacheKey(orgID uuid.UUID, cfg QueryConfig) string {
	b, _ := json.Marshal(cfg)
	h := sha256.Sum256(b)
	return fmt.Sprintf("org:%s:dashboard:query:%x", orgID, h[:8])
}

func (s *Service) buildResult(cfg QueryConfig, rows []map[string]any) *QueryResult {
	if len(rows) == 0 {
		result := &QueryResult{Columns: []string{}, Rows: []map[string]any{}}
		if IsKPI(cfg) {
			v := 0.0
			result.Value = &v
		}
		return result
	}

	// Collect columns from first row
	cols := make([]string, 0, len(rows[0]))
	for k := range rows[0] {
		cols = append(cols, k)
	}

	result := &QueryResult{Columns: cols, Rows: rows}

	// KPI: extract scalar value
	if IsKPI(cfg) {
		if v, ok := rows[0]["value"]; ok {
			f := toFloat64(v)
			result.Value = &f
		}
	}

	return result
}

func toFloat64(v any) float64 {
	switch x := v.(type) {
	case float64:
		return x
	case float32:
		return float64(x)
	case int64:
		return float64(x)
	case int32:
		return float64(x)
	case int:
		return float64(x)
	case int16:
		return float64(x)
	}
	return 0
}

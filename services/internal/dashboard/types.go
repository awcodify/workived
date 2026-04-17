package dashboard

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// ── Widget types ──────────────────────────────────────────────────────────────

const (
	WidgetKPI   = "kpi"
	WidgetTable = "table"
	WidgetBar   = "bar"
	WidgetLine  = "line"
	WidgetDivider = "divider"
	WidgetText    = "text"
)

// ── Filter operators ──────────────────────────────────────────────────────────

const (
	OpEq      = "eq"
	OpNeq     = "neq"
	OpGt      = "gt"
	OpGte     = "gte"
	OpLt      = "lt"
	OpLte     = "lte"
	OpIn      = "in"
	OpIsNull  = "is_null"
	OpNotNull = "not_null"
)

// ── Aggregations ──────────────────────────────────────────────────────────────

const (
	AggCount         = "count"
	AggCountDistinct = "count_distinct"
	AggSum           = "sum"
	AggAvg           = "avg"
	AggMin           = "min"
	AggMax           = "max"
)

// ── Domain types ──────────────────────────────────────────────────────────────

type Dashboard struct {
	ID             uuid.UUID `json:"id"`
	OrganisationID uuid.UUID `json:"organisation_id"`
	Name           string    `json:"name"`
	IsDefault      bool      `json:"is_default"`
	CreatedBy      uuid.UUID `json:"created_by"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type Widget struct {
	ID             uuid.UUID   `json:"id"`
	OrganisationID uuid.UUID   `json:"organisation_id"`
	DashboardID    uuid.UUID   `json:"dashboard_id"`
	Title          string      `json:"title"`
	WidgetType     string      `json:"widget_type"`
	QueryConfig    QueryConfig `json:"query_config"`
	VizConfig      VizConfig   `json:"viz_config"`
	PositionX      int         `json:"position_x"`
	PositionY      int         `json:"position_y"`
	Width          int         `json:"width"`
	Height         int         `json:"height"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

// QueryConfig is stored as JSONB and translated to SQL by the query engine.
type QueryConfig struct {
	Source     string   `json:"source"`              // "tasks", "attendance", "leave", "claims", "employees"
	Aggregate  string   `json:"aggregate,omitempty"` // "count", "sum", "avg", etc.
	Field      string   `json:"field,omitempty"`     // "title", "field:uuid", etc.
	GroupBy    string   `json:"group_by,omitempty"`  // date field override for line; categorical for bar
	Facet      string   `json:"facet,omitempty"`     // categorical split for multi-series line
	DateBucket string   `json:"date_bucket,omitempty"` // "day" | "week" | "month" — for line charts
	Columns    []string `json:"columns,omitempty"`     // for table widget
	Filters    []Filter `json:"filters,omitempty"`
	SortBy     string   `json:"sort_by,omitempty"`
	SortDir    string   `json:"sort_dir,omitempty"` // "asc" | "desc"
	Limit      int      `json:"limit,omitempty"`
	DateRange  string   `json:"date_range,omitempty"` // alias like "this_month"
}

type Filter struct {
	Field string `json:"field"`
	Op    string `json:"op"`
	Value any    `json:"value"`
}

type VizConfig struct {
	Color       string `json:"color,omitempty"`
	Unit        string `json:"unit,omitempty"`
	ShowDelta   bool   `json:"show_delta,omitempty"`
	CompareWith string `json:"compare_with,omitempty"` // "previous_period"
	Content     string `json:"content,omitempty"`      // for text widgets
}

// QueryResult holds the raw result rows returned from the query engine.
type QueryResult struct {
	Columns []string         `json:"columns"`
	Rows    []map[string]any `json:"rows"`
	Value   *float64         `json:"value,omitempty"` // for KPI widgets
}

// ── Input types ───────────────────────────────────────────────────────────────

type CreateDashboardInput struct {
	Name      string `json:"name" validate:"required,min=1,max=100"`
	IsDefault bool   `json:"is_default"`
}

type UpdateDashboardInput struct {
	Name      string `json:"name" validate:"required,min=1,max=100"`
	IsDefault bool   `json:"is_default"`
}

type CreateWidgetInput struct {
	Title       string      `json:"title" validate:"required,min=1,max=200"`
	WidgetType  string      `json:"widget_type" validate:"required,oneof=kpi table bar line divider text"`
	QueryConfig QueryConfig `json:"query_config"`
	VizConfig   VizConfig   `json:"viz_config"`
	PositionX   int         `json:"position_x"`
	PositionY   int         `json:"position_y"`
	Width       int         `json:"width"`
	Height      int         `json:"height"`
}

type UpdateWidgetInput struct {
	Title       string      `json:"title" validate:"required,min=1,max=200"`
	WidgetType  string      `json:"widget_type" validate:"required,oneof=kpi table bar line divider text"`
	QueryConfig QueryConfig `json:"query_config"`
	VizConfig   VizConfig   `json:"viz_config"`
	PositionX   int         `json:"position_x"`
	PositionY   int         `json:"position_y"`
	Width       int         `json:"width"`
	Height      int         `json:"height"`
}

type ExecuteQueryInput struct {
	QueryConfig QueryConfig `json:"query_config"`
}

// FieldDef is a lightweight representation of task_field_definitions.
type FieldDef struct {
	ID        uuid.UUID
	Name      string
	FieldType string // text, number, date, boolean, select, multi_select, url, employee, rating
}

// ── Interfaces ────────────────────────────────────────────────────────────────

type ServiceInterface interface {
	ListDashboards(ctx context.Context, orgID uuid.UUID) ([]Dashboard, error)
	CreateDashboard(ctx context.Context, orgID, userID uuid.UUID, input CreateDashboardInput) (*Dashboard, error)
	UpdateDashboard(ctx context.Context, orgID, id uuid.UUID, input UpdateDashboardInput) (*Dashboard, error)
	DeleteDashboard(ctx context.Context, orgID, id uuid.UUID) error

	ListWidgets(ctx context.Context, orgID, dashboardID uuid.UUID) ([]Widget, error)
	CreateWidget(ctx context.Context, orgID, dashboardID uuid.UUID, input CreateWidgetInput) (*Widget, error)
	UpdateWidget(ctx context.Context, orgID, dashboardID, widgetID uuid.UUID, input UpdateWidgetInput) (*Widget, error)
	DeleteWidget(ctx context.Context, orgID, dashboardID, widgetID uuid.UUID) error

	ExecuteQuery(ctx context.Context, orgID uuid.UUID, input ExecuteQueryInput, orgTimezone string) (*QueryResult, error)
}

type RepositoryInterface interface {
	ListDashboards(ctx context.Context, orgID uuid.UUID) ([]Dashboard, error)
	CreateDashboard(ctx context.Context, orgID, userID uuid.UUID, input CreateDashboardInput) (*Dashboard, error)
	UpdateDashboard(ctx context.Context, orgID, id uuid.UUID, input UpdateDashboardInput) (*Dashboard, error)
	DeleteDashboard(ctx context.Context, orgID, id uuid.UUID) error

	ListWidgets(ctx context.Context, orgID, dashboardID uuid.UUID) ([]Widget, error)
	CreateWidget(ctx context.Context, orgID, dashboardID uuid.UUID, input CreateWidgetInput) (*Widget, error)
	UpdateWidget(ctx context.Context, orgID, dashboardID, widgetID uuid.UUID, input UpdateWidgetInput) (*Widget, error)
	DeleteWidget(ctx context.Context, orgID, dashboardID, widgetID uuid.UUID) error

	RunQuery(ctx context.Context, sql string, args []any) ([]map[string]any, error)
	ListActiveFieldDefs(ctx context.Context, orgID uuid.UUID) ([]FieldDef, error)
}

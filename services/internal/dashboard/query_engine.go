package dashboard

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Engine translates QueryConfig into a parameterized SQL string.
// Security guarantees:
//   - All field names are whitelisted from the source registry
//   - Custom field UUIDs are validated against org ownership
//   - All filter values are parameterized ($N), never interpolated
//   - org_id is always $1 in every query
//   - 10,000 row limit always appended
type Engine struct{}

// BuiltQuery is the output of Engine.Build.
type BuiltQuery struct {
	SQL  string
	Args []any
}

// Build translates a QueryConfig into a parameterized BuiltQuery.
// orgID is always $1. fieldDefs is the list of active custom fields for the org.
// tz is the org's IANA timezone string (e.g. "Asia/Jakarta") for date alias resolution.
func (e *Engine) Build(
	orgID uuid.UUID,
	cfg QueryConfig,
	fieldDefs []FieldDef,
	tz string,
) (*BuiltQuery, error) {
	src, ok := GetSource(cfg.Source)
	if !ok {
		return nil, fmt.Errorf("%w: unknown source %q", ErrValidation, cfg.Source)
	}

	// $1 is always org_id
	args := []any{orgID}
	nextParam := func(v any) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}

	// ── Resolve custom field SQL expressions ──────────────────────────────────
	customFields := buildCustomFieldIndex(fieldDefs)

	// ── SELECT clause ─────────────────────────────────────────────────────────
	selectClause, groupByClause, err := e.buildSelect(cfg, src, customFields, nextParam)
	if err != nil {
		return nil, err
	}

	// ── FROM + JOINs ──────────────────────────────────────────────────────────
	fromClause := fmt.Sprintf("FROM %s\n%s", src.BaseTable, strings.Join(src.Joins, "\n"))

	// ── WHERE clause ─────────────────────────────────────────────────────────
	whereClause, err := e.buildWhere(cfg, src, customFields, nextParam, tz)
	if err != nil {
		return nil, err
	}

	// ── ORDER BY ─────────────────────────────────────────────────────────────
	orderClause := e.buildOrder(cfg, src, customFields)

	// ── LIMIT ────────────────────────────────────────────────────────────────
	limit := 10000
	if cfg.Limit > 0 && cfg.Limit < limit {
		limit = cfg.Limit
	}

	sql := fmt.Sprintf(
		`SELECT %s
%s
WHERE %s.organisation_id = $1
%s
%s
%s
LIMIT %d`,
		selectClause,
		fromClause,
		src.OrgIDCol[:strings.Index(src.OrgIDCol, ".")], // table alias
		whereClause,
		groupByClause,
		orderClause,
		limit,
	)

	return &BuiltQuery{SQL: sql, Args: args}, nil
}

// ── SELECT builder ────────────────────────────────────────────────────────────

func (e *Engine) buildSelect(
	cfg QueryConfig,
	src Source,
	customFields map[string]resolvedField,
	_ func(any) string,
) (selectSQL string, groupBySQL string, err error) {
	switch {
	case cfg.Aggregate != "":
		// KPI / grouped aggregate
		return e.buildAggregateSelect(cfg, src, customFields)
	case len(cfg.Columns) > 0:
		// Table widget — explicit columns
		return e.buildColumnsSelect(cfg, src, customFields)
	default:
		// Fallback: all built-in fields
		return "t.id, t.title, tl.name AS status, e.full_name AS assignee_name, t.due_date, t.priority, t.created_at, t.completed_at", "", nil
	}
}

func (e *Engine) buildAggregateSelect(
	cfg QueryConfig,
	src Source,
	customFields map[string]resolvedField,
) (string, string, error) {
	var aggExpr string
	switch cfg.Aggregate {
	case AggCount:
		aggExpr = "COUNT(*)"
	case AggCountDistinct:
		fieldExpr, err := resolveFieldExpr(cfg.Field, src, customFields)
		if err != nil {
			return "", "", err
		}
		aggExpr = fmt.Sprintf("COUNT(DISTINCT %s)", fieldExpr)
	case AggSum, AggAvg, AggMin, AggMax:
		if cfg.Field == "" {
			return "", "", fmt.Errorf("%w: field required for %s aggregate", ErrValidation, cfg.Aggregate)
		}
		fieldExpr, err := resolveFieldExpr(cfg.Field, src, customFields)
		if err != nil {
			return "", "", err
		}
		aggExpr = fmt.Sprintf("%s(%s)", strings.ToUpper(cfg.Aggregate), fieldExpr)
	default:
		return "", "", fmt.Errorf("%w: unknown aggregate %q", ErrValidation, cfg.Aggregate)
	}

	if cfg.GroupBy == "" {
		return aggExpr + " AS value", "", nil
	}

	groupExpr, err := resolveFieldExpr(cfg.GroupBy, src, customFields)
	if err != nil {
		return "", "", err
	}
	sf, err := resolveSourceField(cfg.GroupBy, src, customFields)
	if err != nil {
		return "", "", err
	}
	if !sf.Groupable {
		return "", "", fmt.Errorf("%w: field %q is not groupable", ErrValidation, cfg.GroupBy)
	}

	sel := fmt.Sprintf("%s AS group_key, %s AS value", groupExpr, aggExpr)
	groupBy := fmt.Sprintf("GROUP BY %s", groupExpr)
	return sel, groupBy, nil
}

func (e *Engine) buildColumnsSelect(
	cfg QueryConfig,
	src Source,
	customFields map[string]resolvedField,
) (string, string, error) {
	parts := make([]string, 0, len(cfg.Columns))
	for _, col := range cfg.Columns {
		expr, err := resolveFieldExpr(col, src, customFields)
		if err != nil {
			return "", "", err
		}
		alias := strings.ReplaceAll(col, ":", "_")
		parts = append(parts, fmt.Sprintf("%s AS %q", expr, alias))
	}
	return strings.Join(parts, ", "), "", nil
}

// ── WHERE builder ─────────────────────────────────────────────────────────────

func (e *Engine) buildWhere(
	cfg QueryConfig,
	src Source,
	customFields map[string]resolvedField,
	nextParam func(any) string,
	tz string,
) (string, error) {
	var parts []string

	// Date range shortcut — applies to created_at or completed_at depending on config
	if cfg.DateRange != "" {
		start, end, err := resolveDateRange(cfg.DateRange, tz)
		if err != nil {
			return "", err
		}
		dateCol := "t.created_at"
		if cfg.Source == "tasks" {
			dateCol = "t.created_at"
		}
		parts = append(parts, fmt.Sprintf("%s >= %s AND %s < %s",
			dateCol, nextParam(start),
			dateCol, nextParam(end),
		))
	}

	for _, f := range cfg.Filters {
		clause, err := e.buildFilterClause(f, src, customFields, nextParam, tz)
		if err != nil {
			return "", err
		}
		parts = append(parts, clause)
	}

	if len(parts) == 0 {
		return "", nil
	}
	return "AND " + strings.Join(parts, "\nAND "), nil
}

func (e *Engine) buildFilterClause(
	f Filter,
	src Source,
	customFields map[string]resolvedField,
	nextParam func(any) string,
	tz string,
) (string, error) {
	fieldExpr, err := resolveFieldExpr(f.Field, src, customFields)
	if err != nil {
		return "", err
	}

	switch f.Op {
	case OpEq:
		val, err := resolveFilterValue(f.Value, f.Field, tz)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%s = %s", fieldExpr, nextParam(val)), nil
	case OpNeq:
		val, err := resolveFilterValue(f.Value, f.Field, tz)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%s != %s", fieldExpr, nextParam(val)), nil
	case OpGt:
		val, err := resolveFilterValue(f.Value, f.Field, tz)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%s > %s", fieldExpr, nextParam(val)), nil
	case OpGte:
		val, err := resolveFilterValue(f.Value, f.Field, tz)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%s >= %s", fieldExpr, nextParam(val)), nil
	case OpLt:
		val, err := resolveFilterValue(f.Value, f.Field, tz)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%s < %s", fieldExpr, nextParam(val)), nil
	case OpLte:
		val, err := resolveFilterValue(f.Value, f.Field, tz)
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%s <= %s", fieldExpr, nextParam(val)), nil
	case OpIn:
		vals, ok := f.Value.([]any)
		if !ok {
			return "", fmt.Errorf("%w: 'in' filter value must be array", ErrValidation)
		}
		placeholders := make([]string, len(vals))
		for i, v := range vals {
			rv, err := resolveFilterValue(v, f.Field, tz)
			if err != nil {
				return "", err
			}
			placeholders[i] = nextParam(rv)
		}
		return fmt.Sprintf("%s IN (%s)", fieldExpr, strings.Join(placeholders, ", ")), nil
	case OpIsNull:
		return fmt.Sprintf("%s IS NULL", fieldExpr), nil
	case OpNotNull:
		return fmt.Sprintf("%s IS NOT NULL", fieldExpr), nil
	default:
		return "", fmt.Errorf("%w: unknown filter op %q", ErrValidation, f.Op)
	}
}

// ── ORDER BY builder ──────────────────────────────────────────────────────────

func (e *Engine) buildOrder(cfg QueryConfig, src Source, customFields map[string]resolvedField) string {
	if cfg.SortBy == "" {
		return ""
	}
	expr, err := resolveFieldExpr(cfg.SortBy, src, customFields)
	if err != nil {
		return ""
	}
	dir := "ASC"
	if strings.ToLower(cfg.SortDir) == "desc" {
		dir = "DESC"
	}
	return fmt.Sprintf("ORDER BY %s %s", expr, dir)
}

// ── Helper: field resolution ──────────────────────────────────────────────────

type resolvedField struct {
	SQLExpr   string
	FieldDef  SourceField
}

func buildCustomFieldIndex(defs []FieldDef) map[string]resolvedField {
	m := make(map[string]resolvedField, len(defs))
	for _, d := range defs {
		key := customFieldPrefix + d.ID.String()
		sf := CustomFieldSourceField(d.FieldType)
		sf.SQLExpr = CustomFieldExpr(d.ID.String(), d.FieldType)
		m[key] = resolvedField{SQLExpr: sf.SQLExpr, FieldDef: sf}
	}
	return m
}

func resolveFieldExpr(key string, src Source, customFields map[string]resolvedField) (string, error) {
	if IsCustomField(key) {
		rf, ok := customFields[key]
		if !ok {
			return "", fmt.Errorf("%w: custom field %q not found or inactive", ErrValidation, key)
		}
		return rf.SQLExpr, nil
	}
	sf, ok := src.Fields[key]
	if !ok {
		return "", fmt.Errorf("%w: unknown field %q for source %q", ErrValidation, key, src.BaseTable)
	}
	return sf.SQLExpr, nil
}

func resolveSourceField(key string, src Source, customFields map[string]resolvedField) (SourceField, error) {
	if IsCustomField(key) {
		rf, ok := customFields[key]
		if !ok {
			return SourceField{}, fmt.Errorf("%w: custom field %q not found", ErrValidation, key)
		}
		return rf.FieldDef, nil
	}
	sf, ok := src.Fields[key]
	if !ok {
		return SourceField{}, fmt.Errorf("%w: unknown field %q", ErrValidation, key)
	}
	return sf, nil
}

// ── Date alias resolution ─────────────────────────────────────────────────────

func resolveDateRange(alias, tz string) (start, end time.Time, err error) {
	loc, locErr := time.LoadLocation(tz)
	if locErr != nil {
		loc = time.UTC
	}

	now := time.Now().In(loc)
	year, month, day := now.Date()

	switch alias {
	case "today":
		start = time.Date(year, month, day, 0, 0, 0, 0, loc)
		end = start.AddDate(0, 0, 1)
	case "this_week":
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		start = time.Date(year, month, day-weekday+1, 0, 0, 0, 0, loc)
		end = start.AddDate(0, 0, 7)
	case "this_month":
		start = time.Date(year, month, 1, 0, 0, 0, 0, loc)
		end = start.AddDate(0, 1, 0)
	case "last_30_days":
		end = time.Date(year, month, day+1, 0, 0, 0, 0, loc)
		start = end.AddDate(0, 0, -30)
	case "this_quarter":
		q := (int(month) - 1) / 3
		startMonth := time.Month(q*3 + 1)
		start = time.Date(year, startMonth, 1, 0, 0, 0, 0, loc)
		end = start.AddDate(0, 3, 0)
	case "this_year":
		start = time.Date(year, 1, 1, 0, 0, 0, 0, loc)
		end = start.AddDate(1, 0, 0)
	case "last_year":
		start = time.Date(year-1, 1, 1, 0, 0, 0, 0, loc)
		end = time.Date(year, 1, 1, 0, 0, 0, 0, loc)
	default:
		return time.Time{}, time.Time{}, fmt.Errorf("%w: unknown date range %q", ErrValidation, alias)
	}
	return start.UTC(), end.UTC(), nil
}

func resolveFilterValue(v any, _ string, tz string) (any, error) {
	s, ok := v.(string)
	if !ok {
		return v, nil
	}
	// Resolve date aliases used as filter values
	switch s {
	case "today", "this_week", "this_month", "last_30_days", "this_quarter", "this_year", "last_year":
		start, _, err := resolveDateRange(s, tz)
		if err != nil {
			return nil, err
		}
		return start, nil
	}
	return v, nil
}

// ErrValidation is returned for invalid query configs (field not found, bad op, etc.)
var ErrValidation = fmt.Errorf("invalid query config")

// IsKPI returns true if the query config represents a KPI (single scalar) query.
func IsKPI(cfg QueryConfig) bool {
	return cfg.Aggregate != "" && cfg.GroupBy == ""
}

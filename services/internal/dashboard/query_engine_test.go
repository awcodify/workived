package dashboard

import (
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestEngine_Build_Count(t *testing.T) {
	orgID := uuid.New()
	e := &Engine{}

	built, err := e.Build(orgID, QueryConfig{
		Source:    "tasks",
		Aggregate: AggCount,
	}, nil, "UTC")

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if built.Args[0] != orgID {
		t.Errorf("expected args[0] = orgID, got %v", built.Args[0])
	}
	if !strings.Contains(built.SQL, "COUNT(*)") {
		t.Errorf("expected COUNT(*) in SQL, got: %s", built.SQL)
	}
	if !strings.Contains(built.SQL, "organisation_id = $1") {
		t.Errorf("expected org_id filter in SQL, got: %s", built.SQL)
	}
	if !strings.Contains(built.SQL, "LIMIT") {
		t.Errorf("expected LIMIT in SQL, got: %s", built.SQL)
	}
}

func TestEngine_Build_UnknownSource(t *testing.T) {
	e := &Engine{}
	_, err := e.Build(uuid.New(), QueryConfig{Source: "nonexistent"}, nil, "UTC")
	if err == nil {
		t.Fatal("expected error for unknown source")
	}
}

func TestEngine_Build_UnknownField(t *testing.T) {
	e := &Engine{}
	_, err := e.Build(uuid.New(), QueryConfig{
		Source:    "tasks",
		Aggregate: AggSum,
		Field:     "nonexistent_field",
	}, nil, "UTC")
	if err == nil {
		t.Fatal("expected error for unknown field")
	}
}

func TestEngine_Build_UnknownAggregate(t *testing.T) {
	e := &Engine{}
	_, err := e.Build(uuid.New(), QueryConfig{
		Source:    "tasks",
		Aggregate: "explode",
	}, nil, "UTC")
	if err == nil {
		t.Fatal("expected error for unknown aggregate")
	}
}

func TestEngine_Build_GroupBy(t *testing.T) {
	e := &Engine{}
	built, err := e.Build(uuid.New(), QueryConfig{
		Source:    "tasks",
		Aggregate: AggCount,
		GroupBy:   "assignee_name",
	}, nil, "UTC")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(built.SQL, "GROUP BY") {
		t.Errorf("expected GROUP BY in SQL, got: %s", built.SQL)
	}
	if !strings.Contains(built.SQL, "e.full_name") {
		t.Errorf("expected assignee_name expr in SQL, got: %s", built.SQL)
	}
}

func TestEngine_Build_Filter_Eq(t *testing.T) {
	e := &Engine{}
	built, err := e.Build(uuid.New(), QueryConfig{
		Source:    "tasks",
		Aggregate: AggCount,
		Filters: []Filter{
			{Field: "priority", Op: OpEq, Value: "high"},
		},
	}, nil, "UTC")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(built.SQL, "t.priority = $") {
		t.Errorf("expected priority filter, got: %s", built.SQL)
	}
	// priority value must be parameterized
	found := false
	for _, a := range built.Args[1:] {
		if a == "high" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("filter value 'high' not in args: %v", built.Args)
	}
}

func TestEngine_Build_Filter_UnknownOp(t *testing.T) {
	e := &Engine{}
	_, err := e.Build(uuid.New(), QueryConfig{
		Source:    "tasks",
		Aggregate: AggCount,
		Filters:   []Filter{{Field: "priority", Op: "contains", Value: "high"}},
	}, nil, "UTC")
	if err == nil {
		t.Fatal("expected error for unknown op")
	}
}

func TestEngine_Build_Filter_In(t *testing.T) {
	e := &Engine{}
	built, err := e.Build(uuid.New(), QueryConfig{
		Source:    "tasks",
		Aggregate: AggCount,
		Filters: []Filter{
			{Field: "priority", Op: OpIn, Value: []any{"high", "urgent"}},
		},
	}, nil, "UTC")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(built.SQL, "IN (") {
		t.Errorf("expected IN clause, got: %s", built.SQL)
	}
}

func TestEngine_Build_Filter_IsNull(t *testing.T) {
	e := &Engine{}
	built, err := e.Build(uuid.New(), QueryConfig{
		Source:    "tasks",
		Aggregate: AggCount,
		Filters:   []Filter{{Field: "completed_at", Op: OpIsNull}},
	}, nil, "UTC")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(built.SQL, "IS NULL") {
		t.Errorf("expected IS NULL, got: %s", built.SQL)
	}
}

func TestEngine_Build_DateRange(t *testing.T) {
	e := &Engine{}
	built, err := e.Build(uuid.New(), QueryConfig{
		Source:    "tasks",
		Aggregate: AggCount,
		DateRange: "this_month",
	}, nil, "UTC")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(built.Args) < 3 {
		t.Errorf("expected at least 3 args (orgID + start + end), got: %v", built.Args)
	}
}

func TestEngine_Build_DateRange_Unknown(t *testing.T) {
	e := &Engine{}
	_, err := e.Build(uuid.New(), QueryConfig{
		Source:    "tasks",
		Aggregate: AggCount,
		DateRange: "last_decade",
	}, nil, "UTC")
	if err == nil {
		t.Fatal("expected error for unknown date range")
	}
}

func TestEngine_Build_CustomField(t *testing.T) {
	fieldID := uuid.New()
	e := &Engine{}
	built, err := e.Build(uuid.New(), QueryConfig{
		Source:    "tasks",
		Aggregate: AggSum,
		Field:     customFieldPrefix + fieldID.String(),
	}, []FieldDef{{ID: fieldID, Name: "Deal Value", FieldType: "number"}}, "UTC")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(built.SQL, fieldID.String()) {
		t.Errorf("expected custom field UUID in SQL, got: %s", built.SQL)
	}
	if !strings.Contains(built.SQL, "task_field_values") {
		t.Errorf("expected task_field_values subquery, got: %s", built.SQL)
	}
}

func TestEngine_Build_CustomField_NotFound(t *testing.T) {
	e := &Engine{}
	unknownID := uuid.New()
	_, err := e.Build(uuid.New(), QueryConfig{
		Source:    "tasks",
		Aggregate: AggSum,
		Field:     customFieldPrefix + unknownID.String(),
	}, nil, "UTC") // nil fieldDefs → custom field not found
	if err == nil {
		t.Fatal("expected error for unknown custom field")
	}
}

func TestEngine_Build_Columns(t *testing.T) {
	e := &Engine{}
	built, err := e.Build(uuid.New(), QueryConfig{
		Source:  "tasks",
		Columns: []string{"title", "assignee_name", "priority"},
	}, nil, "UTC")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(built.SQL, "t.title") {
		t.Errorf("expected t.title in SQL, got: %s", built.SQL)
	}
	if !strings.Contains(built.SQL, "e.full_name") {
		t.Errorf("expected e.full_name in SQL, got: %s", built.SQL)
	}
}

func TestEngine_Build_SortBy(t *testing.T) {
	e := &Engine{}
	built, err := e.Build(uuid.New(), QueryConfig{
		Source:  "tasks",
		Columns: []string{"title"},
		SortBy:  "created_at",
		SortDir: "desc",
	}, nil, "UTC")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(built.SQL, "ORDER BY") {
		t.Errorf("expected ORDER BY in SQL, got: %s", built.SQL)
	}
	if !strings.Contains(strings.ToUpper(built.SQL), "DESC") {
		t.Errorf("expected DESC in SQL, got: %s", built.SQL)
	}
}

func TestEngine_Build_LimitRespected(t *testing.T) {
	e := &Engine{}
	built, err := e.Build(uuid.New(), QueryConfig{
		Source:  "tasks",
		Columns: []string{"title"},
		Limit:   5,
	}, nil, "UTC")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(built.SQL, "LIMIT 5") {
		t.Errorf("expected LIMIT 5 in SQL, got: %s", built.SQL)
	}
}

func TestEngine_Build_LimitMaxCapped(t *testing.T) {
	e := &Engine{}
	built, err := e.Build(uuid.New(), QueryConfig{
		Source:  "tasks",
		Columns: []string{"title"},
		Limit:   999999,
	}, nil, "UTC")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(built.SQL, "LIMIT 10000") {
		t.Errorf("expected LIMIT 10000 cap in SQL, got: %s", built.SQL)
	}
}

func TestIsKPI(t *testing.T) {
	tests := []struct {
		cfg  QueryConfig
		want bool
	}{
		{QueryConfig{Aggregate: AggCount}, true},
		{QueryConfig{Aggregate: AggSum, Field: "field:x"}, true},
		{QueryConfig{Aggregate: AggCount, GroupBy: "priority"}, false},
		{QueryConfig{Columns: []string{"title"}}, false},
	}
	for _, tt := range tests {
		if got := IsKPI(tt.cfg); got != tt.want {
			t.Errorf("IsKPI(%+v) = %v, want %v", tt.cfg, got, tt.want)
		}
	}
}

func TestResolveDateRange(t *testing.T) {
	aliases := []string{"today", "this_week", "this_month", "last_30_days", "this_quarter", "this_year", "last_year"}
	for _, alias := range aliases {
		start, end, err := resolveDateRange(alias, "UTC")
		if err != nil {
			t.Errorf("resolveDateRange(%q) error: %v", alias, err)
			continue
		}
		if !end.After(start) {
			t.Errorf("resolveDateRange(%q): end %v not after start %v", alias, end, start)
		}
	}
}

func TestResolveDateRange_Unknown(t *testing.T) {
	_, _, err := resolveDateRange("last_century", "UTC")
	if err == nil {
		t.Fatal("expected error for unknown date range")
	}
}

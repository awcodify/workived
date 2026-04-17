package dashboard

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// ── Fake repo ─────────────────────────────────────────────────────────────────

type fakeRepo struct {
	dashboards  []Dashboard
	widgets     []Widget
	fieldDefs   []FieldDef
	queryResult []map[string]any
	err         error
}

func (f *fakeRepo) ListDashboards(_ context.Context, _ uuid.UUID) ([]Dashboard, error) {
	return f.dashboards, f.err
}
func (f *fakeRepo) CreateDashboard(_ context.Context, orgID, userID uuid.UUID, input CreateDashboardInput) (*Dashboard, error) {
	if f.err != nil {
		return nil, f.err
	}
	d := &Dashboard{ID: uuid.New(), OrganisationID: orgID, Name: input.Name, IsDefault: input.IsDefault, CreatedBy: userID}
	return d, nil
}
func (f *fakeRepo) UpdateDashboard(_ context.Context, orgID, id uuid.UUID, input UpdateDashboardInput) (*Dashboard, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &Dashboard{ID: id, OrganisationID: orgID, Name: input.Name}, nil
}
func (f *fakeRepo) DeleteDashboard(_ context.Context, _ uuid.UUID, _ uuid.UUID) error { return f.err }

func (f *fakeRepo) ListWidgets(_ context.Context, _, _ uuid.UUID) ([]Widget, error) {
	return f.widgets, f.err
}
func (f *fakeRepo) CreateWidget(_ context.Context, orgID, dashID uuid.UUID, input CreateWidgetInput) (*Widget, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &Widget{ID: uuid.New(), OrganisationID: orgID, DashboardID: dashID, Title: input.Title, WidgetType: input.WidgetType}, nil
}
func (f *fakeRepo) UpdateWidget(_ context.Context, orgID, dashID, widID uuid.UUID, input UpdateWidgetInput) (*Widget, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &Widget{ID: widID, OrganisationID: orgID, DashboardID: dashID, Title: input.Title}, nil
}
func (f *fakeRepo) DeleteWidget(_ context.Context, _, _, _ uuid.UUID) error { return f.err }
func (f *fakeRepo) RunQuery(_ context.Context, _ string, _ []any) ([]map[string]any, error) {
	return f.queryResult, f.err
}
func (f *fakeRepo) ListActiveFieldDefs(_ context.Context, _ uuid.UUID) ([]FieldDef, error) {
	return f.fieldDefs, f.err
}

// ── Tests ─────────────────────────────────────────────────────────────────────

func newTestService(repo RepositoryInterface) *Service {
	return NewService(repo, WithLogger(zerolog.Nop()))
}

func TestService_ListDashboards(t *testing.T) {
	expected := []Dashboard{{ID: uuid.New(), Name: "My Dashboard"}}
	svc := newTestService(&fakeRepo{dashboards: expected})
	got, err := svc.ListDashboards(context.Background(), uuid.New())
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Name != "My Dashboard" {
		t.Errorf("unexpected result: %+v", got)
	}
}

func TestService_CreateDashboard(t *testing.T) {
	svc := newTestService(&fakeRepo{})
	orgID := uuid.New()
	d, err := svc.CreateDashboard(context.Background(), orgID, uuid.New(), CreateDashboardInput{Name: "Sales"})
	if err != nil {
		t.Fatal(err)
	}
	if d.Name != "Sales" {
		t.Errorf("expected name Sales, got %q", d.Name)
	}
	if d.OrganisationID != orgID {
		t.Errorf("expected orgID %v, got %v", orgID, d.OrganisationID)
	}
}

func TestService_CreateDashboard_RepoError(t *testing.T) {
	svc := newTestService(&fakeRepo{err: errors.New("db error")})
	_, err := svc.CreateDashboard(context.Background(), uuid.New(), uuid.New(), CreateDashboardInput{Name: "X"})
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestService_DeleteDashboard(t *testing.T) {
	svc := newTestService(&fakeRepo{})
	if err := svc.DeleteDashboard(context.Background(), uuid.New(), uuid.New()); err != nil {
		t.Fatal(err)
	}
}

func TestService_CreateWidget(t *testing.T) {
	svc := newTestService(&fakeRepo{})
	w, err := svc.CreateWidget(context.Background(), uuid.New(), uuid.New(), CreateWidgetInput{
		Title:      "Total Tasks",
		WidgetType: WidgetKPI,
		QueryConfig: QueryConfig{
			Source:    "tasks",
			Aggregate: AggCount,
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if w.Title != "Total Tasks" {
		t.Errorf("expected title 'Total Tasks', got %q", w.Title)
	}
}

func TestService_CreateWidget_TextSkipsQueryValidation(t *testing.T) {
	svc := newTestService(&fakeRepo{})
	_, err := svc.CreateWidget(context.Background(), uuid.New(), uuid.New(), CreateWidgetInput{
		Title:      "About This Dashboard",
		WidgetType: WidgetText,
		QueryConfig: QueryConfig{Source: "nonexistent"}, // invalid source — must be skipped for text
		VizConfig:   VizConfig{Content: "Hello world"},
	})
	if err != nil {
		t.Fatalf("text widget should skip query validation: %v", err)
	}
}

func TestService_CreateWidget_InvalidQuery(t *testing.T) {
	svc := newTestService(&fakeRepo{})
	_, err := svc.CreateWidget(context.Background(), uuid.New(), uuid.New(), CreateWidgetInput{
		Title:      "Bad",
		WidgetType: WidgetKPI,
		QueryConfig: QueryConfig{
			Source:    "nonexistent",
			Aggregate: AggCount,
		},
	})
	if err == nil {
		t.Fatal("expected validation error for unknown source")
	}
}

func TestService_ExecuteQuery_Count(t *testing.T) {
	rows := []map[string]any{{"value": int64(42)}}
	svc := newTestService(&fakeRepo{queryResult: rows})

	result, err := svc.ExecuteQuery(context.Background(), uuid.New(), ExecuteQueryInput{
		QueryConfig: QueryConfig{Source: "tasks", Aggregate: AggCount},
	}, "UTC")
	if err != nil {
		t.Fatal(err)
	}
	if result.Value == nil {
		t.Fatal("expected scalar value for KPI query")
	}
	if *result.Value != 42 {
		t.Errorf("expected value 42, got %v", *result.Value)
	}
}

func TestService_ExecuteQuery_EmptyResult(t *testing.T) {
	svc := newTestService(&fakeRepo{queryResult: nil})
	result, err := svc.ExecuteQuery(context.Background(), uuid.New(), ExecuteQueryInput{
		QueryConfig: QueryConfig{Source: "tasks", Aggregate: AggCount},
	}, "UTC")
	if err != nil {
		t.Fatal(err)
	}
	if result.Value == nil {
		t.Fatal("expected zero value for empty KPI result")
	}
	if *result.Value != 0 {
		t.Errorf("expected 0, got %v", *result.Value)
	}
}

func TestService_ExecuteQuery_Table(t *testing.T) {
	rows := []map[string]any{
		{"title": "Fix bug", "priority": "high"},
		{"title": "Add feature", "priority": "medium"},
	}
	svc := newTestService(&fakeRepo{queryResult: rows})

	result, err := svc.ExecuteQuery(context.Background(), uuid.New(), ExecuteQueryInput{
		QueryConfig: QueryConfig{
			Source:  "tasks",
			Columns: []string{"title", "priority"},
		},
	}, "UTC")
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Rows) != 2 {
		t.Errorf("expected 2 rows, got %d", len(result.Rows))
	}
	if result.Value != nil {
		t.Error("table widget should not have scalar value")
	}
}

func TestService_ExecuteQuery_InvalidSource(t *testing.T) {
	svc := newTestService(&fakeRepo{})
	_, err := svc.ExecuteQuery(context.Background(), uuid.New(), ExecuteQueryInput{
		QueryConfig: QueryConfig{Source: "bad_source", Aggregate: AggCount},
	}, "UTC")
	if err == nil {
		t.Fatal("expected error for invalid source")
	}
}

func TestToFloat64(t *testing.T) {
	tests := []struct {
		input any
		want  float64
	}{
		{float64(3.14), 3.14},
		{int64(42), 42},
		{int32(7), 7},
		{int(100), 100},
		{"string", 0},
		{nil, 0},
	}
	for _, tt := range tests {
		got := toFloat64(tt.input)
		if got != tt.want {
			t.Errorf("toFloat64(%v) = %v, want %v", tt.input, got, tt.want)
		}
	}
}

package dashboard

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
	"github.com/workived/services/pkg/apperr"
)

type Repo struct {
	db  *pgxpool.Pool
	log zerolog.Logger
}

func NewRepository(db *pgxpool.Pool, log zerolog.Logger) *Repo {
	return &Repo{db: db, log: log.With().Str("component", "dashboard.repo").Logger()}
}

// ── Dashboards ────────────────────────────────────────────────────────────────

func (r *Repo) ListDashboards(ctx context.Context, orgID uuid.UUID) ([]Dashboard, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, name, is_default, created_by, created_at, updated_at
		FROM dashboards
		WHERE organisation_id = $1
		ORDER BY is_default DESC, name ASC`,
		orgID,
	)
	if err != nil {
		return nil, fmt.Errorf("list dashboards: %w", err)
	}
	defer rows.Close()

	var out []Dashboard
	for rows.Next() {
		var d Dashboard
		var createdBy *uuid.UUID
		if err := rows.Scan(&d.ID, &d.OrganisationID, &d.Name, &d.IsDefault, &createdBy, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan dashboard: %w", err)
		}
		if createdBy != nil {
			d.CreatedBy = *createdBy
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *Repo) CreateDashboard(ctx context.Context, orgID, userID uuid.UUID, input CreateDashboardInput) (*Dashboard, error) {
	var d Dashboard
	var createdBy *uuid.UUID
	err := r.db.QueryRow(ctx, `
		INSERT INTO dashboards (organisation_id, name, is_default, created_by)
		VALUES ($1, $2, $3, $4)
		RETURNING id, organisation_id, name, is_default, created_by, created_at, updated_at`,
		orgID, input.Name, input.IsDefault, userID,
	).Scan(&d.ID, &d.OrganisationID, &d.Name, &d.IsDefault, &createdBy, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create dashboard: %w", err)
	}
	if createdBy != nil {
		d.CreatedBy = *createdBy
	}
	return &d, nil
}

func (r *Repo) UpdateDashboard(ctx context.Context, orgID, id uuid.UUID, input UpdateDashboardInput) (*Dashboard, error) {
	var d Dashboard
	var createdBy *uuid.UUID
	err := r.db.QueryRow(ctx, `
		UPDATE dashboards
		SET name = $3, is_default = $4, updated_at = NOW()
		WHERE organisation_id = $1 AND id = $2
		RETURNING id, organisation_id, name, is_default, created_by, created_at, updated_at`,
		orgID, id, input.Name, input.IsDefault,
	).Scan(&d.ID, &d.OrganisationID, &d.Name, &d.IsDefault, &createdBy, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.New(apperr.CodeNotFound, "dashboard not found")
		}
		return nil, fmt.Errorf("update dashboard: %w", err)
	}
	if createdBy != nil {
		d.CreatedBy = *createdBy
	}
	return &d, nil
}

func (r *Repo) DeleteDashboard(ctx context.Context, orgID, id uuid.UUID) error {
	cmd, err := r.db.Exec(ctx, `
		DELETE FROM dashboards WHERE organisation_id = $1 AND id = $2`,
		orgID, id,
	)
	if err != nil {
		return fmt.Errorf("delete dashboard: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return apperr.New(apperr.CodeNotFound, "dashboard not found")
	}
	return nil
}

// ── Widgets ───────────────────────────────────────────────────────────────────

func (r *Repo) ListWidgets(ctx context.Context, orgID, dashboardID uuid.UUID) ([]Widget, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, organisation_id, dashboard_id, title, widget_type,
		       query_config, viz_config, position_x, position_y, width, height,
		       created_at, updated_at
		FROM dashboard_widgets
		WHERE organisation_id = $1 AND dashboard_id = $2
		ORDER BY position_y ASC, position_x ASC`,
		orgID, dashboardID,
	)
	if err != nil {
		return nil, fmt.Errorf("list widgets: %w", err)
	}
	defer rows.Close()

	var out []Widget
	for rows.Next() {
		w, err := scanWidget(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *w)
	}
	return out, rows.Err()
}

func (r *Repo) CreateWidget(ctx context.Context, orgID, dashboardID uuid.UUID, input CreateWidgetInput) (*Widget, error) {
	qcJSON, err := json.Marshal(input.QueryConfig)
	if err != nil {
		return nil, fmt.Errorf("marshal query_config: %w", err)
	}
	vcJSON, err := json.Marshal(input.VizConfig)
	if err != nil {
		return nil, fmt.Errorf("marshal viz_config: %w", err)
	}

	width := input.Width
	if width == 0 {
		width = 4
	}
	height := input.Height
	if height == 0 {
		height = 2
	}

	row := r.db.QueryRow(ctx, `
		INSERT INTO dashboard_widgets
		  (organisation_id, dashboard_id, title, widget_type, query_config, viz_config,
		   position_x, position_y, width, height)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, organisation_id, dashboard_id, title, widget_type,
		          query_config, viz_config, position_x, position_y, width, height,
		          created_at, updated_at`,
		orgID, dashboardID, input.Title, input.WidgetType, qcJSON, vcJSON,
		input.PositionX, input.PositionY, width, height,
	)
	return scanWidgetRow(row)
}

func (r *Repo) UpdateWidget(ctx context.Context, orgID, dashboardID, widgetID uuid.UUID, input UpdateWidgetInput) (*Widget, error) {
	qcJSON, err := json.Marshal(input.QueryConfig)
	if err != nil {
		return nil, fmt.Errorf("marshal query_config: %w", err)
	}
	vcJSON, err := json.Marshal(input.VizConfig)
	if err != nil {
		return nil, fmt.Errorf("marshal viz_config: %w", err)
	}

	row := r.db.QueryRow(ctx, `
		UPDATE dashboard_widgets
		SET title = $4, widget_type = $5, query_config = $6, viz_config = $7,
		    position_x = $8, position_y = $9, width = $10, height = $11,
		    updated_at = NOW()
		WHERE organisation_id = $1 AND dashboard_id = $2 AND id = $3
		RETURNING id, organisation_id, dashboard_id, title, widget_type,
		          query_config, viz_config, position_x, position_y, width, height,
		          created_at, updated_at`,
		orgID, dashboardID, widgetID,
		input.Title, input.WidgetType, qcJSON, vcJSON,
		input.PositionX, input.PositionY, input.Width, input.Height,
	)
	w, err := scanWidgetRow(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.New(apperr.CodeNotFound, "widget not found")
		}
		return nil, err
	}
	return w, nil
}

func (r *Repo) DeleteWidget(ctx context.Context, orgID, dashboardID, widgetID uuid.UUID) error {
	cmd, err := r.db.Exec(ctx, `
		DELETE FROM dashboard_widgets
		WHERE organisation_id = $1 AND dashboard_id = $2 AND id = $3`,
		orgID, dashboardID, widgetID,
	)
	if err != nil {
		return fmt.Errorf("delete widget: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return apperr.New(apperr.CodeNotFound, "widget not found")
	}
	return nil
}

// ── Query execution ───────────────────────────────────────────────────────────

func (r *Repo) RunQuery(ctx context.Context, sql string, args []any) ([]map[string]any, error) {
	rows, err := r.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, fmt.Errorf("run query: %w", err)
	}
	defer rows.Close()

	descs := rows.FieldDescriptions()
	var out []map[string]any
	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}
		row := make(map[string]any, len(descs))
		for i, d := range descs {
			row[string(d.Name)] = vals[i]
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

// ── Custom field defs ─────────────────────────────────────────────────────────

func (r *Repo) ListActiveFieldDefs(ctx context.Context, orgID uuid.UUID) ([]FieldDef, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, name, field_type
		FROM task_field_definitions
		WHERE organisation_id = $1 AND is_active = TRUE
		ORDER BY sort_order ASC`,
		orgID,
	)
	if err != nil {
		return nil, fmt.Errorf("list field defs: %w", err)
	}
	defer rows.Close()

	var out []FieldDef
	for rows.Next() {
		var fd FieldDef
		if err := rows.Scan(&fd.ID, &fd.Name, &fd.FieldType); err != nil {
			return nil, fmt.Errorf("scan field def: %w", err)
		}
		out = append(out, fd)
	}
	return out, rows.Err()
}

// ── Scan helpers ──────────────────────────────────────────────────────────────

func scanWidget(rows pgx.Rows) (*Widget, error) {
	var w Widget
	var qcRaw, vcRaw []byte
	if err := rows.Scan(
		&w.ID, &w.OrganisationID, &w.DashboardID, &w.Title, &w.WidgetType,
		&qcRaw, &vcRaw,
		&w.PositionX, &w.PositionY, &w.Width, &w.Height,
		&w.CreatedAt, &w.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("scan widget: %w", err)
	}
	if err := json.Unmarshal(qcRaw, &w.QueryConfig); err != nil {
		return nil, fmt.Errorf("unmarshal query_config: %w", err)
	}
	if err := json.Unmarshal(vcRaw, &w.VizConfig); err != nil {
		return nil, fmt.Errorf("unmarshal viz_config: %w", err)
	}
	return &w, nil
}

func scanWidgetRow(row pgx.Row) (*Widget, error) {
	var w Widget
	var qcRaw, vcRaw []byte
	if err := row.Scan(
		&w.ID, &w.OrganisationID, &w.DashboardID, &w.Title, &w.WidgetType,
		&qcRaw, &vcRaw,
		&w.PositionX, &w.PositionY, &w.Width, &w.Height,
		&w.CreatedAt, &w.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("scan widget row: %w", err)
	}
	if err := json.Unmarshal(qcRaw, &w.QueryConfig); err != nil {
		return nil, fmt.Errorf("unmarshal query_config: %w", err)
	}
	if err := json.Unmarshal(vcRaw, &w.VizConfig); err != nil {
		return nil, fmt.Errorf("unmarshal viz_config: %w", err)
	}
	return &w, nil
}

-- 000061_create_dashboards.up.sql
-- Analytics dashboard builder — stores dashboard and widget definitions.
-- query_config JSONB holds the structured query that the engine translates to SQL.

CREATE TABLE dashboards (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    name             VARCHAR(100) NOT NULL,
    is_default       BOOLEAN NOT NULL DEFAULT FALSE,
    created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dashboards_org ON dashboards(organisation_id);

CREATE TRIGGER set_dashboards_updated_at
    BEFORE UPDATE ON dashboards
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE dashboard_widgets (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    dashboard_id     UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    title            VARCHAR(200) NOT NULL,
    widget_type      VARCHAR(20) NOT NULL CHECK (widget_type IN ('kpi', 'table', 'bar', 'line')),
    query_config     JSONB NOT NULL,
    viz_config       JSONB NOT NULL DEFAULT '{}',
    position_x       INT NOT NULL DEFAULT 0,
    position_y       INT NOT NULL DEFAULT 0,
    width            INT NOT NULL DEFAULT 4,
    height           INT NOT NULL DEFAULT 2,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dashboard_widgets_org      ON dashboard_widgets(organisation_id);
CREATE INDEX idx_dashboard_widgets_dash     ON dashboard_widgets(dashboard_id);

CREATE TRIGGER set_dashboard_widgets_updated_at
    BEFORE UPDATE ON dashboard_widgets
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

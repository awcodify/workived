-- Revert widget_type check constraint to original set
ALTER TABLE dashboard_widgets
  DROP CONSTRAINT dashboard_widgets_widget_type_check;

ALTER TABLE dashboard_widgets
  ADD CONSTRAINT dashboard_widgets_widget_type_check
    CHECK (widget_type IN ('kpi', 'table', 'bar', 'line'));

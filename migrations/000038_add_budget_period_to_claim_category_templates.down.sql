ALTER TABLE claim_category_templates
  DROP CONSTRAINT chk_category_tmpl_budget_period,
  DROP COLUMN budget_period;

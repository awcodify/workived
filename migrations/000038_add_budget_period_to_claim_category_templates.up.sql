-- Add budget_period to claim_category_templates to match claim_categories
ALTER TABLE claim_category_templates
  ADD COLUMN budget_period VARCHAR(10) NOT NULL DEFAULT 'monthly'
  CONSTRAINT chk_category_tmpl_budget_period CHECK (budget_period IN ('monthly', 'yearly'));

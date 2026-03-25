ALTER TABLE claim_categories
  ADD COLUMN budget_period VARCHAR(10) NOT NULL DEFAULT 'monthly'
  CONSTRAINT chk_budget_period CHECK (budget_period IN ('monthly', 'yearly'));

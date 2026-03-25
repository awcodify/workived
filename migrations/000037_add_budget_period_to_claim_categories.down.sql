ALTER TABLE claim_categories
  DROP CONSTRAINT chk_budget_period,
  DROP COLUMN budget_period;

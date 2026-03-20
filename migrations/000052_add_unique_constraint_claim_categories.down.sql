-- 000052_add_unique_constraint_claim_categories.down.sql
ALTER TABLE claim_categories 
DROP CONSTRAINT IF EXISTS unique_category_per_org;

-- 000052_add_unique_constraint_claim_categories.up.sql
ALTER TABLE claim_categories 
ADD CONSTRAINT unique_category_per_org UNIQUE (organisation_id, name);

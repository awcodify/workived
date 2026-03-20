-- 000054_claim_category_currency_not_null.down.sql
-- Allow currency_code to be NULL again
ALTER TABLE claim_categories
ALTER COLUMN currency_code DROP NOT NULL;

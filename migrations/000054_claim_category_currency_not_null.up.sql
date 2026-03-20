-- 000054_claim_category_currency_not_null.up.sql
-- Make currency_code NOT NULL in claim_categories
ALTER TABLE claim_categories
ALTER COLUMN currency_code SET NOT NULL;

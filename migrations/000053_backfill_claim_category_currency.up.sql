-- 000053_backfill_claim_category_currency.up.sql
-- Backfill NULL currency_code in claim_categories with org's currency
UPDATE claim_categories cc
SET currency_code = o.currency_code,
    updated_at = NOW()
FROM organisations o
WHERE cc.organisation_id = o.id
  AND cc.currency_code IS NULL;

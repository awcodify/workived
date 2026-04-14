-- 000058_seed_claim_category_templates.down.sql
DELETE FROM claim_category_templates
WHERE country_code IN ('ID', 'AE')
  AND name IN (
    'Transport',
    'Meal Allowance',
    'Medical',
    'Communication',
    'Training & Education',
    'Entertainment'
  );

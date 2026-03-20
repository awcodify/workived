-- 000051_seed_claim_category_templates_uae.up.sql
INSERT INTO claim_category_templates (country_code, name, description, monthly_limit, currency_code, requires_receipt, sort_order)
VALUES
  ('AE', 'Travel', 'Transportation and travel expenses for business purposes', 2000, 'AED', TRUE, 1),
  ('AE', 'Meals & Entertainment', 'Business meals and client entertainment', 1000, 'AED', TRUE, 2),
  ('AE', 'Mobile & Internet', 'Phone bills and data plans for work', 500, 'AED', TRUE, 3),
  ('AE', 'Office Equipment', 'Computer accessories, stationery, and office supplies', 1500, 'AED', TRUE, 4),
  ('AE', 'Training & Development', 'Courses, certifications, and professional development', NULL, NULL, TRUE, 5),
  ('AE', 'Medical Reimbursement', 'Medical expenses not covered by insurance', 3000, 'AED', TRUE, 6),
  ('AE', 'Parking & Salik', 'Parking fees and Salik toll gates', 500, 'AED', TRUE, 7),
  ('AE', 'Other', 'Miscellaneous business expenses', NULL, NULL, TRUE, 8);

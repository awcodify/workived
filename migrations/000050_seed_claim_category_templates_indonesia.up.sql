-- 000050_seed_claim_category_templates_indonesia.up.sql
INSERT INTO claim_category_templates (country_code, name, description, monthly_limit, currency_code, requires_receipt, sort_order)
VALUES
  ('ID', 'Travel', 'Transportation and travel expenses for business purposes', 1000000, 'IDR', TRUE, 1),
  ('ID', 'Meals & Entertainment', 'Business meals and client entertainment', 500000, 'IDR', TRUE, 2),
  ('ID', 'Mobile & Internet', 'Phone bills and data plans for work', 300000, 'IDR', TRUE, 3),
  ('ID', 'Office Equipment', 'Computer accessories, stationery, and office supplies', 500000, 'IDR', TRUE, 4),
  ('ID', 'Training & Development', 'Courses, certifications, and professional development', NULL, NULL, TRUE, 5),
  ('ID', 'Medical Reimbursement', 'Medical expenses not covered by BPJS', 2000000, 'IDR', TRUE, 6),
  ('ID', 'Parking & Toll', 'Parking fees and toll roads', 200000, 'IDR', TRUE, 7),
  ('ID', 'Other', 'Miscellaneous business expenses', NULL, NULL, TRUE, 8);

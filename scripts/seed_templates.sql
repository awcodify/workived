-- Seed policy templates for Workived
-- Leave policy templates and claim category templates for Indonesia and UAE
-- Run after migrations

-- Leave Policy Templates - Indonesia
INSERT INTO leave_policy_templates (country_code, name, description, entitled_days_per_year, is_carry_over_allowed, max_carry_over_days, is_accrued, requires_approval, sort_order)
VALUES
  ('ID', 'Annual Leave', 'Minimum 12 days per year as per Indonesian labor law (UU No. 13/2003)', 12, TRUE, 6, TRUE, TRUE, 1),
  ('ID', 'Sick Leave', 'Unlimited sick leave with doctor''s note. Company pays first 3 months, then BPJS Kesehatan', 999, FALSE, NULL, FALSE, FALSE, 2),
  ('ID', 'Maternity Leave', '90 days (18 weeks) as per UU Ketenagakerjaan. Can be split before/after delivery', 90, FALSE, NULL, FALSE, TRUE, 3),
  ('ID', 'Paternity Leave', '2 days for childbirth or adoption', 2, FALSE, NULL, FALSE, TRUE, 4),
  ('ID', 'Compassionate Leave', '2 days for immediate family bereavement', 2, FALSE, NULL, FALSE, TRUE, 5),
  ('ID', 'Hajj Leave', 'Special leave for pilgrimage (10 days). Granted once per employment period with manager approval', 10, FALSE, NULL, FALSE, TRUE, 6)
ON CONFLICT (country_code, name) DO NOTHING;

-- Leave Policy Templates - UAE
INSERT INTO leave_policy_templates (country_code, name, description, entitled_days_per_year, is_carry_over_allowed, max_carry_over_days, is_accrued, requires_approval, sort_order)
VALUES
  ('AE', 'Annual Leave', 'Minimum 30 days per year as per UAE Labor Law. Accrues monthly after completing 1 year of service', 30, TRUE, 30, TRUE, TRUE, 1),
  ('AE', 'Sick Leave', '90 days sick leave per year. Full pay first 15 days, half pay next 30 days, unpaid thereafter. Medical certificate required after 2 days', 90, FALSE, NULL, FALSE, FALSE, 2),
  ('AE', 'Maternity Leave', '60 days maternity leave. Full pay first 45 days, half pay remaining 15 days. Must have worked 1 year. Can be extended 45 days unpaid', 60, FALSE, NULL, FALSE, TRUE, 3),
  ('AE', 'Paternity Leave', '5 days paternity leave within 6 months of childbirth', 5, FALSE, NULL, FALSE, TRUE, 4),
  ('AE', 'Compassionate Leave', '5 days bereavement leave for immediate family members', 5, FALSE, NULL, FALSE, TRUE, 5),
  ('AE', 'Hajj/Umrah Leave', '30 days special leave for Hajj (once during employment). Subject to manager approval and operational requirements', 30, FALSE, NULL, FALSE, TRUE, 6)
ON CONFLICT (country_code, name) DO NOTHING;

-- Claim Category Templates - Indonesia
INSERT INTO claim_category_templates (country_code, name, description, monthly_limit, currency_code, requires_receipt, sort_order)
VALUES
  ('ID', 'Travel', 'Transportation and travel expenses for business purposes', 1000000, 'IDR', TRUE, 1),
  ('ID', 'Meals & Entertainment', 'Business meals and client entertainment', 500000, 'IDR', TRUE, 2),
  ('ID', 'Mobile & Internet', 'Phone bills and data plans for work', 300000, 'IDR', TRUE, 3),
  ('ID', 'Office Equipment', 'Computer accessories, stationery, and office supplies', 500000, 'IDR', TRUE, 4),
  ('ID', 'Training & Development', 'Courses, certifications, and professional development', NULL, 'IDR', TRUE, 5),
  ('ID', 'Medical Reimbursement', 'Medical expenses not covered by BPJS', 2000000, 'IDR', TRUE, 6),
  ('ID', 'Parking & Toll', 'Parking fees and toll roads', 200000, 'IDR', TRUE, 7),
  ('ID', 'Other', 'Miscellaneous business expenses', NULL, 'IDR', TRUE, 8)
ON CONFLICT (country_code, name) DO NOTHING;

-- Claim Category Templates - UAE
INSERT INTO claim_category_templates (country_code, name, description, monthly_limit, currency_code, requires_receipt, sort_order)
VALUES
  ('AE', 'Travel', 'Transportation and travel expenses for business purposes', 2000, 'AED', TRUE, 1),
  ('AE', 'Meals & Entertainment', 'Business meals and client entertainment', 1000, 'AED', TRUE, 2),
  ('AE', 'Mobile & Internet', 'Phone bills and data plans for work', 500, 'AED', TRUE, 3),
  ('AE', 'Office Equipment', 'Computer accessories, stationery, and office supplies', 1500, 'AED', TRUE, 4),
  ('AE', 'Training & Development', 'Courses, certifications, and professional development', NULL, 'AED', TRUE, 5),
  ('AE', 'Medical Reimbursement', 'Medical expenses not covered by insurance', 3000, 'AED', TRUE, 6),
  ('AE', 'Parking & Salik', 'Parking fees and Salik toll gates', 500, 'AED', TRUE, 7),
  ('AE', 'Other', 'Miscellaneous business expenses', NULL, 'AED', TRUE, 8)
ON CONFLICT (country_code, name) DO NOTHING;

SELECT 
    COUNT(*) FILTER (WHERE country_code = 'ID') || ' Indonesia leave templates' as id_leave,
    COUNT(*) FILTER (WHERE country_code = 'AE') || ' UAE leave templates' as ae_leave,
    COUNT(*) || ' total leave templates' as total_leave
FROM leave_policy_templates;

SELECT 
    COUNT(*) FILTER (WHERE country_code = 'ID') || ' Indonesia claim templates' as id_claim,
    COUNT(*) FILTER (WHERE country_code = 'AE') || ' UAE claim templates' as ae_claim,
    COUNT(*) || ' total claim templates' as total_claim
FROM claim_category_templates;

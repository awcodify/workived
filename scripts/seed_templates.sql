-- Seed policy templates for Workived
-- Work schedule templates, leave policy templates and claim category templates for Indonesia and UAE
-- Run after migrations

-- Work Schedule Templates - Indonesia
INSERT INTO work_schedule_templates (country_code, name, description, work_days, start_time, end_time, sort_order)
VALUES
  ('ID', 'Standard Office Hours', 'Monday to Friday, 8:00 AM - 5:00 PM. Typical for office-based work.', ARRAY[1,2,3,4,5], '08:00:00', '17:00:00', 1),
  ('ID', 'Retail/Service Hours', 'Monday to Saturday, 9:00 AM - 6:00 PM. Common for retail and service industries.', ARRAY[1,2,3,4,5,6], '09:00:00', '18:00:00', 2),
  ('ID', 'Morning Shift', 'Monday to Sunday, 7:00 AM - 3:00 PM. Common for manufacturing and shift work.', ARRAY[1,2,3,4,5,6,7], '07:00:00', '15:00:00', 3),
  ('ID', 'Afternoon Shift', 'Monday to Sunday, 3:00 PM - 11:00 PM. Second shift for 24-hour operations.', ARRAY[1,2,3,4,5,6,7], '15:00:00', '23:00:00', 4)
ON CONFLICT (country_code, name) DO NOTHING;

-- Work Schedule Templates - UAE
INSERT INTO work_schedule_templates (country_code, name, description, work_days, start_time, end_time, sort_order)
VALUES
  ('AE', 'UAE Standard Week', 'Sunday to Thursday, 9:00 AM - 6:00 PM. Standard UAE working week as per labor law.', ARRAY[7,1,2,3,4], '09:00:00', '18:00:00', 1),
  ('AE', 'UAE Extended Hours', 'Sunday to Thursday, 8:00 AM - 5:00 PM. Alternative schedule with earlier start.', ARRAY[7,1,2,3,4], '08:00:00', '17:00:00', 2),
  ('AE', 'UAE Retail Schedule', 'Sunday to Thursday, 10:00 AM - 7:00 PM. Common for retail and customer-facing businesses.', ARRAY[7,1,2,3,4,5,6], '10:00:00', '19:00:00', 3)
ON CONFLICT (country_code, name) DO NOTHING;

-- Leave Policy Templates - Indonesia
INSERT INTO leave_policy_templates (country_code, name, description, entitled_days_per_year, is_carry_over_allowed, max_carry_over_days, is_accrued, requires_approval, gender_eligibility, sort_order)
VALUES
  ('ID', 'Annual Leave', 'Minimum 12 days per year as per Indonesian labor law (UU No. 13/2003)', 12, TRUE, 6, TRUE, TRUE, 'all', 1),
  ('ID', 'Sick Leave', 'Unlimited sick leave with doctor''s note. Company pays first 3 months, then BPJS Kesehatan', 999, FALSE, NULL, FALSE, FALSE, 'all', 2),
  ('ID', 'Maternity Leave', '90 days (18 weeks) as per UU Ketenagakerjaan. Can be split before/after delivery', 90, FALSE, NULL, FALSE, TRUE, 'female', 3),
  ('ID', 'Paternity Leave', '2 days for childbirth or adoption', 2, FALSE, NULL, FALSE, TRUE, 'male', 4),
  ('ID', 'Compassionate Leave', '2 days for immediate family bereavement', 2, FALSE, NULL, FALSE, TRUE, 'all', 5),
  ('ID', 'Hajj Leave', 'Special leave for pilgrimage (10 days). Granted once per employment period with manager approval', 10, FALSE, NULL, FALSE, TRUE, 'all', 6)
ON CONFLICT (country_code, name) DO NOTHING;

-- Leave Policy Templates - UAE
INSERT INTO leave_policy_templates (country_code, name, description, entitled_days_per_year, is_carry_over_allowed, max_carry_over_days, is_accrued, requires_approval, gender_eligibility, sort_order)
VALUES
  ('AE', 'Annual Leave', 'Minimum 30 days per year as per UAE Labor Law. Accrues monthly after completing 1 year of service', 30, TRUE, 30, TRUE, TRUE, 'all', 1),
  ('AE', 'Sick Leave', '90 days sick leave per year. Full pay first 15 days, half pay next 30 days, unpaid thereafter. Medical certificate required after 2 days', 90, FALSE, NULL, FALSE, FALSE, 'all', 2),
  ('AE', 'Maternity Leave', '60 days maternity leave. Full pay first 45 days, half pay remaining 15 days. Must have worked 1 year. Can be extended 45 days unpaid', 60, FALSE, NULL, FALSE, TRUE, 'female', 3),
  ('AE', 'Paternity Leave', '5 days paternity leave within 6 months of childbirth', 5, FALSE, NULL, FALSE, TRUE, 'male', 4),
  ('AE', 'Compassionate Leave', '5 days bereavement leave for immediate family members', 5, FALSE, NULL, FALSE, TRUE, 'all', 5),
  ('AE', 'Hajj/Umrah Leave', '30 days special leave for Hajj (once during employment). Subject to manager approval and operational requirements', 30, FALSE, NULL, FALSE, TRUE, 'all', 6)
ON CONFLICT (country_code, name) DO NOTHING;

-- Claim Category Templates - Indonesia
INSERT INTO claim_category_templates (country_code, name, description, monthly_limit, currency_code, requires_receipt, sort_order)
VALUES
  ('ID', 'Travel', 'Transportation and travel expenses for business purposes', 1000000, 'IDR', TRUE, 1),
  ('ID', 'Meals & Entertainment', 'Business meals and client entertainment', 500000, 'IDR', TRUE, 2),
  ('ID', 'Mobile & Internet', 'Phone bills and data plans for work', 300000, 'IDR', TRUE, 3),
  ('ID', 'Office Equipment', 'Computer accessories, stationery, and office supplies', 500000, 'IDR', TRUE, 4),
  ('ID', 'Training & Development', 'Courses, certifications, and professional development', NULL, NULL, TRUE, 5),
  ('ID', 'Medical Reimbursement', 'Medical expenses not covered by BPJS', 2000000, 'IDR', TRUE, 6),
  ('ID', 'Parking & Toll', 'Parking fees and toll roads', 200000, 'IDR', TRUE, 7),
  ('ID', 'Other', 'Miscellaneous business expenses', NULL, NULL, TRUE, 8)
ON CONFLICT (country_code, name) DO NOTHING;

-- Claim Category Templates - UAE
INSERT INTO claim_category_templates (country_code, name, description, monthly_limit, currency_code, requires_receipt, sort_order)
VALUES
  ('AE', 'Travel', 'Transportation and travel expenses for business purposes', 2000, 'AED', TRUE, 1),
  ('AE', 'Meals & Entertainment', 'Business meals and client entertainment', 1000, 'AED', TRUE, 2),
  ('AE', 'Mobile & Internet', 'Phone bills and data plans for work', 500, 'AED', TRUE, 3),
  ('AE', 'Office Equipment', 'Computer accessories, stationery, and office supplies', 1500, 'AED', TRUE, 4),
  ('AE', 'Training & Development', 'Courses, certifications, and professional development', NULL, NULL, TRUE, 5),
  ('AE', 'Medical Reimbursement', 'Medical expenses not covered by insurance', 3000, 'AED', TRUE, 6),
  ('AE', 'Parking & Salik', 'Parking fees and Salik toll gates', 500, 'AED', TRUE, 7),
  ('AE', 'Other', 'Miscellaneous business expenses', NULL, NULL, TRUE, 8)
ON CONFLICT (country_code, name) DO NOTHING;

SELECT 
    COUNT(*) FILTER (WHERE country_code = 'ID') || ' Indonesia work schedule templates' as id_schedules,
    COUNT(*) FILTER (WHERE country_code = 'AE') || ' UAE work schedule templates' as ae_schedules,
    COUNT(*) || ' total work schedule templates' as total_schedules
FROM work_schedule_templates;

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

-- Seed policy templates for Workived
-- Work schedule templates, leave policy templates and claim category templates for Indonesia and UAE
-- Based on: UU 13/2003 + UU Cipta Kerja (Indonesia), Federal Decree-Law No. 33/2021 (UAE)
-- Run after migrations

-- ════════════════════════════════════════════════════════════════════════════════
-- WORK SCHEDULE TEMPLATES
-- ════════════════════════════════════════════════════════════════════════════════

-- Indonesia (40hr/week per UU 13/2003 Pasal 77)
INSERT INTO work_schedule_templates (country_code, name, description, work_days, start_time, end_time, sort_order)
VALUES
  ('ID', 'Standard Office Hours', 'Monday to Friday, 8:00 AM - 5:00 PM (40hr/week). Standard for office-based work per UU 13/2003.', ARRAY[1,2,3,4,5], '08:00:00', '17:00:00', 1),
  ('ID', 'Retail/Service Hours', 'Monday to Saturday, 9:00 AM - 5:00 PM (40hr/week). Common for retail and service industries.', ARRAY[1,2,3,4,5,6], '09:00:00', '17:00:00', 2),
  ('ID', 'Morning Shift', 'Monday to Friday, 7:00 AM - 4:00 PM. Early start for manufacturing and logistics.', ARRAY[1,2,3,4,5], '07:00:00', '16:00:00', 3),
  ('ID', 'Startup Flexible', 'Monday to Friday, 9:00 AM - 6:00 PM. Common for tech startups.', ARRAY[1,2,3,4,5], '09:00:00', '18:00:00', 4)
ON CONFLICT (country_code, name) DO UPDATE SET
  description = EXCLUDED.description,
  work_days = EXCLUDED.work_days,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  sort_order = EXCLUDED.sort_order;

-- UAE (48hr/week per Federal Decree-Law No. 33/2021)
INSERT INTO work_schedule_templates (country_code, name, description, work_days, start_time, end_time, sort_order)
VALUES
  ('AE', 'UAE Standard Week', 'Sunday to Thursday, 9:00 AM - 6:00 PM. Standard UAE working week per labor law.', ARRAY[7,1,2,3,4], '09:00:00', '18:00:00', 1),
  ('AE', 'UAE Early Start', 'Sunday to Thursday, 8:00 AM - 5:00 PM. Common for construction and logistics.', ARRAY[7,1,2,3,4], '08:00:00', '17:00:00', 2),
  ('AE', 'UAE Startup Flexible', 'Sunday to Thursday, 10:00 AM - 7:00 PM. Common for tech startups and creative agencies.', ARRAY[7,1,2,3,4], '10:00:00', '19:00:00', 3),
  ('AE', 'UAE Retail Schedule', 'Sunday to Friday, 10:00 AM - 7:00 PM. For retail and customer-facing businesses.', ARRAY[7,1,2,3,4,5], '10:00:00', '19:00:00', 4)
ON CONFLICT (country_code, name) DO UPDATE SET
  description = EXCLUDED.description,
  work_days = EXCLUDED.work_days,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  sort_order = EXCLUDED.sort_order;

-- Clean up old templates that were renamed
DELETE FROM work_schedule_templates WHERE country_code = 'ID' AND name IN ('Afternoon Shift');
DELETE FROM work_schedule_templates WHERE country_code = 'AE' AND name IN ('UAE Extended Hours');

-- ════════════════════════════════════════════════════════════════════════════════
-- LEAVE POLICY TEMPLATES
-- ════════════════════════════════════════════════════════════════════════════════

-- Indonesia — UU 13/2003, UU Cipta Kerja, PP 35/2021
INSERT INTO leave_policy_templates (country_code, name, description, entitled_days_per_year, is_carry_over_allowed, max_carry_over_days, is_accrued, requires_approval, gender_eligibility, is_unlimited, sort_order)
VALUES
  ('ID', 'Annual Leave', 'Cuti Tahunan — 12 days/year after 12 months service (Pasal 79). Carry over up to 6 days.', 12, TRUE, 6, TRUE, TRUE, 'all', FALSE, 1),
  ('ID', 'Sick Leave', 'Cuti Sakit — Unlimited with doctor''s note (Pasal 93). Full pay months 1-4, 75% months 5-8, 50% months 9-12.', 365, FALSE, NULL, FALSE, FALSE, 'all', TRUE, 2),
  ('ID', 'Maternity Leave', 'Cuti Melahirkan — 90 calendar days, 1.5 months before + 1.5 months after delivery. Full pay (Pasal 82).', 90, FALSE, NULL, FALSE, TRUE, 'female', FALSE, 3),
  ('ID', 'Paternity Leave', 'Cuti Ayah — 2 days for childbirth (Pasal 93(2)c). Many startups offer 5-10 days.', 2, FALSE, NULL, FALSE, TRUE, 'male', FALSE, 4),
  ('ID', 'Marriage Leave', 'Cuti Menikah — 3 days for own marriage (Pasal 93(2)b). Mandatory.', 3, FALSE, NULL, FALSE, TRUE, 'all', FALSE, 5),
  ('ID', 'Compassionate Leave', 'Cuti Duka — 2 days for death of spouse, parent, parent-in-law, or child (Pasal 93(2)d).', 2, FALSE, NULL, FALSE, TRUE, 'all', FALSE, 6),
  ('ID', 'Menstrual Leave', 'Cuti Haid — 2 days/month for female employees (Pasal 81). Still active law. Self-reported.', 24, FALSE, NULL, FALSE, FALSE, 'female', FALSE, 7),
  ('ID', 'Miscarriage Leave', 'Cuti Keguguran — 45 calendar days (Pasal 82(2)). Full pay.', 45, FALSE, NULL, FALSE, TRUE, 'female', FALSE, 8),
  ('ID', 'Child Circumcision/Baptism', 'Khitanan/Pembaptisan Anak — 2 days (Pasal 93(2)b). Mandatory.', 2, FALSE, NULL, FALSE, TRUE, 'all', FALSE, 9),
  ('ID', 'Hajj Leave', 'Cuti Haji — Up to 40 calendar days for pilgrimage. Once per employment period (Pasal 93(2)f). Full pay.', 40, FALSE, NULL, FALSE, TRUE, 'all', FALSE, 10)
ON CONFLICT (country_code, name) DO UPDATE SET
  description = EXCLUDED.description,
  entitled_days_per_year = EXCLUDED.entitled_days_per_year,
  is_carry_over_allowed = EXCLUDED.is_carry_over_allowed,
  max_carry_over_days = EXCLUDED.max_carry_over_days,
  is_accrued = EXCLUDED.is_accrued,
  requires_approval = EXCLUDED.requires_approval,
  gender_eligibility = EXCLUDED.gender_eligibility,
  is_unlimited = EXCLUDED.is_unlimited,
  sort_order = EXCLUDED.sort_order;

-- UAE — Federal Decree-Law No. 33/2021
INSERT INTO leave_policy_templates (country_code, name, description, entitled_days_per_year, is_carry_over_allowed, max_carry_over_days, is_accrued, requires_approval, gender_eligibility, is_unlimited, sort_order)
VALUES
  ('AE', 'Annual Leave', '30 calendar days/year after 1 year service; 2 days/month before that (Art. 29-30). Pay includes basic + housing allowance.', 30, TRUE, 30, TRUE, TRUE, 'all', FALSE, 1),
  ('AE', 'Sick Leave', '90 days/year: 15 days full pay, 30 days half pay, 45 days unpaid (Art. 31). Medical certificate required. Begins after probation.', 90, FALSE, NULL, FALSE, FALSE, 'all', FALSE, 2),
  ('AE', 'Maternity Leave', '60 days: 45 days full pay + 15 days half pay (Art. 30). Can extend 45 days unpaid with medical cert. No minimum service required.', 60, FALSE, NULL, FALSE, TRUE, 'female', FALSE, 3),
  ('AE', 'Paternity Leave', '5 working days within 6 months of birth (Art. 32(6)). New in 2022 law. Full pay.', 5, FALSE, NULL, FALSE, TRUE, 'male', FALSE, 4),
  ('AE', 'Bereavement Leave (Spouse)', '5 working days full pay for death of spouse (Art. 32(4)).', 5, FALSE, NULL, FALSE, TRUE, 'all', FALSE, 5),
  ('AE', 'Bereavement Leave (Family)', '3 working days full pay for parent, child, sibling, grandparent (Art. 32(5)).', 3, FALSE, NULL, FALSE, TRUE, 'all', FALSE, 6),
  ('AE', 'Hajj Leave', '30 calendar days unpaid. Once per employment period (Art. 32(3)).', 30, FALSE, NULL, FALSE, TRUE, 'all', FALSE, 7),
  ('AE', 'Study Leave', '10 working days unpaid/year. Requires 2+ years tenure and enrollment at UAE-accredited institution (Art. 32(2)).', 10, FALSE, NULL, FALSE, TRUE, 'all', FALSE, 8)
ON CONFLICT (country_code, name) DO UPDATE SET
  description = EXCLUDED.description,
  entitled_days_per_year = EXCLUDED.entitled_days_per_year,
  is_carry_over_allowed = EXCLUDED.is_carry_over_allowed,
  max_carry_over_days = EXCLUDED.max_carry_over_days,
  is_accrued = EXCLUDED.is_accrued,
  requires_approval = EXCLUDED.requires_approval,
  gender_eligibility = EXCLUDED.gender_eligibility,
  is_unlimited = EXCLUDED.is_unlimited,
  sort_order = EXCLUDED.sort_order;

-- Clean up old UAE templates that were renamed/split
DELETE FROM leave_policy_templates WHERE country_code = 'AE' AND name IN ('Compassionate Leave', 'Hajj/Umrah Leave');

-- ════════════════════════════════════════════════════════════════════════════════
-- CLAIM CATEGORY TEMPLATES
-- ════════════════════════════════════════════════════════════════════════════════

-- Indonesia — amounts in IDR (no subunit)
INSERT INTO claim_category_templates (country_code, name, description, monthly_limit, currency_code, requires_receipt, budget_period, sort_order)
VALUES
  ('ID', 'Transport', 'Tunjangan Transportasi — commute, fuel, and travel expenses', 750000, 'IDR', TRUE, 'monthly', 1),
  ('ID', 'Meals', 'Tunjangan Makan — daily meal allowance for working days', 800000, 'IDR', FALSE, 'monthly', 2),
  ('ID', 'Mobile & Internet', 'Tunjangan Komunikasi — phone and internet for work', 150000, 'IDR', TRUE, 'monthly', 3),
  ('ID', 'Medical', 'Klaim Kesehatan — expenses not covered by BPJS (outpatient, dental, optical)', 5000000, 'IDR', TRUE, 'yearly', 4),
  ('ID', 'Training & Development', 'Tunjangan Pendidikan — courses, certifications, books', 2000000, 'IDR', TRUE, 'yearly', 5),
  ('ID', 'Parking & Toll', 'Uang Parkir — parking fees and toll roads', 150000, 'IDR', TRUE, 'monthly', 6),
  ('ID', 'Office Equipment', 'Perlengkapan Kerja — accessories, stationery, supplies', 500000, 'IDR', TRUE, 'monthly', 7),
  ('ID', 'Other', 'Miscellaneous business expenses', NULL, NULL, TRUE, 'monthly', 8)
ON CONFLICT (country_code, name) DO UPDATE SET
  description = EXCLUDED.description,
  monthly_limit = EXCLUDED.monthly_limit,
  currency_code = EXCLUDED.currency_code,
  requires_receipt = EXCLUDED.requires_receipt,
  budget_period = EXCLUDED.budget_period,
  sort_order = EXCLUDED.sort_order;

-- Clean up renamed INA templates
DELETE FROM claim_category_templates WHERE country_code = 'ID' AND name IN ('Travel', 'Meals & Entertainment', 'Medical Reimbursement');

-- UAE — amounts in AED (100 subunits, stored as smallest unit)
INSERT INTO claim_category_templates (country_code, name, description, monthly_limit, currency_code, requires_receipt, budget_period, sort_order)
VALUES
  ('AE', 'Transport', 'Commute, fuel, and taxi expenses', 100000, 'AED', TRUE, 'monthly', 1),
  ('AE', 'Meals', 'Daily meal allowance and business meals', 50000, 'AED', FALSE, 'monthly', 2),
  ('AE', 'Mobile & Internet', 'Phone and data plan for work', 30000, 'AED', TRUE, 'monthly', 3),
  ('AE', 'Medical', 'Co-pays, dental, optical not covered by insurance', 500000, 'AED', TRUE, 'yearly', 4),
  ('AE', 'Training & Development', 'Courses, certifications, conferences', 500000, 'AED', TRUE, 'yearly', 5),
  ('AE', 'Parking & Salik', 'Parking fees and Salik toll gates', 50000, 'AED', TRUE, 'monthly', 6),
  ('AE', 'Office Equipment', 'Computer accessories, stationery, and office supplies', 150000, 'AED', TRUE, 'monthly', 7),
  ('AE', 'Annual Flight Ticket', 'Annual round-trip flight to home country (expat benefit)', 350000, 'AED', TRUE, 'yearly', 8),
  ('AE', 'Other', 'Miscellaneous business expenses', NULL, NULL, TRUE, 'monthly', 9)
ON CONFLICT (country_code, name) DO UPDATE SET
  description = EXCLUDED.description,
  monthly_limit = EXCLUDED.monthly_limit,
  currency_code = EXCLUDED.currency_code,
  requires_receipt = EXCLUDED.requires_receipt,
  budget_period = EXCLUDED.budget_period,
  sort_order = EXCLUDED.sort_order;

-- Clean up renamed UAE templates
DELETE FROM claim_category_templates WHERE country_code = 'AE' AND name IN ('Travel', 'Meals & Entertainment', 'Medical Reimbursement');

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ════════════════════════════════════════════════════════════════════════════════

SELECT
    COUNT(*) FILTER (WHERE country_code = 'ID') || ' Indonesia work schedule templates' as id_schedules,
    COUNT(*) FILTER (WHERE country_code = 'AE') || ' UAE work schedule templates' as ae_schedules
FROM work_schedule_templates;

SELECT
    COUNT(*) FILTER (WHERE country_code = 'ID') || ' Indonesia leave templates' as id_leave,
    COUNT(*) FILTER (WHERE country_code = 'AE') || ' UAE leave templates' as ae_leave
FROM leave_policy_templates;

SELECT
    COUNT(*) FILTER (WHERE country_code = 'ID') || ' Indonesia claim templates' as id_claim,
    COUNT(*) FILTER (WHERE country_code = 'AE') || ' UAE claim templates' as ae_claim
FROM claim_category_templates;

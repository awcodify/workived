-- 000044_seed_leave_policyemplates_indonesia.up.sql
INSERT INTO leave_policy_templates (country_code, name, description, entitled_days_per_year, is_carry_over_allowed, max_carry_over_days, is_accrued, requires_approval, sort_order)
VALUES
  ('ID', 'Annual Leave', 'Minimum 12 days per year as per Indonesian labor law (UU No. 13/2003)', 12, TRUE, 6, TRUE, TRUE, 1),
  ('ID', 'Sick Leave', 'Unlimited sick leave with doctor''s note. Company pays first 3 months, then BPJS Kesehatan', 999, FALSE, NULL, FALSE, FALSE, 2),
  ('ID', 'Maternity Leave', '90 days (18 weeks) as per UU Ketenagakerjaan. Can be split before/after delivery', 90, FALSE, NULL, FALSE, TRUE, 3),
  ('ID', 'Paternity Leave', '2 days for childbirth or adoption', 2, FALSE, NULL, FALSE, TRUE, 4),
  ('ID', 'Compassionate Leave', '2 days for immediate family bereavement', 2, FALSE, NULL, FALSE, TRUE, 5),
  ('ID', 'Hajj Leave', 'Special leave for pilgrimage (10 days). Granted once per employment period with manager approval', 10, FALSE, NULL, FALSE, TRUE, 6);

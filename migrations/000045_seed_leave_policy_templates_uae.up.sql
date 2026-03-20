-- 000045_seed_leave_policy_templates_uae.up.sql
INSERT INTO leave_policy_templates (country_code, name, description, entitled_days_per_year, is_carry_over_allowed, max_carry_over_days, is_accrued, requires_approval, sort_order)
VALUES
  ('AE', 'Annual Leave', 'Minimum 30 days per year as per UAE Labor Law. Accrues monthly after completing 1 year of service', 30, TRUE, 30, TRUE, TRUE, 1),
  ('AE', 'Sick Leave', '90 days sick leave per year. Full pay first 15 days, half pay next 30 days, unpaid thereafter. Medical certificate required after 2 days', 90, FALSE, NULL,  FALSE, FALSE, 2),
  ('AE', 'Maternity Leave', '60 days maternity leave. Full pay first 45 days, half pay remaining 15 days. Must have worked 1 year. Can be extended 45 days unpaid', 60, FALSE, NULL, FALSE, TRUE, 3),
  ('AE', 'Paternity Leave', '5 days paternity leave within 6 months of childbirth', 5, FALSE, NULL, FALSE, TRUE, 4),
  ('AE', 'Compassionate Leave', '5 days bereavement leave for immediate family members', 5, FALSE, NULL, FALSE, TRUE, 5),
  ('AE', 'Hajj/Umrah Leave', '30 days special leave for Hajj (once during employment). Subject to manager approval and operational requirements', 30, FALSE, NULL, FALSE, TRUE, 6);

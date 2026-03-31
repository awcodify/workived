-- Re-add UAE Parental Leave template
INSERT INTO leave_policy_templates (country_code, name, description, entitled_days_per_year, is_carry_over_allowed, max_carry_over_days, is_accrued, requires_approval, gender_eligibility, is_unlimited, sort_order)
VALUES ('AE', 'Parental Leave', '5 working days unpaid within 6 months of birth (Art. 32(7)). Either parent. Separate from paternity.', 5, FALSE, NULL, FALSE, TRUE, 'all', FALSE, 5)
ON CONFLICT (country_code, name) DO NOTHING;

-- Revert renamed policies
UPDATE leave_policies SET name = 'Parental Leave', description = NULL
WHERE name = 'Paternity Leave (Legacy)';

-- Revert sort_order
UPDATE leave_policy_templates SET sort_order = 6 WHERE country_code = 'AE' AND name = 'Bereavement Leave (Spouse)';
UPDATE leave_policy_templates SET sort_order = 7 WHERE country_code = 'AE' AND name = 'Bereavement Leave (Family)';
UPDATE leave_policy_templates SET sort_order = 8 WHERE country_code = 'AE' AND name = 'Hajj Leave';
UPDATE leave_policy_templates SET sort_order = 9 WHERE country_code = 'AE' AND name = 'Study Leave';

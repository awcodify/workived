-- WOR-73: Remove incorrect UAE "Parental Leave" template
--
-- UAE law already covers parental leave through:
--   - Maternity Leave (60 days, Art. 30)
--   - Paternity Leave (5 days, Art. 32(6))
--
-- The generic "Parental Leave" (5 days, all genders) was Art. 32(7) but caused
-- confusion since maternity+paternity already cover it correctly.
--
-- Run once: psql -f scripts/fix_uae_parental_leave.sql

DELETE FROM leave_policy_templates
WHERE country_code = 'AE'
  AND name = 'Parental Leave';

-- Verify
SELECT name, entitled_days_per_year, gender_eligibility
FROM leave_policy_templates
WHERE country_code = 'AE'
ORDER BY sort_order;

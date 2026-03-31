-- Remove confusing "Parental Leave" template for UAE
-- UAE already has correct Maternity Leave (60d, female) and Paternity Leave (5d, male)
-- "Parental Leave" (5d, all) caused confusion — Ricko reported it as wrong entitlement

-- Remove from templates
DELETE FROM leave_policy_templates WHERE country_code = 'AE' AND name = 'Parental Leave';

-- Remove any policies created from this template (only if no leave requests exist)
-- Policies with active requests should be kept and renamed
UPDATE leave_policies
SET name = 'Paternity Leave (Legacy)',
    description = 'Migrated from old Parental Leave template. Review and merge with Paternity Leave if needed.'
WHERE name = 'Parental Leave'
  AND organisation_id IN (
    SELECT DISTINCT lp.organisation_id
    FROM leave_policies lp
    JOIN organisations o ON o.id = lp.organisation_id
    WHERE o.country_code = 'AE' AND lp.name = 'Parental Leave'
  );

-- Fix sort_order for remaining UAE templates
UPDATE leave_policy_templates SET sort_order = 5 WHERE country_code = 'AE' AND name = 'Bereavement Leave (Spouse)';
UPDATE leave_policy_templates SET sort_order = 6 WHERE country_code = 'AE' AND name = 'Bereavement Leave (Family)';
UPDATE leave_policy_templates SET sort_order = 7 WHERE country_code = 'AE' AND name = 'Hajj Leave';
UPDATE leave_policy_templates SET sort_order = 8 WHERE country_code = 'AE' AND name = 'Study Leave';

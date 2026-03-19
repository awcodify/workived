-- 000039_fix_role_names.up.sql
-- Align role CHECK constraints with the canonical role set in
-- services/internal/platform/middleware/rbac.go.
--
-- Old names (from migration 037):  hr_manager, hr_staff, finance_manager, finance_staff
-- New names (backend constants):   hr_admin, manager, finance
--
-- No existing rows use the old Pro role names (all existing members are owner/member/admin),
-- so no data backfill is needed before dropping the constraints.

-- ── organisation_members ─────────────────────────────────────────────────────

ALTER TABLE organisation_members
    DROP CONSTRAINT IF EXISTS organisation_members_role_check;

ALTER TABLE organisation_members
    ADD CONSTRAINT organisation_members_role_check
    CHECK (role IN ('owner', 'admin', 'member', 'hr_admin', 'manager', 'finance', 'super_admin'));

-- ── invitations ──────────────────────────────────────────────────────────────

ALTER TABLE invitations
    DROP CONSTRAINT IF EXISTS invitations_role_check;

ALTER TABLE invitations
    ADD CONSTRAINT invitations_role_check
    CHECK (role IN ('admin', 'member', 'hr_admin', 'manager', 'finance', 'super_admin'));

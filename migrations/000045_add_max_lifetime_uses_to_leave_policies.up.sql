ALTER TABLE leave_policies
    ADD COLUMN max_lifetime_uses INT DEFAULT NULL;

COMMENT ON COLUMN leave_policies.max_lifetime_uses IS
    'Maximum times this leave can be used across all years (NULL = unlimited/annual). E.g. Hajj = 1.';

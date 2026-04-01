ALTER TABLE leave_policy_templates
    ADD COLUMN max_lifetime_uses INT DEFAULT NULL;

-- Set Hajj templates to once-per-employment
UPDATE leave_policy_templates SET max_lifetime_uses = 1 WHERE name = 'Hajj Leave';

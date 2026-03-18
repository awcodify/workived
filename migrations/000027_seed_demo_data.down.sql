-- Remove demo data (cascade handles dependent rows)
DO $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM users WHERE email = 'ahmad@workived.com';
    SELECT o.id INTO v_org_id FROM organisations o
        JOIN organisation_members om ON om.organisation_id = o.id
        WHERE om.user_id = v_user_id AND om.role = 'owner'
        LIMIT 1;

    IF v_org_id IS NOT NULL THEN
        DELETE FROM employees WHERE organisation_id = v_org_id;
        DELETE FROM work_schedules WHERE organisation_id = v_org_id;
        DELETE FROM departments WHERE organisation_id = v_org_id;
        DELETE FROM organisation_members WHERE organisation_id = v_org_id;
        DELETE FROM organisations WHERE id = v_org_id;
    END IF;

    IF v_user_id IS NOT NULL THEN
        DELETE FROM users WHERE id = v_user_id;
    END IF;
END $$;

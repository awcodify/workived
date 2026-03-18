-- Link demo user (Ahmad) to an employee record so clock-in works.
-- Ahmad is the org owner — he needs an employee record to use attendance features.

DO $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
    v_dept_id UUID;
BEGIN
    -- Find Ahmad's user ID
    SELECT id INTO v_user_id FROM users WHERE email = 'ahmad@workived.com';
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'Demo user not found, skipping.';
        RETURN;
    END IF;

    -- Find his org
    SELECT om.organisation_id INTO v_org_id
    FROM organisation_members om
    WHERE om.user_id = v_user_id
    LIMIT 1;

    -- Find Engineering department
    SELECT id INTO v_dept_id
    FROM departments
    WHERE organisation_id = v_org_id AND name = 'Engineering'
    LIMIT 1;

    -- Skip if Ahmad already has an employee record in this org
    IF EXISTS (SELECT 1 FROM employees WHERE organisation_id = v_org_id AND user_id = v_user_id) THEN
        RAISE NOTICE 'Ahmad already has an employee record, skipping.';
        RETURN;
    END IF;

    -- Create employee record for Ahmad, linked via user_id
    INSERT INTO employees (
        organisation_id, user_id, full_name, email, phone,
        job_title, department_id, employment_type, status, start_date, is_active
    ) VALUES (
        v_org_id, v_user_id, 'Ahmad Rizki', 'ahmad@workived.com', '+6281200000001',
        'Founder & CEO', v_dept_id, 'full_time', 'active', '2025-01-01', TRUE
    );

    RAISE NOTICE 'Ahmad linked as employee in org %', v_org_id;
END $$;

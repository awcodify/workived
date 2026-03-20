-- Seed test data for Workived development
-- Creates a test organization with employees, leave policies, and claim categories
-- Run this after running migrations

DO $$
DECLARE
    v_org_id UUID;
    v_owner_id UUID;
    v_ahmad_emp_id UUID;
    v_new_emp_id UUID;
    v_annual_leave_policy UUID;
    v_sick_leave_policy UUID;
    v_transport_cat UUID;
    v_meal_cat UUID;
    v_current_year INT := EXTRACT(YEAR FROM CURRENT_DATE);
    v_current_month INT := EXTRACT(MONTH FROM CURRENT_DATE);
BEGIN
    -- Check if test org already exists
    SELECT id INTO v_org_id FROM organisations WHERE slug = 'rizki-tech';
    
    IF v_org_id IS NOT NULL THEN
        RAISE NOTICE 'Test organization already exists (ID: %), skipping seed', v_org_id;
        RETURN;
    END IF;

    RAISE NOTICE 'Creating test organization and data...';

    -- 1. Create test organization
    INSERT INTO organisations (id, name, slug, country_code, timezone, currency_code, plan, work_days)
    VALUES (
        gen_random_uuid(),
        'Rizki Tech',
        'rizki-tech',
        'ID',
        'Asia/Jakarta',
        'IDR',
        'free',
        ARRAY[1,2,3,4,5]  -- Monday to Friday
    )
    RETURNING id INTO v_org_id;
    RAISE NOTICE '✓ Created organization: % (%)', 'Rizki Tech', v_org_id;

    -- 2. Create owner user (ahmad@workived.com with password: 12345678)
    INSERT INTO users (id, email, full_name, password_hash, is_verified, is_active)
    VALUES (
        gen_random_uuid(),
        'ahmad@workived.com',
        'Ahmad Rizki',
        '$2a$10$oCwYryu7kAkeW2nF3kaGWOeDMeVNbkZAM2eps8Ch/ymo1ysNrGmPS',  -- 12345678
        true,
        true
    )
    RETURNING id INTO v_owner_id;
    RAISE NOTICE '✓ Created owner user: ahmad@workived.com';

    -- 3. Add owner to organization
    INSERT INTO organisation_members (id, organisation_id, user_id, role)
    VALUES (gen_random_uuid(), v_org_id, v_owner_id, 'super_admin');
    RAISE NOTICE '✓ Added owner to organization with super_admin role';

    -- 4. Create owner employee record
    INSERT INTO employees (
        id, organisation_id, user_id, employee_code, full_name, email, 
        phone, job_title, employment_type, start_date
    ) VALUES (
        gen_random_uuid(),
        v_org_id,
        v_owner_id,
        'EMP001',
        'Ahmad Rizki',
        'ahmad@workived.com',
        '+62812345678',
        'CEO & Founder',
        'full_time',
        CURRENT_DATE - INTERVAL '1 year'
    )
    RETURNING id INTO v_ahmad_emp_id;
    RAISE NOTICE '✓ Created employee record for ahmad@workived.com';

    -- 5. Create new test employee (employee first, user later via invitation)
    INSERT INTO employees (
        id, organisation_id, user_id, employee_code, full_name, email, 
        phone, job_title, employment_type, reporting_to, start_date
    ) VALUES (
        gen_random_uuid(),
        v_org_id,
        NULL,  -- Will be linked when user accepts invitation
        'EMP002',
        'New Employee',
        'new@rizkitech.com',
        '+62812345679',
        'Software Engineer',
        'full_time',
        v_ahmad_emp_id,  -- Reports to Ahmad
        CURRENT_DATE - INTERVAL '30 days'
    )
    RETURNING id INTO v_new_emp_id;
    RAISE NOTICE '✓ Created employee record for new@rizkitech.com (reports to Ahmad)';

    -- 6. Create leave policies
    INSERT INTO leave_policies (id, organisation_id, name, days_per_year, carry_over_max_days, is_active)
    VALUES 
        (gen_random_uuid(), v_org_id, 'Annual Leave', 12, 6, true),
        (gen_random_uuid(), v_org_id, 'Sick Leave', 7, 0, true),
        (gen_random_uuid(), v_org_id, 'Unpaid Leave', 0, 0, true)
    RETURNING id INTO v_annual_leave_policy;
    RAISE NOTICE '✓ Created 3 leave policies';

    -- 7. Create leave balances for both employees for current year
    INSERT INTO leave_balances (organisation_id, employee_id, leave_policy_id, year, entitled_days)
    SELECT v_org_id, e.id, lp.id, v_current_year, lp.days_per_year
    FROM employees e
    CROSS JOIN leave_policies lp
    WHERE e.organisation_id = v_org_id 
      AND e.is_active = true
      AND lp.organisation_id = v_org_id
      AND lp.is_active = true;
    RAISE NOTICE '✓ Created leave balances for all employees';

    -- 8. Create claim categories (Indonesian categories)
    INSERT INTO claim_categories (id, organisation_id, name, monthly_limit, currency_code, requires_receipt)
    VALUES 
        (gen_random_uuid(), v_org_id, 'Transport', 500000, 'IDR', false),
        (gen_random_uuid(), v_org_id, 'Meal Allowance', 1000000, 'IDR', false),
        (gen_random_uuid(), v_org_id, 'Medical', 2000000, 'IDR', true),
        (gen_random_uuid(), v_org_id, 'Internet', 300000, 'IDR', true),
        (gen_random_uuid(), v_org_id, 'Phone', 200000, 'IDR', true)
    RETURNING id INTO v_transport_cat;
    RAISE NOTICE '✓ Created 5 claim categories';

    -- 9. Create claim balances for both employees for current month
    INSERT INTO claim_balances (organisation_id, employee_id, category_id, year, month, currency_code, monthly_limit)
    SELECT v_org_id, e.id, cc.id, v_current_year, v_current_month, cc.currency_code, cc.monthly_limit
    FROM employees e
    CROSS JOIN claim_categories cc
    WHERE e.organisation_id = v_org_id 
      AND e.is_active = true
      AND cc.organisation_id = v_org_id
      AND cc.is_active = true;
    RAISE NOTICE '✓ Created claim balances for all employees for current month';

    -- 10. Create a few sample claims for ahmad
    INSERT INTO claims (organisation_id, employee_id, category_id, amount, currency_code, status, claim_date, description)
    VALUES 
        (v_org_id, v_ahmad_emp_id, v_transport_cat, 50000, 'IDR', 'approved', CURRENT_DATE - INTERVAL '5 days', 'Taxi to client meeting'),
        (v_org_id, v_ahmad_emp_id, v_transport_cat, 75000, 'IDR', 'pending', CURRENT_DATE - INTERVAL '2 days', 'Grab to office');
    RAISE NOTICE '✓ Created 2 sample claims for ahmad@workived.com';

    RAISE NOTICE '';
    RAISE NOTICE '══════════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ Test data seeded successfully!';
    RAISE NOTICE '══════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'Login credentials:';
    RAISE NOTICE '  Email: ahmad@workived.com';
    RAISE NOTICE '  Password: 12345678';
    RAISE NOTICE '';
    RAISE NOTICE 'Test employees:';
    RAISE NOTICE '  1. Ahmad Rizki (CEO, super_admin) - has user account';
    RAISE NOTICE '  2. New Employee (Engineer) - email: new@rizkitech.com';
    RAISE NOTICE '     → Needs invitation to create user account';
    RAISE NOTICE '';
    RAISE NOTICE 'Data created:';
    RAISE NOTICE '  • 3 Leave policies (Annual: 12 days, Sick: 7 days, Unpaid: 0 days)';
    RAISE NOTICE '  • 5 Claim categories (Transport, Meal, Medical, Internet, Phone)';
    RAISE NOTICE '  • Leave balances for both employees (current year)';
    RAISE NOTICE '  • Claim balances for both employees (current month)';
    RAISE NOTICE '  • 2 sample claims for ahmad@workived.com';
    RAISE NOTICE '══════════════════════════════════════════════════════════════';

END $$;

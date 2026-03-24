-- Seed test data for Workived development
-- Creates a test organization with employees, leave policies, and claim categories
-- Run this after running migrations

DO $$
DECLARE
    v_org_id UUID;
    v_owner_id UUID;
    v_ahmad_emp_id UUID;
    v_new_emp_id UUID;
    v_emp_hr_id UUID;
    v_emp_finance_id UUID;
    v_emp_designer_id UUID;
    v_emp_manager_id UUID;
    v_transport_cat UUID;    v_annual_leave_id UUID;
    v_sick_leave_id UUID;
    v_unpaid_leave_id UUID;    v_current_year INT := EXTRACT(YEAR FROM CURRENT_DATE);
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
    INSERT INTO organisations (id, name, slug, country_code, timezone, currency_code, plan, work_days, setup_completed_at)
    VALUES (
        gen_random_uuid(),
        'Rizki Tech',
        'rizki-tech',
        'ID',
        'Asia/Jakarta',
        'IDR',
        'free',
        ARRAY[1,2,3,4,5],  -- Monday to Friday
        NOW()  -- Mark setup as completed
    )
    RETURNING id INTO v_org_id;
    RAISE NOTICE '✓ Created organization: % (%)', 'Rizki Tech', v_org_id;

    -- 2. Create owner user (ahmad@workived.com with password: 12345678)
    INSERT INTO users (id, email, full_name, password_hash, is_verified, is_active)
    VALUES (
        gen_random_uuid(),
        'ahmad@workived.com',
        'Ahmad Rizki',
        '$2a$10$qXlfyf6puh1pUJHAbTyk3uZuJV8WdNWwtW3J59FzAgkSyjl5lceE2',  -- 12345678
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

    -- 5b. Create more diverse employees
    INSERT INTO employees (
        id, organisation_id, user_id, employee_code, full_name, email, 
        phone, job_title, employment_type, reporting_to, start_date
    ) VALUES (
        gen_random_uuid(),
        v_org_id,
        NULL,
        'EMP003',
        'Sarah Johnson',
        'sarah@rizkitech.com',
        '+62812345680',
        'HR Manager',
        'full_time',
        v_ahmad_emp_id,
        CURRENT_DATE - INTERVAL '6 months'
    )
    RETURNING id INTO v_emp_hr_id;

    INSERT INTO employees (
        id, organisation_id, user_id, employee_code, full_name, email, 
        phone, job_title, employment_type, reporting_to, start_date
    ) VALUES (
        gen_random_uuid(),
        v_org_id,
        NULL,
        'EMP004',
        'Michael Chen',
        'michael@rizkitech.com',
        '+62812345681',
        'Finance Lead',
        'full_time',
        v_ahmad_emp_id,
        CURRENT_DATE - INTERVAL '4 months'
    )
    RETURNING id INTO v_emp_finance_id;

    INSERT INTO employees (
        id, organisation_id, user_id, employee_code, full_name, email, 
        phone, job_title, employment_type, reporting_to, start_date
    ) VALUES (
        gen_random_uuid(),
        v_org_id,
        NULL,
        'EMP005',
        'Lisa Anderson',
        'lisa@rizkitech.com',
        '+62812345682',
        'UI/UX Designer',
        'full_time',
        v_new_emp_id,  -- Reports to New Employee
        CURRENT_DATE - INTERVAL '2 months'
    )
    RETURNING id INTO v_emp_designer_id;

    INSERT INTO employees (
        id, organisation_id, user_id, employee_code, full_name, email, 
        phone, job_title, employment_type, reporting_to, start_date
    ) VALUES (
        gen_random_uuid(),
        v_org_id,
        NULL,
        'EMP006',
        'David Kumar',
        'david@rizkitech.com',
        '+62812345683',
        'Engineering Manager',
        'full_time',
        v_ahmad_emp_id,
        CURRENT_DATE - INTERVAL '8 months'
    )
    RETURNING id INTO v_emp_manager_id;

    RAISE NOTICE '✓ Created 5 additional employees';

    -- 6. Create work schedule (Monday-Friday, 8am-5pm)
    INSERT INTO work_schedules (
        id, organisation_id, name, is_default, 
        work_days, start_time, end_time
    ) VALUES (
        gen_random_uuid(),
        v_org_id,
        'Standard Office Hours',
        true,
        ARRAY[1,2,3,4,5],  -- Monday to Friday
        '08:00',
        '17:00'
    );
    RAISE NOTICE '✓ Created work schedule (Mon-Fri, 8am-5pm)';

    -- 7. Create leave policies
    INSERT INTO leave_policies (id, organisation_id, name, days_per_year, carry_over_days, is_active)
    VALUES 
        (gen_random_uuid(), v_org_id, 'Annual Leave', 12, 6, true),
        (gen_random_uuid(), v_org_id, 'Sick Leave', 7, 0, true),
        (gen_random_uuid(), v_org_id, 'Unpaid Leave', 0, 0, true);
    RAISE NOTICE '✓ Created 3 leave policies';

    -- 8. Create leave balances for all employees for current year
    INSERT INTO leave_balances (organisation_id, employee_id, leave_policy_id, year, entitled_days)
    SELECT v_org_id, e.id, lp.id, v_current_year, lp.days_per_year
    FROM employees e
    CROSS JOIN leave_policies lp
    WHERE e.organisation_id = v_org_id 
      AND e.is_active = true
      AND lp.organisation_id = v_org_id
      AND lp.is_active = true;
    RAISE NOTICE '✓ Created leave balances for all employees';

    -- 9. Create claim categories (Indonesian categories)
    INSERT INTO claim_categories (id, organisation_id, name, monthly_limit, currency_code, requires_receipt)
    VALUES 
        (gen_random_uuid(), v_org_id, 'Transport', 500000, 'IDR', false),
        (gen_random_uuid(), v_org_id, 'Meal Allowance', 1000000, 'IDR', false),
        (gen_random_uuid(), v_org_id, 'Medical', 2000000, 'IDR', true),
        (gen_random_uuid(), v_org_id, 'Internet', 300000, 'IDR', true),
        (gen_random_uuid(), v_org_id, 'Phone', 200000, 'IDR', true);
    RAISE NOTICE '✓ Created 5 claim categories';

    -- 10. Create claim balances for all employees for current month
    INSERT INTO claim_balances (organisation_id, employee_id, category_id, year, month, currency_code, monthly_limit)
    SELECT v_org_id, e.id, cc.id, v_current_year, v_current_month, cc.currency_code, cc.monthly_limit
    FROM employees e
    CROSS JOIN claim_categories cc
    WHERE e.organisation_id = v_org_id 
      AND e.is_active = true
      AND cc.organisation_id = v_org_id
      AND cc.is_active = true;
    RAISE NOTICE '✓ Created claim balances for all employees for current month';

    -- Get Transport category ID for sample claims
    SELECT id INTO v_transport_cat FROM claim_categories 
    WHERE organisation_id = v_org_id AND name = 'Transport' LIMIT 1;

    -- 11. Create a few sample claims for ahmad
    INSERT INTO claims (organisation_id, employee_id, category_id, amount, currency_code, status, claim_date, description)
    VALUES 
        (v_org_id, v_ahmad_emp_id, v_transport_cat, 50000, 'IDR', 'approved', CURRENT_DATE - INTERVAL '5 days', 'Taxi to client meeting'),
        (v_org_id, v_ahmad_emp_id, v_transport_cat, 75000, 'IDR', 'pending', CURRENT_DATE - INTERVAL '2 days', 'Grab to office');
    RAISE NOTICE '✓ Created 2 sample claims for ahmad@workived.com';

    -- Get leave policy IDs for sample leave requests
    SELECT id INTO v_annual_leave_id FROM leave_policies 
    WHERE organisation_id = v_org_id AND name = 'Annual Leave' LIMIT 1;
    
    SELECT id INTO v_sick_leave_id FROM leave_policies 
    WHERE organisation_id = v_org_id AND name = 'Sick Leave' LIMIT 1;
    
    SELECT id INTO v_unpaid_leave_id FROM leave_policies 
    WHERE organisation_id = v_org_id AND name = 'Unpaid Leave' LIMIT 1;

    -- 12. Create sample leave requests for calendar visibility
    INSERT INTO leave_requests (
        id, organisation_id, employee_id, leave_policy_id, 
        start_date, end_date, total_days, status, reason
    ) VALUES 
        -- Ahmad: Approved past vacation
        (gen_random_uuid(), v_org_id, v_ahmad_emp_id, v_annual_leave_id, 
         CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE - INTERVAL '16 days', 5, 
         'approved', 'Family vacation in Bali'),
        
        -- Ahmad: Upcoming annual leave
        (gen_random_uuid(), v_org_id, v_ahmad_emp_id, v_annual_leave_id, 
         CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '9 days', 3, 
         'approved', 'Conference attendance in Singapore'),
        
        -- New Employee: Recent sick leave (approved)
        (gen_random_uuid(), v_org_id, v_new_emp_id, v_sick_leave_id, 
         CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE - INTERVAL '1 day', 1, 
         'approved', 'Flu and fever'),
        
        -- Sarah (HR): Pending leave request for next month
        (gen_random_uuid(), v_org_id, v_emp_hr_id, v_annual_leave_id, 
         CURRENT_DATE + INTERVAL '35 days', CURRENT_DATE + INTERVAL '39 days', 5, 
         'pending', 'Wedding anniversary trip'),
        
        -- Michael (Finance): Rejected leave (audit period)
        (gen_random_uuid(), v_org_id, v_emp_finance_id, v_annual_leave_id, 
         CURRENT_DATE + INTERVAL '10 days', CURRENT_DATE + INTERVAL '12 days', 3, 
         'rejected', 'Personal matters - conflicts with audit period'),
        
        -- Lisa (Designer): Approved leave for design conference
        (gen_random_uuid(), v_org_id, v_emp_designer_id, v_annual_leave_id, 
         CURRENT_DATE + INTERVAL '14 days', CURRENT_DATE + INTERVAL '16 days', 3, 
         'approved', 'UI/UX Design Conference in Jakarta'),
        
        -- David (Manager): Approved emergency leave (past)
        (gen_random_uuid(), v_org_id, v_emp_manager_id, v_sick_leave_id, 
         CURRENT_DATE - INTERVAL '8 days', CURRENT_DATE - INTERVAL '7 days', 2, 
         'approved', 'Family emergency'),
        
        -- Sarah (HR): Approved past leave
        (gen_random_uuid(), v_org_id, v_emp_hr_id, v_annual_leave_id, 
         CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '28 days', 3, 
         'approved', 'Long weekend trip'),
        
        -- Michael (Finance): Upcoming approved leave
        (gen_random_uuid(), v_org_id, v_emp_finance_id, v_annual_leave_id, 
         CURRENT_DATE + INTERVAL '60 days', CURRENT_DATE + INTERVAL '69 days', 10, 
         'approved', 'Year-end vacation - visiting family'),
        
        -- Lisa (Designer): Pending sick leave
        (gen_random_uuid(), v_org_id, v_emp_designer_id, v_sick_leave_id, 
         CURRENT_DATE, CURRENT_DATE, 1, 
         'pending', 'Medical appointment'),
        
        -- David (Manager): Half-day unpaid leave (yesterday)
        (gen_random_uuid(), v_org_id, v_emp_manager_id, v_unpaid_leave_id, 
         CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE - INTERVAL '1 day', 0.5, 
         'approved', 'Personal errands - afternoon off');

    RAISE NOTICE '✓ Created 11 leave requests (7 approved, 2 pending, 2 rejected) across all employees';

    -- 13. Create attendance records (past 14 days with various patterns)
    INSERT INTO attendance_records (organisation_id, employee_id, date, clock_in_at, clock_out_at, is_late, clock_in_lat, clock_in_lng)
    VALUES 
        -- Ahmad (CEO): Regular attendance, mostly on-time
        (v_org_id, v_ahmad_emp_id, CURRENT_DATE - INTERVAL '13 days', (CURRENT_DATE - INTERVAL '13 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '13 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_ahmad_emp_id, CURRENT_DATE - INTERVAL '12 days', (CURRENT_DATE - INTERVAL '12 days')::DATE + TIME '07:55:00', (CURRENT_DATE - INTERVAL '12 days')::DATE + TIME '17:10:00', false, -6.2088, 106.8456),
        (v_org_id, v_ahmad_emp_id, CURRENT_DATE - INTERVAL '11 days', (CURRENT_DATE - INTERVAL '11 days')::DATE + TIME '08:05:00', (CURRENT_DATE - INTERVAL '11 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_ahmad_emp_id, CURRENT_DATE - INTERVAL '10 days', (CURRENT_DATE - INTERVAL '10 days')::DATE + TIME '08:30:00', (CURRENT_DATE - INTERVAL '10 days')::DATE + TIME '18:00:00', true, -6.2088, 106.8456),
        (v_org_id, v_ahmad_emp_id, CURRENT_DATE - INTERVAL '9 days', (CURRENT_DATE - INTERVAL '9 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '9 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_ahmad_emp_id, CURRENT_DATE - INTERVAL '6 days', (CURRENT_DATE - INTERVAL '6 days')::DATE + TIME '10:00:00', (CURRENT_DATE - INTERVAL '6 days')::DATE + TIME '15:00:00', false, -6.2088, 106.8456),  -- Weekend work
        (v_org_id, v_ahmad_emp_id, CURRENT_DATE - INTERVAL '4 days', (CURRENT_DATE - INTERVAL '4 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '4 days')::DATE + TIME '19:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_ahmad_emp_id, CURRENT_DATE - INTERVAL '3 days', (CURRENT_DATE - INTERVAL '3 days')::DATE + TIME '07:50:00', NULL, false, -6.2088, 106.8456),  -- Forgot to clock out
        (v_org_id, v_ahmad_emp_id, CURRENT_DATE - INTERVAL '2 days', (CURRENT_DATE - INTERVAL '2 days')::DATE + TIME '08:10:00', (CURRENT_DATE - INTERVAL '2 days')::DATE + TIME '17:05:00', false, -6.2088, 106.8456),
        (v_org_id, v_ahmad_emp_id, CURRENT_DATE - INTERVAL '1 day', (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),

        -- New Employee (Engineer): Some lates and early clockouts
        (v_org_id, v_new_emp_id, CURRENT_DATE - INTERVAL '13 days', (CURRENT_DATE - INTERVAL '13 days')::DATE + TIME '08:45:00', (CURRENT_DATE - INTERVAL '13 days')::DATE + TIME '17:00:00', true, -6.2188, 106.8556),
        (v_org_id, v_new_emp_id, CURRENT_DATE - INTERVAL '12 days', (CURRENT_DATE - INTERVAL '12 days')::DATE + TIME '09:15:00', (CURRENT_DATE - INTERVAL '12 days')::DATE + TIME '17:00:00', true, -6.2188, 106.8556),
        (v_org_id, v_new_emp_id, CURRENT_DATE - INTERVAL '11 days', (CURRENT_DATE - INTERVAL '11 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '11 days')::DATE + TIME '16:30:00', false, -6.2188, 106.8556),
        (v_org_id, v_new_emp_id, CURRENT_DATE - INTERVAL '10 days', (CURRENT_DATE - INTERVAL '10 days')::DATE + TIME '08:30:00', (CURRENT_DATE - INTERVAL '10 days')::DATE + TIME '17:00:00', true, -6.2188, 106.8556),
        (v_org_id, v_new_emp_id, CURRENT_DATE - INTERVAL '9 days', (CURRENT_DATE - INTERVAL '9 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '9 days')::DATE + TIME '17:00:00', false, -6.2188, 106.8556),
        (v_org_id, v_new_emp_id, CURRENT_DATE - INTERVAL '4 days', (CURRENT_DATE - INTERVAL '4 days')::DATE + TIME '08:15:00', (CURRENT_DATE - INTERVAL '4 days')::DATE + TIME '17:00:00', false, -6.2188, 106.8556),
        (v_org_id, v_new_emp_id, CURRENT_DATE - INTERVAL '2 days', (CURRENT_DATE - INTERVAL '2 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '2 days')::DATE + TIME '17:00:00', false, -6.2188, 106.8556),

        -- HR Manager: Mostly on-time, flexible hours
        (v_org_id, v_emp_hr_id, CURRENT_DATE - INTERVAL '13 days', (CURRENT_DATE - INTERVAL '13 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '13 days')::DATE + TIME '17:30:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_hr_id, CURRENT_DATE - INTERVAL '12 days', (CURRENT_DATE - INTERVAL '12 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '12 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_hr_id, CURRENT_DATE - INTERVAL '11 days', (CURRENT_DATE - INTERVAL '11 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '11 days')::DATE + TIME '18:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_hr_id, CURRENT_DATE - INTERVAL '10 days', (CURRENT_DATE - INTERVAL '10 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '10 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_hr_id, CURRENT_DATE - INTERVAL '9 days', (CURRENT_DATE - INTERVAL '9 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '9 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_hr_id, CURRENT_DATE - INTERVAL '4 days', (CURRENT_DATE - INTERVAL '4 days')::DATE + TIME '07:45:00', (CURRENT_DATE - INTERVAL '4 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_hr_id, CURRENT_DATE - INTERVAL '3 days', (CURRENT_DATE - INTERVAL '3 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '3 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_hr_id, CURRENT_DATE - INTERVAL '2 days', (CURRENT_DATE - INTERVAL '2 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '2 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),

        -- Finance Lead: Very punctual
        (v_org_id, v_emp_finance_id, CURRENT_DATE - INTERVAL '13 days', (CURRENT_DATE - INTERVAL '13 days')::DATE + TIME '07:55:00', (CURRENT_DATE - INTERVAL '13 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_finance_id, CURRENT_DATE - INTERVAL '12 days', (CURRENT_DATE - INTERVAL '12 days')::DATE + TIME '07:58:00', (CURRENT_DATE - INTERVAL '12 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_finance_id, CURRENT_DATE - INTERVAL '11 days', (CURRENT_DATE - INTERVAL '11 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '11 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_finance_id, CURRENT_DATE - INTERVAL '10 days', (CURRENT_DATE - INTERVAL '10 days')::DATE + TIME '07:55:00', (CURRENT_DATE - INTERVAL '10 days')::DATE + TIME '17:05:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_finance_id, CURRENT_DATE - INTERVAL '9 days', (CURRENT_DATE - INTERVAL '9 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '9 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_finance_id, CURRENT_DATE - INTERVAL '4 days', (CURRENT_DATE - INTERVAL '4 days')::DATE + TIME '07:58:00', (CURRENT_DATE - INTERVAL '4 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_finance_id, CURRENT_DATE - INTERVAL '3 days', (CURRENT_DATE - INTERVAL '3 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '3 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_finance_id, CURRENT_DATE - INTERVAL '2 days', (CURRENT_DATE - INTERVAL '2 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '2 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_finance_id, CURRENT_DATE - INTERVAL '1 day', (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),

        -- Designer: Creative hours, some lates and overtime
        (v_org_id, v_emp_designer_id, CURRENT_DATE - INTERVAL '13 days', (CURRENT_DATE - INTERVAL '13 days')::DATE + TIME '09:00:00', (CURRENT_DATE - INTERVAL '13 days')::DATE + TIME '18:00:00', true, -6.2288, 106.8656),
        (v_org_id, v_emp_designer_id, CURRENT_DATE - INTERVAL '12 days', (CURRENT_DATE - INTERVAL '12 days')::DATE + TIME '08:30:00', (CURRENT_DATE - INTERVAL '12 days')::DATE + TIME '18:30:00', true, -6.2288, 106.8656),
        (v_org_id, v_emp_designer_id, CURRENT_DATE - INTERVAL '11 days', (CURRENT_DATE - INTERVAL '11 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '11 days')::DATE + TIME '19:00:00', false, -6.2288, 106.8656),  -- Overtime
        (v_org_id, v_emp_designer_id, CURRENT_DATE - INTERVAL '10 days', (CURRENT_DATE - INTERVAL '10 days')::DATE + TIME '09:15:00', (CURRENT_DATE - INTERVAL '10 days')::DATE + TIME '18:15:00', true, -6.2288, 106.8656),
        (v_org_id, v_emp_designer_id, CURRENT_DATE - INTERVAL '9 days', (CURRENT_DATE - INTERVAL '9 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '9 days')::DATE + TIME '17:00:00', false, -6.2288, 106.8656),
        (v_org_id, v_emp_designer_id, CURRENT_DATE - INTERVAL '4 days', (CURRENT_DATE - INTERVAL '4 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '4 days')::DATE + TIME '20:00:00', false, -6.2288, 106.8656),  -- Heavy overtime
        (v_org_id, v_emp_designer_id, CURRENT_DATE - INTERVAL '2 days', (CURRENT_DATE - INTERVAL '2 days')::DATE + TIME '08:30:00', (CURRENT_DATE - INTERVAL '2 days')::DATE + TIME '17:30:00', true, -6.2288, 106.8656),

        -- Manager: Regular with occasional overtime
        (v_org_id, v_emp_manager_id, CURRENT_DATE - INTERVAL '13 days', (CURRENT_DATE - INTERVAL '13 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '13 days')::DATE + TIME '18:30:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_manager_id, CURRENT_DATE - INTERVAL '12 days', (CURRENT_DATE - INTERVAL '12 days')::DATE + TIME '07:55:00', (CURRENT_DATE - INTERVAL '12 days')::DATE + TIME '17:30:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_manager_id, CURRENT_DATE - INTERVAL '11 days', (CURRENT_DATE - INTERVAL '11 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '11 days')::DATE + TIME '19:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_manager_id, CURRENT_DATE - INTERVAL '10 days', (CURRENT_DATE - INTERVAL '10 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '10 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_manager_id, CURRENT_DATE - INTERVAL '9 days', (CURRENT_DATE - INTERVAL '9 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '9 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_manager_id, CURRENT_DATE - INTERVAL '4 days', (CURRENT_DATE - INTERVAL '4 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '4 days')::DATE + TIME '18:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_manager_id, CURRENT_DATE - INTERVAL '3 days', (CURRENT_DATE - INTERVAL '3 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '3 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_manager_id, CURRENT_DATE - INTERVAL '2 days', (CURRENT_DATE - INTERVAL '2 days')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '2 days')::DATE + TIME '17:00:00', false, -6.2088, 106.8456),
        (v_org_id, v_emp_manager_id, CURRENT_DATE - INTERVAL '1 day', (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '08:00:00', (CURRENT_DATE - INTERVAL '1 day')::DATE + TIME '17:00:00', false, -6.2088, 106.8456);

    RAISE NOTICE '✓ Created 50 attendance records (past 14 days with various patterns)';

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
    RAISE NOTICE '  1. Ahmad Rizki (CEO, super_admin) - email: ahmad@workived.com';
    RAISE NOTICE '  2. New Employee (Engineer) - email: new@rizkitech.com';
    RAISE NOTICE '  3. Sarah Johnson (HR Manager) - email: sarah@rizkitech.com';
    RAISE NOTICE '  4. Michael Chen (Finance Lead) - email: michael@rizkitech.com';
    RAISE NOTICE '  5. Lisa Anderson (UI/UX Designer) - email: lisa@rizkitech.com';
    RAISE NOTICE '  6. David Kumar (Operations Manager) - email: david@rizkitech.com';
    RAISE NOTICE '     → Only Ahmad has user account. Others need invitation.';
    RAISE NOTICE '';
    RAISE NOTICE 'Data created:';
    RAISE NOTICE '  • 1 Work schedule (Mon-Fri, 8am-5pm)';
    RAISE NOTICE '  • 3 Leave policies (Annual: 12 days, Sick: 7 days, Unpaid: 0 days)';
    RAISE NOTICE '  • 5 Claim categories (Transport, Meal, Medical, Internet, Phone)';
    RAISE NOTICE '  • Leave balances for all 6 employees (current year)';
    RAISE NOTICE '  • Claim balances for all 6 employees (current month)';
    RAISE NOTICE '  • 11 leave requests (7 approved, 2 pending, 2 rejected) - visible in calendar';
    RAISE NOTICE '  • 2 sample claims for ahmad@workived.com';
    RAISE NOTICE '  • 50 attendance records (14 days, various patterns: on-time, late, overtime, weekend)';
    RAISE NOTICE '══════════════════════════════════════════════════════════════';

END $$;

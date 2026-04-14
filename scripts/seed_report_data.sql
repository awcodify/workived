-- Seed comprehensive report data for ahmad@workived.com organization  
-- Creates 3-6 months of historical data for reports and analytics
-- Run after seed_test_data.sql

DO $$
DECLARE
    v_org_id UUID;
    v_ahmad_emp_id UUID;
    v_new_emp_id UUID;
    v_emp_hr_id UUID;
    v_emp_finance_id UUID;
    v_emp_designer_id UUID;
    v_emp_manager_id UUID;
    v_emp_hello_id UUID;
    v_emp_judy_id UUID;
    v_emp_dmitri_id UUID;
    v_emp_hans_id UUID;
    v_emp_juara_id UUID;
    
    -- Claim categories
    v_transport_cat UUID;
    v_meal_cat UUID;
    v_medical_cat UUID;
    v_internet_cat UUID;
    v_phone_cat UUID;
    
    -- Leave policies
    v_annual_leave_id UUID;
    v_sick_leave_id UUID;
    v_unpaid_leave_id UUID;
    
    -- Task lists
    v_todo_list UUID;
    v_progress_list UUID;
    v_done_list UUID;
    
    v_currency CHAR(3);
    v_current_year INT := EXTRACT(YEAR FROM CURRENT_DATE);
    v_date DATE;
    v_day_of_week INT;
    i INT;
BEGIN
    -- Get organization ID for ahmad@workived.com
    SELECT o.id INTO v_org_id 
    FROM organisations o
    JOIN users u ON u.email = 'ahmad@workived.com'
    JOIN organisation_members om ON om.user_id = u.id AND om.organisation_id = o.id
    LIMIT 1;
    
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Organization for ahmad@workived.com not found. Please run seed_test_data.sql first.';
    END IF;
    
    RAISE NOTICE 'Seeding report data for organization: %', v_org_id;
    
    -- Get employee IDs
    SELECT id INTO v_ahmad_emp_id FROM employees 
    WHERE organisation_id = v_org_id AND email = 'ahmad@workived.com';
    
    SELECT id INTO v_new_emp_id FROM employees 
    WHERE organisation_id = v_org_id AND email = 'new@rizkitech.com';
    
    SELECT id INTO v_emp_hr_id FROM employees 
    WHERE organisation_id = v_org_id AND email = 'sarah@rizkitech.com';
    
    SELECT id INTO v_emp_finance_id FROM employees 
    WHERE organisation_id = v_org_id AND email = 'michael@rizkitech.com';
    
    SELECT id INTO v_emp_designer_id FROM employees 
    WHERE organisation_id = v_org_id AND email = 'lisa@rizkitech.com';
    
    SELECT id INTO v_emp_manager_id FROM employees 
    WHERE organisation_id = v_org_id AND email = 'david@rizkitech.com';
    
    SELECT id INTO v_emp_hello_id FROM employees 
    WHERE organisation_id = v_org_id AND email = 'hello@workived.com';
    
    SELECT id INTO v_emp_judy_id FROM employees 
    WHERE organisation_id = v_org_id AND email = 'leave@workived.com';
    
    SELECT id INTO v_emp_dmitri_id FROM employees 
    WHERE organisation_id = v_org_id AND email = 'dmitri@agev.com';
    
    SELECT id INTO v_emp_hans_id FROM employees 
    WHERE organisation_id = v_org_id AND email = 'bawahan@workived.com';
    
    SELECT id INTO v_emp_juara_id FROM employees 
    WHERE organisation_id = v_org_id AND email = 'leave.1@workived.com';
    
    -- Get currency
    SELECT currency_code INTO v_currency FROM organisations WHERE id = v_org_id;
    
    -- Get claim category IDs
    SELECT id INTO v_transport_cat FROM claim_categories 
    WHERE organisation_id = v_org_id AND name = 'Transport';
    
    SELECT id INTO v_meal_cat FROM claim_categories 
    WHERE organisation_id = v_org_id AND name = 'Meal Allowance';
    
    SELECT id INTO v_medical_cat FROM claim_categories 
    WHERE organisation_id = v_org_id AND name = 'Medical';
    
    SELECT id INTO v_internet_cat FROM claim_categories 
    WHERE organisation_id = v_org_id AND name = 'Internet';
    
    SELECT id INTO v_phone_cat FROM claim_categories 
    WHERE organisation_id = v_org_id AND name = 'Phone';
    
    -- Get leave policy IDs
    SELECT id INTO v_annual_leave_id FROM leave_policies 
    WHERE organisation_id = v_org_id AND name = 'Annual Leave';
    
    SELECT id INTO v_sick_leave_id FROM leave_policies 
    WHERE organisation_id = v_org_id AND name = 'Sick Leave';
    
    SELECT id INTO v_unpaid_leave_id FROM leave_policies 
    WHERE organisation_id = v_org_id AND name = 'Unpaid Leave';
    
    RAISE NOTICE 'Starting to seed historical data...';
    
    -- ============================================================
    -- 1. HISTORICAL ATTENDANCE DATA (Last 90 days)
    -- ============================================================
    RAISE NOTICE '1. Seeding 90 days of attendance data...';
    
    -- Delete existing attendance records to avoid duplicates
    DELETE FROM attendance_records 
    WHERE organisation_id = v_org_id 
    AND date >= CURRENT_DATE - INTERVAL '90 days';
    
    -- First, seed complete April 2026 attendance (14 working days so far)
    -- This ensures we have 100% coverage for "this month" reports
    FOR i IN 1..(EXTRACT(DAY FROM CURRENT_DATE)::INT) LOOP
        v_date := DATE_TRUNC('month', CURRENT_DATE) + (i - 1|| ' days')::INTERVAL;
        v_day_of_week := EXTRACT(DOW FROM v_date);
        
        -- Skip weekends
        IF v_day_of_week NOT IN (0, 6) THEN
            -- Ahmad (CEO): Always present, 95% on-time
            INSERT INTO attendance_records (
                organisation_id, employee_id, date, 
                clock_in_at, clock_out_at, is_late,
                clock_in_latitude, clock_in_longitude
            ) VALUES (
                v_org_id, v_ahmad_emp_id, v_date,
                v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 20 - 5)),
                v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 120)),
                (random() < 0.05),
                -6.2088 + (random() * 0.01 - 0.005),
                106.8456 + (random() * 0.01 - 0.005)
            );
            
            -- New Employee/Mohammed Pasha: 90% present, 15% late
            IF random() < 0.90 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_new_emp_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 40)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 60)),
                    (random() < 0.15),
                    -6.2188 + (random() * 0.01 - 0.005),
                    106.8556 + (random() * 0.01 - 0.005)
                );
            END IF;
            
            -- Sarah (HR): 98% present, very punctual
            IF random() < 0.98 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_emp_hr_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 10 - 5)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 90)),
                    (random() < 0.03),
                    -6.2088 + (random() * 0.01 - 0.005),
                    106.8456 + (random() * 0.01 - 0.005)
                );
            END IF;
            
            -- Michael (Finance): 99% present, extremely punctual
            IF random() < 0.99 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_emp_finance_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 8 - 3)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 30)),
                    (random() < 0.01),
                    -6.2088 + (random() * 0.01 - 0.005),
                    106.8456 + (random() * 0.01 - 0.005)
                );
            END IF;
            
            -- Lisa (Designer): 92% present, creative schedule
            IF random() < 0.92 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_emp_designer_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 60)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 180)),
                    (random() < 0.20),
                    -6.2288 + (random() * 0.01 - 0.005),
                    106.8656 + (random() * 0.01 - 0.005)
                );
            END IF;
            
            -- David (Manager): 97% present, regular hours
            IF random() < 0.97 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_emp_manager_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 15 - 5)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 120)),
                    (random() < 0.06),
                    -6.2088 + (random() * 0.01 - 0.005),
                    106.8456 + (random() * 0.01 - 0.005)
                );
            END IF;
            
            -- Hello: 94% present, 10% late
            IF v_emp_hello_id IS NOT NULL AND random() < 0.94 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_emp_hello_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 30)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 90)),
                    (random() < 0.10),
                    -6.2088 + (random() * 0.01 - 0.005),
                    106.8456 + (random() * 0.01 - 0.005)
                );
            END IF;
            
            -- Judy: 96% present, 8% late
            IF v_emp_judy_id IS NOT NULL AND random() < 0.96 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_emp_judy_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 25)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 60)),
                    (random() < 0.08),
                    -6.2088 + (random() * 0.01 - 0.005),
                    106.8456 + (random() * 0.01 - 0.005)
                );
            END IF;
            
            -- Dmitri: 91% present, 18% late
            IF v_emp_dmitri_id IS NOT NULL AND random() < 0.91 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_emp_dmitri_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 50)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 90)),
                    (random() < 0.18),
                    -6.2088 + (random() * 0.01 - 0.005),
                    106.8456 + (random() * 0.01 - 0.005)
                );
            END IF;
            
            -- Hans (Intern): 65% present, 40% late ⚠️ ANOMALY EMPLOYEE
            IF v_emp_hans_id IS NOT NULL AND random() < 0.65 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_emp_hans_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 90)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 60)),
                    (random() < 0.40),
                    -6.2088 + (random() * 0.01 - 0.005),
                    106.8456 + (random() * 0.01 - 0.005)
                );
            END IF;
            
            -- Juara: 93% present, 12% late
            IF v_emp_juara_id IS NOT NULL AND random() < 0.93 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_emp_juara_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 35)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 75)),
                    (random() < 0.12),
                    -6.2088 + (random() * 0.01 - 0.005),
                    106.8456 + (random() * 0.01 - 0.005)
                );
            END IF;
        END IF;
    END LOOP;
    
    -- Then seed the rest of the 90-day period (previous months)
    FOR i IN (EXTRACT(DAY FROM CURRENT_DATE)::INT + 1)..90 LOOP
        v_date := CURRENT_DATE - (i || ' days')::INTERVAL;
        v_day_of_week := EXTRACT(DOW FROM v_date); -- 0=Sunday, 6=Saturday
        
        -- Skip weekends (0=Sunday, 6=Saturday)
        IF v_day_of_week NOT IN (0, 6) THEN
            
            -- Ahmad (CEO): 95% attendance rate, mostly on-time
            IF random() < 0.95 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_ahmad_emp_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 30 - 10)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 120)),
                    (random() < 0.1), -- 10% late
                    -6.2088 + (random() * 0.01 - 0.005),
                    106.8456 + (random() * 0.01 - 0.005)
                );
            END IF;
            
            -- New Employee (Engineer): 85% attendance, 20% late
            IF random() < 0.85 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_new_emp_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 60)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 60)),
                    (random() < 0.2), -- 20% late
                    -6.2188 + (random() * 0.01 - 0.005),
                    106.8556 + (random() * 0.01 - 0.005)
                );
            END IF;
            
            -- Sarah (HR): 98% attendance, very punctual
            IF random() < 0.98 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_emp_hr_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 15 - 5)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 90)),
                    (random() < 0.05), -- 5% late
                    -6.2088 + (random() * 0.01 - 0.005),
                    106.8456 + (random() * 0.01 - 0.005)
                );
            END IF;
            
            -- Michael (Finance): 99% attendance, extremely punctual
            IF random() < 0.99 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_emp_finance_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 10 - 5)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 30)),
                    (random() < 0.02), -- 2% late
                    -6.2088 + (random() * 0.01 - 0.005),
                    106.8456 + (random() * 0.01 - 0.005)
                );
            END IF;
            
            -- Lisa (Designer): 88% attendance, creative schedule
            IF random() < 0.88 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_emp_designer_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 90)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 180)),
                    (random() < 0.25), -- 25% late
                    -6.2288 + (random() * 0.01 - 0.005),
                    106.8656 + (random() * 0.01 - 0.005)
                );
            END IF;
            
            -- David (Manager): 96% attendance, regular hours
            IF random() < 0.96 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_emp_manager_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 20 - 5)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 120)),
                    (random() < 0.08), -- 8% late
                    -6.2088 + (random() * 0.01 - 0.005),
                    106.8456 + (random() * 0.01 - 0.005)
                );
            END IF;
            
            -- Additional 5 employees for historical data
            IF v_emp_hello_id IS NOT NULL AND random() < 0.93 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_emp_hello_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 35)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 90)),
                    (random() < 0.11),
                    -6.2088 + (random() * 0.01 - 0.005),
                    106.8456 + (random() * 0.01 - 0.005)
                );
            END IF;
            
            IF v_emp_judy_id IS NOT NULL AND random() < 0.95 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_emp_judy_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 28)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 65)),
                    (random() < 0.09),
                    -6.2088 + (random() * 0.01 - 0.005),
                    106.8456 + (random() * 0.01 - 0.005)
                );
            END IF;
            
            IF v_emp_dmitri_id IS NOT NULL AND random() < 0.90 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_emp_dmitri_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 55)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 95)),
                    (random() < 0.19),
                    -6.2088 + (random() * 0.01 - 0.005),
                    106.8456 + (random() * 0.01 - 0.005)
                );
            END IF;
            
            -- Hans (Intern): 65% attendance ⚠️ ANOMALY EMPLOYEE
            IF v_emp_hans_id IS NOT NULL AND random() < 0.65 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_emp_hans_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 90)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 60)),
                    (random() < 0.40),
                    -6.2088 + (random() * 0.01 - 0.005),
                    106.8456 + (random() * 0.01 - 0.005)
                );
            END IF;
            
            IF v_emp_juara_id IS NOT NULL AND random() < 0.92 THEN
                INSERT INTO attendance_records (
                    organisation_id, employee_id, date, 
                    clock_in_at, clock_out_at, is_late,
                    clock_in_latitude, clock_in_longitude
                ) VALUES (
                    v_org_id, v_emp_juara_id, v_date,
                    v_date + TIME '08:00:00' + (INTERVAL '1 minute' * floor(random() * 38)),
                    v_date + TIME '17:00:00' + (INTERVAL '1 minute' * floor(random() * 80)),
                    (random() < 0.13),
                    -6.2088 + (random() * 0.01 - 0.005),
                    106.8456 + (random() * 0.01 - 0.005)
                );
            END IF;
            
        END IF;
    END LOOP;
    
    RAISE NOTICE '✓ Created ~400 attendance records (90 days, excluding weekends)';
    
    -- ============================================================
    -- 2. HISTORICAL LEAVE REQUESTS (Last 6 months)
    -- ============================================================
    RAISE NOTICE '2. Seeding historical leave requests...';
    
    -- Delete existing future leave requests to avoid conflicts
    DELETE FROM leave_requests 
    WHERE organisation_id = v_org_id 
    AND start_date >= CURRENT_DATE - INTERVAL '180 days';
    
    -- Ahmad - Various leave requests over 6 months
    INSERT INTO leave_requests (
        organisation_id, employee_id, leave_policy_id, 
        start_date, end_date, total_days, status, reason, created_at
    ) VALUES 
        -- Month -5: Vacation
        (v_org_id, v_ahmad_emp_id, v_annual_leave_id, 
         CURRENT_DATE - INTERVAL '150 days', CURRENT_DATE - INTERVAL '146 days', 5, 
         'approved', 'Family vacation', CURRENT_DATE - INTERVAL '160 days'),
        
        -- Month -3: Conference
        (v_org_id, v_ahmad_emp_id, v_annual_leave_id, 
         CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE - INTERVAL '88 days', 3, 
         'approved', 'Tech conference in Singapore', CURRENT_DATE - INTERVAL '100 days'),
        
        -- Month -2: Sick leave
        (v_org_id, v_ahmad_emp_id, v_sick_leave_id, 
         CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE - INTERVAL '60 days', 1, 
         'approved', 'Flu', CURRENT_DATE - INTERVAL '60 days'),
        
        -- Month -1: Personal day
        (v_org_id, v_ahmad_emp_id, v_annual_leave_id, 
         CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE - INTERVAL '20 days', 1, 
         'approved', 'Personal matters', CURRENT_DATE - INTERVAL '25 days'),
        
        -- Next month: Planned vacation
        (v_org_id, v_ahmad_emp_id, v_annual_leave_id, 
         CURRENT_DATE + INTERVAL '30 days', CURRENT_DATE + INTERVAL '34 days', 5, 
         'pending', 'Eid holiday extension', CURRENT_DATE - INTERVAL '2 days');
    
    -- New Employee - Leave requests
    INSERT INTO leave_requests (
        organisation_id, employee_id, leave_policy_id, 
        start_date, end_date, total_days, status, reason, created_at
    ) VALUES 
        (v_org_id, v_new_emp_id, v_sick_leave_id, 
         CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE - INTERVAL '44 days', 2, 
         'approved', 'Food poisoning', CURRENT_DATE - INTERVAL '45 days'),
        
        (v_org_id, v_new_emp_id, v_annual_leave_id, 
         CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE - INTERVAL '15 days', 1, 
         'approved', 'Driving test', CURRENT_DATE - INTERVAL '20 days'),
        
        (v_org_id, v_new_emp_id, v_annual_leave_id, 
         CURRENT_DATE + INTERVAL '45 days', CURRENT_DATE + INTERVAL '49 days', 5, 
         'pending', 'Cousin wedding in Bandung', CURRENT_DATE);
    
    -- Sarah (HR) - Leave requests
    INSERT INTO leave_requests (
        organisation_id, employee_id, leave_policy_id, 
        start_date, end_date, total_days, status, reason, created_at
    ) VALUES 
        (v_org_id, v_emp_hr_id, v_annual_leave_id, 
         CURRENT_DATE - INTERVAL '120 days', CURRENT_DATE - INTERVAL '116 days', 5, 
         'approved', 'Year-end holiday', CURRENT_DATE - INTERVAL '130 days'),
        
        (v_org_id, v_emp_hr_id, v_sick_leave_id, 
         CURRENT_DATE - INTERVAL '75 days', CURRENT_DATE - INTERVAL '75 days', 1, 
         'approved', 'Medical checkup', CURRENT_DATE - INTERVAL '75 days'),
        
        (v_org_id, v_emp_hr_id, v_annual_leave_id, 
         CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '28 days', 3, 
         'approved', 'Long weekend trip', CURRENT_DATE - INTERVAL '40 days'),
        
        (v_org_id, v_emp_hr_id, v_annual_leave_id, 
         CURRENT_DATE + INTERVAL '60 days', CURRENT_DATE + INTERVAL '64 days', 5, 
         'approved', 'Anniversary celebration', CURRENT_DATE - INTERVAL '5 days');
    
    -- Michael (Finance) - Leave requests
    INSERT INTO leave_requests (
        organisation_id, employee_id, leave_policy_id, 
        start_date, end_date, total_days, status, reason, created_at
    ) VALUES 
        (v_org_id, v_emp_finance_id, v_annual_leave_id, 
         CURRENT_DATE - INTERVAL '100 days', CURRENT_DATE - INTERVAL '98 days', 3, 
         'approved', 'Home renovation', CURRENT_DATE - INTERVAL '110 days'),
        
        (v_org_id, v_emp_finance_id, v_annual_leave_id, 
         CURRENT_DATE + INTERVAL '10 days', CURRENT_DATE + INTERVAL '12 days', 3, 
         'rejected', 'Conflicts with audit period', CURRENT_DATE - INTERVAL '3 days'),
        
        (v_org_id, v_emp_finance_id, v_annual_leave_id, 
         CURRENT_DATE + INTERVAL '90 days', CURRENT_DATE + INTERVAL '99 days', 10, 
         'approved', 'Family visit to Jakarta', CURRENT_DATE - INTERVAL '10 days');
    
    -- Lisa (Designer) - Leave requests
    INSERT INTO leave_requests (
        organisation_id, employee_id, leave_policy_id, 
        start_date, end_date, total_days, status, reason, created_at
    ) VALUES 
        (v_org_id, v_emp_designer_id, v_sick_leave_id, 
         CURRENT_DATE - INTERVAL '50 days', CURRENT_DATE - INTERVAL '50 days', 1, 
         'approved', 'Migraine', CURRENT_DATE - INTERVAL '50 days'),
        
        (v_org_id, v_emp_designer_id, v_annual_leave_id, 
         CURRENT_DATE + INTERVAL '14 days', CURRENT_DATE + INTERVAL '16 days', 3, 
         'approved', 'Design conference Jakarta', CURRENT_DATE - INTERVAL '7 days'),
        
        (v_org_id, v_emp_designer_id, v_annual_leave_id, 
         CURRENT_DATE, CURRENT_DATE, 0.5, 
         'pending', 'Dental appointment', CURRENT_DATE);
    
    -- David (Manager) - Leave requests
    INSERT INTO leave_requests (
        organisation_id, employee_id, leave_policy_id, 
        start_date, end_date, total_days, status, reason, created_at
    ) VALUES 
        (v_org_id, v_emp_manager_id, v_annual_leave_id, 
         CURRENT_DATE - INTERVAL '140 days', CURRENT_DATE - INTERVAL '136 days', 5, 
         'approved', 'Umrah pilgrimage', CURRENT_DATE - INTERVAL '150 days'),
        
        (v_org_id, v_emp_manager_id, v_sick_leave_id, 
         CURRENT_DATE - INTERVAL '8 days', CURRENT_DATE - INTERVAL '7 days', 2, 
         'approved', 'Family emergency', CURRENT_DATE - INTERVAL '8 days'),
        
        (v_org_id, v_emp_manager_id, v_unpaid_leave_id, 
         CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE - INTERVAL '1 day', 0.5, 
         'approved', 'Personal errands', CURRENT_DATE - INTERVAL '2 days'),
        
        (v_org_id, v_emp_manager_id, v_annual_leave_id, 
         CURRENT_DATE + INTERVAL '25 days', CURRENT_DATE + INTERVAL '27 days', 3, 
         'pending', 'Son graduation ceremony', CURRENT_DATE);
    
    RAISE NOTICE '✓ Created 25+ historical leave requests across 6 months';
    
    -- ============================================================
    -- 3. HISTORICAL CLAIMS DATA (Last 3 months)
    -- ============================================================
    RAISE NOTICE '3. Seeding historical claims data...';
    
    -- Ensure claim balances exist for past months
    INSERT INTO claim_balances (organisation_id, employee_id, category_id, year, month, currency_code, monthly_limit)
    SELECT DISTINCT
        v_org_id, 
        e.id, 
        cc.id, 
        EXTRACT(YEAR FROM m.month_date)::INT,
        EXTRACT(MONTH FROM m.month_date)::INT,
        cc.currency_code, 
        cc.monthly_limit
    FROM employees e
    CROSS JOIN claim_categories cc
    CROSS JOIN (
        SELECT CURRENT_DATE - INTERVAL '3 months' + (n || ' months')::INTERVAL AS month_date
        FROM generate_series(0, 3) n
    ) m
    WHERE e.organisation_id = v_org_id 
    AND e.is_active = true
    AND cc.organisation_id = v_org_id
    AND cc.is_active = true
    ON CONFLICT DO NOTHING;
    
    -- Delete existing claims to avoid duplicates
    DELETE FROM claims 
    WHERE organisation_id = v_org_id 
    AND claim_date >= CURRENT_DATE - INTERVAL '90 days';
    
    -- Ahmad - Regular claims across categories
    INSERT INTO claims (organisation_id, employee_id, category_id, amount, currency_code, status, claim_date, description, created_at) VALUES
        -- Month -3
        (v_org_id, v_ahmad_emp_id, v_transport_cat, 150000, v_currency, 'approved', CURRENT_DATE - INTERVAL '85 days', 'Taxi to client meeting', CURRENT_DATE - INTERVAL '85 days'),
        (v_org_id, v_ahmad_emp_id, v_meal_cat, 250000, v_currency, 'approved', CURRENT_DATE - INTERVAL '80 days', 'Team lunch', CURRENT_DATE - INTERVAL '80 days'),
        (v_org_id, v_ahmad_emp_id, v_internet_cat, 300000, v_currency, 'approved', CURRENT_DATE - INTERVAL '75 days', 'Home internet - March', CURRENT_DATE - INTERVAL '75 days'),
        
        -- Month -2
        (v_org_id, v_ahmad_emp_id, v_transport_cat, 200000, v_currency, 'approved', CURRENT_DATE - INTERVAL '55 days', 'Airport taxi', CURRENT_DATE - INTERVAL '55 days'),
        (v_org_id, v_ahmad_emp_id, v_phone_cat, 150000, v_currency, 'approved', CURRENT_DATE - INTERVAL '50 days', 'Mobile bill - Feb', CURRENT_DATE - INTERVAL '50 days'),
        (v_org_id, v_ahmad_emp_id, v_medical_cat, 500000, v_currency, 'approved', CURRENT_DATE - INTERVAL '45 days', 'Annual health checkup', CURRENT_DATE - INTERVAL '45 days'),
        
        -- Month -1
        (v_org_id, v_ahmad_emp_id, v_transport_cat, 75000, v_currency, 'approved', CURRENT_DATE - INTERVAL '25 days', 'Grab to office', CURRENT_DATE - INTERVAL '25 days'),
        (v_org_id, v_ahmad_emp_id, v_meal_cat, 120000, v_currency, 'approved', CURRENT_DATE - INTERVAL '20 days', 'Client lunch', CURRENT_DATE - INTERVAL '20 days'),
        (v_org_id, v_ahmad_emp_id, v_internet_cat, 300000, v_currency, 'approved', CURRENT_DATE - INTERVAL '10 days', 'Home internet - current month', CURRENT_DATE - INTERVAL '10 days'),
        
        -- Current month
        (v_org_id, v_ahmad_emp_id, v_transport_cat, 50000, v_currency, 'pending', CURRENT_DATE - INTERVAL '2 days', 'Taxi to venue', CURRENT_DATE - INTERVAL '2 days'),
        (v_org_id, v_ahmad_emp_id, v_meal_cat, 85000, v_currency, 'pending', CURRENT_DATE - INTERVAL '1 day', 'Working lunch', CURRENT_DATE - INTERVAL '1 day');
    
    -- New Employee - Regular commute and meal claims
    INSERT INTO claims (organisation_id, employee_id, category_id, amount, currency_code, status, claim_date, description, created_at) VALUES
        (v_org_id, v_new_emp_id, v_transport_cat, 100000, v_currency, 'approved', CURRENT_DATE - INTERVAL '75 days', 'Week transport', CURRENT_DATE - INTERVAL '75 days'),
        (v_org_id, v_new_emp_id, v_meal_cat, 150000, v_currency, 'approved', CURRENT_DATE - INTERVAL '70 days', 'Weekly meals', CURRENT_DATE - INTERVAL '70 days'),
        (v_org_id, v_new_emp_id, v_transport_cat, 120000, v_currency, 'approved', CURRENT_DATE - INTERVAL '45 days', 'Commute costs', CURRENT_DATE - INTERVAL '45 days'),
        (v_org_id, v_new_emp_id, v_meal_cat, 180000, v_currency, 'approved', CURRENT_DATE - INTERVAL '40 days', 'Lunch allowance', CURRENT_DATE - INTERVAL '40 days'),
        (v_org_id, v_new_emp_id, v_transport_cat, 90000, v_currency, 'approved', CURRENT_DATE - INTERVAL '15 days', 'Grab costs', CURRENT_DATE - INTERVAL '15 days'),
        (v_org_id, v_new_emp_id, v_internet_cat, 250000, v_currency, 'pending', CURRENT_DATE - INTERVAL '5 days', 'Internet bill', CURRENT_DATE - INTERVAL '5 days');
    
    -- Sarah (HR) - Professional claims
    INSERT INTO claims (organisation_id, employee_id, category_id, amount, currency_code, status, claim_date, description, created_at) VALUES
        (v_org_id, v_emp_hr_id, v_transport_cat, 80000, v_currency, 'approved', CURRENT_DATE - INTERVAL '80 days', 'HR conference transport', CURRENT_DATE - INTERVAL '80 days'),
        (v_org_id, v_emp_hr_id, v_meal_cat, 200000, v_currency, 'approved', CURRENT_DATE - INTERVAL '60 days', 'Candidate interviews', CURRENT_DATE - INTERVAL '60 days'),
        (v_org_id, v_emp_hr_id, v_phone_cat, 180000, v_currency, 'approved', CURRENT_DATE - INTERVAL '50 days', 'Phone bill', CURRENT_DATE - INTERVAL '50 days'),
        (v_org_id, v_emp_hr_id, v_transport_cat, 60000, v_currency, 'approved', CURRENT_DATE - INTERVAL '30 days', 'Site visit transport', CURRENT_DATE - INTERVAL '30 days'),
        (v_org_id, v_emp_hr_id, v_internet_cat, 300000, v_currency, 'approved', CURRENT_DATE - INTERVAL '10 days', 'Internet reimbursement', CURRENT_DATE - INTERVAL '10 days');
    
    -- Michael (Finance) - Conservative claims
    INSERT INTO claims (organisation_id, employee_id, category_id, amount, currency_code, status, claim_date, description, created_at) VALUES
        (v_org_id, v_emp_finance_id, v_internet_cat, 300000, v_currency, 'approved', CURRENT_DATE - INTERVAL '85 days', 'Internet - Month -3', CURRENT_DATE - INTERVAL '85 days'),
        (v_org_id, v_emp_finance_id, v_phone_cat, 200000, v_currency, 'approved', CURRENT_DATE - INTERVAL '80 days', 'Phone - Month -3', CURRENT_DATE - INTERVAL '80 days'),
        (v_org_id, v_emp_finance_id, v_internet_cat, 300000, v_currency, 'approved', CURRENT_DATE - INTERVAL '55 days', 'Internet - Month -2', CURRENT_DATE - INTERVAL '55 days'),
        (v_org_id, v_emp_finance_id, v_phone_cat, 200000, v_currency, 'approved', CURRENT_DATE - INTERVAL '50 days', 'Phone - Month -2', CURRENT_DATE - INTERVAL '50 days'),
        (v_org_id, v_emp_finance_id, v_transport_cat, 45000, v_currency, 'approved', CURRENT_DATE - INTERVAL '40 days', 'Bank meeting', CURRENT_DATE - INTERVAL '40 days'),
        (v_org_id, v_emp_finance_id, v_internet_cat, 300000, v_currency, 'approved', CURRENT_DATE - INTERVAL '10 days', 'Internet - current', CURRENT_DATE - INTERVAL '10 days'),
        (v_org_id, v_emp_finance_id, v_phone_cat, 200000, v_currency, 'pending', CURRENT_DATE - INTERVAL '3 days', 'Phone - current', CURRENT_DATE - INTERVAL '3 days');
    
    -- Lisa (Designer) - Creative work claims
    INSERT INTO claims (organisation_id, employee_id, category_id, amount, currency_code, status, claim_date, description, created_at) VALUES
        (v_org_id, v_emp_designer_id, v_transport_cat, 95000, v_currency, 'approved', CURRENT_DATE - INTERVAL '70 days', 'Design workshop', CURRENT_DATE - INTERVAL '70 days'),
        (v_org_id, v_emp_designer_id, v_meal_cat, 180000, v_currency, 'approved', CURRENT_DATE - INTERVAL '65 days', 'Late night meals', CURRENT_DATE - INTERVAL '65 days'),
        (v_org_id, v_emp_designer_id, v_internet_cat, 300000, v_currency, 'approved', CURRENT_DATE - INTERVAL '55 days', 'High-speed internet - work', CURRENT_DATE - INTERVAL '55 days'),
        (v_org_id, v_emp_designer_id, v_transport_cat, 110000, v_currency, 'approved', CURRENT_DATE - INTERVAL '35 days', 'Client presentations', CURRENT_DATE - INTERVAL '35 days'),
        (v_org_id, v_emp_designer_id, v_meal_cat, 220000, v_currency, 'approved', CURRENT_DATE - INTERVAL '25 days', 'Project dinner', CURRENT_DATE - INTERVAL '25 days'),
        (v_org_id, v_emp_designer_id, v_transport_cat, 65000, v_currency, 'pending', CURRENT_DATE - INTERVAL '4 days', 'Creative meetup', CURRENT_DATE - INTERVAL '4 days');
    
    -- David (Manager) - Management-related claims
    INSERT INTO claims (organisation_id, employee_id, category_id, amount, currency_code, status, claim_date, description, created_at) VALUES
        (v_org_id, v_emp_manager_id, v_transport_cat, 120000, v_currency, 'approved', CURRENT_DATE - INTERVAL '78 days', 'Team offsite', CURRENT_DATE - INTERVAL '78 days'),
        (v_org_id, v_emp_manager_id, v_meal_cat, 350000, v_currency, 'approved', CURRENT_DATE - INTERVAL '75 days', 'Team building lunch', CURRENT_DATE - INTERVAL '75 days'),
        (v_org_id, v_emp_manager_id, v_phone_cat, 200000, v_currency, 'approved', CURRENT_DATE - INTERVAL '60 days', 'Phone bill', CURRENT_DATE - INTERVAL '60 days'),
        (v_org_id, v_emp_manager_id, v_internet_cat, 300000, v_currency, 'approved', CURRENT_DATE - INTERVAL '55 days', 'Internet', CURRENT_DATE - INTERVAL '55 days'),
        (v_org_id, v_emp_manager_id, v_transport_cat, 85000, v_currency, 'approved', CURRENT_DATE - INTERVAL '30 days', 'Partner meeting', CURRENT_DATE - INTERVAL '30 days'),
        (v_org_id, v_emp_manager_id, v_meal_cat, 280000, v_currency, 'approved', CURRENT_DATE - INTERVAL '20 days', 'Leadership dinner', CURRENT_DATE - INTERVAL '20 days'),
        (v_org_id, v_emp_manager_id, v_medical_cat, 750000, v_currency, 'rejected', CURRENT_DATE - INTERVAL '15 days', 'Cosmetic dentistry - not covered', CURRENT_DATE - INTERVAL '15 days'),
        (v_org_id, v_emp_manager_id, v_phone_cat, 200000, v_currency, 'approved', CURRENT_DATE - INTERVAL '10 days', 'Phone - current', CURRENT_DATE - INTERVAL '10 days');
    
    RAISE NOTICE '✓ Created 50+ historical claims across 3 months and all categories';
    
    -- ============================================================
    -- 4. TASK LISTS AND TASKS
    -- ============================================================
    RAISE NOTICE '4. Seeding task lists and tasks...';
    
    -- Check if task lists already exist
    SELECT id INTO v_todo_list FROM task_lists 
    WHERE organisation_id = v_org_id AND name = 'To Do' LIMIT 1;
    
    IF v_todo_list IS NULL THEN
        -- Create task lists
        INSERT INTO task_lists (id, organisation_id, name, position, created_by)
        VALUES 
            (gen_random_uuid(), v_org_id, 'To Do', 1000, v_ahmad_emp_id),
            (gen_random_uuid(), v_org_id, 'In Progress', 2000, v_ahmad_emp_id),
            (gen_random_uuid(), v_org_id, 'Done', 3000, v_ahmad_emp_id);
        
        RAISE NOTICE '✓ Created 3 task lists';
    ELSE
        RAISE NOTICE '✓ Task lists already exist';
    END IF;
    
    -- Get task list IDs
    SELECT id INTO v_todo_list FROM task_lists 
    WHERE organisation_id = v_org_id AND name = 'To Do';
    
    SELECT id INTO v_progress_list FROM task_lists 
    WHERE organisation_id = v_org_id AND name = 'In Progress';
    
    SELECT id INTO v_done_list FROM task_lists 
    WHERE organisation_id = v_org_id AND name = 'Done';
    
    -- Delete existing tasks to avoid duplicates
    DELETE FROM tasks WHERE organisation_id = v_org_id;
    
    -- Create diverse tasks with proper completion timestamps
    -- NOTE: created_at determines which report period the task appears in
    -- completed_at determines when it was done (for completion metrics)
    INSERT INTO tasks (organisation_id, task_list_id, created_by, title, description, priority, due_date, assignee_id, position, created_at, completed_at) VALUES
        -- TO DO LIST (7 tasks - lean backlog for healthy company)
        (v_org_id, v_todo_list, v_ahmad_emp_id, 'Fix critical security vulnerability', 
         'CVE-2024-1234 requires immediate patch', 'urgent', 
         CURRENT_DATE - INTERVAL '2 days', v_emp_manager_id, 1000, CURRENT_DATE - INTERVAL '3 days', NULL),
        
        (v_org_id, v_todo_list, v_ahmad_emp_id, 'Complete Q2 financial report', 
         'Board meeting preparation', 'urgent', 
         CURRENT_DATE, v_emp_finance_id, 2000, CURRENT_DATE - INTERVAL '5 days', NULL),
        
        (v_org_id, v_todo_list, v_ahmad_emp_id, 'Design new onboarding flow', 
         'User feedback shows confusion in current flow', 'high', 
         CURRENT_DATE + INTERVAL '3 days', v_emp_designer_id, 3000, CURRENT_DATE - INTERVAL '8 days', NULL),
        
        (v_org_id, v_todo_list, v_ahmad_emp_id, 'Update API documentation', 
         'New endpoints need examples and descriptions', 'medium', 
         CURRENT_DATE + INTERVAL '5 days', v_new_emp_id, 4000, CURRENT_DATE - INTERVAL '4 days', NULL),
        
        (v_org_id, v_todo_list, v_emp_finance_id, 'Prepare tax documentation', 
         'Q2 tax filing preparation', 'high', 
         CURRENT_DATE + INTERVAL '10 days', v_emp_finance_id, 8000, CURRENT_DATE - INTERVAL '2 days', NULL),
        
        (v_org_id, v_todo_list, v_emp_manager_id, 'Performance review scheduling', 
         'Book 1-on-1 sessions with team', 'medium', 
         CURRENT_DATE + INTERVAL '5 days', v_emp_manager_id, 10000, CURRENT_DATE - INTERVAL '1 day', NULL),
        
        (v_org_id, v_todo_list, v_new_emp_id, 'Investigate production bug', 
         'Error rate increased 2% yesterday', 'high', 
         CURRENT_DATE + INTERVAL '1 day', v_new_emp_id, 11000, CURRENT_DATE, NULL),
        
        -- IN PROGRESS LIST (5 tasks - focused work in progress for healthy company)
        (v_org_id, v_progress_list, v_ahmad_emp_id, 'Implement real-time notifications', 
         'WebSocket integration for live updates', 'high', 
         CURRENT_DATE + INTERVAL '2 days', v_new_emp_id, 1000, CURRENT_DATE - INTERVAL '6 days', NULL),
        
        (v_org_id, v_progress_list, v_ahmad_emp_id, 'Refactor authentication service', 
         'Improve security and performance', 'high', 
         CURRENT_DATE + INTERVAL '5 days', v_emp_manager_id, 2000, CURRENT_DATE - INTERVAL '7 days', NULL),
        
        (v_org_id, v_progress_list, v_emp_designer_id, 'Create mobile app mockups', 
         'iOS and Android designs', 'high', 
         CURRENT_DATE + INTERVAL '6 days', v_emp_designer_id, 4000, CURRENT_DATE - INTERVAL '8 days', NULL),
        
        (v_org_id, v_progress_list, v_emp_finance_id, 'Quarterly budget review', 
         'Analyze Q1 spending vs forecast', 'high', 
         CURRENT_DATE + INTERVAL '3 days', v_emp_finance_id, 5000, CURRENT_DATE - INTERVAL '4 days', NULL),
        
        (v_org_id, v_progress_list, v_new_emp_id, 'Database optimization', 
         'Index tuning and query optimization', 'medium', 
         CURRENT_DATE + INTERVAL '7 days', v_new_emp_id, 6000, CURRENT_DATE - INTERVAL '9 days', NULL),
        
        -- DONE LIST - Week 1 (Last 7 days - VISIBLE on board + in all reports)
        (v_org_id, v_done_list, v_ahmad_emp_id, 'Fix critical payment bug', 
         'Resolved Stripe webhook timeout issue', 'urgent', 
         CURRENT_DATE - INTERVAL '2 days', v_new_emp_id, 1000, 
         CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE - INTERVAL '1 day'),
        
        (v_org_id, v_done_list, v_emp_hr_id, 'Complete Q1 hiring report', 
         'Submitted to leadership team', 'high', 
         CURRENT_DATE - INTERVAL '3 days', v_emp_hr_id, 2000, 
         CURRENT_DATE - INTERVAL '4 days', CURRENT_DATE - INTERVAL '2 days'),
        
        (v_org_id, v_done_list, v_emp_designer_id, 'Update brand guidelines', 
         'Version 2.1 published to team', 'medium', 
         CURRENT_DATE - INTERVAL '4 days', v_emp_designer_id, 3000, 
         CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '3 days'),
        
        (v_org_id, v_done_list, v_emp_manager_id, 'Code review sprint backlog', 
         'Reviewed 12 PRs', 'high', 
         CURRENT_DATE - INTERVAL '5 days', v_emp_manager_id, 4000, 
         CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE - INTERVAL '4 days'),
        
        (v_org_id, v_done_list, v_emp_finance_id, 'Process vendor invoices', 
         'April payments completed', 'medium', 
         CURRENT_DATE - INTERVAL '6 days', v_emp_finance_id, 5000, 
         CURRENT_DATE - INTERVAL '8 days', CURRENT_DATE - INTERVAL '5 days'),
        
        (v_org_id, v_done_list, v_ahmad_emp_id, 'Client demo preparation', 
         'Slides and demo environment ready', 'high', 
         CURRENT_DATE - INTERVAL '7 days', v_ahmad_emp_id, 6000, 
         CURRENT_DATE - INTERVAL '9 days', CURRENT_DATE - INTERVAL '6 days'),
        
        (v_org_id, v_done_list, v_new_emp_id, 'Deploy hotfix v2.1.3', 
         'Critical UI bug resolved', 'urgent', 
         CURRENT_DATE - INTERVAL '1 day', v_new_emp_id, 7000, 
         CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE - INTERVAL '1 day'),
        
        (v_org_id, v_done_list, v_emp_hr_id, 'Interview 3 candidates', 
         'Engineering positions screening', 'high', 
         CURRENT_DATE - INTERVAL '5 days', v_emp_hr_id, 8000, 
         CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '5 days'),
        
        -- DONE LIST - Week 2-4 (This Month - created in April, completed recently)
        (v_org_id, v_done_list, v_new_emp_id, 'Optimize homepage load time', 
         'Reduced from 3.2s to 1.1s', 'high', 
         CURRENT_DATE - INTERVAL '12 days', v_new_emp_id, 9000, 
         CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '10 days'),
        
        (v_org_id, v_done_list, v_emp_hr_id, 'Onboard 2 new hires', 
         'Completed orientation program', 'medium', 
         CURRENT_DATE - INTERVAL '10 days', v_emp_hr_id, 10000, 
         CURRENT_DATE - INTERVAL '12 days', CURRENT_DATE - INTERVAL '9 days'),
        
        (v_org_id, v_done_list, v_emp_finance_id, 'March financial close', 
         'All accounts reconciled', 'urgent', 
         CURRENT_DATE - INTERVAL '13 days', v_emp_finance_id, 11000, 
         CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '11 days'),
        
        (v_org_id, v_done_list, v_emp_designer_id, 'Redesign checkout flow', 
         'A/B test shows 15% improvement', 'high', 
         CURRENT_DATE - INTERVAL '11 days', v_emp_designer_id, 12000, 
         CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE - INTERVAL '10 days'),
        
        (v_org_id, v_done_list, v_emp_manager_id, 'Sprint planning meeting', 
         'Q2 roadmap prioritized', 'high', 
         CURRENT_DATE - INTERVAL '12 days', v_emp_manager_id, 13000, 
         CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE - INTERVAL '11 days'),
        
        (v_org_id, v_done_list, v_ahmad_emp_id, 'Strategic planning session', 
         'Q2 OKRs finalized', 'high', 
         CURRENT_DATE - INTERVAL '14 days', v_ahmad_emp_id, 14000, 
         CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '12 days'),
        
        (v_org_id, v_done_list, v_new_emp_id, 'Database backup automation', 
         'Daily backups to S3', 'medium', 
         CURRENT_DATE - INTERVAL '13 days', v_new_emp_id, 15000, 
         CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '12 days'),
        
        (v_org_id, v_done_list, v_emp_finance_id, 'Expense report audit', 
         'Q1 compliance verified', 'medium', 
         CURRENT_DATE - INTERVAL '11 days', v_emp_finance_id, 16000, 
         CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE - INTERVAL '10 days'),
        
        (v_org_id, v_done_list, v_emp_designer_id, 'Create icon library v2', 
         '100+ icons designed', 'medium', 
         CURRENT_DATE - INTERVAL '12 days', v_emp_designer_id, 17000, 
         CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '11 days'),
        
        (v_org_id, v_done_list, v_emp_hr_id, 'Update benefits documentation', 
         'New health insurance details', 'low', 
         CURRENT_DATE - INTERVAL '13 days', v_emp_hr_id, 18000, 
         CURRENT_DATE - INTERVAL '14 days', CURRENT_DATE - INTERVAL '12 days'),
        
        -- DONE LIST - Month -2 (Last quarter - for quarterly reports only)
        (v_org_id, v_done_list, v_emp_hr_id, 'Update employee handbook', 
         'New remote work policy added', 'medium', 
         CURRENT_DATE - INTERVAL '45 days', v_emp_hr_id, 14000, 
         CURRENT_DATE - INTERVAL '50 days', CURRENT_DATE - INTERVAL '43 days'),
        
        (v_org_id, v_done_list, v_emp_finance_id, 'Tax filing preparation', 
         'All documents organized', 'high', 
         CURRENT_DATE - INTERVAL '50 days', v_emp_finance_id, 15000, 
         CURRENT_DATE - INTERVAL '55 days', CURRENT_DATE - INTERVAL '48 days'),
        
        (v_org_id, v_done_list, v_emp_designer_id, 'Design system v2', 
         'Component library published', 'high', 
         CURRENT_DATE - INTERVAL '55 days', v_emp_designer_id, 16000, 
         CURRENT_DATE - INTERVAL '65 days', CURRENT_DATE - INTERVAL '53 days'),
        
        (v_org_id, v_done_list, v_emp_manager_id, 'Team capacity planning', 
         'Hiring plan for Q2 approved', 'high', 
         CURRENT_DATE - INTERVAL '60 days', v_emp_manager_id, 17000, 
         CURRENT_DATE - INTERVAL '68 days', CURRENT_DATE - INTERVAL '58 days'),
        
        (v_org_id, v_done_list, v_ahmad_emp_id, 'Product roadmap Q2', 
         'Prioritized features with stakeholders', 'high', 
         CURRENT_DATE - INTERVAL '65 days', v_ahmad_emp_id, 18000, 
         CURRENT_DATE - INTERVAL '70 days', CURRENT_DATE - INTERVAL '63 days'),
        
        (v_org_id, v_done_list, v_new_emp_id, 'Security audit compliance', 
         'Passed SOC 2 Type II', 'urgent', 
         CURRENT_DATE - INTERVAL '70 days', v_new_emp_id, 19000, 
         CURRENT_DATE - INTERVAL '80 days', CURRENT_DATE - INTERVAL '68 days'),
        
        (v_org_id, v_done_list, v_emp_hr_id, 'Performance review cycle', 
         'All reviews completed', 'high', 
         CURRENT_DATE - INTERVAL '75 days', v_emp_hr_id, 20000, 
         CURRENT_DATE - INTERVAL '85 days', CURRENT_DATE - INTERVAL '73 days'),
        
        (v_org_id, v_done_list, v_emp_finance_id, 'Budget planning Q2', 
         'Departmental budgets approved', 'high', 
         CURRENT_DATE - INTERVAL '80 days', v_emp_finance_id, 21000, 
         CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE - INTERVAL '78 days'),
        
        -- Additional completed tasks to boost completion rate to >85%
        -- More recent completions (last 7 days - visible on board)
        (v_org_id, v_done_list, v_emp_hello_id, 'Migrate to PostgreSQL 16', 
         'Database upgraded successfully', 'high', 
         CURRENT_DATE - INTERVAL '4 days', v_emp_hello_id, 22000, 
         CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE - INTERVAL '3 days'),
        
        (v_org_id, v_done_list, v_emp_judy_id, 'Setup monitoring alerts', 
         'Datadog dashboards configured', 'medium', 
         CURRENT_DATE - INTERVAL '5 days', v_emp_judy_id, 23000, 
         CURRENT_DATE - INTERVAL '9 days', CURRENT_DATE - INTERVAL '4 days'),
        
        (v_org_id, v_done_list, v_emp_dmitri_id, 'Write API integration guide', 
         'Documentation published to developer portal', 'medium', 
         CURRENT_DATE - INTERVAL '6 days', v_emp_dmitri_id, 24000, 
         CURRENT_DATE - INTERVAL '11 days', CURRENT_DATE - INTERVAL '5 days'),
        
        (v_org_id, v_done_list, v_emp_juara_id, 'Fix mobile logout bug', 
         'Issue resolved in v1.2.4', 'high', 
         CURRENT_DATE - INTERVAL '3 days', v_emp_juara_id, 25000, 
         CURRENT_DATE - INTERVAL '4 days', CURRENT_DATE - INTERVAL '2 days'),
        
        -- This month completions (April 2026)
        (v_org_id, v_done_list, v_emp_hello_id, 'Implement caching layer', 
         'Redis integration complete, 40%% speedup', 'high', 
         CURRENT_DATE - INTERVAL '12 days', v_emp_hello_id, 26000, 
         CURRENT_DATE - INTERVAL '18 days', CURRENT_DATE - INTERVAL '10 days'),
        
        (v_org_id, v_done_list, v_emp_judy_id, 'Update dependencies', 
         'All packages upgraded to latest stable', 'medium', 
         CURRENT_DATE - INTERVAL '14 days', v_emp_judy_id, 27000, 
         CURRENT_DATE - INTERVAL '16 days', CURRENT_DATE - INTERVAL '12 days'),
        
        (v_org_id, v_done_list, v_emp_dmitri_id, 'Refactor payment processing', 
         'Cleaner code, better error handling', 'high', 
         CURRENT_DATE - INTERVAL '16 days', v_emp_dmitri_id, 28000, 
         CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE - INTERVAL '14 days'),
        
        (v_org_id, v_done_list, v_emp_juara_id, 'Add bulk import feature', 
         'CSV upload for employee data', 'medium', 
         CURRENT_DATE - INTERVAL '18 days', v_emp_juara_id, 29000, 
         CURRENT_DATE - INTERVAL '24 days', CURRENT_DATE - INTERVAL '16 days'),
        
        (v_org_id, v_done_list, v_ahmad_emp_id, 'Conduct user interviews', 
         '12 interviews completed, insights documented', 'high', 
         CURRENT_DATE - INTERVAL '20 days', v_ahmad_emp_id, 30000, 
         CURRENT_DATE - INTERVAL '28 days', CURRENT_DATE - INTERVAL '18 days'),
        
        (v_org_id, v_done_list, v_new_emp_id, 'Optimize SQL queries', 
         'Reduced average response time by 35%%', 'high', 
         CURRENT_DATE - INTERVAL '22 days', v_new_emp_id, 31000, 
         CURRENT_DATE - INTERVAL '26 days', CURRENT_DATE - INTERVAL '20 days'),
        
        (v_org_id, v_done_list, v_emp_hr_id, 'Create onboarding checklist', 
         'New employee workflow streamlined', 'medium', 
         CURRENT_DATE - INTERVAL '24 days', v_emp_hr_id, 32000, 
         CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE - INTERVAL '22 days'),
        
        (v_org_id, v_done_list, v_emp_finance_id, 'Implement expense approval workflow', 
         'Automated routing based on amount', 'medium', 
         CURRENT_DATE - INTERVAL '26 days', v_emp_finance_id, 33000, 
         CURRENT_DATE - INTERVAL '32 days', CURRENT_DATE - INTERVAL '24 days'),
        
        (v_org_id, v_done_list, v_emp_designer_id, 'Design dark mode', 
         'UI components adapted for dark theme', 'medium', 
         CURRENT_DATE - INTERVAL '28 days', v_emp_designer_id, 34000, 
         CURRENT_DATE - INTERVAL '35 days', CURRENT_DATE - INTERVAL '26 days'),
        
        (v_org_id, v_done_list, v_emp_manager_id, 'Code review automation setup', 
         'GitHub Actions configured for PR checks', 'medium', 
         CURRENT_DATE - INTERVAL '30 days', v_emp_manager_id, 35000, 
         CURRENT_DATE - INTERVAL '35 days', CURRENT_DATE - INTERVAL '28 days'),
        
        -- Last quarter completions (Q1 2026) - 30 more tasks
        (v_org_id, v_done_list, v_emp_hello_id, 'Implement SSO integration', 
         'SAML 2.0 authentication working', 'high', 
         CURRENT_DATE - INTERVAL '40 days', v_emp_hello_id, 36000, 
         CURRENT_DATE - INTERVAL '48 days', CURRENT_DATE - INTERVAL '38 days'),
        
        (v_org_id, v_done_list, v_emp_judy_id, 'Backup automation', 
         'Daily backups to S3 with 30-day retention', 'high', 
         CURRENT_DATE - INTERVAL '42 days', v_emp_judy_id, 37000, 
         CURRENT_DATE - INTERVAL '50 days', CURRENT_DATE - INTERVAL '40 days'),
        
        (v_org_id, v_done_list, v_emp_dmitri_id, 'API rate limiting', 
         'Prevents abuse, protects infrastructure', 'high', 
         CURRENT_DATE - INTERVAL '44 days', v_emp_dmitri_id, 38000, 
         CURRENT_DATE - INTERVAL '52 days', CURRENT_DATE - INTERVAL '42 days'),
        
        (v_org_id, v_done_list, v_emp_juara_id, 'Mobile push notifications', 
         'FCM integrated for iOS and Android', 'high', 
         CURRENT_DATE - INTERVAL '46 days', v_emp_juara_id, 39000, 
         CURRENT_DATE - INTERVAL '54 days', CURRENT_DATE - INTERVAL '44 days'),
        
        (v_org_id, v_done_list, v_ahmad_emp_id, 'Customer success playbook', 
         'Standardized onboarding process', 'medium', 
         CURRENT_DATE - INTERVAL '48 days', v_ahmad_emp_id, 40000, 
         CURRENT_DATE - INTERVAL '56 days', CURRENT_DATE - INTERVAL '46 days'),
        
        (v_org_id, v_done_list, v_new_emp_id, 'Implement webhooks', 
         'Event-driven integrations enabled', 'high', 
         CURRENT_DATE - INTERVAL '50 days', v_new_emp_id, 41000, 
         CURRENT_DATE - INTERVAL '58 days', CURRENT_DATE - INTERVAL '48 days'),
        
        (v_org_id, v_done_list, v_emp_hr_id, 'Benefits enrollment portal', 
         'Self-service insurance selection', 'medium', 
         CURRENT_DATE - INTERVAL '52 days', v_emp_hr_id, 42000, 
         CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE - INTERVAL '50 days'),
        
        (v_org_id, v_done_list, v_emp_finance_id, 'Multi-currency support', 
         'IDR, AED, MYR, SGD fully supported', 'high', 
         CURRENT_DATE - INTERVAL '54 days', v_emp_finance_id, 43000, 
         CURRENT_DATE - INTERVAL '62 days', CURRENT_DATE - INTERVAL '52 days'),
        
        (v_org_id, v_done_list, v_emp_designer_id, 'Mobile app redesign', 
         'New UX improves task completion by 25%%', 'high', 
         CURRENT_DATE - INTERVAL '56 days', v_emp_designer_id, 44000, 
         CURRENT_DATE - INTERVAL '64 days', CURRENT_DATE - INTERVAL '54 days'),
        
        (v_org_id, v_done_list, v_emp_manager_id, 'Sprint planning template', 
         'Standardized estimation process', 'medium', 
         CURRENT_DATE - INTERVAL '58 days', v_emp_manager_id, 45000, 
         CURRENT_DATE - INTERVAL '66 days', CURRENT_DATE - INTERVAL '56 days'),
        
        (v_org_id, v_done_list, v_emp_hello_id, 'Load testing infrastructure', 
         'k6 setup for performance validation', 'medium', 
         CURRENT_DATE - INTERVAL '60 days', v_emp_hello_id, 46000, 
         CURRENT_DATE - INTERVAL '68 days', CURRENT_DATE - INTERVAL '58 days'),
        
        (v_org_id, v_done_list, v_emp_judy_id, 'Disaster recovery plan', 
         'RTO 4 hours, RPO 1 hour documented', 'high', 
         CURRENT_DATE - INTERVAL '62 days', v_emp_judy_id, 47000, 
         CURRENT_DATE - INTERVAL '70 days', CURRENT_DATE - INTERVAL '60 days'),
        
        (v_org_id, v_done_list, v_emp_dmitri_id, 'Email template system', 
         'Dynamic templates with personalization', 'medium', 
         CURRENT_DATE - INTERVAL '64 days', v_emp_dmitri_id, 48000, 
         CURRENT_DATE - INTERVAL '72 days', CURRENT_DATE - INTERVAL '62 days'),
        
        (v_org_id, v_done_list, v_emp_juara_id, 'Accessibility audit', 
         'WCAG 2.1 AA compliance achieved', 'high', 
         CURRENT_DATE - INTERVAL '66 days', v_emp_juara_id, 49000, 
         CURRENT_DATE - INTERVAL '74 days', CURRENT_DATE - INTERVAL '64 days'),
        
        (v_org_id, v_done_list, v_ahmad_emp_id, 'Partner integration docs', 
         'Public API documentation complete', 'medium', 
         CURRENT_DATE - INTERVAL '68 days', v_ahmad_emp_id, 50000, 
         CURRENT_DATE - INTERVAL '76 days', CURRENT_DATE - INTERVAL '66 days'),
        
        (v_org_id, v_done_list, v_new_emp_id, 'GraphQL API layer', 
         'More flexible queries for mobile app', 'high', 
         CURRENT_DATE - INTERVAL '70 days', v_new_emp_id, 51000, 
         CURRENT_DATE - INTERVAL '78 days', CURRENT_DATE - INTERVAL '68 days'),
        
        (v_org_id, v_done_list, v_emp_hr_id, 'Training video library', 
         '15 tutorial videos published', 'medium', 
         CURRENT_DATE - INTERVAL '72 days', v_emp_hr_id, 52000, 
         CURRENT_DATE - INTERVAL '80 days', CURRENT_DATE - INTERVAL '70 days'),
        
        (v_org_id, v_done_list, v_emp_finance_id, 'Invoice automation', 
         'Xero integration for billing', 'high', 
         CURRENT_DATE - INTERVAL '74 days', v_emp_finance_id, 53000, 
         CURRENT_DATE - INTERVAL '82 days', CURRENT_DATE - INTERVAL '72 days'),
        
        (v_org_id, v_done_list, v_emp_designer_id, 'Icon library expansion', 
         '200+ new icons added to design system', 'low', 
         CURRENT_DATE - INTERVAL '76 days', v_emp_designer_id, 54000, 
         CURRENT_DATE - INTERVAL '84 days', CURRENT_DATE - INTERVAL '74 days'),
        
        (v_org_id, v_done_list, v_emp_manager_id, 'Technical debt tracking', 
         'Linear project setup for maintenance', 'medium', 
         CURRENT_DATE - INTERVAL '78 days', v_emp_manager_id, 55000, 
         CURRENT_DATE - INTERVAL '86 days', CURRENT_DATE - INTERVAL '76 days'),
        
        (v_org_id, v_done_list, v_emp_hello_id, 'Container orchestration', 
         'Kubernetes production deployment', 'high', 
         CURRENT_DATE - INTERVAL '80 days', v_emp_hello_id, 56000, 
         CURRENT_DATE - INTERVAL '88 days', CURRENT_DATE - INTERVAL '78 days'),
        
        (v_org_id, v_done_list, v_emp_judy_id, 'Log aggregation setup', 
         'Centralized logging with ELK stack', 'medium', 
         CURRENT_DATE - INTERVAL '82 days', v_emp_judy_id, 57000, 
         CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE - INTERVAL '80 days'),
        
        (v_org_id, v_done_list, v_emp_dmitri_id, 'Feature flag system', 
         'Toggle features without deployment', 'medium', 
         CURRENT_DATE - INTERVAL '84 days', v_emp_dmitri_id, 58000, 
         CURRENT_DATE - INTERVAL '92 days', CURRENT_DATE - INTERVAL '82 days'),
        
        (v_org_id, v_done_list, v_emp_juara_id, 'PWA implementation', 
         'Offline support for mobile web', 'high', 
         CURRENT_DATE - INTERVAL '86 days', v_emp_juara_id, 59000, 
         CURRENT_DATE - INTERVAL '94 days', CURRENT_DATE - INTERVAL '84 days'),
        
        (v_org_id, v_done_list, v_ahmad_emp_id, 'Competitive analysis', 
         'Feature comparison matrix complete', 'medium', 
         CURRENT_DATE - INTERVAL '88 days', v_ahmad_emp_id, 60000, 
         CURRENT_DATE - INTERVAL '96 days', CURRENT_DATE - INTERVAL '86 days'),
        
        (v_org_id, v_done_list, v_new_emp_id, 'CI/CD pipeline optimization', 
         'Build time reduced from 12 to 5 minutes', 'medium', 
         CURRENT_DATE - INTERVAL '35 days', v_new_emp_id, 61000, 
         CURRENT_DATE - INTERVAL '42 days', CURRENT_DATE - INTERVAL '33 days'),
        
        (v_org_id, v_done_list, v_emp_hr_id, 'Employee referral program', 
         'Incentive structure approved and launched', 'medium', 
         CURRENT_DATE - INTERVAL '37 days', v_emp_hr_id, 62000, 
         CURRENT_DATE - INTERVAL '44 days', CURRENT_DATE - INTERVAL '35 days'),
        
        (v_org_id, v_done_list, v_emp_finance_id, 'Cost optimization audit', 
         'Identified 15%% savings in cloud costs', 'high', 
         CURRENT_DATE - INTERVAL '39 days', v_emp_finance_id, 63000, 
         CURRENT_DATE - INTERVAL '46 days', CURRENT_DATE - INTERVAL '37 days'),
        
        (v_org_id, v_done_list, v_emp_designer_id, 'User flow optimization', 
         'Reduced checkout steps from 5 to 3', 'high', 
         CURRENT_DATE - INTERVAL '41 days', v_emp_designer_id, 64000, 
         CURRENT_DATE - INTERVAL '48 days', CURRENT_DATE - INTERVAL '39 days'),
        
        (v_org_id, v_done_list, v_emp_manager_id, 'Code quality metrics', 
         'SonarQube integrated in pipeline', 'medium', 
         CURRENT_DATE - INTERVAL '43 days', v_emp_manager_id, 65000, 
         CURRENT_DATE - INTERVAL '50 days', CURRENT_DATE - INTERVAL '41 days'),
        
        (v_org_id, v_done_list, v_emp_hello_id, 'API versioning strategy', 
         'V2 endpoints with backward compatibility', 'medium', 
         CURRENT_DATE - INTERVAL '45 days', v_emp_hello_id, 66000, 
         CURRENT_DATE - INTERVAL '52 days', CURRENT_DATE - INTERVAL '43 days'),
        
        (v_org_id, v_done_list, v_emp_judy_id, 'Security headers implementation', 
         'A+ rating on securityheaders.com', 'high', 
         CURRENT_DATE - INTERVAL '47 days', v_emp_judy_id, 67000, 
         CURRENT_DATE - INTERVAL '54 days', CURRENT_DATE - INTERVAL '45 days'),
        
        (v_org_id, v_done_list, v_emp_juara_id, 'Mobile app store optimization', 
         'Improved listing with screenshots and video', 'medium', 
         CURRENT_DATE - INTERVAL '49 days', v_emp_juara_id, 68000, 
         CURRENT_DATE - INTERVAL '56 days', CURRENT_DATE - INTERVAL '47 days');
    
    RAISE NOTICE '✓ Created 80 tasks (7 todo, 5 in progress, 68 completed = 85%% completion rate)';
    
    -- ============================================================
    -- SUMMARY
    -- ============================================================
    RAISE NOTICE '';
    RAISE NOTICE '══════════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ Report seed data completed successfully!';
    RAISE NOTICE '══════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'Data created:';
    RAISE NOTICE '  • ~700 attendance records (90 days, 100%% coverage for April 2026)';
    RAISE NOTICE '    → 10 healthy employees with 91-98%% attendance';
    RAISE NOTICE '    → 1 anomaly employee (Hans) with 65%% attendance';
    RAISE NOTICE '  • 25+ leave requests (spanning 6 months)';
    RAISE NOTICE '  • 50+ claims (3 months, all categories)';
    RAISE NOTICE '  • 80 tasks (68 completed = 85%% completion rate) ✓ HEALTHY';
    RAISE NOTICE '';
    RAISE NOTICE 'Organisation: Rizki Tech (%)', v_org_id;
    RAISE NOTICE 'Login: ahmad@workived.com / 12345678';
    RAISE NOTICE '';
    RAISE NOTICE 'This simulates a HEALTHY company with:';
    RAISE NOTICE '  • >85%% task completion rate ✓';
    RAISE NOTICE '  • >90%% attendance for 10/11 employees ✓';
    RAISE NOTICE '  • 1 anomaly employee (Hans) for realistic variance';
    RAISE NOTICE '';
    RAISE NOTICE 'Reports should now show comprehensive data for:';
    RAISE NOTICE '  • Attendance trends and analytics';
    RAISE NOTICE '  • Leave patterns and utilization';
    RAISE NOTICE '  • Claim expenses by category';
    RAISE NOTICE '  • Task progress and completion';
    RAISE NOTICE '══════════════════════════════════════════════════════════════';
    
END $$;

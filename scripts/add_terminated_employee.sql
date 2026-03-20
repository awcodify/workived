-- Add terminated employee to demo data
-- Run this with: psql <connection_string> -f scripts/add_terminated_employee.sql
-- Or: docker exec -i workived-db psql -U workived -d workived < scripts/add_terminated_employee.sql

DO $$
DECLARE
    v_org_id UUID;
    v_dept_id UUID;
BEGIN
    -- Get the demo organization (Rizki Tech)
    SELECT id INTO v_org_id FROM organisations WHERE name = 'Rizki Tech' LIMIT 1;
    
    IF v_org_id IS NULL THEN
        RAISE NOTICE 'Demo organization not found. Run migration 000027 first.';
        RETURN;
    END IF;

    -- Get engineering department
    SELECT id INTO v_dept_id FROM departments WHERE organisation_id = v_org_id AND name = 'Engineering' LIMIT 1;

    -- Insert terminated employee
    INSERT INTO employees (
        organisation_id, 
        full_name, 
        email, 
        phone, 
        job_title, 
        department_id, 
        employment_type, 
        status, 
        start_date, 
        end_date,
        is_active
    )
    VALUES (
        v_org_id,
        'Ahmad Yusuf',
        'ahmad.yusuf@rizkitech.com',
        '+6281234567895',
        'Former Frontend Engineer',
        v_dept_id,
        'full_time',
        'inactive',
        '2024-06-01',
        '2025-12-31',  -- Last day of work
        FALSE
    );

    -- Also update one existing employee to be terminated (Adi Nugroho - the intern)
    UPDATE employees 
    SET 
        status = 'inactive',
        end_date = '2026-03-15',
        is_active = FALSE
    WHERE 
        organisation_id = v_org_id 
        AND email = 'adi@rizkitech.com';

    RAISE NOTICE 'Added 1 terminated employee and updated 1 intern to terminated';
END $$;

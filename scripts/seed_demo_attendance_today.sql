-- Seed today's attendance data for demo organisation
-- This creates realistic attendance records for testing

DO $$
DECLARE
    v_org_id UUID;
    v_today DATE;
    v_emp_budi UUID;
    v_emp_siti UUID;
    v_emp_reza UUID;
    v_emp_dewi UUID;
    v_emp_adi UUID;
BEGIN
    -- Get demo org
    SELECT id INTO v_org_id FROM organisations WHERE slug = 'rizki-tech';
    
    IF v_org_id IS NULL THEN
        RAISE NOTICE 'Demo organisation not found, skipping attendance seed.';
        RETURN;
    END IF;

    -- Get today in org's timezone (Asia/Jakarta)
    v_today := (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE;

    -- Get employee IDs
    SELECT id INTO v_emp_budi FROM employees WHERE organisation_id = v_org_id AND email = 'budi@rizkitech.com';
    SELECT id INTO v_emp_siti FROM employees WHERE organisation_id = v_org_id AND email = 'siti@rizkitech.com';
    SELECT id INTO v_emp_reza FROM employees WHERE organisation_id = v_org_id AND email = 'reza@rizkitech.com';
    SELECT id INTO v_emp_dewi FROM employees WHERE organisation_id = v_org_id AND email = 'dewi@rizkitech.com';
    SELECT id INTO v_emp_adi FROM employees WHERE organisation_id = v_org_id AND email = 'adi@rizkitech.com';

    -- Skip if Budi already has attendance for today
    IF EXISTS (
        SELECT 1 FROM attendance_records 
        WHERE organisation_id = v_org_id 
        AND employee_id = v_emp_budi
        AND date = v_today
    ) THEN
        RAISE NOTICE 'Demo attendance for today already seeded, skipping.';
        RETURN;
    END IF;

    -- Budi: Clocked in on time (09:00), clocked out (17:30)
    INSERT INTO attendance_records (
        organisation_id, employee_id, date, 
        clock_in_at, clock_out_at, 
        is_late, note
    ) VALUES (
        v_org_id, v_emp_budi, v_today,
        (v_today || ' 09:00:00')::TIMESTAMPTZ AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta',
        (v_today || ' 17:30:00')::TIMESTAMPTZ AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta',
        FALSE,
        'Regular day'
    );

    -- Siti: Clocked in on time (08:55), still working
    INSERT INTO attendance_records (
        organisation_id, employee_id, date, 
        clock_in_at, clock_out_at, 
        is_late, note
    ) VALUES (
        v_org_id, v_emp_siti, v_today,
        (v_today || ' 08:55:00')::TIMESTAMPTZ AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta',
        NULL,
        FALSE,
        'Early start today'
    );

    -- Reza: Clocked in late (09:27), still working
    INSERT INTO attendance_records (
        organisation_id, employee_id, date, 
        clock_in_at, clock_out_at, 
        is_late, note
    ) VALUES (
        v_org_id, v_emp_reza, v_today,
        (v_today || ' 09:27:00')::TIMESTAMPTZ AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta',
        NULL,
        TRUE,
        'Traffic was bad'
    );

    -- Dewi: Clocked in late (09:42), clocked out (18:15) - worked late to compensate
    INSERT INTO attendance_records (
        organisation_id, employee_id, date, 
        clock_in_at, clock_out_at, 
        is_late, note
    ) VALUES (
        v_org_id, v_emp_dewi, v_today,
        (v_today || ' 09:42:00')::TIMESTAMPTZ AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta',
        (v_today || ' 18:15:00')::TIMESTAMPTZ AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta',
        TRUE,
        'Doctor appointment in the morning'
    );

    -- Adi: No attendance record (absent)
    -- Intentionally not creating a record to test "absent" status

    RAISE NOTICE 'Seeded attendance for today (%) with % records', v_today, 4;
END $$;

-- Rollback today's attendance seed

DO $$
DECLARE
    v_org_id UUID;
    v_today DATE;
BEGIN
    -- Get demo org
    SELECT id INTO v_org_id FROM organisations WHERE slug = 'rizki-tech';
    
    IF v_org_id IS NULL THEN
        RETURN;
    END IF;

    -- Get today in org's timezone
    v_today := (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE;

    -- Delete today's attendance records for demo org
    DELETE FROM attendance_records 
    WHERE organisation_id = v_org_id 
    AND date = v_today;

    RAISE NOTICE 'Removed attendance seed for today (%)' , v_today;
END $$;

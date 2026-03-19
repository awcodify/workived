-- Remove all attendance records for today (for demo org only)
DO $$
DECLARE
    v_org_id UUID;
    v_today DATE := CURRENT_DATE;
BEGIN
    SELECT id INTO v_org_id FROM organisations WHERE slug = 'rizki-tech';
    IF v_org_id IS NOT NULL THEN
        DELETE FROM attendance_records WHERE organisation_id = v_org_id AND date = v_today;
        RAISE NOTICE 'Removed all today''s attendance for demo org.';
    ELSE
        RAISE NOTICE 'Demo org not found, nothing deleted.';
    END IF;
END $$;

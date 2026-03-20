-- 000042_add_missing_eid_fitr_indonesia.up.sql
-- Add the missing Eid Al-Fitr Day 1 for Indonesia on 2026-03-20
-- This date already has Isra Mi'raj, and now both can coexist

INSERT INTO public_holidays (country_code, date, name) 
VALUES ('ID', '2026-03-20', 'Eid Al-Fitr Day 1');

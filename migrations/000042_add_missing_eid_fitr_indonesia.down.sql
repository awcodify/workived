-- 000042_add_missing_eid_fitr_indonesia.down.sql
-- Remove the Eid Al-Fitr Day 1 entry we added

DELETE FROM public_holidays 
WHERE country_code = 'ID' 
  AND date = '2026-03-20' 
  AND name = 'Eid Al-Fitr Day 1';

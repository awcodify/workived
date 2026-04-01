-- Fix incorrect Eid Al-Fitr 2026 dates
-- Issue: March 31 and April 1, 2026 were incorrectly marked as Eid Al-Fitr Days 3 & 4
-- Eid Al-Fitr is a 2-3 day celebration, not spread over 10 days

-- Delete incorrect entries
DELETE FROM public_holidays 
WHERE country_code = 'ID' 
  AND date IN ('2026-03-31', '2026-04-01')
  AND name LIKE 'Eid Al-Fitr%';

-- Add correct Day 3 if not exists
INSERT INTO public_holidays (country_code, date, name) 
VALUES ('ID', '2026-03-22', 'Eid Al-Fitr Day 3')
ON CONFLICT DO NOTHING;

-- Verify the fix
SELECT date, name 
FROM public_holidays 
WHERE country_code = 'ID' 
  AND date BETWEEN '2026-03-15' AND '2026-04-05'
ORDER BY date;

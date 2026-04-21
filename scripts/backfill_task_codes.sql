-- Backfill task codes for all existing tasks
-- This script generates task codes for all tasks that don't have one yet
--
-- Usage:
--   psql -U workived -d workived -f scripts/backfill_task_codes.sql
--
-- Note: This uses a PostgreSQL function to maintain atomicity

DO $$
DECLARE
    org_record RECORD;
    task_record RECORD;
    next_seq INT;
    org_initials TEXT;
    task_code TEXT;
    total_tasks INT := 0;
    total_updated INT := 0;
BEGIN
    -- Process each organisation
    FOR org_record IN 
        SELECT id, name 
        FROM organisations 
        WHERE is_active = TRUE
        ORDER BY name
    LOOP
        RAISE NOTICE 'Processing organisation: % (ID: %)', org_record.name, org_record.id;
        
        -- Count tasks without codes for this org
        SELECT COUNT(*) INTO total_tasks
        FROM tasks
        WHERE organisation_id = org_record.id AND code IS NULL;
        
        IF total_tasks = 0 THEN
            RAISE NOTICE '  No tasks to backfill';
            CONTINUE;
        END IF;
        
        RAISE NOTICE '  Found % tasks without codes', total_tasks;
        
        -- Generate initials from company name
        -- This is a simplified version - the Go code has more sophisticated logic
        SELECT 
            CASE 
                -- Single word: take first 3 letters
                WHEN array_length(words, 1) = 1 THEN 
                    UPPER(LEFT(words[1], 3))
                -- Multiple words: take first letter of each significant word (max 4)
                ELSE
                    UPPER(
                        COALESCE(LEFT(words[1], 1), '') ||
                        COALESCE(LEFT(words[2], 1), '') ||
                        CASE WHEN array_length(words, 1) > 2 THEN COALESCE(LEFT(words[3], 1), '') ELSE '' END ||
                        CASE WHEN array_length(words, 1) > 3 THEN COALESCE(LEFT(words[4], 1), '') ELSE '' END
                    )
            END INTO org_initials
        FROM (
            SELECT regexp_split_to_array(
                regexp_replace(
                    org_record.name,
                    '\y(inc|ltd|llc|corp|co|company|limited|corporation|pt|cv|tbk|the)\y',
                    '',
                    'gi'
                ),
                E'\\s+'
            ) AS words
        ) w
        WHERE array_length(words, 1) > 0;
        
        -- Fallback if no initials generated
        IF org_initials IS NULL OR org_initials = '' THEN
            org_initials := 'ORG';
        END IF;
        
        RAISE NOTICE '  Company initials: %', org_initials;
        
        -- Process each task without a code
        FOR task_record IN
            SELECT id, title
            FROM tasks
            WHERE organisation_id = org_record.id AND code IS NULL
            ORDER BY created_at ASC
        LOOP
            -- Atomically increment sequence and get next number
            UPDATE organisations
            SET task_sequence = task_sequence + 1
            WHERE id = org_record.id
            RETURNING task_sequence INTO next_seq;
            
            -- Generate code
            task_code := org_initials || '-' || next_seq;
            
            -- Update task with generated code
            UPDATE tasks
            SET code = task_code
            WHERE id = task_record.id;
            
            total_updated := total_updated + 1;
            
            -- Log every 10th task to avoid too much output
            IF total_updated % 10 = 0 THEN
                RAISE NOTICE '  Updated % tasks...', total_updated;
            END IF;
        END LOOP;
        
        RAISE NOTICE '  ✓ Updated % tasks for this organisation', total_updated;
        total_updated := 0; -- Reset for next org
    END LOOP;
    
    RAISE NOTICE 'Backfill complete!';
END $$;

-- Verify the results
SELECT 
    o.name AS organisation,
    COUNT(*) FILTER (WHERE t.code IS NOT NULL) AS tasks_with_code,
    COUNT(*) FILTER (WHERE t.code IS NULL) AS tasks_without_code,
    COUNT(*) AS total_tasks
FROM organisations o
LEFT JOIN tasks t ON t.organisation_id = o.id
WHERE o.is_active = TRUE
GROUP BY o.id, o.name
ORDER BY o.name;

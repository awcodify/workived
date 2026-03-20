-- 000048_add_employee_status_consistency_check.up.sql
-- Enforce invariant: status='inactive' ⟺ is_active=FALSE
-- This prevents data integrity issues between the two fields.

-- Fix any existing inconsistent data before adding constraint
UPDATE employees 
SET is_active = FALSE 
WHERE status = 'inactive' AND is_active = TRUE;

UPDATE employees 
SET is_active = TRUE 
WHERE status != 'inactive' AND is_active = FALSE;

-- Add constraint to prevent future inconsistencies
ALTER TABLE employees 
ADD CONSTRAINT check_employee_status_inactive_consistency 
CHECK (
  (status = 'inactive' AND is_active = FALSE) OR
  (status != 'inactive' AND is_active = TRUE)
);

COMMENT ON CONSTRAINT check_employee_status_inactive_consistency ON employees IS 
  'Ensures status and is_active fields remain synchronized: inactive status requires is_active=FALSE, all other statuses require is_active=TRUE';

-- Add trigger to automatically sync is_active when status changes
CREATE OR REPLACE FUNCTION sync_employee_is_active()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to 'inactive', set is_active = FALSE
  IF NEW.status = 'inactive' THEN
    NEW.is_active := FALSE;
  -- When status changes from 'inactive' to anything else, set is_active = TRUE
  ELSIF OLD.status = 'inactive' AND NEW.status != 'inactive' THEN
    NEW.is_active := TRUE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_employee_is_active
  BEFORE INSERT OR UPDATE OF status ON employees
  FOR EACH ROW
  EXECUTE FUNCTION sync_employee_is_active();

COMMENT ON FUNCTION sync_employee_is_active() IS 
  'Automatically synchronizes is_active field when employee status changes';

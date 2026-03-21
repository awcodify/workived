-- Add support for unlimited leave policies and claim categories

ALTER TABLE leave_policies 
ADD COLUMN is_unlimited BOOLEAN DEFAULT FALSE;

ALTER TABLE claim_categories
ADD COLUMN is_unlimited BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN leave_policies.is_unlimited IS 
  'If true, max_days is ignored (unlimited leave with approval)';
COMMENT ON COLUMN claim_categories.is_unlimited IS 
  'If true, monthly_limit is ignored (unlimited claims with approval)';

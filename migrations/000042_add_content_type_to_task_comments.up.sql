-- Add content_type column to task_comments
-- This column was referenced in code but missing from the original migration
ALTER TABLE task_comments ADD COLUMN content_type VARCHAR(20) NOT NULL DEFAULT 'plain';

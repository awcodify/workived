-- 000057_add_comment_nesting.up.sql
-- Add support for nested/threaded comments

ALTER TABLE task_comments 
  ADD COLUMN parent_id UUID REFERENCES task_comments(id) ON DELETE CASCADE,
  ADD COLUMN content_type VARCHAR(20) DEFAULT 'plain' 
    CHECK (content_type IN ('plain', 'markdown'));

CREATE INDEX idx_task_comments_parent ON task_comments(parent_id);

COMMENT ON COLUMN task_comments.parent_id IS 'Reference to parent comment for threaded discussions. NULL for root comments.';
COMMENT ON COLUMN task_comments.content_type IS 'Content format type: plain (default) or markdown for rich text.';

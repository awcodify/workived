-- 000058_create_comment_reactions.up.sql
-- Add emoji reactions to comments

CREATE TABLE comment_reactions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
    comment_id       UUID NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
    employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    emoji            VARCHAR(10) NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_comment_employee_emoji UNIQUE(comment_id, employee_id, emoji)
);

CREATE INDEX idx_comment_reactions_org     ON comment_reactions(organisation_id);
CREATE INDEX idx_comment_reactions_comment ON comment_reactions(comment_id);
CREATE INDEX idx_comment_reactions_employee ON comment_reactions(employee_id);

COMMENT ON TABLE comment_reactions IS 'Emoji reactions to task comments. One reaction per emoji per employee per comment.';
COMMENT ON COLUMN comment_reactions.emoji IS 'UTF-8 emoji character (e.g., 👍, ❤️, 🎉). Max 10 characters to support multi-byte emojis.';
COMMENT ON CONSTRAINT uq_comment_employee_emoji ON comment_reactions IS 'Prevents duplicate reactions: one employee can only react once per emoji per comment.';

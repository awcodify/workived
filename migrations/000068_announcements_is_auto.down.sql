ALTER TABLE announcements
    DROP COLUMN is_auto,
    ALTER COLUMN author_id SET NOT NULL;

-- Add body and icon columns that the frontend expects
-- Keep existing message/type columns for backwards compatibility
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'bell';

-- Copy any existing message data to body
UPDATE notifications SET body = message WHERE body IS NULL AND message IS NOT NULL;

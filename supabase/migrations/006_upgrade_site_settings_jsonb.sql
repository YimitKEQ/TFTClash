-- Upgrade site_settings.value from text to jsonb for better querying
-- This is safe: existing JSON strings are valid jsonb
ALTER TABLE site_settings
  ALTER COLUMN value TYPE jsonb USING value::jsonb;

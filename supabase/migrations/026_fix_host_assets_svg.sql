-- Migration 026: Remove SVG from host-assets bucket (XSS vector)
-- SVGs can contain <script> tags and execute JavaScript when loaded

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/gif']
WHERE id = 'host-assets';

-- Migration 024: Create host-assets storage bucket for logo/banner uploads
-- 5MB limit, image MIME types only, public read access

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('host-assets', 'host-assets', true, 5242880, ARRAY['image/png','image/jpeg','image/webp','image/gif','image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to host-images folder
CREATE POLICY "Authenticated users can upload host assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'host-assets' AND (storage.foldername(name))[1] = 'host-images');

-- Public read access
CREATE POLICY "Anyone can view host assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'host-assets');

-- Users can update/delete own uploads
CREATE POLICY "Users can manage own host assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'host-assets' AND owner = auth.uid());

CREATE POLICY "Users can delete own host assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'host-assets' AND owner = auth.uid());

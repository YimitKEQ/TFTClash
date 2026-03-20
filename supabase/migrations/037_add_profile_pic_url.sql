-- Add profile_pic_url column to players table
-- NOTE: The 'avatars' storage bucket must be created manually in the Supabase dashboard.
--   Go to Storage > New bucket > name it "avatars" > set it to public.
ALTER TABLE players ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;

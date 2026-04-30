-- Migration 096: news_posts platform-wide announcements feed.
--
-- The /events broadcast composer is per-tournament and tucked into the Ops
-- tab. We need a top-level news feed visible to logged-out visitors and
-- players alike, where admins can post text + an image + an optional link
-- button. Posts are soft-deletable via archived_at (mirrors the tournaments
-- table convention).

CREATE TABLE IF NOT EXISTS public.news_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 140),
  body TEXT CHECK (length(body) <= 4000),
  image_url TEXT,
  link_url TEXT,
  link_label TEXT CHECK (link_label IS NULL OR length(link_label) BETWEEN 1 AND 60),
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS news_posts_published_idx
  ON public.news_posts (pinned DESC, published_at DESC)
  WHERE archived_at IS NULL;

ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can read non-archived, published posts.
DROP POLICY IF EXISTS news_posts_public_read ON public.news_posts;
CREATE POLICY news_posts_public_read ON public.news_posts
  FOR SELECT
  USING (archived_at IS NULL AND published_at <= NOW());

-- Only admins can insert / update / delete. Mirrors the user_roles pattern
-- already used for tournaments and other admin-only tables.
DROP POLICY IF EXISTS news_posts_admin_all ON public.news_posts;
CREATE POLICY news_posts_admin_all ON public.news_posts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- updated_at trigger so admin edits bump the field.
CREATE OR REPLACE FUNCTION public.news_posts_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS news_posts_touch_updated_at_trg ON public.news_posts;
CREATE TRIGGER news_posts_touch_updated_at_trg
  BEFORE UPDATE ON public.news_posts
  FOR EACH ROW EXECUTE FUNCTION public.news_posts_touch_updated_at();

-- Storage bucket for inline images. Public read, admin-only write.
INSERT INTO storage.buckets (id, name, public)
VALUES ('news-images', 'news-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "news-images public read" ON storage.objects;
CREATE POLICY "news-images public read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'news-images');

DROP POLICY IF EXISTS "news-images admin write" ON storage.objects;
CREATE POLICY "news-images admin write" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'news-images'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "news-images admin update" ON storage.objects;
CREATE POLICY "news-images admin update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'news-images'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'news-images'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "news-images admin delete" ON storage.objects;
CREATE POLICY "news-images admin delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'news-images'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

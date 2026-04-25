-- 070_remove_bucket_listing.sql
-- Public storage buckets `avatars` and `host-assets` have a broad SELECT
-- policy on storage.objects that allows clients to LIST every file in the
-- bucket. Since the buckets are marked public=true, file URLs already work
-- via the Supabase CDN regardless of RLS — the SELECT policy is only used
-- to enable LIST queries.
--
-- Audit of src/ confirms no `.from('avatars').list()` or `.from('host-assets').list()`
-- calls; only `.upload()` and `.getPublicUrl()`. Dropping the SELECT policy
-- removes enumeration capability without breaking image rendering.
--
-- Risk averted: a competitor enumerating host-assets/ could see unannounced
-- prize images before tournament reveals; an attacker enumerating avatars/
-- could harvest user IDs from the path structure.

begin;

drop policy if exists "Anyone can view avatars" on storage.objects;
drop policy if exists "Anyone can view host assets" on storage.objects;

commit;

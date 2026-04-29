-- Phase 1 marketing rebuild: add new platform handles to social_connections.
-- Operator manages handles for X, Reddit, TikTok, YT Shorts, IG, Threads, Bluesky, LinkedIn, Medium.

alter table public.social_connections
  add column if not exists tiktok_handle text,
  add column if not exists ytshorts_handle text,
  add column if not exists threads_handle text,
  add column if not exists bluesky_handle text,
  add column if not exists linkedin_handle text;

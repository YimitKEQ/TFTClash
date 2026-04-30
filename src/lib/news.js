// Thin data-layer for news_posts. RLS does the auth gating; these helpers
// just shape queries and image uploads consistently across the public feed,
// the homepage widget, and the admin composer.
import { supabase } from './supabase.js'

var BUCKET = 'news-images'

// Fetch the latest non-archived posts. Pinned rows always come first, then
// most recent. `limit` is capped so the home widget doesn't pull a flood.
export function fetchNewsPosts(opts) {
  var o = opts || {}
  var limit = Math.max(1, Math.min(100, parseInt(o.limit, 10) || 20))
  return supabase
    .from('news_posts')
    .select('id,title,body,image_url,link_url,link_label,pinned,published_at,created_at')
    .is('archived_at', null)
    .lte('published_at', new Date().toISOString())
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(limit)
}

// Admin-only — RLS will reject if the caller isn't admin. Returns the
// inserted row so the composer can prepend it without a refetch.
export function createNewsPost(input) {
  var payload = {
    title: String(input.title || '').trim().slice(0, 140),
    body: input.body ? String(input.body).slice(0, 4000) : null,
    image_url: input.image_url || null,
    link_url: input.link_url || null,
    link_label: input.link_label ? String(input.link_label).trim().slice(0, 60) : null,
    pinned: !!input.pinned,
    published_at: input.published_at || new Date().toISOString()
  }
  return supabase.from('news_posts').insert(payload).select().single()
}

export function updateNewsPost(id, patch) {
  var allowed = ['title', 'body', 'image_url', 'link_url', 'link_label', 'pinned', 'published_at']
  var clean = {}
  allowed.forEach(function(k) {
    if (Object.prototype.hasOwnProperty.call(patch, k)) clean[k] = patch[k]
  })
  return supabase.from('news_posts').update(clean).eq('id', id).select().single()
}

// Soft-delete via archived_at so the post can be restored. Mirrors the
// tournaments archive flow.
export function archiveNewsPost(id) {
  return supabase.from('news_posts').update({ archived_at: new Date().toISOString() }).eq('id', id)
}

export function unarchiveNewsPost(id) {
  return supabase.from('news_posts').update({ archived_at: null }).eq('id', id)
}

// Upload an image to the news-images public bucket and return its public
// URL. Files are namespaced by timestamp + random to avoid collisions.
export function uploadNewsImage(file) {
  if (!file) return Promise.reject(new Error('No file'))
  if (!supabase.storage) return Promise.reject(new Error('Storage unavailable'))
  var ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
  var path = 'posts/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext
  return supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/png'
  }).then(function(res) {
    if (res.error) throw res.error
    var pub = supabase.storage.from(BUCKET).getPublicUrl(path)
    return { path: path, url: pub.data.publicUrl }
  })
}

// Format a timestamp like "Today, 14:32" / "Yesterday, 09:12" / "Apr 15".
// Localized but compact — matches the rest of the site.
export function formatPostDate(iso) {
  if (!iso) return ''
  var d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  var now = new Date()
  var sameDay = d.toDateString() === now.toDateString()
  var yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  var isYesterday = d.toDateString() === yesterday.toDateString()
  var hh = String(d.getHours()).padStart(2, '0')
  var mm = String(d.getMinutes()).padStart(2, '0')
  if (sameDay) return 'Today, ' + hh + ':' + mm
  if (isYesterday) return 'Yesterday, ' + hh + ':' + mm
  var month = d.toLocaleString(undefined, { month: 'short' })
  return month + ' ' + d.getDate() + ', ' + hh + ':' + mm
}

// Allowlist hosts so an admin typo doesn't ship a javascript: link. http(s)
// only; everything else gets dropped.
export function safeLinkUrl(raw) {
  if (!raw) return null
  var s = String(raw).trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) return null
  if (s.length > 2000) return null
  return s
}

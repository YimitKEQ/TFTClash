import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Panel, Btn, Inp, Icon } from '../../components/ui'
import { supabase } from '../../lib/supabase.js'
import { addAudit as sharedAddAudit } from '../../lib/utils.js'
import {
  archiveNewsPost, unarchiveNewsPost, createNewsPost, updateNewsPost,
  uploadNewsImage, formatPostDate, safeLinkUrl
} from '../../lib/news'

var EMPTY = {
  id: null,
  title: '',
  body: '',
  image_url: '',
  link_url: '',
  link_label: '',
  pinned: false
}

function isValidPost(p) {
  if (!p || !p.title || !p.title.trim()) return false
  if (p.title.trim().length > 140) return false
  if (p.body && p.body.length > 4000) return false
  if (p.link_url && !safeLinkUrl(p.link_url)) return false
  if (p.link_label && p.link_label.length > 60) return false
  return true
}

function PostListRow(props) {
  var p = props.post
  var onEdit = props.onEdit
  var onArchive = props.onArchive
  var onUnarchive = props.onUnarchive
  var isArchived = !!p.archived_at
  return (
    <div className={'flex items-start gap-3 px-4 py-3 border-b border-outline-variant/5 last:border-0 ' + (isArchived ? 'opacity-50' : '')}>
      {p.image_url ? (
        <div className="w-10 h-10 rounded overflow-hidden bg-surface-container-high flex-shrink-0">
          <img src={p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      ) : (
        <div className="w-10 h-10 rounded bg-primary/10 border border-primary/20 flex-shrink-0 flex items-center justify-center">
          <Icon name="campaign" size={14} className="text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          {p.pinned && (
            <span className="text-[9px] font-label font-black uppercase tracking-widest text-secondary bg-secondary/10 border border-secondary/30 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
              <Icon name="push_pin" size={9} />Pinned
            </span>
          )}
          {isArchived && (
            <span className="text-[9px] font-label font-black uppercase tracking-widest text-on-surface/50 bg-on-surface/5 border border-outline-variant/20 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
              <Icon name="inventory_2" size={9} />Archived
            </span>
          )}
          <span className="font-mono text-[10px] text-on-surface/40">{formatPostDate(p.published_at)}</span>
        </div>
        <div className="text-sm font-bold text-on-surface truncate">{p.title}</div>
        {p.body && <div className="text-[11px] text-on-surface/50 line-clamp-1">{p.body}</div>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {!isArchived && (
          <Btn v="ghost" s="sm" onClick={function() { onEdit(p) }} title="Edit"><Icon name="edit" size={14} /></Btn>
        )}
        {isArchived ? (
          <Btn v="ghost" s="sm" onClick={function() { onUnarchive(p) }} title="Restore"><Icon name="unarchive" size={14} className="text-tertiary" /></Btn>
        ) : (
          <Btn v="ghost" s="sm" onClick={function() { onArchive(p) }} title="Archive"><Icon name="inventory_2" size={14} className="text-on-surface/60" /></Btn>
        )}
      </div>
    </div>
  )
}

export default function OpsNews() {
  var ctx = useApp()
  var toast = ctx.toast
  var currentUser = ctx.currentUser

  var _posts = useState([])
  var posts = _posts[0]
  var setPosts = _posts[1]

  var _loading = useState(true)
  var loading = _loading[0]
  var setLoading = _loading[1]

  var _showArchived = useState(false)
  var showArchived = _showArchived[0]
  var setShowArchived = _showArchived[1]

  var _form = useState(EMPTY)
  var form = _form[0]
  var setForm = _form[1]

  var _saving = useState(false)
  var saving = _saving[0]
  var setSaving = _saving[1]

  var _uploading = useState(false)
  var uploading = _uploading[0]
  var setUploading = _uploading[1]

  var fileInputRef = useRef(null)

  function addAudit(type, msg) { sharedAddAudit(supabase, currentUser, type, msg) }

  function loadPosts() {
    setLoading(true)
    // Admin view: include archived rows so the show-archived toggle has
    // something to reveal. RLS is permissive for admins on this table.
    supabase.from('news_posts')
      .select('id,title,body,image_url,link_url,link_label,pinned,published_at,archived_at,created_at,updated_at')
      .order('pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(200)
      .then(function(res) {
        if (res.error) { toast('Failed to load news: ' + res.error.message, 'error'); setLoading(false); return }
        setPosts(res.data || [])
        setLoading(false)
      }).catch(function() { setLoading(false) })
  }

  useEffect(loadPosts, [])

  function setField(k, v) {
    setForm(function(prev) { var n = Object.assign({}, prev); n[k] = v; return n })
  }

  function handleFile(e) {
    var f = e && e.target && e.target.files && e.target.files[0]
    if (!f) return
    if (!/^image\//.test(f.type)) { toast('Please pick an image file', 'error'); return }
    if (f.size > 8 * 1024 * 1024) { toast('Image must be under 8MB', 'error'); return }
    setUploading(true)
    uploadNewsImage(f).then(function(res) {
      setField('image_url', res.url)
      setUploading(false)
      toast('Image uploaded', 'success')
    }).catch(function(err) {
      setUploading(false)
      toast('Upload failed: ' + (err && err.message ? err.message : 'unknown'), 'error')
    })
    if (e && e.target) e.target.value = ''
  }

  function startEdit(post) {
    setForm({
      id: post.id,
      title: post.title || '',
      body: post.body || '',
      image_url: post.image_url || '',
      link_url: post.link_url || '',
      link_label: post.link_label || '',
      pinned: !!post.pinned
    })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() { setForm(EMPTY) }

  function savePost() {
    if (!isValidPost(form)) { toast('Title is required, link must be http(s)', 'error'); return }
    setSaving(true)
    var payload = {
      title: form.title.trim(),
      body: form.body ? form.body.trim() : null,
      image_url: form.image_url || null,
      link_url: form.link_url ? safeLinkUrl(form.link_url) : null,
      link_label: form.link_label ? form.link_label.trim() : null,
      pinned: !!form.pinned
    }
    var p = form.id
      ? updateNewsPost(form.id, payload)
      : createNewsPost(payload)
    p.then(function(res) {
      setSaving(false)
      if (res.error) { toast('Save failed: ' + res.error.message, 'error'); return }
      addAudit('ACTION', form.id ? 'News post edited: ' + payload.title : 'News post published: ' + payload.title)
      toast(form.id ? 'Post updated' : 'Post published', 'success')
      resetForm()
      loadPosts()
    }).catch(function() { setSaving(false); toast('Save failed', 'error') })
  }

  function archiveOne(p) {
    if (!window.confirm('Archive "' + p.title + '"? It will be hidden from the public news feed.')) return
    archiveNewsPost(p.id).then(function(res) {
      if (res.error) { toast('Archive failed: ' + res.error.message, 'error'); return }
      addAudit('ACTION', 'News post archived: ' + p.title)
      toast('Archived', 'success')
      loadPosts()
    }).catch(function() { toast('Archive failed', 'error') })
  }

  function unarchiveOne(p) {
    unarchiveNewsPost(p.id).then(function(res) {
      if (res.error) { toast('Restore failed: ' + res.error.message, 'error'); return }
      addAudit('ACTION', 'News post restored: ' + p.title)
      toast('Restored', 'success')
      loadPosts()
    }).catch(function() { toast('Restore failed', 'error') })
  }

  var visiblePosts = posts.filter(function(p) { return showArchived || !p.archived_at })
  var archivedCount = posts.filter(function(p) { return !!p.archived_at }).length
  var titleLen = (form.title || '').length
  var bodyLen = (form.body || '').length

  return (
    <div className="space-y-5">
      {/* Composer */}
      <Panel>
        <div className="flex items-center gap-2 mb-4">
          <Icon name={form.id ? 'edit_note' : 'edit_square'} size={18} className="text-primary" />
          <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface/60">
            {form.id ? 'Edit Post' : 'New Post'}
          </span>
          {form.id && (
            <button type="button" onClick={resetForm} className="ml-auto text-[10px] font-label font-bold uppercase tracking-widest text-on-surface/40 hover:text-primary transition-colors">
              Cancel edit
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1 flex justify-between">
                <span>Title <span className="text-error">*</span></span>
                <span className="font-mono text-[10px] text-on-surface/30">{titleLen}/140</span>
              </label>
              <Inp value={form.title} onChange={function(v) { setField('title', typeof v === 'string' ? v : v.target.value) }} placeholder="e.g. Weekend Clash $250 prize pool!" />
            </div>
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1 flex justify-between">
                <span>Body</span>
                <span className="font-mono text-[10px] text-on-surface/30">{bodyLen}/4000</span>
              </label>
              <textarea
                value={form.body}
                onChange={function(e) { setField('body', e.target.value) }}
                rows={6}
                maxLength={4000}
                placeholder="Tell players what's new. Newlines render as paragraph breaks."
                className="w-full bg-surface border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-on-surface placeholder-on-surface/30 focus:outline-none focus:border-primary/60 resize-y"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Link URL</label>
                <Inp value={form.link_url} onChange={function(v) { setField('link_url', typeof v === 'string' ? v : v.target.value) }} placeholder="https://..." />
              </div>
              <div>
                <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Link Button Label</label>
                <Inp value={form.link_label} onChange={function(v) { setField('link_label', typeof v === 'string' ? v : v.target.value) }} placeholder="Read more" />
              </div>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.pinned} onChange={function(e) { setField('pinned', e.target.checked) }} className="accent-primary" />
              <span className="text-xs text-on-surface/80 font-bold">Pin to top</span>
            </label>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] text-on-surface/60 font-bold uppercase tracking-wider mb-1">Hero Image (optional)</label>
              <div className="flex items-center gap-2 mb-2">
                <Btn v="dark" s="sm" onClick={function() { if (fileInputRef.current) fileInputRef.current.click() }} disabled={uploading}>
                  <Icon name={uploading ? 'progress_activity' : 'upload'} size={14} className={uploading ? 'animate-spin' : ''} />
                  {uploading ? 'Uploading...' : 'Upload'}
                </Btn>
                {form.image_url && (
                  <Btn v="ghost" s="sm" onClick={function() { setField('image_url', '') }}>
                    <Icon name="close" size={14} className="text-error" />Remove
                  </Btn>
                )}
                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFile} className="hidden" />
              </div>
              {form.image_url ? (
                <div className="aspect-[16/9] rounded-lg overflow-hidden border border-outline-variant/20 bg-surface-container-high">
                  <img src={form.image_url} alt="preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-[16/9] rounded-lg border border-dashed border-outline-variant/20 bg-surface-container/40 flex flex-col items-center justify-center text-on-surface/30 text-xs gap-1">
                  <Icon name="image" size={28} />
                  <span className="font-label uppercase tracking-widest">No image</span>
                </div>
              )}
              <div className="text-[10px] text-on-surface/40 mt-1">Recommended 16:9 aspect, max 8MB. Stored in Supabase public bucket "news-images".</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-4 mt-4 border-t border-outline-variant/10">
          <Btn v="primary" onClick={savePost} disabled={saving || !form.title.trim()}>
            <Icon name={form.id ? 'save' : 'send'} size={14} />
            {saving ? 'Saving...' : (form.id ? 'Save changes' : 'Publish post')}
          </Btn>
          {!form.id && (
            <span className="text-[10px] font-label uppercase tracking-widest text-on-surface/40">Visible immediately to all visitors</span>
          )}
        </div>
      </Panel>

      {/* Posts list */}
      <Panel className="!p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Icon name="list_alt" size={18} className="text-primary" />
            <span className="font-label text-xs font-bold uppercase tracking-widest text-on-surface/60">
              All Posts ({visiblePosts.length}{archivedCount > 0 ? ' / ' + posts.length : ''})
            </span>
          </div>
          {archivedCount > 0 && (
            <button type="button" onClick={function() { setShowArchived(!showArchived) }} className={'inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-label font-bold uppercase tracking-widest rounded border transition-colors ' + (showArchived ? 'border-on-surface/30 text-on-surface bg-on-surface/5' : 'border-outline-variant/20 text-on-surface/50 hover:text-on-surface hover:border-outline-variant/40')}>
              <Icon name={showArchived ? 'visibility_off' : 'visibility'} size={12} />
              {showArchived ? 'Hide archived' : 'Show archived (' + archivedCount + ')'}
            </button>
          )}
        </div>
        {loading ? (
          <div className="py-10 text-center text-on-surface/30 text-xs font-label uppercase tracking-widest">Loading...</div>
        ) : visiblePosts.length === 0 ? (
          <div className="py-10 text-center text-on-surface/30 text-xs font-label uppercase tracking-widest">No posts yet. Compose your first one above!</div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            {visiblePosts.map(function(p) { return (
              <PostListRow
                key={p.id}
                post={p}
                onEdit={startEdit}
                onArchive={archiveOne}
                onUnarchive={unarchiveOne}
              />
            ) })}
          </div>
        )}
      </Panel>
    </div>
  )
}

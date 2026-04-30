import { useEffect, useState } from 'react'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Btn, Icon } from '../components/ui'
import { fetchNewsPosts, formatPostDate, safeLinkUrl } from '../lib/news'

function PostBody(props) {
  var text = props.text
  if (!text) return null
  // Render newlines as paragraph breaks. Plain text only - we never
  // dangerouslySetInnerHTML user-controlled content.
  var paras = String(text).split(/\n{2,}/)
  return (
    <div className="space-y-3 text-sm leading-relaxed text-on-surface/80 whitespace-pre-wrap">
      {paras.map(function(p, i) { return <p key={i}>{p}</p> })}
    </div>
  )
}

function PostCard(props) {
  var post = props.post
  var safeLink = safeLinkUrl(post.link_url)
  var label = post.link_label || (safeLink ? 'Read more' : null)
  return (
    <Panel className="!p-0 overflow-hidden">
      {post.image_url && (
        <div className="aspect-[16/7] w-full overflow-hidden bg-surface-container-high border-b border-outline-variant/10">
          <img src={post.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}
      <div className="p-5 sm:p-6 space-y-3">
        <div className="flex items-start gap-2 flex-wrap">
          {post.pinned && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-label font-black uppercase tracking-widest text-secondary bg-secondary/10 border border-secondary/30 rounded">
              <Icon name="push_pin" size={10} />Pinned
            </span>
          )}
          <span className="font-mono text-[10px] text-on-surface/40 uppercase tracking-wider">{formatPostDate(post.published_at)}</span>
        </div>
        <h2 className="font-display text-xl sm:text-2xl font-black uppercase tracking-tight text-on-surface leading-tight">{post.title}</h2>
        <PostBody text={post.body} />
        {safeLink && label && (
          <div className="pt-1">
            <a href={safeLink} target="_blank" rel="noopener noreferrer">
              <Btn v="primary" s="sm">
                {label} <Icon name="open_in_new" size={14} />
              </Btn>
            </a>
          </div>
        )}
      </div>
    </Panel>
  )
}

export default function NewsScreen() {
  var _loading = useState(true)
  var loading = _loading[0]
  var setLoading = _loading[1]

  var _posts = useState([])
  var posts = _posts[0]
  var setPosts = _posts[1]

  var _err = useState(null)
  var err = _err[0]
  var setErr = _err[1]

  useEffect(function() {
    var cancelled = false
    fetchNewsPosts({ limit: 50 }).then(function(res) {
      if (cancelled) return
      if (res.error) { setErr(res.error.message); setLoading(false); return }
      setPosts(res.data || [])
      setLoading(false)
    }).catch(function(e) {
      if (cancelled) return
      setErr(e && e.message ? e.message : 'Failed to load news')
      setLoading(false)
    })
    return function() { cancelled = true }
  }, [])

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-primary/30 bg-primary/10">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <span className="font-label text-[10px] font-bold uppercase tracking-widest text-primary">News</span>
            </span>
            <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface/40">Announcements & Updates</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="campaign" size={22} className="text-primary" />
            <h1 className="font-display text-2xl font-black uppercase tracking-tight text-on-surface">Latest from TFT Clash</h1>
          </div>
          <div className="mt-2 h-px bg-gradient-to-r from-primary/30 via-outline-variant/20 to-transparent"></div>
        </div>

        {loading && (
          <Panel className="text-center py-10 text-on-surface/40 text-xs font-label uppercase tracking-widest">Loading news...</Panel>
        )}
        {!loading && err && (
          <Panel className="text-center py-8 text-error text-xs">{err}</Panel>
        )}
        {!loading && !err && posts.length === 0 && (
          <Panel className="text-center py-12">
            <Icon name="campaign" size={32} className="text-on-surface/20 block mx-auto mb-2" />
            <div className="font-label text-xs text-on-surface/30 uppercase tracking-widest">No news yet</div>
            <div className="text-[11px] text-on-surface/40 mt-1">Check back soon - announcements and updates will appear here.</div>
          </Panel>
        )}
        {!loading && !err && posts.length > 0 && (
          <div className="space-y-4">
            {posts.map(function(p) { return <PostCard key={p.id} post={p} /> })}
          </div>
        )}
      </div>
    </PageLayout>
  )
}

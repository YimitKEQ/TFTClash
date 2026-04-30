import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Panel, Btn, Icon } from '../ui'
import { fetchNewsPosts, formatPostDate, safeLinkUrl } from '../../lib/news'

function NewsRow(props) {
  var post = props.post
  var safeLink = safeLinkUrl(post.link_url)
  var label = post.link_label || (safeLink ? 'Read more' : null)
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-outline-variant/10 bg-surface-container-low/40">
      {post.image_url ? (
        <div className="w-14 h-14 rounded-md overflow-hidden bg-surface-container-high flex-shrink-0">
          <img src={post.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      ) : (
        <div className="w-14 h-14 rounded-md bg-primary/10 border border-primary/20 flex-shrink-0 flex items-center justify-center">
          <Icon name="campaign" size={20} className="text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          {post.pinned && (
            <span className="inline-flex items-center gap-1 px-1 py-0.5 text-[9px] font-label font-black uppercase tracking-widest text-secondary bg-secondary/10 border border-secondary/30 rounded">
              <Icon name="push_pin" size={9} />
            </span>
          )}
          <span className="font-mono text-[10px] text-on-surface/40 uppercase tracking-wider">{formatPostDate(post.published_at)}</span>
        </div>
        <div className="text-sm font-bold text-on-surface line-clamp-2">{post.title}</div>
        {post.body && <div className="text-[12px] text-on-surface/60 line-clamp-2 whitespace-pre-wrap">{post.body}</div>}
        {safeLink && label && (
          <a href={safeLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-label font-bold uppercase tracking-widest text-primary hover:underline">
            {label}<Icon name="open_in_new" size={11} />
          </a>
        )}
      </div>
    </div>
  )
}

export default function NewsFeed(props) {
  var limit = props.limit || 3
  var navigate = useNavigate()

  var _posts = useState([])
  var posts = _posts[0]
  var setPosts = _posts[1]

  var _loaded = useState(false)
  var loaded = _loaded[0]
  var setLoaded = _loaded[1]

  useEffect(function() {
    var cancelled = false
    fetchNewsPosts({ limit: limit }).then(function(res) {
      if (cancelled) return
      if (!res.error && res.data) setPosts(res.data)
      setLoaded(true)
    }).catch(function() { if (!cancelled) setLoaded(true) })
    return function() { cancelled = true }
  }, [limit])

  // Hide entirely if no posts after load — no point shouting "no news yet"
  // on the home page when the platform has nothing to say.
  if (loaded && posts.length === 0) return null

  return (
    <Panel className="!p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon name="campaign" size={16} className="text-primary" />
          <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface/50">Latest News</span>
        </div>
        <button type="button" onClick={function() { navigate('/news') }} className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface/40 hover:text-primary transition-colors flex items-center gap-1">
          View all <Icon name="chevron_right" size={12} />
        </button>
      </div>
      {!loaded ? (
        <div className="py-6 text-center text-on-surface/30 text-xs font-label uppercase tracking-widest">Loading...</div>
      ) : (
        <div className="space-y-2">
          {posts.map(function(p) { return <NewsRow key={p.id} post={p} /> })}
        </div>
      )}
      {loaded && posts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-outline-variant/5 flex justify-center">
          <Btn v="ghost" s="sm" onClick={function() { navigate('/news') }}>
            <Icon name="campaign" size={14} /> All news
          </Btn>
        </div>
      )}
    </Panel>
  )
}

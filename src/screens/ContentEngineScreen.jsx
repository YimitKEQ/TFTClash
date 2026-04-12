import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import { Icon, Btn, Panel } from '../components/ui'

var PLATFORMS = [
  { id: 'twitter',   name: 'Twitter / X',  color: '#1DA1F2', icon: 'tag' },
  { id: 'reddit',    name: 'Reddit',       color: '#FF4500', icon: 'forum' },
  { id: 'medium',    name: 'Medium',       color: '#00AB6C', icon: 'article' },
  { id: 'instagram', name: 'Instagram',    color: '#E1306C', icon: 'photo_camera' },
]

var CONTENT_TYPES = {
  twitter: [
    { id: 'single_tweet',   label: 'Single Tweet' },
    { id: 'thread',         label: 'Thread (3-10)' },
    { id: 'poll',           label: 'Poll' },
    { id: 'hot_take',       label: 'Hot Take' },
    { id: 'engagement',     label: 'Engagement Bait' },
    { id: 'quote_response', label: 'Quote Response' },
  ],
  reddit: [
    { id: 'discussion',   label: 'Discussion Post' },
    { id: 'dev_diary',    label: 'Dev Diary' },
    { id: 'guide',        label: 'Guide / Analysis' },
    { id: 'announcement', label: 'Announcement' },
    { id: 'meme',         label: 'Meme Post' },
  ],
  medium: [
    { id: 'dev_log',       label: 'Dev Log' },
    { id: 'tft_analysis',  label: 'TFT Analysis' },
    { id: 'opinion',       label: 'Opinion / Hot Take' },
    { id: 'tutorial',      label: 'Tutorial' },
    { id: 'launch',        label: 'Launch Announcement' },
  ],
  instagram: [
    { id: 'caption',   label: 'Caption + Hashtags' },
    { id: 'carousel',  label: 'Carousel Script' },
    { id: 'reel',      label: 'Reel Script' },
    { id: 'story',     label: 'Story Sequence' },
  ],
}

var TONES = [
  { id: 'hype',         label: 'Hype',         emoji: '\ud83d\udd25' },
  { id: 'casual',       label: 'Casual',       emoji: '\ud83d\ude0e' },
  { id: 'professional', label: 'Professional', emoji: '\ud83d\udcd0' },
  { id: 'funny',        label: 'Funny',        emoji: '\ud83d\ude02' },
  { id: 'provocative',  label: 'Provocative',  emoji: '\ud83e\udd4c' },
  { id: 'educational',  label: 'Educational',  emoji: '\ud83c\udf93' },
  { id: 'unhinged',     label: 'Unhinged',     emoji: '\ud83d\udc80' },
]

var TABS = [
  { id: 'generate', label: 'Generate', icon: 'bolt' },
  { id: 'library',  label: 'Library',  icon: 'inventory_2' },
  { id: 'trends',   label: 'Trends',   icon: 'trending_up' },
  { id: 'socials',  label: 'Socials',  icon: 'link' },
]

function buildComposerUrl(platform, content, social) {
  if (platform === 'twitter') {
    return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(content)
  }
  if (platform === 'reddit') {
    var sub = (social && social.reddit_default_sub) || 'CompetitiveTFT'
    var lines = content.split('\n')
    var title = lines[0].replace(/^Title:\s*/i, '').slice(0, 300)
    var body = lines.slice(1).join('\n').trim()
    return 'https://www.reddit.com/r/' + sub + '/submit?title=' + encodeURIComponent(title) + '&text=' + encodeURIComponent(body)
  }
  if (platform === 'medium') {
    return 'https://medium.com/new-story'
  }
  if (platform === 'instagram') {
    return 'https://www.instagram.com/'
  }
  return '#'
}

function GenerateTab(props) {
  var currentUser = props.currentUser
  var toast = props.toast
  var social = props.social
  var refreshLibrary = props.refreshLibrary

  var [platform, setPlatform] = useState('twitter')
  var [contentType, setContentType] = useState('single_tweet')
  var [tone, setTone] = useState('casual')
  var [context, setContext] = useState('')
  var [includeTrends, setIncludeTrends] = useState(true)
  var [variations, setVariations] = useState(1)
  var [results, setResults] = useState([])
  var [loading, setLoading] = useState(false)
  var [selected, setSelected] = useState(0)
  var [editMode, setEditMode] = useState(false)
  var [edited, setEdited] = useState('')

  useEffect(function(){
    var list = CONTENT_TYPES[platform] || []
    if (list.length && !list.find(function(t){return t.id===contentType})) {
      setContentType(list[0].id)
    }
  }, [platform])

  var generate = useCallback(async function(){
    if (!currentUser) { toast('Sign in first', 'error'); return }
    setLoading(true)
    setResults([])
    try {
      var session = await supabase.auth.getSession()
      var token = session?.data?.session?.access_token
      if (!token) { toast('No auth token', 'error'); setLoading(false); return }

      var recent = await supabase.from('content_posts').select('generated_content').eq('platform', platform).order('created_at', {ascending:false}).limit(5)
      var previousPosts = (recent.data || []).map(function(r){return r.generated_content})

      var res = await fetch((import.meta.env.VITE_SUPABASE_URL || '') + '/functions/v1/content-generate', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + token },
        body: JSON.stringify({
          action:'generate',
          platform: platform,
          contentType: contentType,
          tone: tone,
          context: context,
          includeTrends: includeTrends,
          variations: variations,
          previousPosts: previousPosts,
        })
      })
      var json = await res.json()
      if (json.error) { toast(json.error, 'error'); setLoading(false); return }
      setResults(json.results || [])
      setSelected(0)
      setEditMode(false)
      toast('Generated ' + (json.results||[]).length + ' variation(s)', 'success')
    } catch(e) {
      toast('Error: ' + e.message, 'error')
    }
    setLoading(false)
  }, [currentUser, platform, contentType, tone, context, includeTrends, variations, toast])

  var saveDraft = useCallback(async function(){
    var content = editMode ? edited : (results[selected] || '')
    if (!content) return
    var row = {
      owner_id: currentUser.auth_user_id,
      platform: platform,
      content_type: contentType,
      tone: tone,
      context: context,
      generated_content: results[selected] || content,
      edited_content: editMode ? edited : null,
      status: 'draft',
    }
    var r = await supabase.from('content_posts').insert(row)
    if (r.error) { toast(r.error.message, 'error'); return }
    toast('Saved to library', 'success')
    if (refreshLibrary) refreshLibrary()
  }, [editMode, edited, results, selected, currentUser, platform, contentType, tone, context, toast, refreshLibrary])

  var copyText = function(){
    var content = editMode ? edited : (results[selected] || '')
    navigator.clipboard.writeText(content)
    toast('Copied', 'success')
  }

  var openComposer = function(){
    var content = editMode ? edited : (results[selected] || '')
    var url = buildComposerUrl(platform, content, social)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  var current = results[selected] || ''
  var displayText = editMode ? edited : current
  var charCount = displayText.length

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-1 flex flex-col gap-4">
        <Panel>
          <div className="p-4">
            <div className="text-xs uppercase tracking-wider text-on-surface/50 mb-2">Platform</div>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map(function(p){
                var active = platform === p.id
                return (
                  <button key={p.id} onClick={function(){setPlatform(p.id)}}
                    className="flex items-center gap-2 p-3 rounded-lg border text-left transition-all"
                    style={{
                      borderColor: active ? p.color : 'rgba(255,255,255,0.08)',
                      background: active ? p.color + '20' : 'rgba(255,255,255,0.02)',
                      color: active ? p.color : '#BECBD9'
                    }}>
                    <Icon name={p.icon} size={18}/>
                    <span className="text-sm font-semibold">{p.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="p-4">
            <div className="text-xs uppercase tracking-wider text-on-surface/50 mb-2">Content Type</div>
            <div className="grid grid-cols-1 gap-2">
              {(CONTENT_TYPES[platform] || []).map(function(t){
                var active = contentType === t.id
                return (
                  <button key={t.id} onClick={function(){setContentType(t.id)}}
                    className="text-left px-3 py-2 rounded-md text-sm transition-all"
                    style={{
                      background: active ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.02)',
                      border: '1px solid ' + (active ? '#D4AF37' : 'rgba(255,255,255,0.06)'),
                      color: active ? '#D4AF37' : '#BECBD9'
                    }}>
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="p-4">
            <div className="text-xs uppercase tracking-wider text-on-surface/50 mb-2">Tone</div>
            <div className="flex flex-wrap gap-2">
              {TONES.map(function(t){
                var active = tone === t.id
                return (
                  <button key={t.id} onClick={function(){setTone(t.id)}}
                    className="px-3 py-1.5 rounded-full text-xs transition-all"
                    style={{
                      background: active ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.03)',
                      border: '1px solid ' + (active ? '#D4AF37' : 'rgba(255,255,255,0.08)'),
                      color: active ? '#D4AF37' : '#BECBD9'
                    }}>
                    <span className="mr-1">{t.emoji}</span>{t.label}
                  </button>
                )
              })}
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="p-4 space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-on-surface/50 mb-2">Context (optional)</div>
              <textarea value={context} onChange={function(e){setContext(e.target.value)}}
                placeholder="Anything specific? Event? Angle? Target audience?"
                className="w-full bg-black/30 border border-white/10 rounded-md p-2 text-sm text-on-surface resize-none"
                rows={3}/>
            </div>
            <label className="flex items-center gap-2 text-sm text-on-surface/80 cursor-pointer">
              <input type="checkbox" checked={includeTrends} onChange={function(e){setIncludeTrends(e.target.checked)}}/>
              Inject current TFT Reddit trends
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-on-surface/50 uppercase tracking-wider">Variations</span>
              {[1,2,3].map(function(n){
                return (
                  <button key={n} onClick={function(){setVariations(n)}}
                    className="w-8 h-8 rounded-md text-sm"
                    style={{
                      background: variations===n ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.04)',
                      border: '1px solid ' + (variations===n ? '#D4AF37' : 'rgba(255,255,255,0.08)'),
                      color: variations===n ? '#D4AF37' : '#BECBD9'
                    }}>{n}</button>
                )
              })}
            </div>
            <Btn variant="primary" onClick={generate} disabled={loading} className="w-full">
              {loading ? 'Generating...' : 'Generate'}
            </Btn>
          </div>
        </Panel>
      </div>

      <div className="lg:col-span-2">
        <Panel>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-wider text-on-surface/50">Output</div>
              {results.length > 1 && (
                <div className="flex gap-1">
                  {results.map(function(_,i){
                    return (
                      <button key={i} onClick={function(){setSelected(i); setEditMode(false)}}
                        className="w-7 h-7 rounded-md text-xs"
                        style={{
                          background: selected===i ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.04)',
                          border: '1px solid ' + (selected===i ? '#D4AF37' : 'rgba(255,255,255,0.08)'),
                          color: selected===i ? '#D4AF37' : '#BECBD9'
                        }}>{i+1}</button>
                    )
                  })}
                </div>
              )}
            </div>

            {!results.length && !loading && (
              <div className="text-center py-16 text-on-surface/40">
                <Icon name="auto_awesome" size={48}/>
                <div className="mt-3 text-sm">Pick a platform and generate</div>
              </div>
            )}

            {loading && (
              <div className="text-center py-16 text-on-surface/60">
                <Icon name="hourglass_top" size={32}/>
                <div className="mt-2 text-sm">Claude is cooking...</div>
              </div>
            )}

            {results.length > 0 && !loading && (
              <div>
                {editMode ? (
                  <textarea value={edited} onChange={function(e){setEdited(e.target.value)}}
                    className="w-full bg-black/40 border border-white/10 rounded-md p-3 text-sm text-on-surface"
                    rows={16}/>
                ) : (
                  <pre className="whitespace-pre-wrap bg-black/40 border border-white/10 rounded-md p-4 text-sm text-on-surface font-sans">{current}</pre>
                )}

                <div className="flex items-center justify-between mt-3">
                  <div className="text-xs text-on-surface/50">
                    {charCount} chars
                    {platform==='twitter' && charCount > 280 && <span className="text-red-400 ml-2">OVER LIMIT</span>}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Btn onClick={function(){
                      if (!editMode) { setEdited(current); setEditMode(true) }
                      else { setEditMode(false) }
                    }}>{editMode ? 'Done' : 'Edit'}</Btn>
                    <Btn onClick={copyText}>Copy</Btn>
                    <Btn onClick={saveDraft}>Save</Btn>
                    <Btn onClick={generate}>Regenerate</Btn>
                    <Btn variant="primary" onClick={openComposer}>Open in {platform}</Btn>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function LibraryTab(props) {
  var posts = props.posts
  var refresh = props.refresh
  var toast = props.toast
  var social = props.social

  var [filter, setFilter] = useState('all')

  var filtered = posts.filter(function(p){
    if (filter === 'all') return true
    if (filter === 'favorites') return p.is_favorite
    return p.platform === filter || p.status === filter
  })

  var toggleFav = async function(p){
    await supabase.from('content_posts').update({is_favorite: !p.is_favorite}).eq('id', p.id)
    refresh()
  }

  var archive = async function(p){
    await supabase.from('content_posts').update({status:'archived'}).eq('id', p.id)
    refresh()
  }

  var del = async function(p){
    if (!confirm('Delete this post?')) return
    await supabase.from('content_posts').delete().eq('id', p.id)
    refresh()
  }

  var post = function(p){
    var content = p.edited_content || p.generated_content
    window.open(buildComposerUrl(p.platform, content, social), '_blank', 'noopener,noreferrer')
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all','favorites','draft','scheduled','posted','twitter','reddit','medium','instagram'].map(function(f){
          return (
            <button key={f} onClick={function(){setFilter(f)}}
              className="px-3 py-1.5 rounded-full text-xs capitalize"
              style={{
                background: filter===f ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.03)',
                border: '1px solid ' + (filter===f ? '#D4AF37' : 'rgba(255,255,255,0.08)'),
                color: filter===f ? '#D4AF37' : '#BECBD9'
              }}>{f}</button>
          )
        })}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(function(p){
          var plat = PLATFORMS.find(function(x){return x.id===p.platform}) || {color:'#fff',name:p.platform}
          var content = p.edited_content || p.generated_content
          return (
            <Panel key={p.id}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{background:plat.color+'20', color:plat.color}}>{plat.name}</span>
                    <span className="text-xs text-on-surface/50">{p.content_type} / {p.tone}</span>
                  </div>
                  <button onClick={function(){toggleFav(p)}} className="text-lg" style={{color: p.is_favorite ? '#D4AF37' : '#556'}}>
                    {p.is_favorite ? '\u2605' : '\u2606'}
                  </button>
                </div>
                <pre className="whitespace-pre-wrap text-xs text-on-surface/80 bg-black/30 p-3 rounded max-h-40 overflow-auto font-sans">{content}</pre>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Btn onClick={function(){navigator.clipboard.writeText(content); toast('Copied','success')}}>Copy</Btn>
                  <Btn variant="primary" onClick={function(){post(p)}}>Post</Btn>
                  <Btn onClick={function(){archive(p)}}>Archive</Btn>
                  <Btn onClick={function(){del(p)}}>Delete</Btn>
                </div>
                <div className="text-xs text-on-surface/40 mt-2">{new Date(p.created_at).toLocaleString()}</div>
              </div>
            </Panel>
          )
        })}
        {!filtered.length && <div className="text-on-surface/50 text-sm col-span-2 text-center py-10">No posts yet.</div>}
      </div>
    </div>
  )
}

function TrendsTab(props) {
  var toast = props.toast
  var [trends, setTrends] = useState(null)
  var [loading, setLoading] = useState(false)

  var load = useCallback(async function(){
    setLoading(true)
    try {
      var session = await supabase.auth.getSession()
      var token = session?.data?.session?.access_token
      var res = await fetch((import.meta.env.VITE_SUPABASE_URL || '') + '/functions/v1/content-generate', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
        body: JSON.stringify({action:'trends'})
      })
      var json = await res.json()
      setTrends(json.trends)
    } catch(e){
      toast('Error: '+e.message, 'error')
    }
    setLoading(false)
  }, [toast])

  useEffect(function(){ load() }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-on-surface/60">Live r/CompetitiveTFT hot posts (cached 2h)</div>
        <Btn onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</Btn>
      </div>
      <Panel>
        <div className="p-4">
          {!trends && <div className="text-on-surface/50 text-sm">No data</div>}
          {trends && trends.posts && trends.posts.map(function(p,i){
            return (
              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                className="block py-3 border-b border-white/5 hover:bg-white/5 px-2 rounded">
                <div className="text-sm text-on-surface">{p.title}</div>
                <div className="text-xs text-on-surface/50 mt-1">{p.score} upvotes / {p.num_comments} comments {p.flair && '/ '+p.flair}</div>
              </a>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}

function SocialsTab(props) {
  var currentUser = props.currentUser
  var social = props.social
  var refresh = props.refresh
  var toast = props.toast

  var [twitter, setTwitter] = useState((social && social.twitter_handle) || '')
  var [reddit, setReddit] = useState((social && social.reddit_username) || '')
  var [sub, setSub] = useState((social && social.reddit_default_sub) || 'CompetitiveTFT')
  var [medium, setMedium] = useState((social && social.medium_handle) || '')
  var [ig, setIg] = useState((social && social.instagram_handle) || '')

  useEffect(function(){
    if (social) {
      setTwitter(social.twitter_handle || '')
      setReddit(social.reddit_username || '')
      setSub(social.reddit_default_sub || 'CompetitiveTFT')
      setMedium(social.medium_handle || '')
      setIg(social.instagram_handle || '')
    }
  }, [social])

  var save = async function(){
    var row = {
      owner_id: currentUser.auth_user_id,
      twitter_handle: twitter,
      reddit_username: reddit,
      reddit_default_sub: sub,
      medium_handle: medium,
      instagram_handle: ig,
      updated_at: new Date().toISOString(),
    }
    var r = await supabase.from('social_connections').upsert(row, {onConflict:'owner_id'})
    if (r.error) { toast(r.error.message,'error'); return }
    toast('Saved','success')
    refresh()
  }

  var Field = function(fp){
    return (
      <div className="mb-3">
        <div className="text-xs uppercase tracking-wider text-on-surface/50 mb-1">{fp.label}</div>
        <input value={fp.value} onChange={function(e){fp.onChange(e.target.value)}} placeholder={fp.placeholder}
          className="w-full bg-black/30 border border-white/10 rounded-md p-2 text-sm text-on-surface"/>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <Panel>
        <div className="p-5">
          <div className="text-sm text-on-surface/70 mb-4">
            Connect your handles. We use platform "composer" deep links (Twitter intent, Reddit submit) so "Post" buttons open a pre-filled compose window in a new tab. No OAuth, no stored tokens, no risk.
          </div>
          <Field label="Twitter / X handle" value={twitter} onChange={setTwitter} placeholder="@levitate"/>
          <Field label="Reddit username" value={reddit} onChange={setReddit} placeholder="u/yourname"/>
          <Field label="Default subreddit" value={sub} onChange={setSub} placeholder="CompetitiveTFT"/>
          <Field label="Medium handle" value={medium} onChange={setMedium} placeholder="@sebastianlives"/>
          <Field label="Instagram handle" value={ig} onChange={setIg} placeholder="@sebastianlives"/>
          <Btn variant="primary" onClick={save}>Save</Btn>
        </div>
      </Panel>
    </div>
  )
}

export default function ContentEngineScreen(){
  var ctx = useApp()
  var currentUser = ctx.currentUser
  var toast = ctx.toast
  var isAdmin = ctx.isAdmin

  var [tab, setTab] = useState('generate')
  var [posts, setPosts] = useState([])
  var [social, setSocial] = useState(null)

  var loadPosts = useCallback(async function(){
    if (!currentUser) return
    var r = await supabase.from('content_posts').select('*').order('created_at', {ascending:false}).limit(100)
    setPosts(r.data || [])
  }, [currentUser])

  var loadSocial = useCallback(async function(){
    if (!currentUser) return
    var r = await supabase.from('social_connections').select('*').eq('owner_id', currentUser.auth_user_id).maybeSingle()
    setSocial(r.data || null)
  }, [currentUser])

  useEffect(function(){ loadPosts(); loadSocial() }, [loadPosts, loadSocial])

  if (!currentUser || !isAdmin) {
    return (
      <PageLayout>
        <div className="page wrap text-center pt-20">
          <div className="text-4xl mb-4">{'\ud83d\udd12'}</div>
          <h2 className="text-on-surface mb-2">Admin only</h2>
        </div>
      </PageLayout>
    )
  }

  var drafts = posts.filter(function(p){return p.status==='draft'}).length
  var scheduled = posts.filter(function(p){return p.status==='scheduled'}).length

  return (
    <PageLayout>
      <div className="page wrap max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-on-surface text-2xl font-bold">Content Engine</h1>
            <div className="text-xs text-on-surface/50 mt-1">Drafts: {drafts} / Scheduled: {scheduled} / Posts: {posts.length}</div>
          </div>
        </div>

        <div className="flex gap-2 mb-5 border-b border-white/10">
          {TABS.map(function(t){
            var active = tab === t.id
            return (
              <button key={t.id} onClick={function(){setTab(t.id)}}
                className="flex items-center gap-2 px-4 py-3 text-sm transition-all"
                style={{
                  borderBottom: '2px solid ' + (active ? '#D4AF37' : 'transparent'),
                  color: active ? '#D4AF37' : '#BECBD9'
                }}>
                <Icon name={t.icon} size={16}/>{t.label}
              </button>
            )
          })}
        </div>

        {tab === 'generate' && <GenerateTab currentUser={currentUser} toast={toast} social={social} refreshLibrary={loadPosts}/>}
        {tab === 'library' && <LibraryTab posts={posts} refresh={loadPosts} toast={toast} social={social}/>}
        {tab === 'trends' && <TrendsTab toast={toast}/>}
        {tab === 'socials' && <SocialsTab currentUser={currentUser} social={social} refresh={loadSocial} toast={toast}/>}
      </div>
    </PageLayout>
  )
}

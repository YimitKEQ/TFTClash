import { useState, useEffect, useCallback, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import { Icon, Btn, Panel, PillTab, PillTabGroup } from '../components/ui'

var SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
var SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

var PLATFORMS = [
  { id: 'twitter',   name: 'Twitter / X',  color: '#1DA1F2', icon: 'tag',          glow: 'rgba(29,161,242,0.35)' },
  { id: 'reddit',    name: 'Reddit',       color: '#FF4500', icon: 'forum',        glow: 'rgba(255,69,0,0.35)' },
  { id: 'medium',    name: 'Medium',       color: '#00AB6C', icon: 'article',      glow: 'rgba(0,171,108,0.35)' },
  { id: 'instagram', name: 'Instagram',    color: '#E1306C', icon: 'photo_camera', glow: 'rgba(225,48,108,0.35)' },
]

var CONTENT_TYPES = {
  twitter: [
    { id: 'single_tweet',    label: 'Single Tweet',      icon: 'chat_bubble' },
    { id: 'thread',          label: 'Thread 3-10',       icon: 'format_list_numbered' },
    { id: 'patch_hot_take',  label: 'Patch Hot Take',    icon: 'local_fire_department' },
    { id: 'meta_comp',       label: 'Meta Comp Spotlight', icon: 'groups' },
    { id: 'set17_hype',      label: 'Set 17 Hype',       icon: 'rocket_launch' },
    { id: 'tourney_recap',   label: 'Tournament Recap',  icon: 'emoji_events' },
    { id: 'leaderboard_flex',label: 'Leaderboard Flex',  icon: 'leaderboard' },
    { id: 'poll',            label: 'Poll',              icon: 'how_to_vote' },
    { id: 'dev_log',         label: 'Dev Log',           icon: 'code' },
    { id: 'meme_tweet',      label: 'Meme Tweet',        icon: 'sentiment_very_satisfied' },
    { id: 'quote_response',  label: 'Quote Response',    icon: 'format_quote' },
    { id: 'engagement',      label: 'Engagement Bait',   icon: 'psychology' },
  ],
  reddit: [
    { id: 'discussion',      label: 'Discussion Post',   icon: 'forum' },
    { id: 'patch_breakdown', label: 'Patch Breakdown',   icon: 'fact_check' },
    { id: 'comp_guide',      label: 'Comp Guide',        icon: 'school' },
    { id: 'augment_review',  label: 'Augment Review',    icon: 'auto_awesome' },
    { id: 'hero_augment',    label: 'Hero Augment Tier', icon: 'military_tech' },
    { id: 'tourney_recap',   label: 'Tournament Recap',  icon: 'emoji_events' },
    { id: 'set17_prediction',label: 'Set 17 Prediction', icon: 'psychology_alt' },
    { id: 'dev_diary',       label: 'Dev Diary',         icon: 'build' },
    { id: 'clash_announce',  label: 'Clash Announcement',icon: 'campaign' },
    { id: 'meme',            label: 'Meme Post',         icon: 'mood' },
    { id: 'hot_take_reddit', label: 'Hot Take',          icon: 'local_fire_department' },
  ],
  medium: [
    { id: 'dev_log',         label: 'Dev Log',             icon: 'code' },
    { id: 'patch_deep_dive', label: 'Patch Deep Dive',     icon: 'query_stats' },
    { id: 'meta_analysis',   label: 'Meta Analysis',       icon: 'analytics' },
    { id: 'champion_spot',   label: 'Champion Spotlight',  icon: 'star' },
    { id: 'set17_preview',   label: 'Set 17 Preview',      icon: 'rocket_launch' },
    { id: 'tutorial',        label: 'Tutorial',            icon: 'school' },
    { id: 'opinion',         label: 'Opinion / Hot Take',  icon: 'record_voice_over' },
    { id: 'launch',          label: 'Launch Announcement', icon: 'campaign' },
    { id: 'founder_story',   label: 'Founder Story',       icon: 'auto_stories' },
  ],
  instagram: [
    { id: 'caption',        label: 'Caption + Tags',     icon: 'text_fields' },
    { id: 'comp_carousel',  label: 'Comp Carousel',      icon: 'view_carousel' },
    { id: 'patch_reel',     label: 'Patch Reel Script',  icon: 'movie' },
    { id: 'clash_reel',     label: 'Clash Highlight Reel',icon: 'emoji_events' },
    { id: 'tier_list',      label: 'Tier List Post',     icon: 'format_list_numbered' },
    { id: 'story',          label: 'Story Sequence',     icon: 'amp_stories' },
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

var REMIX_ACTIONS = [
  { id: 'shorter',  label: 'Shorter',   icon: 'compress' },
  { id: 'punchier', label: 'Punchier',  icon: 'bolt' },
  { id: 'funnier',  label: 'Funnier',   icon: 'mood' },
  { id: 'bolder',   label: 'Bolder',    icon: 'whatshot' },
  { id: 'simpler',  label: 'Simpler',   icon: 'compress' },
  { id: 'spicier',  label: 'Spicier',   icon: 'local_fire_department' },
]

var TABS = [
  { id: 'generate', label: 'Generate', icon: 'bolt' },
  { id: 'campaign', label: 'Campaign', icon: 'rocket_launch' },
  { id: 'ideas',    label: 'Ideas',    icon: 'lightbulb' },
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
  if (platform === 'medium') return 'https://medium.com/new-story'
  if (platform === 'instagram') return 'https://www.instagram.com/'
  return '#'
}

async function callEdgeFn(body) {
  var session = await supabase.auth.getSession()
  var token = session?.data?.session?.access_token
  if (!token) throw new Error('Not signed in')
  var res = await fetch(SUPABASE_URL + '/functions/v1/content-generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      'apikey': SUPABASE_KEY,
    },
    body: JSON.stringify(body),
  })
  var json = await res.json()
  if (!res.ok || json.error) throw new Error(json.error || ('HTTP ' + res.status))
  return json
}

// ═══════════════════════════════ SHARED STYLE HELPERS ═══════════════════════════════

var goldBorder = { border: '1px solid rgba(255,255,255,0.08)' }
var goldGlow = {}
var surfaceBase = { background: 'rgba(255,255,255,0.02)' }

function SectionLabel(props) {
  return (
    <div className="text-[11px] uppercase font-semibold tracking-wider mb-2 text-on-surface/60"
      style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
      {props.children}
    </div>
  )
}

function GoldChip(props) {
  var active = props.active
  return (
    <button onClick={props.onClick} disabled={props.disabled}
      className={'px-3 py-1.5 rounded-md text-xs font-semibold transition-all border ' + (active ? 'bg-primary text-on-primary border-primary' : 'bg-white/[0.03] text-on-surface/70 border-white/10 hover:border-white/20')}>
      {props.children}
    </button>
  )
}

function StatPill(props) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10">
      <Icon name={props.icon} size={14} className="text-primary"/>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-on-surface/50 leading-none" style={{fontFamily:'Barlow Condensed'}}>{props.label}</div>
        <div className="text-sm font-bold text-on-surface leading-tight">{props.value}</div>
      </div>
    </div>
  )
}

// ═══════════════════════════════ GENERATE TAB ═══════════════════════════════

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
  var [loadingMsg, setLoadingMsg] = useState('')
  var [selected, setSelected] = useState(0)
  var [editMode, setEditMode] = useState(false)
  var [edited, setEdited] = useState('')
  var [usedTrends, setUsedTrends] = useState(null)

  useEffect(function(){
    var list = CONTENT_TYPES[platform] || []
    if (list.length && !list.find(function(t){return t.id===contentType})) {
      setContentType(list[0].id)
    }
  }, [platform])

  var doGenerate = useCallback(async function(overrideContext){
    if (!currentUser) { toast('Sign in first', 'error'); return }
    setLoading(true)
    setLoadingMsg('Summoning Gemini...')
    setResults([])
    try {
      var recent = await supabase.from('content_posts').select('generated_content').eq('platform', platform).order('created_at', {ascending:false}).limit(5)
      var previousPosts = (recent.data || []).map(function(r){return r.generated_content})

      var json = await callEdgeFn({
        action:'generate',
        platform: platform,
        contentType: contentType,
        tone: tone,
        context: overrideContext || context,
        includeTrends: includeTrends,
        variations: variations,
        previousPosts: previousPosts,
      })
      setResults(json.results || [])
      setUsedTrends(json.trends || null)
      setSelected(0)
      setEditMode(false)
      toast('Generated ' + (json.results||[]).length + ' variation(s)', 'success')
    } catch(e) {
      toast('Error: ' + e.message, 'error')
    }
    setLoading(false)
    setLoadingMsg('')
  }, [currentUser, platform, contentType, tone, context, includeTrends, variations, toast])

  var remix = useCallback(async function(action){
    if (!results.length) return
    var source = editMode ? edited : (results[selected] || '')
    var remixCtx = 'Take this existing post and make it ' + action + '. Keep the same core idea but transform it.\n\nORIGINAL:\n' + source
    setLoading(true)
    setLoadingMsg('Remixing ' + action + '...')
    try {
      var json = await callEdgeFn({
        action:'generate',
        platform: platform,
        contentType: contentType,
        tone: tone,
        context: remixCtx,
        includeTrends: false,
        variations: 1,
      })
      var newResults = results.slice()
      newResults[selected] = (json.results && json.results[0]) || newResults[selected]
      setResults(newResults)
      setEditMode(false)
      toast('Remixed: ' + action, 'success')
    } catch(e) {
      toast('Error: ' + e.message, 'error')
    }
    setLoading(false)
    setLoadingMsg('')
  }, [results, selected, editMode, edited, platform, contentType, tone, toast])

  var adaptToAll = useCallback(async function(){
    if (!results.length) return
    var source = editMode ? edited : (results[selected] || '')
    var targets = PLATFORMS.filter(function(p){return p.id !== platform})
    setLoading(true)
    setLoadingMsg('Adapting to 3 platforms...')
    try {
      var adapted = []
      for (var i=0; i<targets.length; i++) {
        var tgt = targets[i]
        var firstType = (CONTENT_TYPES[tgt.id][0] || {}).id
        var adaptCtx = 'Adapt this existing post to ' + tgt.name + '. Preserve the core message but rewrite to fit the platform perfectly.\n\nSOURCE (' + platform + '):\n' + source
        var json = await callEdgeFn({
          action:'generate',
          platform: tgt.id,
          contentType: firstType,
          tone: tone,
          context: adaptCtx,
          includeTrends: false,
          variations: 1,
        })
        var content = (json.results && json.results[0]) || ''
        if (content) {
          await supabase.from('content_posts').insert({
            owner_id: currentUser.auth_user_id,
            platform: tgt.id,
            content_type: firstType,
            tone: tone,
            context: 'Adapted from ' + platform,
            generated_content: content,
            status: 'draft',
          })
          adapted.push(tgt.name)
        }
      }
      toast('Adapted to ' + adapted.join(', ') + ' and saved to Library', 'success')
      if (refreshLibrary) refreshLibrary()
    } catch(e) {
      toast('Error: ' + e.message, 'error')
    }
    setLoading(false)
    setLoadingMsg('')
  }, [results, selected, editMode, edited, platform, tone, currentUser, toast, refreshLibrary])

  var saveDraft = useCallback(async function(){
    var content = editMode ? edited : (results[selected] || '')
    if (!content) return
    var r = await supabase.from('content_posts').insert({
      owner_id: currentUser.auth_user_id,
      platform: platform,
      content_type: contentType,
      tone: tone,
      context: context,
      generated_content: results[selected] || content,
      edited_content: editMode ? edited : null,
      status: 'draft',
      trend_snapshot: usedTrends,
    })
    if (r.error) { toast(r.error.message, 'error'); return }
    toast('Saved to library', 'success')
    if (refreshLibrary) refreshLibrary()
  }, [editMode, edited, results, selected, currentUser, platform, contentType, tone, context, usedTrends, toast, refreshLibrary])

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
  var twitterOver = platform === 'twitter' && charCount > 280
  var platformObj = PLATFORMS.find(function(p){return p.id===platform}) || PLATFORMS[0]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* LEFT COLUMN: config */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        {/* PLATFORM HERO TILES */}
        <div className="rounded-xl p-5" style={{...surfaceBase, ...goldGlow, ...goldBorder}}>
          <SectionLabel>Platform</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            {PLATFORMS.map(function(p){
              var active = platform === p.id
              return (
                <button key={p.id} onClick={function(){setPlatform(p.id)}}
                  className="flex flex-col items-start gap-1 p-4 rounded-lg text-left transition-all relative overflow-hidden"
                  style={{
                    background: active ? 'linear-gradient(135deg, ' + p.color + '25, ' + p.color + '08)' : 'rgba(255,255,255,0.02)',
                    border: '1px solid ' + (active ? p.color : 'rgba(255,255,255,0.08)'),
                    boxShadow: active ? '0 0 24px ' + p.glow + ', inset 0 1px 0 ' + p.color + '40' : 'none',
                    color: active ? p.color : '#BECBD9',
                    transform: active ? 'translateY(-1px)' : 'none',
                  }}>
                  <Icon name={p.icon} size={22}/>
                  <span className="text-sm font-bold" style={{fontFamily:'Barlow Condensed, sans-serif', letterSpacing:'0.05em'}}>{p.name.toUpperCase()}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* CONTENT TYPE GRID */}
        <div className="rounded-xl p-5" style={{...surfaceBase, ...goldBorder}}>
          <SectionLabel>Content Type</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {(CONTENT_TYPES[platform] || []).map(function(t){
              var active = contentType === t.id
              return (
                <button key={t.id} onClick={function(){setContentType(t.id)}}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-md text-xs transition-all text-left"
                  style={{
                    background: active ? 'linear-gradient(135deg, rgba(232,168,56,0.18), rgba(232,168,56,0.04))' : 'rgba(255,255,255,0.02)',
                    border: '1px solid ' + (active ? 'rgba(232,168,56,0.6)' : 'rgba(255,255,255,0.06)'),
                    color: active ? '#E8A838' : '#BECBD9',
                    boxShadow: active ? '0 0 10px rgba(232,168,56,0.15)' : 'none',
                  }}>
                  <Icon name={t.icon} size={14}/>
                  <span className="font-semibold" style={{fontFamily:'Barlow Condensed'}}>{t.label.toUpperCase()}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* TONE CHIPS */}
        <div className="rounded-xl p-5" style={{...surfaceBase, ...goldBorder}}>
          <SectionLabel>Tone</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {TONES.map(function(t){
              return (
                <GoldChip key={t.id} active={tone === t.id} onClick={function(){setTone(t.id)}}>
                  <span className="mr-1">{t.emoji}</span>{t.label.toUpperCase()}
                </GoldChip>
              )
            })}
          </div>
        </div>

        {/* CONTEXT + OPTIONS */}
        <div className="rounded-xl p-5 space-y-3" style={{...surfaceBase, ...goldBorder}}>
          <div>
            <SectionLabel>Context (optional)</SectionLabel>
            <textarea value={context} onChange={function(e){setContext(e.target.value)}}
              placeholder="Angle? Event? Specific hook? Let Gemini know what to cook."
              className="w-full rounded-md p-3 text-sm text-on-surface resize-none"
              style={{
                background: 'rgba(11,18,32,0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
                outline: 'none',
              }}
              rows={3}/>
          </div>
          <label className="flex items-center gap-2 text-sm text-on-surface/80 cursor-pointer py-1">
            <input type="checkbox" checked={includeTrends} onChange={function(e){setIncludeTrends(e.target.checked)}}
              style={{accentColor:'#E8A838'}}/>
            <Icon name="trending_up" size={14} style={{color:'#E8A838'}}/>
            <span style={{fontFamily:'Barlow Condensed', letterSpacing:'0.03em'}}>INJECT LIVE TFT TRENDS</span>
          </label>
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-widest text-on-surface/50" style={{fontFamily:'Barlow Condensed'}}>Variations</span>
            <div className="flex gap-1">
              {[1,2,3].map(function(n){
                var active = variations===n
                return (
                  <button key={n} onClick={function(){setVariations(n)}}
                    className="w-9 h-9 rounded-md text-sm font-bold transition-all"
                    style={{
                      background: active ? 'linear-gradient(135deg, rgba(232,168,56,0.25), rgba(232,168,56,0.08))' : 'rgba(255,255,255,0.03)',
                      border: '1px solid ' + (active ? 'rgba(232,168,56,0.6)' : 'rgba(255,255,255,0.08)'),
                      color: active ? '#E8A838' : '#BECBD9',
                      boxShadow: active ? '0 0 10px rgba(232,168,56,0.2)' : 'none',
                    }}>{n}</button>
                )
              })}
            </div>
          </div>

          {/* BIG GENERATE BUTTON */}
          <button onClick={function(){doGenerate()}} disabled={loading}
            className="w-full mt-2 py-4 rounded-lg font-bold text-sm transition-all"
            style={{
              background: loading ? 'rgba(232,168,56,0.15)' : 'linear-gradient(135deg, #E8A838 0%, #B8860B 100%)',
              color: loading ? '#E8A838' : '#0B1220',
              boxShadow: loading ? 'none' : '0 0 30px rgba(232,168,56,0.4), 0 4px 12px rgba(0,0,0,0.3)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: '15px',
              border: 'none',
              cursor: loading ? 'wait' : 'pointer',
            }}>
            {loading ? (loadingMsg || 'Cooking...') : '\u26a1 Generate'}
          </button>
        </div>
      </div>

      {/* RIGHT COLUMN: output */}
      <div className="lg:col-span-7">
        <div className="rounded-xl p-5 min-h-[600px]" style={{...surfaceBase, ...goldBorder, ...goldGlow, borderLeft:'3px solid #E8A838'}}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <SectionLabel>Output</SectionLabel>
              {results.length > 0 && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold"
                  style={{background: platformObj.color+'20', color: platformObj.color, border: '1px solid '+platformObj.color+'40'}}>
                  <Icon name={platformObj.icon} size={10}/>
                  {platformObj.name.toUpperCase()}
                </div>
              )}
            </div>
            {results.length > 1 && (
              <div className="flex gap-1.5">
                {results.map(function(_,i){
                  var active = selected===i
                  return (
                    <button key={i} onClick={function(){setSelected(i); setEditMode(false)}}
                      className="w-8 h-8 rounded-md text-xs font-bold transition-all"
                      style={{
                        background: active ? 'linear-gradient(135deg, rgba(232,168,56,0.3), rgba(232,168,56,0.1))' : 'rgba(255,255,255,0.03)',
                        border: '1px solid ' + (active ? 'rgba(232,168,56,0.7)' : 'rgba(255,255,255,0.08)'),
                        color: active ? '#E8A838' : '#BECBD9',
                      }}>V{i+1}</button>
                  )
                })}
              </div>
            )}
          </div>

          {!results.length && !loading && (
            <div className="flex flex-col items-center justify-center text-center py-24">
              <div className="mb-4 text-5xl" style={{color:'#E8A838'}}>{'\u2728'}</div>
              <div className="text-lg font-bold text-on-surface/80 mb-2" style={{fontFamily:'Playfair Display, serif'}}>Ready to cook</div>
              <div className="text-xs text-on-surface/40 max-w-sm" style={{fontFamily:'Barlow Condensed'}}>
                PICK PLATFORM. PICK TYPE. PICK TONE. SMASH GENERATE. STEAL THE ALGORITHM.
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="relative w-16 h-16 mb-4">
                <div className="absolute inset-0 rounded-full animate-ping" style={{background:'rgba(232,168,56,0.3)'}}/>
                <div className="absolute inset-2 rounded-full" style={{background:'linear-gradient(135deg,#E8A838,#B8860B)'}}/>
                <Icon name="auto_awesome" size={24} className="absolute inset-0 m-auto text-black"/>
              </div>
              <div className="text-sm text-on-surface/80 font-bold" style={{fontFamily:'Barlow Condensed', letterSpacing:'0.1em'}}>{(loadingMsg || 'COOKING').toUpperCase()}</div>
            </div>
          )}

          {results.length > 0 && !loading && (
            <div>
              {editMode ? (
                <textarea value={edited} onChange={function(e){setEdited(e.target.value)}}
                  className="w-full rounded-lg p-4 text-sm text-on-surface font-mono"
                  style={{background:'rgba(11,18,32,0.8)', border:'1px solid rgba(232,168,56,0.3)', outline:'none', minHeight:'340px'}}
                  rows={16}/>
              ) : (
                <div className="relative">
                  <pre className="whitespace-pre-wrap rounded-lg p-5 text-sm text-on-surface font-body leading-relaxed"
                    style={{
                      background: 'rgba(11,18,32,0.7)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderLeft: '3px solid ' + platformObj.color,
                      minHeight: '340px',
                    }}>{current}</pre>
                </div>
              )}

              {/* CHAR COUNT + TREND INJECTED BADGE */}
              <div className="flex items-center justify-between mt-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="text-xs font-bold" style={{
                    color: twitterOver ? '#F87171' : '#BECBD9',
                    fontFamily: 'Barlow Condensed',
                    letterSpacing: '0.05em'
                  }}>
                    {charCount} CHARS {twitterOver && '\u26a0 OVER 280 LIMIT'}
                  </div>
                  {usedTrends && usedTrends.posts && usedTrends.posts.length > 0 && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                      style={{background:'rgba(0,171,108,0.15)', color:'#00AB6C', border:'1px solid rgba(0,171,108,0.3)'}}>
                      <Icon name="trending_up" size={10}/>
                      <span style={{fontFamily:'Barlow Condensed'}}>TRENDS INJECTED</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex gap-2 flex-wrap mb-3">
                <Btn onClick={function(){
                  if (!editMode) { setEdited(current); setEditMode(true) }
                  else { setEditMode(false) }
                }}>
                  <Icon name={editMode?'check':'edit'} size={14}/>{editMode?' Done':' Edit'}
                </Btn>
                <Btn onClick={copyText}><Icon name="content_copy" size={14}/> Copy</Btn>
                <Btn onClick={saveDraft}><Icon name="save" size={14}/> Save</Btn>
                <Btn onClick={function(){doGenerate()}}><Icon name="refresh" size={14}/> Regen</Btn>
                <Btn onClick={adaptToAll}><Icon name="shuffle" size={14}/> Adapt All</Btn>
                <button onClick={openComposer}
                  className="px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5"
                  style={{
                    background: 'linear-gradient(135deg,' + platformObj.color + ',' + platformObj.color + 'aa)',
                    color: '#fff',
                    fontFamily: 'Barlow Condensed',
                    letterSpacing: '0.08em',
                    border: 'none',
                    boxShadow: '0 0 14px ' + platformObj.glow,
                  }}>
                  <Icon name="send" size={14}/>POST TO {platformObj.name.toUpperCase()}
                </button>
              </div>

              {/* REMIX BAR */}
              <div className="pt-3" style={{borderTop:'1px dashed rgba(232,168,56,0.2)'}}>
                <div className="text-[10px] uppercase tracking-widest text-on-surface/50 mb-2" style={{fontFamily:'Barlow Condensed'}}>Quick Remix</div>
                <div className="flex gap-1.5 flex-wrap">
                  {REMIX_ACTIONS.map(function(a){
                    return (
                      <button key={a.id} onClick={function(){remix(a.id)}}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{
                          background: 'rgba(232,168,56,0.06)',
                          border: '1px solid rgba(232,168,56,0.2)',
                          color: '#E8A838',
                          fontFamily: 'Barlow Condensed',
                        }}>
                        <Icon name={a.icon} size={11}/>{a.label.toUpperCase()}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════ CAMPAIGN TAB ═══════════════════════════════

function CampaignTab(props) {
  var currentUser = props.currentUser
  var toast = props.toast
  var refreshLibrary = props.refreshLibrary

  var [theme, setTheme] = useState('Set 17 Space Gods launch week')
  var [tone, setTone] = useState('hype')
  var [postsPerPlatform, setPostsPerPlatform] = useState(3)
  var [loading, setLoading] = useState(false)
  var [progress, setProgress] = useState('')
  var [generated, setGenerated] = useState([])

  var runCampaign = useCallback(async function(){
    if (!currentUser) { toast('Sign in first','error'); return }
    setLoading(true)
    setGenerated([])
    var all = []
    try {
      for (var pi=0; pi<PLATFORMS.length; pi++) {
        var p = PLATFORMS[pi]
        var types = CONTENT_TYPES[p.id]
        for (var i=0; i<postsPerPlatform; i++) {
          var t = types[i % types.length]
          setProgress(p.name + ' - ' + t.label + ' (' + (all.length+1) + '/' + (PLATFORMS.length * postsPerPlatform) + ')')
          var json = await callEdgeFn({
            action:'generate',
            platform: p.id,
            contentType: t.id,
            tone: tone,
            context: 'CAMPAIGN: "' + theme + '". Post ' + (i+1) + ' of ' + postsPerPlatform + ' for ' + p.name + '. Make each post feel distinct, dont repeat angles.',
            includeTrends: true,
            variations: 1,
          })
          var content = (json.results && json.results[0]) || ''
          if (content) {
            var row = {
              owner_id: currentUser.auth_user_id,
              platform: p.id,
              content_type: t.id,
              tone: tone,
              context: 'Campaign: ' + theme,
              generated_content: content,
              status: 'draft',
              tags: ['campaign', theme.toLowerCase().replace(/\s+/g,'-').slice(0,40)],
            }
            await supabase.from('content_posts').insert(row)
            all.push({ platform: p.id, type: t.label, content: content })
            setGenerated(all.slice())
          }
        }
      }
      toast('Campaign complete: ' + all.length + ' posts saved', 'success')
      if (refreshLibrary) refreshLibrary()
    } catch(e) {
      toast('Error: ' + e.message, 'error')
    }
    setLoading(false)
    setProgress('')
  }, [currentUser, theme, tone, postsPerPlatform, toast, refreshLibrary])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-1">
        <div className="rounded-xl p-5 space-y-4" style={{...surfaceBase, ...goldBorder, ...goldGlow}}>
          <div>
            <SectionLabel>Campaign Theme</SectionLabel>
            <input value={theme} onChange={function(e){setTheme(e.target.value)}}
              className="w-full rounded-md p-3 text-sm text-on-surface"
              style={{background:'rgba(11,18,32,0.6)', border:'1px solid rgba(255,255,255,0.08)', outline:'none'}}/>
          </div>
          <div>
            <SectionLabel>Tone</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {TONES.map(function(t){
                return <GoldChip key={t.id} active={tone===t.id} onClick={function(){setTone(t.id)}}>{t.emoji} {t.label.toUpperCase()}</GoldChip>
              })}
            </div>
          </div>
          <div>
            <SectionLabel>Posts per platform</SectionLabel>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(function(n){
                var active = postsPerPlatform===n
                return (
                  <button key={n} onClick={function(){setPostsPerPlatform(n)}}
                    className="w-10 h-10 rounded-md text-sm font-bold"
                    style={{
                      background: active ? 'linear-gradient(135deg, rgba(232,168,56,0.25), rgba(232,168,56,0.08))' : 'rgba(255,255,255,0.03)',
                      border: '1px solid ' + (active ? 'rgba(232,168,56,0.6)' : 'rgba(255,255,255,0.08)'),
                      color: active ? '#E8A838' : '#BECBD9',
                    }}>{n}</button>
                )
              })}
            </div>
            <div className="text-[10px] text-on-surface/40 mt-2" style={{fontFamily:'Barlow Condensed'}}>
              TOTAL: {postsPerPlatform * PLATFORMS.length} POSTS ACROSS 4 PLATFORMS
            </div>
          </div>
          <button onClick={runCampaign} disabled={loading}
            className="w-full py-4 rounded-lg font-bold text-sm"
            style={{
              background: loading ? 'rgba(232,168,56,0.15)' : 'linear-gradient(135deg, #E8A838 0%, #B8860B 100%)',
              color: loading ? '#E8A838' : '#0B1220',
              boxShadow: loading ? 'none' : '0 0 30px rgba(232,168,56,0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              fontFamily: 'Barlow Condensed',
              border: 'none',
              cursor: loading ? 'wait' : 'pointer',
            }}>
            {loading ? (progress || 'Running...') : '\ud83d\ude80 Launch Campaign'}
          </button>
          <div className="text-[11px] text-on-surface/50" style={{fontFamily:'Barlow Condensed'}}>
            Generates {postsPerPlatform * PLATFORMS.length} unique posts and saves all as drafts. Review in Library.
          </div>
        </div>
      </div>
      <div className="lg:col-span-2">
        <div className="rounded-xl p-5" style={{...surfaceBase, ...goldBorder, minHeight:'600px'}}>
          <SectionLabel>Output Stream</SectionLabel>
          {!generated.length && !loading && (
            <div className="text-center py-16 text-on-surface/40">
              <Icon name="rocket_launch" size={40} style={{color:'#E8A838'}}/>
              <div className="mt-3 text-xs" style={{fontFamily:'Barlow Condensed', letterSpacing:'0.1em'}}>SET A THEME. LAUNCH. WATCH IT COOK.</div>
            </div>
          )}
          <div className="space-y-3">
            {generated.map(function(g, i){
              var p = PLATFORMS.find(function(x){return x.id===g.platform})
              return (
                <div key={i} className="rounded-lg p-3"
                  style={{background:'rgba(11,18,32,0.6)', border:'1px solid rgba(255,255,255,0.06)', borderLeft:'3px solid '+p.color}}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                      style={{background:p.color+'20', color:p.color, fontFamily:'Barlow Condensed'}}>{p.name.toUpperCase()}</span>
                    <span className="text-[10px] text-on-surface/50">{g.type}</span>
                  </div>
                  <pre className="whitespace-pre-wrap text-xs text-on-surface/80 font-body max-h-32 overflow-auto">{g.content}</pre>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════ IDEAS TAB ═══════════════════════════════

function IdeasTab(props) {
  var toast = props.toast
  var [topic, setTopic] = useState('TFT Clash launch marketing')
  var [ideas, setIdeas] = useState('')
  var [loading, setLoading] = useState(false)

  var generate = async function(){
    setLoading(true)
    try {
      var json = await callEdgeFn({
        action:'generate',
        platform:'twitter',
        contentType:'idea_brainstorm',
        tone:'casual',
        context:'Give me 15 FIRE content ideas around: "' + topic + '". Format as numbered list. Each idea one line, punchy, clickable. No fluff. No explanations. Just 15 raw ideas.',
        includeTrends: true,
        variations: 1,
      })
      setIdeas((json.results && json.results[0]) || '')
      toast('15 ideas generated','success')
    } catch(e){ toast('Error: '+e.message,'error') }
    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-xl p-5" style={{...surfaceBase, ...goldBorder, ...goldGlow}}>
        <SectionLabel>Brainstorm Topic</SectionLabel>
        <div className="flex gap-2">
          <input value={topic} onChange={function(e){setTopic(e.target.value)}}
            className="flex-1 rounded-md p-3 text-sm text-on-surface"
            style={{background:'rgba(11,18,32,0.6)', border:'1px solid rgba(255,255,255,0.08)', outline:'none'}}/>
          <button onClick={generate} disabled={loading}
            className="px-6 rounded-md font-bold text-xs"
            style={{
              background: loading ? 'rgba(232,168,56,0.15)' : 'linear-gradient(135deg, #E8A838, #B8860B)',
              color: loading ? '#E8A838' : '#0B1220',
              textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:'Barlow Condensed', border:'none',
              boxShadow: loading ? 'none' : '0 0 20px rgba(232,168,56,0.3)',
              cursor: loading ? 'wait' : 'pointer',
            }}>{loading ? 'Cooking' : '\u26a1 15 Ideas'}</button>
        </div>
        {ideas && (
          <pre className="whitespace-pre-wrap mt-5 rounded-lg p-5 text-sm text-on-surface font-body leading-relaxed"
            style={{background:'rgba(11,18,32,0.7)', border:'1px solid rgba(255,255,255,0.06)', borderLeft:'3px solid #E8A838'}}>{ideas}</pre>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════ LIBRARY TAB ═══════════════════════════════

function LibraryTab(props) {
  var posts = props.posts
  var refresh = props.refresh
  var toast = props.toast
  var social = props.social

  var [filter, setFilter] = useState('all')
  var [search, setSearch] = useState('')

  var filtered = useMemo(function(){
    return posts.filter(function(p){
      var matchFilter = filter === 'all' ||
        (filter === 'favorites' && p.is_favorite) ||
        p.platform === filter || p.status === filter
      if (!matchFilter) return false
      if (!search) return true
      var hay = (p.generated_content + ' ' + (p.edited_content||'') + ' ' + (p.context||'')).toLowerCase()
      return hay.includes(search.toLowerCase())
    })
  }, [posts, filter, search])

  var toggleFav = async function(p){
    await supabase.from('content_posts').update({is_favorite: !p.is_favorite}).eq('id', p.id)
    refresh()
  }
  var archive = async function(p){
    await supabase.from('content_posts').update({status:'archived'}).eq('id', p.id)
    refresh()
  }
  var markPosted = async function(p){
    await supabase.from('content_posts').update({status:'posted', posted_at: new Date().toISOString()}).eq('id', p.id)
    toast('Marked as posted','success')
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
      <div className="flex gap-3 mb-4 items-center flex-wrap">
        <input value={search} onChange={function(e){setSearch(e.target.value)}}
          placeholder="Search posts..."
          className="flex-1 min-w-[200px] rounded-md p-2 text-sm text-on-surface"
          style={{background:'rgba(11,18,32,0.6)', border:'1px solid rgba(255,255,255,0.08)', outline:'none'}}/>
      </div>
      <div className="flex gap-2 mb-5 flex-wrap">
        {['all','favorites','draft','scheduled','posted','archived','twitter','reddit','medium','instagram'].map(function(f){
          return <GoldChip key={f} active={filter===f} onClick={function(){setFilter(f)}}>{f.toUpperCase()}</GoldChip>
        })}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(function(p){
          var plat = PLATFORMS.find(function(x){return x.id===p.platform}) || {color:'#fff',name:p.platform,icon:'help'}
          var content = p.edited_content || p.generated_content
          return (
            <div key={p.id} className="rounded-lg p-4 flex flex-col"
              style={{...surfaceBase, border:'1px solid rgba(255,255,255,0.06)', borderLeft:'3px solid '+plat.color}}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold"
                    style={{background:plat.color+'20', color:plat.color, fontFamily:'Barlow Condensed'}}>
                    <Icon name={plat.icon} size={10}/>{plat.name.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-on-surface/50" style={{fontFamily:'Barlow Condensed'}}>{p.content_type.toUpperCase()} / {p.tone.toUpperCase()}</span>
                  {p.status !== 'draft' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:'rgba(232,168,56,0.15)', color:'#E8A838'}}>{p.status.toUpperCase()}</span>
                  )}
                </div>
                <button onClick={function(){toggleFav(p)}} className="text-lg" style={{background:'none', border:'none', color: p.is_favorite ? '#E8A838' : '#556', cursor:'pointer'}}>
                  {p.is_favorite ? '\u2605' : '\u2606'}
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-xs text-on-surface/80 rounded p-3 max-h-40 overflow-auto font-body flex-1"
                style={{background:'rgba(11,18,32,0.7)'}}>{content}</pre>
              <div className="flex gap-1.5 mt-3 flex-wrap">
                <Btn onClick={function(){navigator.clipboard.writeText(content); toast('Copied','success')}}><Icon name="content_copy" size={12}/></Btn>
                <button onClick={function(){post(p)}}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold"
                  style={{background:'linear-gradient(135deg,'+plat.color+','+plat.color+'aa)', color:'#fff', border:'none', fontFamily:'Barlow Condensed'}}>
                  <Icon name="send" size={11}/>POST
                </button>
                <Btn onClick={function(){markPosted(p)}}><Icon name="check" size={12}/></Btn>
                <Btn onClick={function(){archive(p)}}><Icon name="archive" size={12}/></Btn>
                <Btn onClick={function(){del(p)}}><Icon name="delete" size={12}/></Btn>
              </div>
              <div className="text-[10px] text-on-surface/40 mt-2" style={{fontFamily:'Barlow Condensed'}}>{new Date(p.created_at).toLocaleString()}</div>
            </div>
          )
        })}
        {!filtered.length && (
          <div className="text-on-surface/40 text-sm col-span-2 text-center py-10" style={{fontFamily:'Barlow Condensed', letterSpacing:'0.1em'}}>
            NO POSTS YET. GENERATE SOMETHING.
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════ TRENDS TAB ═══════════════════════════════

function TrendsTab(props) {
  var toast = props.toast
  var [trends, setTrends] = useState(null)
  var [loading, setLoading] = useState(false)

  var load = useCallback(async function(){
    setLoading(true)
    try {
      var json = await callEdgeFn({action:'trends'})
      setTrends(json.trends)
    } catch(e){ toast('Error: '+e.message, 'error') }
    setLoading(false)
  }, [toast])

  useEffect(function(){ load() }, [])

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-on-surface/60" style={{fontFamily:'Barlow Condensed', letterSpacing:'0.08em'}}>AI-GENERATED TFT TALKING POINTS (CACHED 2H)</div>
        <Btn onClick={load} disabled={loading}>
          <Icon name="refresh" size={14}/>{loading ? ' Loading' : ' Refresh'}
        </Btn>
      </div>
      <div className="rounded-xl p-2" style={{...surfaceBase, ...goldBorder}}>
        {!trends && <div className="text-on-surface/50 text-sm p-6 text-center">No data yet</div>}
        {trends && trends.error && (!trends.posts || !trends.posts.length) && (
          <div className="p-6 text-center">
            <div className="text-error text-sm mb-2">Reddit fetch blocked</div>
            <div className="text-on-surface/50 text-xs break-all">{trends.error}</div>
            <div className="text-on-surface/40 text-xs mt-3">Reddit blocks Supabase Edge IPs. Trends may need a different source.</div>
          </div>
        )}
        {trends && trends.posts && trends.posts.map(function(p,i){
          return (
            <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
              className="block py-3 px-4 border-b border-white/5 hover:bg-white/5 transition-all rounded"
              style={{textDecoration:'none'}}>
              <div className="flex items-start gap-3">
                <div className="text-xs font-bold w-8 flex-shrink-0" style={{color:'#E8A838', fontFamily:'Barlow Condensed'}}>#{i+1}</div>
                <div className="flex-1">
                  <div className="text-sm text-on-surface leading-snug">{p.title}</div>
                  <div className="text-[10px] text-on-surface/50 mt-1 flex items-center gap-3" style={{fontFamily:'Barlow Condensed'}}>
                    <span>{p.score} UPVOTES</span>
                    <span>{p.num_comments} COMMENTS</span>
                    {p.flair && <span style={{color:'#E8A838'}}>{p.flair.toUpperCase()}</span>}
                  </div>
                </div>
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════ SOCIALS TAB ═══════════════════════════════

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

  var fields = [
    { label:'Twitter / X handle', value:twitter, setter:setTwitter, placeholder:'@levitate', color:'#1DA1F2' },
    { label:'Reddit username',    value:reddit,  setter:setReddit,  placeholder:'u/yourname', color:'#FF4500' },
    { label:'Default subreddit',  value:sub,     setter:setSub,     placeholder:'CompetitiveTFT', color:'#FF4500' },
    { label:'Medium handle',      value:medium,  setter:setMedium,  placeholder:'@sebastianlives', color:'#00AB6C' },
    { label:'Instagram handle',   value:ig,      setter:setIg,      placeholder:'@sebastianlives', color:'#E1306C' },
  ]

  return (
    <div className="max-w-2xl">
      <div className="rounded-xl p-6" style={{...surfaceBase, ...goldBorder, ...goldGlow}}>
        <div className="text-sm text-on-surface/70 mb-5 leading-relaxed">
          Save your handles. The "Post" buttons use platform deep-links (Twitter intent URLs, Reddit submit URLs) to open a pre-filled composer in a new tab. No OAuth, no stored tokens, zero risk.
        </div>
        {fields.map(function(f){
          return (
            <div key={f.label} className="mb-4">
              <div className="text-[10px] uppercase font-bold tracking-widest mb-1.5" style={{color:f.color, fontFamily:'Barlow Condensed'}}>{f.label}</div>
              <input value={f.value} onChange={function(e){f.setter(e.target.value)}} placeholder={f.placeholder}
                className="w-full rounded-md p-3 text-sm text-on-surface"
                style={{background:'rgba(11,18,32,0.6)', border:'1px solid '+f.color+'30', outline:'none'}}/>
            </div>
          )
        })}
        <button onClick={save}
          className="w-full mt-2 py-3 rounded-lg font-bold text-sm"
          style={{
            background:'linear-gradient(135deg, #E8A838, #B8860B)',
            color:'#0B1220', border:'none',
            boxShadow:'0 0 20px rgba(232,168,56,0.3)',
            textTransform:'uppercase', letterSpacing:'0.15em', fontFamily:'Barlow Condensed', cursor:'pointer',
          }}>Save Handles</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════ MAIN SCREEN ═══════════════════════════════

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
    var r = await supabase.from('content_posts').select('*').order('created_at', {ascending:false}).limit(200)
    setPosts(r.data || [])
  }, [currentUser])

  var loadSocial = useCallback(async function(){
    if (!currentUser) return
    var r = await supabase.from('social_connections').select('*').eq('owner_id', currentUser.auth_user_id).maybeSingle()
    setSocial(r.data || null)
  }, [currentUser])

  useEffect(function(){ loadPosts(); loadSocial() }, [loadPosts, loadSocial])

  // Streak calculation: consecutive days with at least 1 post
  var streak = useMemo(function(){
    if (!posts.length) return 0
    var dates = {}
    posts.forEach(function(p){
      var d = new Date(p.created_at).toISOString().slice(0,10)
      dates[d] = true
    })
    var s = 0
    var cur = new Date()
    for (var i=0; i<60; i++) {
      var k = cur.toISOString().slice(0,10)
      if (dates[k]) s++
      else if (s > 0) break
      cur.setDate(cur.getDate() - 1)
    }
    return s
  }, [posts])

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
  var posted = posts.filter(function(p){return p.status==='posted'}).length

  return (
    <PageLayout>
      <div className="page wrap max-w-7xl mx-auto px-4 py-6">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold" style={{fontFamily:'Playfair Display, serif', color:'#F5F2EA', letterSpacing:'-0.01em'}}>
              Content Engine
            </h1>
            <div className="text-[11px] uppercase tracking-widest mt-1" style={{color:'#E8A838', fontFamily:'Barlow Condensed', letterSpacing:'0.15em'}}>
              AI SOCIAL COMMAND CENTER / POWERED BY GEMINI
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <StatPill icon="edit_note"    label="Drafts"    value={drafts}/>
            <StatPill icon="schedule"     label="Scheduled" value={scheduled}/>
            <StatPill icon="send"         label="Posted"    value={posted}/>
            <StatPill icon="local_fire_department" label="Streak" value={streak + (streak > 0 ? 'd' : '')}/>
          </div>
        </div>

        {/* TABS */}
        <PillTabGroup align="start" className="mb-6">
          {TABS.map(function(t){
            return (
              <PillTab
                key={t.id}
                icon={t.icon}
                active={tab === t.id}
                onClick={function(){setTab(t.id)}}
              >
                {t.label}
              </PillTab>
            )
          })}
        </PillTabGroup>

        {tab === 'generate' && <GenerateTab currentUser={currentUser} toast={toast} social={social} refreshLibrary={loadPosts}/>}
        {tab === 'campaign' && <CampaignTab currentUser={currentUser} toast={toast} refreshLibrary={loadPosts}/>}
        {tab === 'ideas'    && <IdeasTab toast={toast}/>}
        {tab === 'library'  && <LibraryTab posts={posts} refresh={loadPosts} toast={toast} social={social}/>}
        {tab === 'trends'   && <TrendsTab toast={toast}/>}
        {tab === 'socials'  && <SocialsTab currentUser={currentUser} social={social} refresh={loadSocial} toast={toast}/>}
      </div>
    </PageLayout>
  )
}

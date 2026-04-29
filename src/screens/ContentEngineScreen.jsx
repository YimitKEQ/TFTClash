import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import { Icon, Btn, Panel, PillTab, PillTabGroup } from '../components/ui'

var TCS_PIN = '133199'
var TCS_SESSION_KEY = 'tcs_unlocked'

var SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
var SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

var PLATFORMS = [
  { id: 'twitter',   name: 'X / Twitter',  color: '#1DA1F2', icon: 'tag',           glow: 'rgba(29,161,242,0.35)' },
  { id: 'reddit',    name: 'Reddit',       color: '#FF4500', icon: 'forum',         glow: 'rgba(255,69,0,0.35)' },
  { id: 'tiktok',    name: 'TikTok',       color: '#FF0050', icon: 'music_video',   glow: 'rgba(255,0,80,0.35)' },
  { id: 'ytshorts',  name: 'YT Shorts',    color: '#FF0000', icon: 'play_circle',   glow: 'rgba(255,0,0,0.35)' },
  { id: 'instagram', name: 'Instagram',    color: '#E1306C', icon: 'photo_camera',  glow: 'rgba(225,48,108,0.35)' },
  { id: 'threads',   name: 'Threads',      color: '#E5E7EB', icon: 'chat',          glow: 'rgba(229,231,235,0.25)' },
  { id: 'bluesky',   name: 'Bluesky',      color: '#0085FF', icon: 'cloud',         glow: 'rgba(0,133,255,0.35)' },
  { id: 'linkedin',  name: 'LinkedIn',     color: '#0A66C2', icon: 'work',          glow: 'rgba(10,102,194,0.35)' },
  { id: 'medium',    name: 'Medium',       color: '#00AB6C', icon: 'article',       glow: 'rgba(0,171,108,0.35)' },
]

// Platforms we adapt to from a primary post (skip long-form Medium and LinkedIn unless explicit)
var ADAPT_TARGETS = ['twitter','reddit','tiktok','ytshorts','instagram','threads','bluesky']

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
  tiktok: [
    { id: 'pov_clutch',     label: 'POV Clutch Moment',  icon: 'visibility' },
    { id: 'tier_list_short',label: 'Tier List Short',    icon: 'format_list_numbered' },
    { id: 'augment_take',   label: 'Augment Hot Take',   icon: 'auto_awesome' },
    { id: 'mistake_callout',label: '3 Mistakes',         icon: 'warning' },
    { id: 'comp_quickhit',  label: 'Comp Quick-Hit',     icon: 'bolt' },
    { id: 'patch_reaction', label: 'Patch Reaction',     icon: 'mood' },
    { id: 'clash_clip',     label: 'Clash Clip Promo',   icon: 'emoji_events' },
  ],
  ytshorts: [
    { id: 'tutorial_short', label: 'Tutorial Short',     icon: 'school' },
    { id: 'tier_list_short',label: 'Tier List Short',    icon: 'format_list_numbered' },
    { id: 'patch_recap',    label: 'Patch Recap',        icon: 'summarize' },
    { id: 'mistake_callout',label: '3 Mistakes',         icon: 'warning' },
    { id: 'lobby_breakdown',label: 'Lobby Breakdown',    icon: 'analytics' },
    { id: 'set17_preview',  label: 'Set 17 Preview',     icon: 'rocket_launch' },
  ],
  threads: [
    { id: 'dev_log_thread', label: 'Dev Log Thread',     icon: 'code' },
    { id: 'hot_take',       label: 'Hot Take',           icon: 'local_fire_department' },
    { id: 'community',      label: 'Community Prompt',   icon: 'forum' },
    { id: 'tournament_recap',label:'Tournament Recap',   icon: 'emoji_events' },
    { id: 'meta_note',      label: 'Meta Note',          icon: 'flash_on' },
  ],
  bluesky: [
    { id: 'sharp_take',     label: 'Sharp Take',         icon: 'cloud' },
    { id: 'patch_reaction', label: 'Patch Reaction',     icon: 'bolt' },
    { id: 'transparency',   label: 'Transparency Post',  icon: 'visibility' },
    { id: 'hot_take',       label: 'Hot Take',           icon: 'local_fire_department' },
    { id: 'community',      label: 'Community Prompt',   icon: 'forum' },
  ],
  linkedin: [
    { id: 'case_study',     label: 'Tournament Case Study', icon: 'business' },
    { id: 'build_in_public',label: 'Build in Public',    icon: 'construction' },
    { id: 'esports_take',   label: 'Esports Take',       icon: 'workspace_premium' },
    { id: 'community_post', label: 'Community Building', icon: 'group' },
    { id: 'lessons_learned',label: 'Lessons Learned',    icon: 'lightbulb' },
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
  { id: 'daily',    label: 'Daily Drop', icon: 'today' },
  { id: 'inbox',    label: 'Idea Inbox', icon: 'inbox' },
  { id: 'generate', label: 'Generate',   icon: 'bolt' },
  { id: 'campaign', label: 'Campaign',   icon: 'rocket_launch' },
  { id: 'ideas',    label: 'Brainstorm', icon: 'lightbulb' },
  { id: 'library',  label: 'Library',    icon: 'inventory_2' },
  { id: 'trends',   label: 'Trends',     icon: 'trending_up' },
  { id: 'socials',  label: 'Socials',    icon: 'link' },
]

// Day-of-week themes shipped in the niche playbook (see edge fn NICHE_PLAYBOOK).
// Index 0 = Sunday to match Date#getDay().
var DAY_THEMES = [
  { key: 'sun', name: 'Q&A / Community',     icon: 'forum',                hint: 'Open prompt, AMA, leaderboard spotlight, community love.' },
  { key: 'mon', name: 'Meta Watch',          icon: 'flash_on',             hint: 'What shifted, what is S-tier, what to play this week.' },
  { key: 'tue', name: 'Tutorial Tuesday',    icon: 'school',               hint: 'One fundamental: positioning, econ, scout reads, items.' },
  { key: 'wed', name: 'Dev Log',             icon: 'code',                 hint: 'Build in public, what shipped on TFT Clash this week.' },
  { key: 'thu', name: 'Hot Take Thursday',   icon: 'local_fire_department',hint: 'One bold opinion. Engagement bait. Make them argue.' },
  { key: 'fri', name: 'Featured Comp',       icon: 'star',                 hint: 'Deep dive: items, augments, openers, transitions, late game.' },
  { key: 'sat', name: 'Tournament Recap',    icon: 'emoji_events',         hint: 'Final tables, big plays, story of the bracket.' },
]

function todayKey() {
  var d = new Date()
  return d.toISOString().slice(0,10)
}

function dayTheme(date) {
  var idx = (date || new Date()).getDay()
  return DAY_THEMES[idx]
}

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
  if (platform === 'threads')   return 'https://www.threads.net/'
  if (platform === 'bluesky')   return 'https://bsky.app/'
  if (platform === 'linkedin')  return 'https://www.linkedin.com/feed/?shareActive=true'
  if (platform === 'tiktok')    return 'https://www.tiktok.com/upload'
  if (platform === 'ytshorts')  return 'https://www.youtube.com/upload'
  if (platform === 'medium')    return 'https://medium.com/new-story'
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
// /ops design language: surface-container-low background, faint outline-variant border, no gradients/glow.
// CSS vars from index.css: --md-surface-container-low, --md-outline-variant.

var surfaceBase = { background: '#1b1b23' } // bg-surface-container-low
var goldBorder = { border: '1px solid rgba(80, 69, 53, 0.25)' } // outline-variant/25
var goldGlow = {} // /ops aesthetic has no glow; kept as no-op for diff minimisation

function SectionLabel(props) {
  return (
    <div className="font-label text-[10px] uppercase font-bold tracking-widest mb-2 text-on-surface/50">
      {props.children}
    </div>
  )
}

function GoldChip(props) {
  var active = props.active
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      className={'px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-colors border ' + (
        active
          ? 'bg-primary text-on-primary border-primary'
          : 'bg-surface-container hover:bg-surface-container-high text-on-surface/70 hover:text-on-surface border-outline-variant/15'
      )}
    >
      {props.children}
    </button>
  )
}

function StatPill(props) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded bg-surface-container-low border border-outline-variant/10">
      <Icon name={props.icon} size={14} className="text-primary" />
      <div>
        <div className="font-label text-[9px] uppercase tracking-widest text-on-surface/40 leading-none">{props.label}</div>
        <div className="font-mono text-sm font-bold text-on-surface leading-tight mt-0.5">{props.value}</div>
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
    var targets = PLATFORMS.filter(function(p){return p.id !== platform && ADAPT_TARGETS.indexOf(p.id) >= 0})
    setLoading(true)
    setLoadingMsg('Adapting to ' + targets.length + ' platforms...')
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
                  <span className="text-sm font-bold" style={{fontFamily:'Subtle, system-ui, sans-serif', letterSpacing:'0.05em'}}>{p.name.toUpperCase()}</span>
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
                  <span className="font-semibold" style={{fontFamily:'Subtle, system-ui, sans-serif'}}>{t.label.toUpperCase()}</span>
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
            <span style={{fontFamily:'Subtle, system-ui, sans-serif', letterSpacing:'0.03em'}}>INJECT LIVE TFT TRENDS</span>
          </label>
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-widest text-on-surface/50" style={{fontFamily:'Subtle, system-ui, sans-serif'}}>Variations</span>
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
              fontFamily: 'Subtle, system-ui, sans-serif',
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
              <div className="text-lg font-bold text-on-surface/80 mb-2" style={{fontFamily:'Subtle, system-ui, sans-serif'}}>Ready to cook</div>
              <div className="text-xs text-on-surface/40 max-w-sm" style={{fontFamily:'Subtle, system-ui, sans-serif'}}>
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
              <div className="text-sm text-on-surface/80 font-bold" style={{fontFamily:'Subtle, system-ui, sans-serif', letterSpacing:'0.1em'}}>{(loadingMsg || 'COOKING').toUpperCase()}</div>
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
                    fontFamily: 'Subtle, system-ui, sans-serif',
                    letterSpacing: '0.05em'
                  }}>
                    {charCount} CHARS {twitterOver && '\u26a0 OVER 280 LIMIT'}
                  </div>
                  {usedTrends && usedTrends.posts && usedTrends.posts.length > 0 && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                      style={{background:'rgba(0,171,108,0.15)', color:'#00AB6C', border:'1px solid rgba(0,171,108,0.3)'}}>
                      <Icon name="trending_up" size={10}/>
                      <span style={{fontFamily:'Subtle, system-ui, sans-serif'}}>TRENDS INJECTED</span>
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
                    fontFamily: 'Subtle, system-ui, sans-serif',
                    letterSpacing: '0.08em',
                    border: 'none',
                    boxShadow: '0 0 14px ' + platformObj.glow,
                  }}>
                  <Icon name="send" size={14}/>POST TO {platformObj.name.toUpperCase()}
                </button>
              </div>

              {/* REMIX BAR */}
              <div className="pt-3" style={{borderTop:'1px dashed rgba(232,168,56,0.2)'}}>
                <div className="text-[10px] uppercase tracking-widest text-on-surface/50 mb-2" style={{fontFamily:'Subtle, system-ui, sans-serif'}}>Quick Remix</div>
                <div className="flex gap-1.5 flex-wrap">
                  {REMIX_ACTIONS.map(function(a){
                    return (
                      <button key={a.id} onClick={function(){remix(a.id)}}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={{
                          background: 'rgba(232,168,56,0.06)',
                          border: '1px solid rgba(232,168,56,0.2)',
                          color: '#E8A838',
                          fontFamily: 'Subtle, system-ui, sans-serif',
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
            <div className="text-[10px] text-on-surface/40 mt-2" style={{fontFamily:'Subtle, system-ui, sans-serif'}}>
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
              fontFamily: 'Subtle, system-ui, sans-serif',
              border: 'none',
              cursor: loading ? 'wait' : 'pointer',
            }}>
            {loading ? (progress || 'Running...') : '\ud83d\ude80 Launch Campaign'}
          </button>
          <div className="text-[11px] text-on-surface/50" style={{fontFamily:'Subtle, system-ui, sans-serif'}}>
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
              <div className="mt-3 text-xs" style={{fontFamily:'Subtle, system-ui, sans-serif', letterSpacing:'0.1em'}}>SET A THEME. LAUNCH. WATCH IT COOK.</div>
            </div>
          )}
          <div className="space-y-3">
            {generated.map(function(g, i){
              var p = PLATFORMS.find(function(x){return x.id===g.platform})
              var stableKey = (g.platform || 'p') + '-' + (g.type || 't') + '-' + i
              return (
                <div key={stableKey} className="rounded-lg p-3"
                  style={{background:'rgba(11,18,32,0.6)', border:'1px solid rgba(255,255,255,0.06)', borderLeft:'3px solid '+p.color}}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                      style={{background:p.color+'20', color:p.color, fontFamily:'Subtle, system-ui, sans-serif'}}>{p.name.toUpperCase()}</span>
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
              textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:'Subtle, system-ui, sans-serif', border:'none',
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
        {['all','favorites','draft','scheduled','posted','archived','twitter','reddit','tiktok','ytshorts','instagram','threads','bluesky','linkedin','medium'].map(function(f){
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
                    style={{background:plat.color+'20', color:plat.color, fontFamily:'Subtle, system-ui, sans-serif'}}>
                    <Icon name={plat.icon} size={10}/>{plat.name.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-on-surface/50" style={{fontFamily:'Subtle, system-ui, sans-serif'}}>{p.content_type.toUpperCase()} / {p.tone.toUpperCase()}</span>
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
                  style={{background:'linear-gradient(135deg,'+plat.color+','+plat.color+'aa)', color:'#fff', border:'none', fontFamily:'Subtle, system-ui, sans-serif'}}>
                  <Icon name="send" size={11}/>POST
                </button>
                <Btn onClick={function(){markPosted(p)}}><Icon name="check" size={12}/></Btn>
                <Btn onClick={function(){archive(p)}}><Icon name="archive" size={12}/></Btn>
                <Btn onClick={function(){del(p)}}><Icon name="delete" size={12}/></Btn>
              </div>
              <div className="text-[10px] text-on-surface/40 mt-2" style={{fontFamily:'Subtle, system-ui, sans-serif'}}>{new Date(p.created_at).toLocaleString()}</div>
            </div>
          )
        })}
        {!filtered.length && (
          <div className="text-on-surface/40 text-sm col-span-2 text-center py-10" style={{fontFamily:'Subtle, system-ui, sans-serif', letterSpacing:'0.1em'}}>
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
        <div className="text-sm text-on-surface/60" style={{fontFamily:'Subtle, system-ui, sans-serif', letterSpacing:'0.08em'}}>AI-GENERATED TFT TALKING POINTS (CACHED 2H)</div>
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
            <a key={p.url || i} href={p.url} target="_blank" rel="noopener noreferrer"
              className="block py-3 px-4 border-b border-white/5 hover:bg-white/5 transition-all rounded"
              style={{textDecoration:'none'}}>
              <div className="flex items-start gap-3">
                <div className="text-xs font-bold w-8 flex-shrink-0" style={{color:'#E8A838', fontFamily:'Subtle, system-ui, sans-serif'}}>#{i+1}</div>
                <div className="flex-1">
                  <div className="text-sm text-on-surface leading-snug">{p.title}</div>
                  <div className="text-[10px] text-on-surface/50 mt-1 flex items-center gap-3" style={{fontFamily:'Subtle, system-ui, sans-serif'}}>
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
  var [tiktok, setTiktok] = useState((social && social.tiktok_handle) || '')
  var [ytshorts, setYtshorts] = useState((social && social.ytshorts_handle) || '')
  var [threads, setThreads] = useState((social && social.threads_handle) || '')
  var [bluesky, setBluesky] = useState((social && social.bluesky_handle) || '')
  var [linkedin, setLinkedin] = useState((social && social.linkedin_handle) || '')

  useEffect(function(){
    if (social) {
      setTwitter(social.twitter_handle || '')
      setReddit(social.reddit_username || '')
      setSub(social.reddit_default_sub || 'CompetitiveTFT')
      setMedium(social.medium_handle || '')
      setIg(social.instagram_handle || '')
      setTiktok(social.tiktok_handle || '')
      setYtshorts(social.ytshorts_handle || '')
      setThreads(social.threads_handle || '')
      setBluesky(social.bluesky_handle || '')
      setLinkedin(social.linkedin_handle || '')
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
      tiktok_handle: tiktok,
      ytshorts_handle: ytshorts,
      threads_handle: threads,
      bluesky_handle: bluesky,
      linkedin_handle: linkedin,
      updated_at: new Date().toISOString(),
    }
    var r = await supabase.from('social_connections').upsert(row, {onConflict:'owner_id'})
    if (r.error) { toast(r.error.message,'error'); return }
    toast('Saved','success')
    refresh()
  }

  var fields = [
    { label:'X / Twitter handle', value:twitter,  setter:setTwitter,  placeholder:'@tftclash', color:'#1DA1F2' },
    { label:'Reddit username',    value:reddit,   setter:setReddit,   placeholder:'u/tftclash', color:'#FF4500' },
    { label:'Default subreddit',  value:sub,      setter:setSub,      placeholder:'CompetitiveTFT', color:'#FF4500' },
    { label:'TikTok handle',      value:tiktok,   setter:setTiktok,   placeholder:'@tftclash', color:'#FF0050' },
    { label:'YouTube handle',     value:ytshorts, setter:setYtshorts, placeholder:'@tftclash', color:'#FF0000' },
    { label:'Instagram handle',   value:ig,       setter:setIg,       placeholder:'@tftclash', color:'#E1306C' },
    { label:'Threads handle',     value:threads,  setter:setThreads,  placeholder:'@tftclash', color:'#E5E7EB' },
    { label:'Bluesky handle',     value:bluesky,  setter:setBluesky,  placeholder:'tftclash.bsky.social', color:'#0085FF' },
    { label:'LinkedIn handle',    value:linkedin, setter:setLinkedin, placeholder:'company/tft-clash', color:'#0A66C2' },
    { label:'Medium handle',      value:medium,   setter:setMedium,   placeholder:'@tftclash', color:'#00AB6C' },
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
              <div className="text-[10px] uppercase font-bold tracking-widest mb-1.5" style={{color:f.color, fontFamily:'Subtle, system-ui, sans-serif'}}>{f.label}</div>
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
            textTransform:'uppercase', letterSpacing:'0.15em', fontFamily:'Subtle, system-ui, sans-serif', cursor:'pointer',
          }}>Save Handles</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════ DAILY DROP TAB ═══════════════════════════════

function DailyDropTab(props) {
  var currentUser = props.currentUser
  var toast = props.toast
  var social = props.social
  var refreshLibrary = props.refreshLibrary
  var streak = props.streak
  var posts = props.posts || []

  var today = useMemo(function(){ return new Date() }, [])
  var theme = useMemo(function(){ return dayTheme(today) }, [today])
  var todayStr = useMemo(function(){
    return today.toLocaleDateString(undefined, { weekday:'long', month:'short', day:'numeric' })
  }, [today])

  var [topic, setTopic] = useState('')
  var [tone, setTone] = useState('casual')
  var [primary, setPrimary] = useState('')
  var [primaryRow, setPrimaryRow] = useState(null)
  var [variants, setVariants] = useState({})
  var [loading, setLoading] = useState(false)
  var [loadingMsg, setLoadingMsg] = useState('')
  var [postedMap, setPostedMap] = useState({})

  // Find existing daily-drop posts for today so the streak feels honest
  var todaysDrops = useMemo(function(){
    var key = todayKey()
    return posts.filter(function(p){
      if (!p.tags || !Array.isArray(p.tags)) return false
      if (p.tags.indexOf('daily-drop') < 0) return false
      var d = new Date(p.created_at).toISOString().slice(0,10)
      return d === key
    })
  }, [posts])

  useEffect(function(){
    // hydrate postedMap from posts marked posted today
    var m = {}
    todaysDrops.forEach(function(p){
      if (p.status === 'posted') m[p.platform] = true
    })
    setPostedMap(m)
  }, [todaysDrops])

  var generatePrimary = useCallback(async function(){
    if (!currentUser) { toast('Sign in first', 'error'); return }
    setLoading(true); setLoadingMsg('Cooking today\u0027s X drop...')
    setPrimary(''); setVariants({}); setPrimaryRow(null)
    try {
      var brief = topic.trim() || (theme.name + '. ' + theme.hint)
      var json = await callEdgeFn({
        action:'generate',
        platform:'twitter',
        contentType:'single_tweet',
        tone: tone,
        context: 'DAILY DROP - ' + theme.name + '. ' + (topic.trim() ? 'Operator brief: ' + topic.trim() + '. ' : '') + 'Make it punchy, hook-first, ready to post on X. One tweet, under 280 chars.',
        includeTrends: true,
        variations: 1,
      })
      var content = (json.results && json.results[0]) || ''
      setPrimary(content)
      // save as draft tagged daily-drop so streak + library can find it
      var ins = await supabase.from('content_posts').insert({
        owner_id: currentUser.auth_user_id,
        platform: 'twitter',
        content_type: 'single_tweet',
        tone: tone,
        context: 'Daily Drop - ' + theme.name + (topic ? ' / ' + topic : ''),
        generated_content: content,
        status: 'draft',
        tags: ['daily-drop', theme.key, todayKey()],
        trend_snapshot: json.trends || null,
      }).select('*').single()
      if (ins.data) setPrimaryRow(ins.data)
      if (refreshLibrary) refreshLibrary()
      toast('Daily Drop ready', 'success')
    } catch(e) { toast('Error: ' + e.message, 'error') }
    setLoading(false); setLoadingMsg('')
  }, [currentUser, topic, tone, theme, toast, refreshLibrary])

  var generateVariant = useCallback(async function(targetPlatform){
    if (!primary) { toast('Generate the X drop first', 'error'); return }
    setLoading(true); setLoadingMsg('Adapting to ' + targetPlatform + '...')
    try {
      var firstType = (CONTENT_TYPES[targetPlatform][0] || {}).id
      var ctxText = brief()
      var json = await callEdgeFn({
        action:'generate',
        platform: targetPlatform,
        contentType: firstType,
        tone: tone,
        context: 'DAILY DROP variant for ' + targetPlatform + '. Theme: ' + theme.name + '. Adapt this X post but rewrite to fit ' + targetPlatform + ' perfectly.\n\nSOURCE (X):\n' + primary,
        includeTrends: false,
        variations: 1,
      })
      var content = (json.results && json.results[0]) || ''
      setVariants(function(prev){ var n = Object.assign({}, prev); n[targetPlatform] = content; return n })
      // also save as draft so it shows in library
      await supabase.from('content_posts').insert({
        owner_id: currentUser.auth_user_id,
        platform: targetPlatform,
        content_type: firstType,
        tone: tone,
        context: 'Daily Drop variant - ' + theme.name,
        generated_content: content,
        status: 'draft',
        tags: ['daily-drop', theme.key, todayKey()],
      })
      if (refreshLibrary) refreshLibrary()
      toast('Variant ready: ' + targetPlatform, 'success')
    } catch(e) { toast('Error: ' + e.message, 'error') }
    setLoading(false); setLoadingMsg('')
    function brief(){ return topic.trim() || theme.hint }
  }, [primary, tone, theme, currentUser, topic, toast, refreshLibrary])

  var copyText = function(text){
    if (!text) return
    navigator.clipboard.writeText(text)
    toast('Copied', 'success')
  }

  var togglePosted = useCallback(async function(plat){
    var nextPosted = !postedMap[plat]
    setPostedMap(function(prev){ var n = Object.assign({}, prev); n[plat] = nextPosted; return n })
    // find a daily-drop row for this platform today and flip its status
    var match = todaysDrops.filter(function(p){return p.platform === plat})[0]
    if (match) {
      await supabase.from('content_posts').update({
        status: nextPosted ? 'posted' : 'draft',
        posted_at: nextPosted ? new Date().toISOString() : null,
      }).eq('id', match.id)
      if (refreshLibrary) refreshLibrary()
    }
  }, [postedMap, todaysDrops, refreshLibrary])

  var openComposer = function(plat, content){
    if (!content) return
    window.open(buildComposerUrl(plat, content, social), '_blank', 'noopener,noreferrer')
  }

  var siblingPlatforms = PLATFORMS.filter(function(p){return p.id !== 'twitter'})

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* LEFT: today header + brief */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        <div className="rounded-xl p-5" style={{...surfaceBase, ...goldBorder, ...goldGlow}}>
          <div className="text-[10px] uppercase tracking-[0.2em] text-on-surface/50 mb-1" style={{fontFamily:'Subtle, system-ui, sans-serif'}}>TODAY</div>
          <div className="text-xl font-bold text-on-surface" style={{fontFamily:'Subtle, system-ui, sans-serif'}}>{todayStr}</div>
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{background:'linear-gradient(135deg, rgba(232,168,56,0.15), rgba(232,168,56,0.04))', border:'1px solid rgba(232,168,56,0.4)'}}>
            <Icon name={theme.icon} size={18} style={{color:'#E8A838'}}/>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-on-surface/60" style={{fontFamily:'Subtle, system-ui, sans-serif'}}>DAY THEME</div>
              <div className="text-sm font-bold" style={{color:'#E8A838', fontFamily:'Subtle, system-ui, sans-serif'}}>{theme.name.toUpperCase()}</div>
            </div>
          </div>
          <div className="text-xs text-on-surface/70 mt-3 leading-relaxed">{theme.hint}</div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold"
              style={{background:'rgba(255,69,0,0.12)', color:'#FF8A4C', border:'1px solid rgba(255,138,76,0.3)', fontFamily:'Subtle, system-ui, sans-serif'}}>
              <Icon name="local_fire_department" size={12}/>
              STREAK {streak}d
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold"
              style={{background:'rgba(125,211,252,0.12)', color:'#7DD3FC', border:'1px solid rgba(125,211,252,0.3)', fontFamily:'Subtle, system-ui, sans-serif'}}>
              <Icon name="check_circle" size={12}/>
              POSTED TODAY {Object.keys(postedMap).filter(function(k){return postedMap[k]}).length}
            </div>
          </div>
        </div>

        <div className="rounded-xl p-5 space-y-3" style={{...surfaceBase, ...goldBorder}}>
          <div>
            <SectionLabel>Today&apos;s Angle (optional)</SectionLabel>
            <textarea value={topic} onChange={function(e){setTopic(e.target.value)}}
              placeholder="Skip to use the day theme, or steer it: e.g. 'Lillia rerolls feel busted on 14.10', 'r/CompetitiveTFT is mad about Aug X'..."
              className="w-full rounded-md p-3 text-sm text-on-surface resize-none"
              style={{background:'rgba(11,18,32,0.6)', border:'1px solid rgba(255,255,255,0.08)', outline:'none'}}
              rows={3}/>
          </div>
          <div>
            <SectionLabel>Tone</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {TONES.slice(0,5).map(function(t){
                return <GoldChip key={t.id} active={tone === t.id} onClick={function(){setTone(t.id)}}><span className="mr-1">{t.emoji}</span>{t.label.toUpperCase()}</GoldChip>
              })}
            </div>
          </div>
          <button onClick={generatePrimary} disabled={loading}
            className="w-full mt-2 py-4 rounded-lg font-bold text-sm"
            style={{
              background: loading ? 'rgba(232,168,56,0.15)' : 'linear-gradient(135deg, #E8A838 0%, #B8860B 100%)',
              color: loading ? '#E8A838' : '#0B1220',
              boxShadow: loading ? 'none' : '0 0 30px rgba(232,168,56,0.4), 0 4px 12px rgba(0,0,0,0.3)',
              textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'Subtle, system-ui, sans-serif',
              fontSize: '15px', border: 'none', cursor: loading ? 'wait' : 'pointer',
            }}>
            {loading ? (loadingMsg || 'Cooking...') : '\u26a1 Generate Today\u0027s Drop'}
          </button>
          <div className="text-[11px] text-on-surface/50" style={{fontFamily:'Subtle, system-ui, sans-serif'}}>
            One ready-to-post X tweet. Variants for every other platform on demand. All saved as drafts.
          </div>
        </div>
      </div>

      {/* RIGHT: primary X drop + sibling variants */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        {/* Primary X tile */}
        <div className="rounded-xl p-5" style={{...surfaceBase, ...goldBorder, borderLeft:'3px solid #1DA1F2', minHeight:'200px'}}>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold"
                style={{background:'rgba(29,161,242,0.18)', color:'#1DA1F2', fontFamily:'Subtle, system-ui, sans-serif'}}>
                <Icon name="tag" size={10}/> X / TWITTER (PRIMARY)
              </span>
              {primary && <span className="text-[10px] text-on-surface/50">{primary.length} CHARS{primary.length>280 && ' \u26a0 OVER 280'}</span>}
            </div>
            {primary && (
              <div className="flex gap-1.5">
                <Btn onClick={function(){copyText(primary)}}><Icon name="content_copy" size={12}/> Copy</Btn>
                <button onClick={function(){openComposer('twitter', primary)}}
                  className="px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1"
                  style={{background:'linear-gradient(135deg,#1DA1F2,#1DA1F2aa)', color:'#fff', border:'none', fontFamily:'Subtle, system-ui, sans-serif'}}>
                  <Icon name="send" size={11}/> POST
                </button>
                <label className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] cursor-pointer"
                  style={{background: postedMap['twitter'] ? 'rgba(125,211,252,0.18)' : 'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', color: postedMap['twitter'] ? '#7DD3FC' : '#BECBD9'}}>
                  <input type="checkbox" checked={!!postedMap['twitter']} onChange={function(){togglePosted('twitter')}} style={{accentColor:'#7DD3FC'}}/>
                  POSTED
                </label>
              </div>
            )}
          </div>
          {!primary && !loading && (
            <div className="text-on-surface/40 text-sm py-10 text-center" style={{fontFamily:'Subtle, system-ui, sans-serif', letterSpacing:'0.08em'}}>
              SMASH GENERATE TO COOK TODAY&apos;S X DROP
            </div>
          )}
          {loading && !primary && (
            <div className="flex items-center justify-center py-10">
              <div className="text-sm text-on-surface/70" style={{fontFamily:'Subtle, system-ui, sans-serif', letterSpacing:'0.1em'}}>{(loadingMsg||'COOKING').toUpperCase()}</div>
            </div>
          )}
          {primary && (
            <pre className="whitespace-pre-wrap rounded-lg p-4 text-sm text-on-surface font-body leading-relaxed"
              style={{background:'rgba(11,18,32,0.7)', border:'1px solid rgba(255,255,255,0.06)'}}>{primary}</pre>
          )}
        </div>

        {/* Sibling platforms grid */}
        {primary && (
          <div className="rounded-xl p-5" style={{...surfaceBase, ...goldBorder}}>
            <SectionLabel>Sibling Platforms (one click adapts + saves)</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {siblingPlatforms.map(function(p){
                var content = variants[p.id] || ''
                var hasContent = !!content
                return (
                  <div key={p.id} className="rounded-lg p-3"
                    style={{background:'rgba(11,18,32,0.5)', border:'1px solid rgba(255,255,255,0.06)', borderLeft:'3px solid '+p.color}}>
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{background:p.color+'20', color:p.color, fontFamily:'Subtle, system-ui, sans-serif'}}>
                        <Icon name={p.icon} size={10}/> {p.name.toUpperCase()}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {!hasContent && (
                          <button onClick={function(){generateVariant(p.id)}} disabled={loading}
                            className="px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1"
                            style={{background:'rgba(232,168,56,0.15)', color:'#E8A838', border:'1px solid rgba(232,168,56,0.4)', fontFamily:'Subtle, system-ui, sans-serif'}}>
                            <Icon name="auto_awesome" size={10}/> ADAPT
                          </button>
                        )}
                        {hasContent && (
                          <>
                            <button onClick={function(){copyText(content)}}
                              className="px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1"
                              style={{background:'rgba(255,255,255,0.04)', color:'#BECBD9', border:'1px solid rgba(255,255,255,0.1)', fontFamily:'Subtle, system-ui, sans-serif'}}>
                              <Icon name="content_copy" size={10}/> COPY
                            </button>
                            <button onClick={function(){openComposer(p.id, content)}}
                              className="px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1"
                              style={{background:'linear-gradient(135deg,'+p.color+','+p.color+'aa)', color:'#fff', border:'none', fontFamily:'Subtle, system-ui, sans-serif'}}>
                              <Icon name="send" size={10}/> POST
                            </button>
                            <label className="flex items-center gap-1 px-2 py-1 rounded text-[10px] cursor-pointer"
                              style={{background: postedMap[p.id] ? 'rgba(125,211,252,0.18)' : 'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', color: postedMap[p.id] ? '#7DD3FC' : '#BECBD9'}}>
                              <input type="checkbox" checked={!!postedMap[p.id]} onChange={function(){togglePosted(p.id)}} style={{accentColor:'#7DD3FC'}}/>
                              DONE
                            </label>
                          </>
                        )}
                      </div>
                    </div>
                    {hasContent ? (
                      <pre className="whitespace-pre-wrap text-xs text-on-surface/80 font-body max-h-40 overflow-auto rounded p-2"
                        style={{background:'rgba(11,18,32,0.7)'}}>{content}</pre>
                    ) : (
                      <div className="text-[11px] text-on-surface/40 py-3" style={{fontFamily:'Subtle, system-ui, sans-serif'}}>
                        Hit ADAPT to rewrite for {p.name}.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════ IDEA INBOX TAB ═══════════════════════════════

function IdeaInboxTab(props) {
  var currentUser = props.currentUser
  var toast = props.toast
  var refreshLibrary = props.refreshLibrary

  var [thought, setThought] = useState('')
  var [tone, setTone] = useState('casual')
  var [targets, setTargets] = useState({ twitter:true, reddit:true, tiktok:true, instagram:true })
  var [loading, setLoading] = useState(false)
  var [loadingMsg, setLoadingMsg] = useState('')
  var [results, setResults] = useState({})

  var toggleTarget = function(id){
    setTargets(function(prev){ var n = Object.assign({}, prev); n[id] = !n[id]; return n })
  }

  var run = useCallback(async function(){
    if (!currentUser) { toast('Sign in first', 'error'); return }
    var t = thought.trim()
    if (!t) { toast('Drop a raw thought first', 'error'); return }
    var picked = Object.keys(targets).filter(function(k){return targets[k]})
    if (!picked.length) { toast('Pick at least one platform', 'error'); return }
    setLoading(true); setResults({})
    try {
      var out = {}
      for (var i=0; i<picked.length; i++) {
        var plat = picked[i]
        setLoadingMsg('Cooking ' + plat + ' (' + (i+1) + '/' + picked.length + ')...')
        var firstType = (CONTENT_TYPES[plat][0] || {}).id
        var json = await callEdgeFn({
          action:'generate',
          platform: plat,
          contentType: firstType,
          tone: tone,
          context: 'IDEA INBOX. Operator dropped this raw thought, you turn it into a ready-to-post ' + plat + ' post.\n\nRAW THOUGHT:\n' + t,
          includeTrends: false,
          variations: 1,
        })
        var content = (json.results && json.results[0]) || ''
        out[plat] = content
        if (content) {
          await supabase.from('content_posts').insert({
            owner_id: currentUser.auth_user_id,
            platform: plat,
            content_type: firstType,
            tone: tone,
            context: 'Idea Inbox: ' + t.slice(0, 80),
            generated_content: content,
            status: 'draft',
            tags: ['idea-inbox'],
          })
        }
        setResults(Object.assign({}, out))
      }
      if (refreshLibrary) refreshLibrary()
      toast('Drafts saved across ' + picked.length + ' platforms', 'success')
    } catch(e) { toast('Error: ' + e.message, 'error') }
    setLoading(false); setLoadingMsg('')
  }, [currentUser, thought, tone, targets, toast, refreshLibrary])

  var copyText = function(text){
    if (!text) return
    navigator.clipboard.writeText(text)
    toast('Copied', 'success')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-5">
        <div className="rounded-xl p-5 space-y-4" style={{...surfaceBase, ...goldBorder, ...goldGlow}}>
          <div>
            <SectionLabel>Drop a Raw Thought</SectionLabel>
            <textarea value={thought} onChange={function(e){setThought(e.target.value)}}
              placeholder={'e.g. "Watched 30 tournament games this weekend, nobody is playing the obvious S-tier comp"\n\nor\n\n"We just shipped regional EU + NA splits, here is why"'}
              className="w-full rounded-md p-3 text-sm text-on-surface resize-none"
              style={{background:'rgba(11,18,32,0.6)', border:'1px solid rgba(255,255,255,0.08)', outline:'none', minHeight:'180px'}}
              rows={8}/>
          </div>
          <div>
            <SectionLabel>Tone</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {TONES.map(function(t){
                return <GoldChip key={t.id} active={tone === t.id} onClick={function(){setTone(t.id)}}><span className="mr-1">{t.emoji}</span>{t.label.toUpperCase()}</GoldChip>
              })}
            </div>
          </div>
          <div>
            <SectionLabel>Cook For</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map(function(p){
                var on = !!targets[p.id]
                return (
                  <button key={p.id} onClick={function(){toggleTarget(p.id)}}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-xs text-left"
                    style={{
                      background: on ? p.color+'18' : 'rgba(255,255,255,0.02)',
                      border:'1px solid '+(on ? p.color+'80' : 'rgba(255,255,255,0.08)'),
                      color: on ? p.color : '#BECBD9',
                      fontFamily:'Subtle, system-ui, sans-serif',
                    }}>
                    <Icon name={p.icon} size={12}/>
                    <span className="font-bold">{p.name.toUpperCase()}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <button onClick={run} disabled={loading}
            className="w-full py-4 rounded-lg font-bold text-sm"
            style={{
              background: loading ? 'rgba(232,168,56,0.15)' : 'linear-gradient(135deg, #E8A838 0%, #B8860B 100%)',
              color: loading ? '#E8A838' : '#0B1220',
              boxShadow: loading ? 'none' : '0 0 30px rgba(232,168,56,0.4)',
              textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'Subtle, system-ui, sans-serif',
              border: 'none', cursor: loading ? 'wait' : 'pointer',
            }}>
            {loading ? (loadingMsg || 'Cooking...') : '\u26a1 Turn It Into Posts'}
          </button>
          <div className="text-[11px] text-on-surface/50" style={{fontFamily:'Subtle, system-ui, sans-serif'}}>
            One paste. One click. Drafts saved to Library across every selected platform.
          </div>
        </div>
      </div>

      <div className="lg:col-span-7">
        <div className="rounded-xl p-5" style={{...surfaceBase, ...goldBorder, minHeight:'520px'}}>
          <SectionLabel>Output</SectionLabel>
          {!Object.keys(results).length && !loading && (
            <div className="text-center py-16 text-on-surface/40">
              <Icon name="inbox" size={40} style={{color:'#E8A838'}}/>
              <div className="mt-3 text-xs" style={{fontFamily:'Subtle, system-ui, sans-serif', letterSpacing:'0.1em'}}>DROP A THOUGHT. PICK PLATFORMS. WATCH IT COOK.</div>
            </div>
          )}
          <div className="space-y-3">
            {Object.keys(results).map(function(plat){
              var p = PLATFORMS.find(function(x){return x.id===plat}) || {color:'#E8A838', name:plat, icon:'help'}
              var content = results[plat]
              return (
                <div key={plat} className="rounded-lg p-3"
                  style={{background:'rgba(11,18,32,0.6)', border:'1px solid rgba(255,255,255,0.06)', borderLeft:'3px solid '+p.color}}>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold"
                      style={{background:p.color+'20', color:p.color, fontFamily:'Subtle, system-ui, sans-serif'}}>
                      <Icon name={p.icon} size={10}/> {p.name.toUpperCase()}
                    </span>
                    <div className="flex gap-1.5">
                      <Btn onClick={function(){copyText(content)}}><Icon name="content_copy" size={11}/> Copy</Btn>
                      <button onClick={function(){window.open(buildComposerUrl(plat, content, null), '_blank', 'noopener,noreferrer')}}
                        className="px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1"
                        style={{background:'linear-gradient(135deg,'+p.color+','+p.color+'aa)', color:'#fff', border:'none', fontFamily:'Subtle, system-ui, sans-serif'}}>
                        <Icon name="send" size={11}/> POST
                      </button>
                    </div>
                  </div>
                  <pre className="whitespace-pre-wrap text-xs text-on-surface/80 font-body max-h-48 overflow-auto rounded p-2"
                    style={{background:'rgba(11,18,32,0.7)'}}>{content}</pre>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════ PIN GATE ═══════════════════════════════════

function PinGate(props){
  var [input, setInput] = useState('')
  var [error, setError] = useState(false)
  var [shake, setShake] = useState(false)
  var bufferRef = useRef('')
  var lockedRef = useRef(false)
  var pin = props.pin
  var sessionKey = props.sessionKey

  function tryUnlock(next){
    if (next.length !== pin.length) return
    lockedRef.current = true
    if (next === pin) {
      try { localStorage.setItem(sessionKey, '1') } catch(e) {}
      setTimeout(function(){ props.onUnlock() }, 150)
    } else {
      setError(true); setShake(true)
      setTimeout(function(){
        setShake(false); setInput(''); setError(false)
        bufferRef.current = ''; lockedRef.current = false
      }, 700)
    }
  }

  function handlePress(k){
    if (lockedRef.current) return
    if (bufferRef.current.length >= pin.length) return
    var next = bufferRef.current + k
    bufferRef.current = next; setInput(next); setError(false)
    tryUnlock(next)
  }

  function handleBackspace(){
    if (lockedRef.current) return
    bufferRef.current = bufferRef.current.slice(0, -1)
    setInput(bufferRef.current); setError(false)
  }

  useEffect(function(){
    function onKey(e){
      if (e.key >= '0' && e.key <= '9') handlePress(e.key)
      else if (e.key === 'Backspace') handleBackspace()
    }
    window.addEventListener('keydown', onKey)
    return function(){ window.removeEventListener('keydown', onKey) }
  }, [])

  var keys = ['1','2','3','4','5','6','7','8','9','','0','back']
  var dots = []
  for (var i = 0; i < pin.length; i++) dots.push(i)
  var label = props.label || 'Operator access'
  var brand = props.brand || 'PRIVATE'

  return (
    <PageLayout>
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
        <div className={'w-full max-w-sm bg-surface-container-low border border-outline-variant/15 rounded p-6 sm:p-8 flex flex-col items-center gap-5 ' + (shake ? 'animate-[pin-wiggle_0.5s]' : '')}>
          <div className="flex flex-col items-center gap-2">
            <Icon name="lock" size={28} className="text-primary" />
            <div className="font-label text-[10px] uppercase tracking-widest font-bold text-on-surface/40">
              {brand}
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
              {label}
            </h1>
          </div>

          <div className="flex gap-2">
            {dots.map(function(idx){
              var filled = input.length > idx
              var stateClass = error
                ? 'border-error/60 text-error'
                : filled
                  ? 'border-primary/60 text-primary'
                  : 'border-outline-variant/20 text-on-surface/30'
              return (
                <div
                  key={idx}
                  className={'w-10 h-12 rounded bg-surface-container border flex items-center justify-center text-lg font-mono font-bold ' + stateClass}
                >
                  {filled ? '\u2022' : ''}
                </div>
              )
            })}
          </div>

          {error ? (
            <p className="text-error text-xs font-label uppercase tracking-wider">Wrong PIN</p>
          ) : (
            <p className="text-on-surface/40 text-[11px] font-label uppercase tracking-wider">Enter {pin.length}-digit PIN</p>
          )}

          <div className="grid grid-cols-3 gap-2 w-full max-w-[260px]">
            {keys.map(function(k, i){
              if (k === '') return <div key={'empty-' + i} />
              if (k === 'back') {
                return (
                  <button
                    key="back"
                    type="button"
                    onClick={handleBackspace}
                    className="h-12 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/15 text-on-surface/70 flex items-center justify-center transition-colors"
                  >
                    <Icon name="backspace" size={18} />
                  </button>
                )
              }
              return (
                <button
                  key={k}
                  type="button"
                  onClick={function(){ handlePress(k) }}
                  className="h-12 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant/15 text-on-surface font-mono text-base font-bold transition-colors"
                >
                  {k}
                </button>
              )
            })}
          </div>
        </div>
        <style>{'@keyframes pin-wiggle { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }'}</style>
      </div>
    </PageLayout>
  )
}

// ═══════════════════════════════ MAIN SCREEN ═══════════════════════════════

export default function ContentEngineScreen(){
  var [unlocked, setUnlocked] = useState(function(){
    try { return localStorage.getItem(TCS_SESSION_KEY) === '1' } catch(e) { return false }
  })
  if (!unlocked) {
    return (
      <PinGate
        pin={TCS_PIN}
        sessionKey={TCS_SESSION_KEY}
        label="TFT Clash Studio"
        brand="OPERATOR ACCESS"
        onUnlock={function(){ setUnlocked(true) }}
      />
    )
  }
  return <ContentEngineScreenInner onLock={function(){
    try { localStorage.removeItem(TCS_SESSION_KEY) } catch(e) {}
    setUnlocked(false)
  }} />
}

function ContentEngineScreenInner(props){
  var navigate = useNavigate()
  var ctx = useApp()
  var currentUser = ctx.currentUser
  var toast = ctx.toast
  var isAdmin = ctx.isAdmin

  var [tab, setTab] = useState('daily')
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
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <Icon name="lock" size={40} className="block mx-auto mb-3 text-on-surface/40" />
          <div className="font-display text-sm font-bold text-on-surface/60">Studio requires admin access</div>
        </div>
      </PageLayout>
    )
  }

  var drafts = posts.filter(function(p){return p.status==='draft'}).length
  var scheduled = posts.filter(function(p){return p.status==='scheduled'}).length
  var posted = posts.filter(function(p){return p.status==='posted'}).length

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {/* OPS-STYLE HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Icon name="rocket_launch" size={32} className="text-primary" />
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-success animate-pulse border-2 border-[#13131A]" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-on-surface tracking-tight">TFT Clash Studio</h1>
              <div className="font-label text-[10px] text-on-surface/30 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span>AI social command center / Powered by Gemini</span>
                <button
                  type="button"
                  onClick={function(){ navigate('/tfttech') }}
                  className="text-on-surface/30 hover:text-primary transition-colors"
                >
                  / Back to TFTTech
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatPill icon="edit_note" label="Drafts" value={drafts}/>
            <StatPill icon="schedule" label="Scheduled" value={scheduled}/>
            <StatPill icon="send" label="Posted" value={posted}/>
            <StatPill icon="local_fire_department" label="Streak" value={streak + (streak > 0 ? 'd' : '')}/>
            <button
              type="button"
              onClick={props.onLock}
              title="Lock studio"
              className="flex items-center gap-1.5 px-3 py-2 rounded font-label text-[10px] uppercase tracking-widest font-bold bg-surface-container hover:bg-surface-container-high border border-outline-variant/10 text-on-surface/60 hover:text-on-surface transition-colors"
            >
              <Icon name="lock" size={12} />
              Lock
            </button>
          </div>
        </div>

        {/* TABS */}
        <PillTabGroup align="start">
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

        {tab === 'daily'    && <DailyDropTab currentUser={currentUser} toast={toast} social={social} refreshLibrary={loadPosts} streak={streak} posts={posts}/>}
        {tab === 'inbox'    && <IdeaInboxTab currentUser={currentUser} toast={toast} refreshLibrary={loadPosts}/>}
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

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Btn, Inp, Icon, Tag, Divider, PillTab } from '../components/ui'
import { Sel, Bar, StatusPill, ACCENT_COLORS, WIZ_STEPS } from './host-dashboard/HostComponents'
import { RoundControl } from './host-dashboard/CommandCenter'
import { readTemplates, saveTemplate, deleteTemplate } from '../lib/tournamentTemplates.js'

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function CopyableSnippet(props) {
  var label = props.label
  var value = props.value
  var hint = props.hint
  var toast = props.toast
  var _copied = useState(false)
  var copied = _copied[0]
  var setCopied = _copied[1]

  function copy() {
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value)
        setCopied(true)
        toast && toast('Copied', 'success')
        setTimeout(function() { setCopied(false) }, 1500)
      } else {
        toast && toast('Copy not supported in this browser', 'error')
      }
    } catch (e) {
      toast && toast('Copy failed', 'error')
    }
  }

  return (
    <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h4 className="font-editorial text-base text-on-surface">{label}</h4>
        <button
          type="button"
          onClick={copy}
          className="text-[10px] font-label uppercase tracking-widest text-primary hover:text-primary/80 flex items-center gap-1"
        >
          <Icon name={copied ? 'check' : 'content_copy'} size={14} />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {hint && <p className="text-xs text-on-surface-variant mb-2">{hint}</p>}
      <pre className="bg-black/30 border border-outline-variant/10 rounded px-3 py-2 text-xs text-on-surface font-mono overflow-x-auto whitespace-pre-wrap break-all">
        {value}
      </pre>
    </div>
  )
}

function EmbedTab(props) {
  var brandName = props.brandName || ''
  var toast = props.toast
  var _slug = useState(function() { return slugify(brandName) })
  var slug = _slug[0]
  var setSlug = _slug[1]
  var _theme = useState('dark')
  var theme = _theme[0]
  var setTheme = _theme[1]

  useEffect(function() { setSlug(slugify(brandName)) }, [brandName])

  var origin = 'https://tftclash.com'
  var hostQuery = slug ? '?host=' + encodeURIComponent(slug) : ''
  var widgetUrl = origin + '/api/widget' + (hostQuery || '?') + (hostQuery ? '&' : '') + 'theme=' + theme
  var calendarUrl = origin + '/api/calendar' + hostQuery
  var tournamentsJson = origin + '/api/public-tournaments?status=upcoming' + (slug ? '' : '')
  var leaderboardJson = origin + '/api/public-players?limit=100'

  var markdown = '![TFT Clash next event](' + widgetUrl + ')\n[tftclash.com' + (slug ? '/?host=' + slug : '') + '](' + origin + ')'
  var htmlEmbed = '<a href="' + origin + '"><img src="' + widgetUrl + '" alt="Next TFT Clash event" width="480" height="160"/></a>'
  var iframeEmbed = '<iframe src="' + widgetUrl + '" width="480" height="160" frameborder="0" style="border:0"></iframe>'

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 border-b border-outline-variant/10 pb-4">
        <h2 className="font-editorial text-2xl text-on-background flex-1">Embed Code</h2>
      </div>
      <p className="text-on-surface-variant text-sm">
        Drop these snippets into Discord, your sponsor decks, your stream overlay, or your homepage. The widget auto-updates from your scheduled events.
      </p>

      <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-label uppercase tracking-widest text-on-surface-variant/50 mb-1">Host slug</label>
            <input
              type="text"
              value={slug}
              onChange={function(e) { setSlug(slugify(e.target.value)) }}
              placeholder="my-org"
              className="w-full bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/40"
            />
            <p className="text-[10px] text-on-surface-variant/50 mt-1">Leave empty for platform-wide next event.</p>
          </div>
          <div>
            <label className="block text-[10px] font-label uppercase tracking-widest text-on-surface-variant/50 mb-1">Theme</label>
            <select
              value={theme}
              onChange={function(e) { setTheme(e.target.value) }}
              className="w-full bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/40"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>

        <div className="pt-2 border-t border-outline-variant/10">
          <div className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant/50 mb-2">Live preview</div>
          <img src={widgetUrl} alt="Widget preview" className="rounded border border-outline-variant/15 max-w-full" />
        </div>
      </div>

      <CopyableSnippet
        label="Discord / Markdown"
        hint="Paste in Discord, GitHub README, or any markdown channel."
        value={markdown}
        toast={toast}
      />

      <CopyableSnippet
        label="HTML embed"
        hint="Paste into a sponsor page, blog, or homepage."
        value={htmlEmbed}
        toast={toast}
      />

      <CopyableSnippet
        label="iframe embed"
        hint="Use when image embeds aren't allowed."
        value={iframeEmbed}
        toast={toast}
      />

      <CopyableSnippet
        label="iCal calendar URL"
        hint="Subscribers get every event you publish auto-synced. Works with Google, Apple, Outlook."
        value={calendarUrl}
        toast={toast}
      />

      <CopyableSnippet
        label="Public tournaments JSON"
        hint="For Discord bots or third-party integrations."
        value={tournamentsJson}
        toast={toast}
      />

      <CopyableSnippet
        label="Public leaderboard JSON"
        hint="Top 100 players + region filter via &region=EU"
        value={leaderboardJson}
        toast={toast}
      />
    </div>
  )
}

function TemplatesTab(props) {
  var toast = props.toast
  var _list = useState(function() { return readTemplates() })
  var list = _list[0]
  var setList = _list[1]
  var _showForm = useState(false)
  var showForm = _showForm[0]
  var setShowForm = _showForm[1]
  var _form = useState({ name: '', format: 'Standard', size: 8, rounds: 4, region: '', description: '', rulesText: '' })
  var form = _form[0]
  var setForm = _form[1]

  function update(field, val) {
    setForm(function(f) { var n = Object.assign({}, f); n[field] = val; return n })
  }

  function onSave() {
    if (!form.name.trim()) { toast && toast('Template name required', 'error'); return }
    saveTemplate(form)
    setList(readTemplates())
    setShowForm(false)
    setForm({ name: '', format: 'Standard', size: 8, rounds: 4, region: '', description: '', rulesText: '' })
    toast && toast('Template saved', 'success')
  }

  function onDelete(id) {
    deleteTemplate(id)
    setList(readTemplates())
    toast && toast('Template removed', 'info')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 border-b border-outline-variant/10 pb-4">
        <h2 className="font-editorial text-2xl text-on-background flex-1">Tournament Templates</h2>
        <Btn variant="primary" size="sm" icon={showForm ? "close" : "add"} onClick={function() { setShowForm(function(v) { return !v }) }}>
          {showForm ? 'Cancel' : 'New template'}
        </Btn>
      </div>

      <p className="text-on-surface-variant text-sm">
        Save tournament configs once, spin up future events from a saved template. Stored locally in your browser.
      </p>

      {showForm && (
        <div className="bg-surface-container-low border border-outline-variant/15 rounded-lg p-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="text" value={form.name} onChange={function(e) { update('name', e.target.value.slice(0, 80)) }} placeholder="Template name" className="bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/40" />
            <select value={form.format} onChange={function(e) { update('format', e.target.value) }} className="bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/40">
              <option>Standard</option>
              <option>Multi-stage</option>
              <option>Flash</option>
              <option>Scrim</option>
            </select>
            <input type="number" min={4} max={128} value={form.size} onChange={function(e) { update('size', parseInt(e.target.value, 10) || 8) }} placeholder="Players" className="bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/40" />
            <input type="number" min={1} max={12} value={form.rounds} onChange={function(e) { update('rounds', parseInt(e.target.value, 10) || 4) }} placeholder="Rounds" className="bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/40" />
            <input type="text" value={form.region} onChange={function(e) { update('region', e.target.value.slice(0, 20)) }} placeholder="Region (e.g. EUW)" className="bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary/40 md:col-span-2" />
            <textarea value={form.description} onChange={function(e) { update('description', e.target.value.slice(0, 500)) }} placeholder="Description (auto-fills tournament page)" rows={2} className="bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/40 resize-none md:col-span-2" />
            <textarea value={form.rulesText} onChange={function(e) { update('rulesText', e.target.value.slice(0, 2000)) }} placeholder="Rules text (default tiebreakers + Riot ToS)" rows={3} className="bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/40 resize-none md:col-span-2" />
          </div>
          <div className="flex justify-end gap-2">
            <Btn variant="secondary" size="sm" onClick={function() { setShowForm(false) }}>Cancel</Btn>
            <Btn variant="primary" size="sm" icon="save" onClick={onSave}>Save template</Btn>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-lg p-8 text-center">
          <Icon name="bookmark" size={36} className="text-on-surface-variant/20 mx-auto mb-3" />
          <p className="text-on-surface text-sm font-semibold">No templates saved yet</p>
          <p className="text-on-surface-variant text-xs mt-1">Save your first config to spin up future events in one click.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {list.slice().sort(function(a, b) { return b.createdAt - a.createdAt }).map(function(t) {
            return (
              <div key={t.id} className="bg-surface-container-low border border-outline-variant/15 rounded-lg p-4">
                <div className="flex items-start gap-2 mb-2">
                  <Icon name="bookmark" size={16} className="text-primary mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-editorial text-base text-on-surface truncate">{t.name}</h4>
                    <p className="text-[10px] font-label uppercase tracking-wider text-on-surface-variant/50 mt-0.5">
                      {t.format + ' · ' + t.size + 'p · ' + t.rounds + ' rounds' + (t.region ? ' · ' + t.region : '')}
                    </p>
                  </div>
                  <button
                    onClick={function() { onDelete(t.id) }}
                    className="text-[10px] font-label uppercase tracking-widest text-error/70 hover:text-error"
                  >
                    Delete
                  </button>
                </div>
                {t.description && (
                  <p className="text-xs text-on-surface-variant leading-snug line-clamp-2">{t.description}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- HostDashboardScreen ---
export default function HostDashboardScreen() {
  var ctx = useApp();
  var currentUser = ctx.currentUser;
  var players = ctx.players;
  var toast = ctx.toast;
  var setScreen = ctx.setScreen;
  var hostTournaments = ctx.hostTournaments;
  var setHostTournaments = ctx.setHostTournaments;
  var hostBranding = ctx.hostBranding;
  var setHostBranding = ctx.setHostBranding;
  var hostAnnouncements = ctx.hostAnnouncements;
  var setHostAnnouncements = ctx.setHostAnnouncements;
  var featuredEvents = ctx.featuredEvents;
  var setFeaturedEvents = ctx.setFeaturedEvents;
  var navigate = useNavigate();

  // Active section: "overview" | "tournaments" | "analytics" | "game-flow" | "registrations" | "announce" | "branding"
  var [tab, setTab] = useState("overview");
  var [showCreate, setShowCreate] = useState(false);
  var [filterStatus, setFilterStatus] = useState("all");

  // Tournament wizard state
  var [wizStep, setWizStep] = useState(0);
  var [wizData, setWizData] = useState({ name: "", date: "", type: "swiss", totalGames: 4, maxPlayers: 32, accentColor: "#ffc66b", entryFee: "", inviteOnly: false, rules: "", region: "EU" });
  var [wizCreating, setWizCreating] = useState(false);

  // Branding state
  var [brandName, setBrandName] = useState((hostBranding && hostBranding.name) || (currentUser && currentUser.username) || "My Org");
  var [brandLogo, setBrandLogo] = useState((hostBranding && hostBranding.logo) || "controller");
  var [brandColor, setBrandColor] = useState((hostBranding && hostBranding.color) || "#ffc66b");
  var [brandBio, setBrandBio] = useState((hostBranding && hostBranding.bio) || "");
  var [brandLogoUrl, setBrandLogoUrl] = useState((hostBranding && hostBranding.logoUrl) || "");
  var [brandBannerUrl, setBrandBannerUrl] = useState((hostBranding && hostBranding.bannerUrl) || "");
  var [uploadingLogo, setUploadingLogo] = useState(false);
  var [uploadingBanner, setUploadingBanner] = useState(false);
  var [dbProfileLoaded, setDbProfileLoaded] = useState(false);
  var [brandSaved, setBrandSaved] = useState(false);

  // Announce state
  var [announceMsg, setAnnounceMsg] = useState("");
  var [announceTo, setAnnounceTo] = useState("all");
  var [announcements, setAnnouncements] = useState(hostAnnouncements || []);

  var tournaments = hostTournaments || [];
  var setTournaments = setHostTournaments || function() {};

  // Command Center state
  var _selEvt = useState(tournaments.length > 0 ? tournaments[0].id : null)
  var selectedEventId = _selEvt[0]
  var setSelectedEventId = _selEvt[1]

  var _ar = useState(1)
  var activeRound = _ar[0]
  var setActiveRound = _ar[1]

  var _pending = useState({})
  var pendingPlacements = _pending[0]
  var setPendingPlacements = _pending[1]

  var _selP = useState(null)
  var selectedPlayer = _selP[0]
  var setSelectedPlayer = _selP[1]

  var _stack = useState([])
  var placementStack = _stack[0]
  var setPlacementStack = _stack[1]

  var _regs = useState([])
  var eventRegistrants = _regs[0]
  var setEventRegistrants = _regs[1]

  var _regsLoading = useState(false)
  var setEventRegistrantsLoading = _regsLoading[1]

  var _teamEventData = useState({})
  var teamEventData = _teamEventData[0]
  var setTeamEventData = _teamEventData[1]

  useEffect(function() {
    if (!supabase || !supabase.from) return
    var liveDbIds = (hostTournaments || []).filter(function(t) {
      return t && t.dbId && (t.status === 'live' || t.status === 'closed')
    }).map(function(t) { return t.dbId })
    if (liveDbIds.length === 0) { setTeamEventData({}); return }
    var cancelled = false
    supabase.from('tournaments').select('id, team_size').in('id', liveDbIds)
      .then(function(tRes) {
        if (cancelled || !tRes.data) return
        var teamIds = tRes.data.filter(function(t) { return (t.team_size || 1) > 1 }).map(function(t) { return t.id })
        if (teamIds.length === 0) { setTeamEventData({}); return }
        supabase.from('registrations')
          .select('id, tournament_id, team_id, lineup_player_ids, status, teams!registrations_team_id_fkey(id, name, tag)')
          .in('tournament_id', teamIds)
          .not('team_id', 'is', null)
          .in('status', ['registered','checked_in'])
          .then(function(rRes) {
            if (cancelled || !rRes.data) return
            var allPids = {}
            rRes.data.forEach(function(r) { (r.lineup_player_ids || []).forEach(function(pid) { if (pid) allPids[pid] = true }) })
            var pidList = Object.keys(allPids)
            var fetchPlayers = pidList.length > 0
              ? supabase.from('players').select('id, username, riot_id').in('id', pidList)
              : Promise.resolve({ data: [] })
            fetchPlayers.then(function(pRes) {
              if (cancelled) return
              var byPid = {}
              ;((pRes && pRes.data) || []).forEach(function(p) { byPid[p.id] = p })
              var byTournament = {}
              tRes.data.forEach(function(t) {
                if ((t.team_size || 1) > 1) byTournament[t.id] = { teamSize: t.team_size, teams: [] }
              })
              rRes.data.forEach(function(r) {
                var bucket = byTournament[r.tournament_id]
                if (!bucket) return
                var lineup = (r.lineup_player_ids || []).map(function(pid) { return byPid[pid] || { id: pid, username: 'Player ' + pid } })
                bucket.teams.push({
                  reg_id: r.id,
                  team_id: r.team_id,
                  status: r.status,
                  team_name: r.teams ? r.teams.name : 'Team',
                  team_tag: r.teams ? r.teams.tag : null,
                  lineup: lineup
                })
              })
              setTeamEventData(byTournament)
            }).catch(function() {})
          }).catch(function() {})
      }).catch(function() {})
    return function() { cancelled = true }
  }, [(hostTournaments || []).map(function(t){ return t.dbId + ':' + t.status }).join(',')])

  var setTournamentState = ctx.setTournamentState
  var tournamentState = ctx.tournamentState || {}

  var activeEvent = tournaments.find(function(e) { return e.id === selectedEventId }) || null
  var activeRoundLobbyPlayers = eventRegistrants.length > 0 ? eventRegistrants : (players || []).slice(0, 8)
  var totalRounds = activeEvent ? (activeEvent.totalGames || 3) : 3

  // Compute live standings from locked rounds
  var CC_PTS = {1:8, 2:7, 3:6, 4:5, 5:4, 6:3, 7:2, 8:1}
  var lockedLobbies = tournamentState.lockedLobbies || []
  var standingsMap = {}
  activeRoundLobbyPlayers.forEach(function(p) { standingsMap[p.id] = 0; })
  lockedLobbies.forEach(function(lobby) {
    var pls = lobby.placements || {}
    Object.keys(pls).forEach(function(rank) {
      var pid = pls[rank]
      standingsMap[pid] = (standingsMap[pid] || 0) + (CC_PTS[parseInt(rank)] || 0)
    })
  })
  var liveStandings = activeRoundLobbyPlayers.map(function(p) {
    return Object.assign({}, p, { ccPts: standingsMap[p.id] || 0 })
  }).sort(function(a, b) { return b.ccPts - a.ccPts })

  // Activity feed from real locked rounds
  var activityItems = lockedLobbies.slice().reverse().map(function(lb) {
    return { label: 'Round ' + lb.round + ' confirmed', dot: 'bg-secondary' }
  })
  if (activeEvent) { activityItems = activityItems.concat([{ label: 'Event created', dot: 'bg-on-surface/15' }]) }
  if (activityItems.length === 0) { activityItems = [{ label: 'Waiting for round 1...', dot: 'bg-on-surface/10' }] }

  // Load host profile from DB on mount
  useEffect(function() {
    if (!currentUser || !supabase.from || dbProfileLoaded) return;
    var aid = currentUser.auth_user_id;
    if (typeof aid !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(aid)) return;
    supabase.from("host_profiles").select("*").eq("user_id", aid).maybeSingle().then(function(res) {
      if (res.data) {
        var hp = res.data;
        setBrandName(hp.org_name || brandName);
        setBrandColor(hp.brand_color || brandColor);
        setBrandBio(hp.bio || "");
        if (hp.logo_url) setBrandLogoUrl(hp.logo_url);
        if (hp.banner_url) setBrandBannerUrl(hp.banner_url);
        setDbProfileLoaded(true);
      }
    }).catch(function() {});
  }, [currentUser]);

  // Load registrants for the selected event from DB
  useEffect(function() {
    if (!selectedEventId || !supabase.from) { setEventRegistrants([]); return; }
    var activeEvt = (hostTournaments || []).find(function(t) { return t.id === selectedEventId; });
    var dbId = activeEvt ? (activeEvt.dbId || null) : null;
    if (!dbId) { setEventRegistrants([]); return; }
    setEventRegistrantsLoading(true);
    supabase.from('registrations')
      .select('player_id, status')
      .eq('tournament_id', dbId)
      .in('status', ['confirmed', 'registered', 'checked_in'])
      .then(function(res) {
        setEventRegistrantsLoading(false);
        if (res.error || !res.data || res.data.length === 0) { setEventRegistrants([]); return; }
        var regIds = res.data.map(function(r) { return r.player_id; });
        var matched = (players || []).filter(function(p) { return regIds.indexOf(p.id) !== -1; });
        setEventRegistrants(matched);
      }).catch(function() { setEventRegistrantsLoading(false); });
  }, [selectedEventId, (hostTournaments || []).length]);

  // Load host tournaments from DB
  useEffect(function() {
    if (!currentUser || !supabase.from) return;
    supabase.from("tournaments").select("id, name, date, max_players, host_id")
      .eq("host_id", currentUser.auth_user_id || currentUser.id)
      .order("date", { ascending: false })
      .then(function(res) {
        if (res.data && setHostTournaments) {
          var merged = res.data.map(function(dbT) {
            var existing = (hostTournaments || []).find(function(t) { return t.dbId === dbT.id || t.name === dbT.name; });
            return existing
              ? Object.assign({}, existing, { dbId: dbT.id, max_players: dbT.max_players })
              : Object.assign({}, dbT, { dbId: dbT.id, status: "upcoming", registered: 0, size: dbT.max_players || 32 });
          });
          setHostTournaments(function(prev) {
            var prevIds = (prev || []).map(function(t) { return t.dbId || t.id; });
            var newFromDb = merged.filter(function(t) { return prevIds.indexOf(t.dbId || t.id) === -1; });
            return (prev || []).concat(newFromDb);
          });
        }
      }).catch(function() {});
  }, [currentUser ? currentUser.id : null]);

  function uploadImage(file, type) {
    if (!file || !supabase.storage) return;
    var setUploading = type === "logo" ? setUploadingLogo : setUploadingBanner;
    var setUrl = type === "logo" ? setBrandLogoUrl : setBrandBannerUrl;
    setUploading(true);
    var ext = file.name.split('.').pop();
    var authUid = currentUser ? currentUser.auth_user_id : "anon";
    var path = "host-" + authUid + "/" + type + "." + ext;
    supabase.storage.from("host-assets").upload(path, file, { cacheControl: "3600", upsert: true }).then(function(res) {
      setUploading(false);
      if (res.error) { toast("Upload failed: " + res.error.message, "error"); return; }
      var url = supabase.storage.from("host-assets").getPublicUrl(path).data.publicUrl;
      setUrl(url);
      toast((type === "logo" ? "Logo" : "Banner") + " uploaded!", "success");
    }).catch(function() { setUploading(false); toast("Upload failed", "error"); });
  }

  function updateTournamentAndFeatured(tournamentId, updates) {
    setTournaments(function(ts) { return ts.map(function(t) { return t.id === tournamentId ? Object.assign({}, t, updates) : t; }); });
    if (setFeaturedEvents) {
      setFeaturedEvents(function(evts) {
        return evts.map(function(ev) {
          if (ev.hostTournamentId !== tournamentId) return ev;
          var feUpdates = {};
          if (updates.status === "upcoming") feUpdates.status = "upcoming";
          if (updates.status === "checkin" || updates.status === "live") feUpdates.status = "live";
          if (updates.status === "closed") feUpdates.status = "upcoming";
          if (updates.status === "complete") {
            feUpdates.status = "complete";
            if (updates.champion) feUpdates.champion = updates.champion;
            if (updates.top4) feUpdates.top4 = updates.top4;
          }
          return Object.assign({}, ev, feUpdates);
        });
      });
    }
  }

  function exportTournamentCSV(tournament) {
    var tournId = tournament.dbId || tournament.id;
    if (!tournId) {
      toast('No database ID for this tournament', 'error');
      return;
    }
    supabase
      .from('game_results')
      .select('round, lobby_number, player_id, placement')
      .eq('tournament_id', tournId)
      .order('round', { ascending: true })
      .order('placement', { ascending: true })
      .then(function(res) {
        if (res.error) {
          toast('Export failed: ' + res.error.message, 'error');
          return;
        }
        var rows = res.data || [];
        if (rows.length === 0) {
          toast('No results recorded for this tournament yet', 'info');
          return;
        }
        var PTS = { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 };
        var header = 'Player,Round,Lobby,Placement,Points';
        var lines = rows.map(function(r) {
          var player = (players || []).find(function(p) { return p.id === r.player_id; });
          var playerName = player ? player.name : ('Player ' + r.player_id);
          var lobbyLetter = String.fromCharCode(64 + (r.lobby_number || 1));
          var pts = PTS[r.placement] || 0;
          return [playerName, r.round, lobbyLetter, r.placement, pts].join(',');
        });
        var csv = [header].concat(lines).join('\n');
        var blob = new Blob([csv], { type: 'text/csv' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = tournament.name.replace(/[^a-z0-9]/gi, '-').toLowerCase() + '-results.csv';
        a.click();
        URL.revokeObjectURL(url);
        toast('CSV exported!', 'success');
      });
  }

  function submitWizard() {
    if (!wizData.name.trim() || !wizData.date.trim()) { toast("Name and date required", "error"); return; }
    setWizCreating(true);
    var newT = {
      id: Date.now(),
      name: wizData.name,
      date: wizData.date,
      size: wizData.maxPlayers,
      invite: wizData.inviteOnly,
      entryFee: wizData.entryFee,
      rules: wizData.rules,
      status: wizData.entryFee ? "pending_approval" : "upcoming",
      registered: 0,
      approved: !wizData.entryFee
    };
    setTournaments(function(ts) { return ts.concat([newT]); });
    if (setFeaturedEvents) {
      setFeaturedEvents(function(evts) {
        return evts.concat([{
          id: "host-" + newT.id,
          name: wizData.name,
          host: brandName,
          sponsor: null,
          status: "upcoming",
          date: wizData.date,
          time: "TBD",
          format: wizData.type === "swiss" ? "Swiss" : "Standard",
          size: wizData.maxPlayers,
          registered: 0,
          registeredIds: [],
          prizePool: null,
          region: wizData.region || "EU",
          description: wizData.rules || "Tournament hosted by " + brandName,
          tags: wizData.inviteOnly ? ["Invite Only"] : ["Open"],
          logo: brandLogo,
          screen: "tournament-host-" + newT.id,
          hostTournamentId: newT.id
        }]);
      });
    }
    var savedWizData = Object.assign({}, wizData);
    if (supabase.from) {
      supabase.from("tournaments").insert({
        name: savedWizData.name,
        date: savedWizData.date,
        type: "flash_tournament",
        format: savedWizData.type,
        round_count: savedWizData.totalGames,
        max_players: savedWizData.maxPlayers,
        phase: "draft",
        host_id: currentUser ? currentUser.auth_user_id : null,
        invite_only: !!savedWizData.inviteOnly,
        entry_fee: savedWizData.entryFee || null,
        rules_text: savedWizData.rules || null,
        region: savedWizData.region === 'NA' ? 'NA' : 'EU',
        branding_json: { accent_color: savedWizData.accentColor }
      }).select().single().then(function(res) {
        setWizCreating(false);
        if (res && res.error) {
          toast("Failed to create tournament: " + res.error.message, "error");
          return;
        }
        if (res && res.data) {
          var dbId = res.data.id;
          setTournaments(function(ts) { return ts.map(function(t) { return t.name === savedWizData.name && !t.dbId ? Object.assign({}, t, { dbId: dbId }) : t; }); });
          if (setFeaturedEvents) {
            setFeaturedEvents(function(evts) { return evts.map(function(ev) { return ev.name === savedWizData.name && !ev.dbTournamentId ? Object.assign({}, ev, { dbTournamentId: dbId }) : ev; }); });
          }
        }
        setShowCreate(false);
        setWizStep(0);
        setWizData({ name: "", date: "", type: "swiss", totalGames: 4, maxPlayers: 32, accentColor: "#ffc66b", entryFee: "", inviteOnly: false, rules: "", region: "EU" });
        toast(savedWizData.entryFee ? "Tournament created - pending admin approval" : "Tournament created!", "success");
      }).catch(function() { setWizCreating(false); toast("Failed to create tournament", "error"); });
    } else {
      setWizCreating(false);
      setShowCreate(false);
      setWizStep(0);
      setWizData({ name: "", date: "", type: "swiss", totalGames: 4, maxPlayers: 32, accentColor: "#ffc66b", entryFee: "", inviteOnly: false, rules: "" });
      toast(savedWizData.entryFee ? "Tournament created - pending admin approval" : "Tournament created!", "success");
    }
  }

  function saveBranding() {
    if (setHostBranding) setHostBranding({ name: brandName, logo: brandLogo, color: brandColor, bio: brandBio, logoUrl: brandLogoUrl, bannerUrl: brandBannerUrl });
    if (supabase.from && currentUser) {
      supabase.from("host_profiles").update({
        org_name: brandName,
        brand_color: brandColor,
        bio: brandBio,
        logo_url: brandLogoUrl || brandLogo,
        banner_url: brandBannerUrl || ""
      }).eq("user_id", currentUser.auth_user_id).then(function(res) {
      }).catch(function() {});
    }
    setBrandSaved(true);
    toast("Branding saved!", "success");
    setTimeout(function() { setBrandSaved(false); }, 3000);
  }

  function sendAnnouncement() {
    if (!announceMsg.trim()) { toast("Write a message first", "error"); return; }
    var msg = announceMsg.trim();
    var a = { id: Date.now(), to: announceTo, msg: msg, sentAt: new Date().toLocaleString() };
    var newArr = [a].concat(announcements);
    setAnnouncements(function() { return newArr; });
    if (setHostAnnouncements) setHostAnnouncements(newArr);
    setAnnounceMsg("");
    if (supabase.from) {
      supabase.from('site_settings').upsert(
        { key: 'announcement', value: msg },
        { onConflict: 'key' }
      ).then(function(r) { }).catch(function() {})
    }
    toast("Announcement sent to " + (announceTo === "all" ? "all players" : announceTo + " players"), "success");
  }

  var liveTournaments = tournaments.filter(function(t) { return t.status === "live"; });
  var upcomingTournaments = tournaments.filter(function(t) { return t.status === "upcoming"; });
  var completedTournaments = tournaments.filter(function(t) { return t.status === "complete"; });
  var totalHosted = tournaments.length;
  var totalPlayers = tournaments.reduce(function(s, t) { return s + (t.registered || 0); }, 0);

  var filteredTournaments = tournaments.filter(function(t) {
    if (filterStatus === "all") return true;
    if (filterStatus === "live") return t.status === "live";
    if (filterStatus === "draft") return t.status === "upcoming" || t.status === "pending_approval";
    if (filterStatus === "completed") return t.status === "complete";
    return true;
  });

  // --- Wizard steps ---
  function renderWizardStep() {
    if (wizStep === 0) {
      return (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-label uppercase tracking-widest text-primary font-bold">Tournament Name</label>
              <input
                className="w-full bg-surface-container-lowest border-none border-b border-outline-variant/20 focus:border-primary focus:ring-0 text-on-background py-3 font-mono"
                value={wizData.name}
                onChange={function(e) { var v = e.target.value; setWizData(function(d) { return Object.assign({}, d, { name: v }); }); }}
                placeholder="e.g. Weekly Clash #15"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-label uppercase tracking-widest text-primary font-bold">Date</label>
              <input
                className="w-full bg-surface-container-lowest border-none border-b border-outline-variant/20 focus:border-primary focus:ring-0 text-on-background py-3 font-mono"
                value={wizData.date}
                onChange={function(e) { var v = e.target.value; setWizData(function(d) { return Object.assign({}, d, { date: v }); }); }}
                placeholder="Mar 24 2026"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Btn
              variant="secondary"
              size="md"
              onClick={function() { setShowCreate(false); setWizStep(0); }}
            >
              Cancel
            </Btn>
            <Btn
              variant="primary"
              size="md"
              onClick={function() { if (!wizData.name.trim() || !wizData.date.trim()) { toast("Name and date required", "error"); return; } setWizStep(1); }}
            >
              Next: Format
            </Btn>
            <span className="text-xs font-mono text-slate-500">All fields auto-save to cloud.</span>
          </div>
        </div>
      );
    }
    if (wizStep === 1) {
      return (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-label uppercase tracking-widest text-primary font-bold">Server Region</label>
              <Sel value={wizData.region} onChange={function(v) { setWizData(function(d) { return Object.assign({}, d, { region: v === 'NA' ? 'NA' : 'EU' }); }); }}>
                <option value="EU">EU</option>
                <option value="NA">NA</option>
              </Sel>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-label uppercase tracking-widest text-slate-500">Format</label>
              <Sel value={wizData.type} onChange={function(v) { setWizData(function(d) { return Object.assign({}, d, { type: v }); }); }}>
                <option value="swiss">Swiss System</option>
                <option value="standard">Single Elimination</option>
                <option value="round_robin">Round Robin</option>
              </Sel>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-label uppercase tracking-widest text-slate-500">Player Limit</label>
              <Sel value={String(wizData.maxPlayers)} onChange={function(v) { setWizData(function(d) { return Object.assign({}, d, { maxPlayers: parseInt(v) }); }); }}>
                {[8, 16, 24, 32, 48, 64, 96, 128].map(function(n) { return <option key={n} value={n}>{n + " Players"}</option>; })}
              </Sel>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-label uppercase tracking-widest text-slate-500">Check-in Window</label>
              <Sel value={String(wizData.totalGames)} onChange={function(v) { setWizData(function(d) { return Object.assign({}, d, { totalGames: parseInt(v) }); }); }}>
                {[2, 3, 4, 5, 6, 7, 8].map(function(n) { return <option key={n} value={n}>{n + " games"}</option>; })}
              </Sel>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-label uppercase tracking-widest text-slate-500">Entry Fee <span className="text-on-surface-variant/50 normal-case font-normal">(optional, requires admin approval)</span></label>
            <input
              className="w-full bg-surface-container-lowest border-none border-b border-outline-variant/20 focus:border-primary focus:ring-0 text-on-background py-3 font-mono"
              value={wizData.entryFee}
              onChange={function(e) { var v = e.target.value; setWizData(function(d) { return Object.assign({}, d, { entryFee: v }); }); }}
              placeholder="Leave blank = free"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-label uppercase tracking-widest text-slate-500">Custom Rules <span className="text-on-surface-variant/50 normal-case font-normal">(optional)</span></label>
            <textarea
              className="w-full bg-surface-container-lowest border-b border-outline-variant/20 px-0 py-3 text-on-background text-sm resize-y min-h-16 outline-none font-mono"
              value={wizData.rules}
              onChange={function(e) { var v = e.target.value; setWizData(function(d) { return Object.assign({}, d, { rules: v }); }); }}
              placeholder="Any special rules or format notes..."
            />
          </div>
          <div
            onClick={function() { setWizData(function(d) { return Object.assign({}, d, { inviteOnly: !d.inviteOnly }); }); }}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className={'w-9 h-5 rounded-full relative transition-all border ' + (wizData.inviteOnly ? 'bg-primary/25 border-primary/40' : 'bg-white/[0.08] border-white/10')}>
              <div className={'w-3.5 h-3.5 rounded-full absolute top-0.5 transition-all ' + (wizData.inviteOnly ? 'bg-primary left-[18px]' : 'bg-on-surface-variant left-0.5')} />
            </div>
            <span className="text-sm text-on-surface-variant">Invite-only registration</span>
          </div>
          <div className="flex items-center gap-4">
            <Btn variant="secondary" size="md" onClick={function() { setWizStep(0); }}>Back</Btn>
            <Btn variant="primary" size="md" onClick={function() { setWizStep(2); }}>Next: Branding</Btn>
          </div>
        </div>
      );
    }
    if (wizStep === 2) {
      return (
        <div className="space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-label uppercase tracking-widest text-primary font-bold">Accent Color</label>
            <div className="flex gap-2 flex-wrap">
              {ACCENT_COLORS.map(function(c) {
                return (
                  <div key={c} onClick={function() { setWizData(function(d) { return Object.assign({}, d, { accentColor: c }); }); }}
                    className="w-7 h-7 rounded-full cursor-pointer transition-all"
                    style={{ background: c, border: wizData.accentColor === c ? "3px solid #fff" : "3px solid transparent" }} />
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <input type="color" value={wizData.accentColor} onChange={function(e) { var v = e.target.value; setWizData(function(d) { return Object.assign({}, d, { accentColor: v }); }); }} className="w-9 h-8 rounded border border-outline-variant/20 bg-transparent cursor-pointer p-0.5" />
              <span className="text-xs text-on-surface-variant font-mono">{wizData.accentColor}</span>
            </div>
          </div>
          <div className="bg-surface-container p-4 rounded border" style={{ borderColor: wizData.accentColor }}>
            <div className="text-xs text-on-surface-variant font-label uppercase tracking-widest mb-1">Preview</div>
            <div className="font-bold text-on-surface font-editorial">{wizData.name || "Tournament Name"}</div>
            <div className="text-xs font-mono mt-1" style={{ color: wizData.accentColor }}>{wizData.type === "swiss" ? "Swiss" : "Standard"} - {wizData.maxPlayers} players</div>
          </div>
          <div className="flex items-center gap-4">
            <Btn variant="secondary" size="md" onClick={function() { setWizStep(1); }}>Back</Btn>
            <Btn variant="primary" size="md" onClick={function() { setWizStep(3); }}>Review</Btn>
          </div>
        </div>
      );
    }
    // Step 3: Review
    return (
      <div className="space-y-8">
        <div className="bg-surface-container p-5 rounded space-y-4">
          <div className="font-bold text-lg text-on-surface font-editorial">{wizData.name}</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Date", wizData.date],
              ["Region", wizData.region === 'NA' ? 'NA' : 'EU'],
              ["Format", wizData.type === "swiss" ? "Swiss" : "Standard"],
              ["Games", wizData.totalGames + " per player"],
              ["Max Players", String(wizData.maxPlayers)],
              ["Entry Fee", wizData.entryFee || "Free"],
              ["Invite Only", wizData.inviteOnly ? "Yes" : "No"]
            ].map(function(arr) {
              return (
                <div key={arr[0]} className="bg-surface-container-high p-3 rounded">
                  <div className="text-xs font-label uppercase tracking-widest text-on-surface-variant mb-1">{arr[0]}</div>
                  <div className="text-sm font-mono text-on-surface">{arr[1]}</div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ background: wizData.accentColor }} />
            <span className="text-xs text-on-surface-variant font-mono">{wizData.accentColor}</span>
          </div>
        </div>
        {wizData.entryFee && (
          <div className="bg-primary/5 border border-primary/20 rounded p-3 text-sm text-primary flex items-center gap-2">
            <Icon name="warning" size={16} />
            Entry fee tournaments require admin approval before going live.
          </div>
        )}
        <div className="flex items-center gap-4">
          <Btn variant="secondary" size="md" onClick={function() { setWizStep(2); }}>Back</Btn>
          <Btn
            variant="primary"
            size="lg"
            onClick={submitWizard}
            disabled={wizCreating}
            loading={wizCreating}
          >
            {wizCreating ? "Creating..." : "Create Tournament"}
          </Btn>
        </div>
      </div>
    );
  }

  // --- Render ---
  return (
    <PageLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-10">

        {/* Hero / Editorial Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-5xl font-editorial font-bold text-on-background mb-2">Host Central</h1>
            <p className="text-on-surface-variant font-body max-w-xl">Run your tournaments, track engagement, and brand every detail. One dashboard, total control.</p>
          </div>
          <div className="flex gap-4">
            <Btn
              variant="secondary"
              size="md"
              icon="file_upload"
              onClick={function() {
                var data = JSON.stringify(tournaments, null, 2);
                var blob = new Blob([data], { type: 'application/json' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'tournaments-export.json';
                a.click();
                URL.revokeObjectURL(url);
                toast('Data exported!', 'success');
              }}
            >
              Export Data
            </Btn>
            <Btn
              variant="primary"
              size="md"
              icon="add"
              onClick={function() { setShowCreate(function(s) { return !s; }); setWizStep(0); }}
            >
              {showCreate ? "Cancel" : "Create Tournament"}
            </Btn>
          </div>
        </div>

        {/* Bento Grid: Analytics + Branding */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Analytics Large */}
          <div className="md:col-span-3 bg-surface-container-low p-6 rounded-lg relative overflow-hidden">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="font-editorial text-xl mb-1">Tournament History</h3>
                <p className="font-label text-xs text-slate-500 uppercase tracking-widest">{tournaments.length + ' tournament' + (tournaments.length !== 1 ? 's' : '') + ' hosted'}</p>
              </div>
            </div>
            {/* Real bar chart from tournament data */}
            {tournaments.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-500 text-sm font-label uppercase tracking-widest">No analytics data yet</div>
            ) : (
              <div className="h-48 w-full flex items-end gap-1 px-2">
                {tournaments.slice(-9).map(function(t, i) {
                  var fill = t.size > 0 ? (t.registered || 0) / t.size : 0;
                  var h = Math.max(8, Math.round(fill * 100));
                  var isLast = i === Math.min(tournaments.length, 9) - 1;
                  return (
                    <div
                      key={t.id || t.name}
                      className={'flex-grow rounded-t-sm border-t-2 ' + (isLast ? 'bg-primary/25 border-t-primary/80' : 'bg-[rgba(30,30,40,0.6)] border-t-white/[0.04]')}
                      title={t.name + ': ' + (t.registered || 0) + '/' + (t.size || 0) + ' players'}
                      style={{ height: h + '%' }}
                    />
                  );
                })}
              </div>
            )}
            {/* Stats row */}
            <div className="mt-4 flex gap-8 border-t border-outline-variant/10 pt-4">
              <div>
                <div className="text-xs font-label uppercase tracking-widest text-slate-500 mb-1">Completed</div>
                <div className="font-mono text-lg font-bold text-on-surface">{completedTournaments.length}</div>
              </div>
              <div>
                <div className="text-xs font-label uppercase tracking-widest text-slate-500 mb-1">Avg Fill</div>
                <div className="font-mono text-lg font-bold text-on-surface">
                  {tournaments.length === 0 ? "--" : Math.round(tournaments.reduce(function(s, t) { return s + (t.size > 0 ? (t.registered / t.size) : 0); }, 0) / tournaments.length * 100) + "%"}
                </div>
              </div>
              <div>
                <div className="text-xs font-label uppercase tracking-widest text-slate-500 mb-1">Total Players</div>
                <div className="font-mono text-lg font-bold text-on-surface">{totalPlayers}</div>
              </div>
              <div>
                <div className="text-xs font-label uppercase tracking-widest text-slate-500 mb-1">Live Now</div>
                <div className="font-mono text-lg font-bold text-tertiary">{liveTournaments.length}</div>
              </div>
            </div>
          </div>

          {/* Branding Quick Tool */}
          <div className="bg-secondary-container/10 p-6 rounded-lg border border-secondary/30 flex flex-col justify-between">
            <div>
              <h3 className="font-editorial text-xl mb-4">Branding</h3>
              <div className="space-y-4">
                <div
                  className="group relative w-full aspect-square bg-surface-container-highest flex flex-col items-center justify-center border-2 border-dashed border-outline-variant/30 rounded-lg cursor-pointer hover:border-amber-500/50 transition-colors"
                  onClick={function() { setTab("branding"); }}
                >
                  {brandLogoUrl
                    ? <img src={brandLogoUrl} alt="Brand logo" loading="lazy" decoding="async" className="w-3/4 h-3/4 object-contain rounded" />
                    : (
                      <>
                        <Icon name="cloud_upload" size={28} className="text-slate-500 mb-2" />
                        <span className="text-[10px] font-label uppercase text-slate-400">Upload Logo</span>
                      </>
                    )
                  }
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-label uppercase text-slate-400">Primary Color</span>
                  <div className="flex gap-1">
                    {ACCENT_COLORS.slice(0, 3).map(function(c) {
                      return (
                        <div
                          key={c}
                          onClick={function() { setBrandColor(c); }}
                          className="w-6 h-6 rounded-full cursor-pointer border border-white/20 hover:scale-110 transition-all"
                          style={{ background: c, outline: brandColor === c ? "2px solid rgba(255,255,255,.6)" : "none", outlineOffset: "1px" }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={function() { setTab("branding"); }}
              className="w-full text-xs font-mono text-secondary-fixed-dim mt-4 uppercase text-left hover:underline"
            >
              Edit Palette
            </button>
          </div>
        </div>

        {/* Quick Draft (wizard) */}
        {showCreate && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-editorial text-2xl">Quick Draft</h3>
                {/* Step indicators */}
                <div className="flex items-center gap-2">
                  {WIZ_STEPS.map(function(label, i) {
                    return (
                      <div key={label} className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className={'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all border ' + (wizStep === i ? 'bg-primary/20 border-primary/50 text-primary' : wizStep > i ? 'bg-tertiary/15 border-tertiary/40 text-tertiary' : 'bg-white/[0.06] border-white/10 text-on-surface-variant')}>
                            {wizStep > i ? <Icon name="check" size={12} /> : (i + 1)}
                          </div>
                          {wizStep === i && <span className="text-xs font-label text-primary hidden sm:inline">{label}</span>}
                        </div>
                        {i < WIZ_STEPS.length - 1 && <div className={'w-4 h-px ' + (wizStep > i ? 'bg-tertiary/30' : 'bg-white/[0.08]')} />}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="p-8 rounded-lg border border-outline-variant/5 space-y-8 bg-surface-container">
                {renderWizardStep()}
              </div>
            </div>

            {/* Broadcast Preview */}
            <div className="space-y-6">
              <h3 className="font-editorial text-2xl">Broadcast Preview</h3>
              <div className="bg-surface-container-low rounded-lg p-6 relative aspect-video flex flex-col items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent opacity-60"></div>
                <div className="relative z-10 text-center">
                  <p className="font-label text-[10px] uppercase tracking-[0.4em] text-primary mb-2">Live Broadcast Overlay</p>
                  <div className="flex items-center justify-center gap-4">
                    <div className="w-12 h-0.5 bg-primary"></div>
                    <span className="font-display text-2xl uppercase tracking-tighter">VERSUS</span>
                    <div className="w-12 h-0.5 bg-primary"></div>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 items-center">
                    <div className="w-16 h-1 bg-secondary shadow-[0_0_15px_rgba(217,185,255,0.4)]"></div>
                    <span className="font-editorial text-slate-400">{wizData.name || "Tournament Name"}</span>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-surface-container-high rounded-lg space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-label uppercase text-slate-400">Host Status</span>
                  <span className="flex items-center gap-1.5 text-xs font-mono text-tertiary">
                    <span className="w-2 h-2 rounded-full bg-tertiary"></span> Online
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-label uppercase text-slate-400">Stream Delay</span>
                  <span className="text-xs font-mono text-slate-200">120s (Standard)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tournament Management */}
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-outline-variant/10 pb-4">
            <h2 className="font-editorial text-2xl">Hosted Events</h2>
            <div className="flex bg-surface-container-lowest p-1 rounded gap-1">
              {["all", "live", "draft", "completed"].map(function(f) {
                return (
                  <button
                    key={f}
                    onClick={function() { setFilterStatus(f); }}
                    className={"px-4 py-1 text-xs font-label uppercase tracking-widest transition-colors " + (filterStatus === f ? "bg-primary text-on-primary" : "text-slate-500 hover:text-slate-300")}
                  >
                    {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tournament List */}
          <div className="space-y-3">
            {filteredTournaments.length === 0 && (
              <div className="bg-surface-container-low p-12 rounded-lg text-center border border-outline-variant/10">
                <Icon name="military_tech" size={48} className="text-on-surface/20 mx-auto mb-4 block" aria-hidden="true" />
                <p className="text-on-surface text-sm font-bold mb-1">No tournaments yet</p>
                <p className="text-on-surface/50 text-xs">Create your first one with the form above.</p>
              </div>
            )}
            {filteredTournaments.map(function(t) {
              var isLive = t.status === "live";
              var isDraft = t.status === "upcoming" || t.status === "pending_approval";
              var isComplete = t.status === "complete";
              return (
                <div key={t.id} className="bg-surface-container-low p-5 rounded-lg flex items-center gap-6 hover:bg-surface-container transition-all group">
                  {/* Icon block */}
                  <div className={"w-16 h-16 bg-surface-container-high rounded flex items-center justify-center shrink-0" + (isDraft ? " grayscale opacity-50" : "")}>
                    <Icon
                      name={isLive ? "trophy" : isDraft ? "rocket_launch" : "emoji_events"}
                      size={28}
                      className={isLive ? "text-primary" : isDraft ? "text-slate-400" : "text-slate-500"}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <StatusPill status={t.status} />
                      <h4 className={"font-editorial text-lg " + (isComplete ? "text-slate-400" : isDraft ? "text-slate-300" : "text-on-background")}>
                        {t.name}
                      </h4>
                      {t.invite && <span className="px-2 py-0.5 bg-secondary/10 text-secondary font-label text-[10px] uppercase rounded">Invite Only</span>}
                    </div>
                    <div className="flex gap-6 flex-wrap">
                      <span className={"text-xs font-mono flex items-center gap-1 " + (isComplete ? "text-slate-600" : "text-slate-500")}>
                        <Icon name="group" size={14} />
                        {t.registered || 0}/{t.size} Players
                      </span>
                      <span className={"text-xs font-mono flex items-center gap-1 " + (isComplete ? "text-slate-600" : "text-slate-500")}>
                        <Icon name={isComplete ? "check_circle" : "calendar_today"} size={14} />
                        {isComplete ? "Finalized" : (t.date || "TBD")}
                      </span>
                      {isComplete && t.champion && (
                        <span className="text-xs font-mono text-slate-600 flex items-center gap-1">
                          <Icon name="emoji_events" size={14} />
                          Winner: {t.champion}
                        </span>
                      )}
                    </div>
                    {!isComplete && (
                      <div className="mt-2">
                        <Bar val={t.registered || 0} max={t.size || 1} color="#ffc66b" h={3} />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0 items-center">
                    {t.status === "upcoming" && (
                      <button
                        className="px-4 py-2 bg-secondary/10 text-secondary text-xs font-label font-bold uppercase tracking-wider rounded-full hover:bg-secondary/20 transition-colors"
                        onClick={function() {
                          updateTournamentAndFeatured(t.id, { status: "live" });
                          if (supabase.from) {
                            supabase.from('tournaments').update({ status: 'live' }).eq('id', t.id || t.dbId);
                          }
                          toast("Check-in opened! Tournament is now LIVE", "success");
                        }}
                      >
                        Publish Event
                      </button>
                    )}
                    {t.status === "pending_approval" && (
                      <span className="text-xs text-primary font-label font-bold uppercase tracking-wider">Awaiting Approval</span>
                    )}
                    {t.status === "live" && (
                      <button
                        className="px-4 py-2 bg-secondary/10 text-secondary text-xs font-label font-bold uppercase tracking-wider rounded-full hover:bg-secondary/20 transition-colors"
                        onClick={function() {
                          updateTournamentAndFeatured(t.id, { status: "closed" });
                          if (supabase.from && (t.dbId || t.id)) {
                            supabase.from('tournaments').update({ registration_close_at: new Date().toISOString() }).eq('id', t.dbId || t.id);
                          }
                          toast("Registration closed", "info");
                        }}
                      >
                        Close Reg
                      </button>
                    )}
                    {(t.status === "live" || t.status === "closed") && (
                      <button
                        className="px-4 py-2 bg-primary/10 text-primary text-xs font-label font-bold uppercase tracking-wider rounded-full hover:bg-primary/20 transition-colors"
                        onClick={function() {
                          var champ = prompt("Enter champion name:");
                          if (champ && champ.trim()) {
                            updateTournamentAndFeatured(t.id, { status: "complete", champion: champ.trim(), top4: [champ.trim()] });
                            if (supabase.from) {
                              supabase.from('tournaments').update({ status: 'complete', champion: champ.trim() }).eq('id', t.id || t.dbId);
                            }
                            toast("Tournament completed! Champion: " + champ.trim(), "success");
                          }
                        }}
                      >
                        Complete
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="View tournament analytics"
                      className="w-10 h-10 bg-surface-container-high rounded-full flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      onClick={function() { setTab("analytics"); }}
                    >
                      <Icon name="analytics" size={18} aria-hidden="true" />
                    </button>
                    {!isComplete && (
                      <button
                        type="button"
                        aria-label="Edit tournament"
                        className="w-10 h-10 bg-surface-container-high rounded-full flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        onClick={function() { setTab("game-flow"); }}
                      >
                        <Icon name="edit" size={18} aria-hidden="true" />
                      </button>
                    )}
                    {isComplete && (
                      <button
                        type="button"
                        aria-label="View tournament results"
                        className="w-10 h-10 bg-surface-container-high rounded-full flex items-center justify-center hover:bg-primary/10 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        onClick={function() { navigate("/results"); }}
                      >
                        <Icon name="history_edu" size={18} aria-hidden="true" />
                      </button>
                    )}
                    {t.status === 'complete' && (
                      <button
                        onClick={function() { exportTournamentCSV(t); }}
                        className="flex items-center gap-1 text-[10px] cond font-bold uppercase tracking-wide text-secondary hover:text-secondary/80 transition-colors bg-transparent border-0 cursor-pointer p-0"
                      >
                        <Icon name="file_download" size={12} />
                        CSV
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Delete tournament"
                      className="w-10 h-10 bg-surface-container-high rounded-full flex items-center justify-center hover:bg-error/10 hover:text-error transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/60"
                      onClick={function() {
                        if (!confirm("Delete this tournament?\n\nIt will be archived from upcoming/live feeds. Registrations and results are preserved.")) return;
                        var uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                        var dbId = (t.dbId && uuidRe.test(String(t.dbId))) ? t.dbId
                          : (t.id && uuidRe.test(String(t.id))) ? t.id
                          : null;
                        function clearLocal() {
                          setTournaments(function(ts) { return ts.filter(function(x) { return x.id !== t.id; }); });
                          if (setFeaturedEvents) {
                            setFeaturedEvents(function(evts) {
                              return evts.filter(function(ev) {
                                if (ev.hostTournamentId === t.id) return false;
                                if (dbId && ev.dbTournamentId === dbId) return false;
                                if (ev.id === ('host-' + t.id)) return false;
                                return true;
                              });
                            });
                          }
                        }
                        if (!supabase || !supabase.from || !dbId) {
                          clearLocal();
                          toast("Tournament removed", "info");
                          return;
                        }
                        supabase.from('tournaments')
                          .update({ phase: 'complete', archived_at: new Date().toISOString() })
                          .eq('id', dbId)
                          .then(function(r) {
                            if (r.error) { toast("Delete failed: " + r.error.message, "error"); return; }
                            clearLocal();
                            toast("Tournament deleted", "info");
                          })
                          .catch(function(err) { toast("Delete failed: " + (err && err.message ? err.message : 'unknown'), "error"); });
                      }}
                    >
                      <Icon name="more_vert" size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Announce tab */}
        {tab === "announce" && (
          <div className="space-y-6">
            <h2 className="font-editorial text-2xl text-on-background border-b border-outline-variant/10 pb-4">Send Announcement</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-label uppercase tracking-widest text-slate-500">Send to</label>
                  <Sel value={announceTo} onChange={setAnnounceTo}>
                    <option value="all">All registered players</option>
                    {tournaments.map(function(t) { return <option key={t.id} value={t.name}>{t.name}</option>; })}
                  </Sel>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-label uppercase tracking-widest text-slate-500">Message</label>
                  <textarea
                    className="w-full bg-surface-container-lowest border-b border-outline-variant/20 px-0 py-3 text-on-background text-sm resize-y min-h-24 outline-none font-mono"
                    value={announceMsg}
                    onChange={function(e) { setAnnounceMsg(e.target.value); }}
                    placeholder="e.g. Check-in is now open! Join the Discord for lobby codes..."
                  />
                </div>
                <Btn variant="primary" size="md" icon="campaign" onClick={sendAnnouncement}>
                  Send Announcement
                </Btn>
              </div>
              <div>
                <h3 className="font-editorial text-lg text-on-background mb-4">Sent</h3>
                {announcements.length === 0 && (
                  <p className="text-slate-500 text-sm">No announcements sent yet.</p>
                )}
                <div className="space-y-3">
                  {announcements.map(function(a) {
                    return (
                      <div key={a.id} className="bg-surface-container-low p-3 rounded-lg space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded font-label uppercase">To: {a.to}</span>
                          <span className="text-xs text-slate-500">{a.sentAt}</span>
                        </div>
                        <p className="text-sm text-slate-400">{a.msg}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Branding tab */}
        {tab === "branding" && (
          <div className="space-y-6">
            <h2 className="font-editorial text-2xl text-on-background border-b border-outline-variant/10 pb-4">Host Branding</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8 p-8 rounded-lg border border-outline-variant/5 bg-surface-container">
                <div className="space-y-2">
                  <label className="text-[10px] font-label uppercase tracking-widest text-primary font-bold">Org / Display Name</label>
                  <input
                    className="w-full bg-surface-container-lowest border-none border-b border-outline-variant/20 focus:border-primary focus:ring-0 text-on-background py-3 font-mono"
                    value={brandName}
                    onChange={function(e) { setBrandName(e.target.value); }}
                    placeholder="Your org or community name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-label uppercase tracking-widest text-slate-500">Brand Color</label>
                  <div className="flex gap-2 flex-wrap mb-2">
                    {ACCENT_COLORS.map(function(c) {
                      return (
                        <div key={c} onClick={function() { setBrandColor(c); }}
                          className="w-7 h-7 rounded-full cursor-pointer transition-all hover:scale-110"
                          style={{ background: c, border: brandColor === c ? "3px solid #fff" : "3px solid transparent" }} />
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="color" value={brandColor} onChange={function(e) { setBrandColor(e.target.value); }} className="w-9 h-8 rounded border border-outline-variant/20 bg-transparent cursor-pointer p-0.5" />
                    <input
                      className="bg-surface-container-lowest border-none border-b border-outline-variant/20 focus:border-primary focus:ring-0 text-on-background py-2 font-mono text-sm max-w-[120px]"
                      value={brandColor}
                      onChange={function(e) { setBrandColor(e.target.value); }}
                      placeholder="#ffc66b"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-label uppercase tracking-widest text-slate-500">Bio / Description</label>
                  <textarea
                    className="w-full bg-surface-container-lowest border-b border-outline-variant/20 px-0 py-3 text-on-background text-sm resize-y min-h-20 outline-none font-mono"
                    value={brandBio}
                    onChange={function(e) { setBrandBio(e.target.value); }}
                    placeholder="Tell players about your org, community, and what kind of clashes you run..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-label uppercase tracking-widest text-slate-500">Logo Image</label>
                  <div className="flex gap-3 items-center">
                    <input
                      className="flex-1 bg-surface-container-lowest border-none border-b border-outline-variant/20 focus:border-primary focus:ring-0 text-on-background py-3 font-mono text-sm"
                      value={brandLogoUrl}
                      onChange={function(e) { setBrandLogoUrl(e.target.value); }}
                      placeholder="https://example.com/logo.png"
                    />
                    <label className="bg-secondary/10 border border-secondary/30 rounded-full px-4 py-2 text-xs font-bold text-secondary cursor-pointer whitespace-nowrap hover:bg-secondary/20 transition-colors font-label uppercase tracking-wider">
                      {uploadingLogo ? "Uploading..." : "Upload"}
                      <input type="file" accept="image/*" className="hidden" onChange={function(e) { if (e.target.files[0]) uploadImage(e.target.files[0], "logo"); }} />
                    </label>
                  </div>
                  {brandLogoUrl && <img src={brandLogoUrl} alt="Brand logo preview" loading="lazy" decoding="async" className="w-12 h-12 rounded object-cover border border-outline-variant/20 mt-1" />}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-label uppercase tracking-widest text-slate-500">Banner Image</label>
                  <div className="flex gap-3 items-center">
                    <input
                      className="flex-1 bg-surface-container-lowest border-none border-b border-outline-variant/20 focus:border-primary focus:ring-0 text-on-background py-3 font-mono text-sm"
                      value={brandBannerUrl}
                      onChange={function(e) { setBrandBannerUrl(e.target.value); }}
                      placeholder="https://example.com/banner.png"
                    />
                    <label className="bg-secondary/10 border border-secondary/30 rounded-full px-4 py-2 text-xs font-bold text-secondary cursor-pointer whitespace-nowrap hover:bg-secondary/20 transition-colors font-label uppercase tracking-wider">
                      {uploadingBanner ? "Uploading..." : "Upload"}
                      <input type="file" accept="image/*" className="hidden" onChange={function(e) { if (e.target.files[0]) uploadImage(e.target.files[0], "banner"); }} />
                    </label>
                  </div>
                  {brandBannerUrl && <img src={brandBannerUrl} alt="Brand banner preview" loading="lazy" decoding="async" className="w-full max-h-28 rounded object-cover border border-outline-variant/20 mt-1" />}
                </div>
                <Btn variant="primary" size="lg" onClick={saveBranding}>
                  {brandSaved ? "Saved!" : "Save Branding"}
                </Btn>
              </div>

              {/* Branding Preview */}
              <div className="space-y-6">
                <h3 className="font-editorial text-lg text-on-background">Preview</h3>
                <div className="p-5 bg-surface-container-low rounded-lg" style={{ borderLeft: "4px solid " + brandColor }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded flex items-center justify-center" style={{ background: brandColor + "22", border: "1px solid " + brandColor + "44" }}>
                      {brandLogoUrl
                        ? <img src={brandLogoUrl} alt="Brand logo" loading="lazy" decoding="async" className="w-8 h-8 object-contain rounded" />
                        : <Icon name="military_tech" size={20} style={{ color: brandColor }} />
                      }
                    </div>
                    <div>
                      <div className="font-bold text-on-surface text-sm">{brandName || "Your Org"}</div>
                      <div className="text-xs font-label" style={{ color: brandColor }}>Host Partner</div>
                    </div>
                  </div>
                  {brandBio && <p className="text-xs text-slate-400 leading-relaxed">{brandBio}</p>}
                </div>
                {/* Host status panel */}
                <div className="p-6 bg-surface-container-high rounded-lg space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-label uppercase text-slate-400">Host Status</span>
                    <span className="flex items-center gap-1.5 text-xs font-mono text-tertiary">
                      <span className="w-2 h-2 rounded-full bg-tertiary"></span> Online
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-label uppercase text-slate-400">Tournaments Hosted</span>
                    <span className="text-xs font-mono text-slate-200">{totalHosted}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Game Flow tab */}
        {tab === "game-flow" && (
          <div className="space-y-5">
            <h2 className="font-editorial text-2xl text-on-background border-b border-outline-variant/10 pb-4">Game Flow</h2>
            {tournaments.filter(function(t) { return t.status === "live" || t.status === "closed"; }).length === 0 && (
              <div className="bg-surface-container-low p-12 rounded-lg text-center">
                <Icon name="sports_esports" size={40} className="text-slate-500 mx-auto mb-3" />
                <h3 className="font-editorial text-lg text-on-surface mb-2">No Live Tournaments</h3>
                <p className="text-slate-500 text-sm">Open check-in on a tournament to start the game flow.</p>
              </div>
            )}
            {tournaments.filter(function(t) { return t.status === "live" || t.status === "closed"; }).map(function(t) {
              var matchingEvent = (featuredEvents || []).find(function(ev) { return ev.hostTournamentId === t.id; });
              var regIds = matchingEvent ? (matchingEvent.registeredIds || []) : [];
              var roundCount = t.roundCount || 3;
              var currentRound = t.currentRound || 1;
              var teamData = t.dbId ? teamEventData[t.dbId] : null;
              var isTeamEvent = !!teamData;
              var teamCount = isTeamEvent ? teamData.teams.length : 0;
              return (
                <div key={t.id} className="bg-surface-container-low p-6 rounded-lg border border-tertiary/20">
                  <div className="flex items-center gap-3 mb-5">
                    <h3 className="font-editorial text-lg text-on-surface flex-1">{t.name}</h3>
                    {isTeamEvent && (
                      <span className="px-2 py-0.5 bg-tertiary/15 text-tertiary font-label text-[10px] uppercase tracking-tighter rounded">{teamData.teamSize}v{teamData.teamSize}</span>
                    )}
                    <span className="px-2 py-0.5 bg-tertiary-container/10 text-tertiary font-label text-[10px] uppercase tracking-tighter rounded">Round {currentRound}/{roundCount}</span>
                    <span className="px-2 py-0.5 bg-primary/10 text-primary font-label text-[10px] uppercase tracking-tighter rounded">
                      {isTeamEvent ? (teamCount + ' team' + (teamCount === 1 ? '' : 's')) : (regIds.length + ' players')}
                    </span>
                  </div>

                  {isTeamEvent && teamCount === 0 && (
                    <div className="text-center py-8">
                      <Icon name="groups" size={36} className="mx-auto text-on-surface/20 block mb-3" aria-hidden="true" />
                      <p className="text-on-surface/50 text-sm">No teams checked in yet.</p>
                    </div>
                  )}

                  {isTeamEvent && teamCount > 0 && (
                    <div className="space-y-4">
                      <div className="text-xs font-label uppercase tracking-widest text-slate-500 mb-2">Enter placements for Round {currentRound}</div>
                      <div className="space-y-4">
                        {teamData.teams.map(function(tm) {
                          var lineup = tm.lineup || [];
                          var notCheckedIn = tm.status !== 'checked_in';
                          return (
                            <div key={tm.team_id} className="rounded border border-outline-variant/15 overflow-hidden bg-surface-container/40">
                              <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-high border-b border-outline-variant/10">
                                <Icon name="groups" size={14} className="text-tertiary" />
                                <span className="font-bold text-sm text-on-surface flex-1 truncate">{tm.team_name}{tm.team_tag ? <span className="text-on-surface/40 font-mono text-xs ml-2">[{tm.team_tag}]</span> : null}</span>
                                {notCheckedIn ? (
                                  <span className="text-[10px] font-label uppercase tracking-wider text-on-surface-variant/50">Not checked in</span>
                                ) : (
                                  <span className="text-[10px] font-label uppercase tracking-wider text-success">Checked in - {lineup.length} starters</span>
                                )}
                              </div>
                              <div className="divide-y divide-outline-variant/5">
                                {lineup.length === 0 ? (
                                  <div className="px-3 py-3 text-xs text-on-surface/50">Lineup not submitted yet.</div>
                                ) : lineup.map(function(p) {
                                  return (
                                    <div key={p.id} className="flex items-center gap-3 p-3">
                                      <span className="text-sm font-mono text-on-surface flex-1 truncate">{p.username || 'Player'}</span>
                                      {p.riot_id ? <span className="text-[11px] font-mono text-on-surface/50 truncate hidden sm:inline">{p.riot_id}</span> : null}
                                      <Sel value="" onChange={function(val) {
                                        if (!val) return;
                                        var placement = parseInt(val);
                                        var pts = { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 }[placement] || 0;
                                        if (!supabase.from || !t.dbId) {
                                          toast(p.username + ' placed ' + placement + 'th (' + pts + 'pts)', 'success');
                                          return;
                                        }
                                        supabase.from('game_results').insert({
                                          tournament_id: t.dbId,
                                          round_number: currentRound,
                                          game_number: currentRound,
                                          player_id: p.id,
                                          placement: placement,
                                          points: pts
                                        }).then(function(res) {
                                          if (res.error) toast('Failed to save: ' + res.error.message, 'error');
                                          else toast(p.username + ' placed ' + placement + (placement === 1 ? 'st' : placement === 2 ? 'nd' : placement === 3 ? 'rd' : 'th') + ' (' + pts + 'pts)', 'success');
                                        }).catch(function() { toast('Failed to save result', 'error'); });
                                      }} className="w-28">
                                        <option value="">Place</option>
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map(function(pl) {
                                          return <option key={pl} value={pl}>{pl}{pl === 1 ? 'st' : pl === 2 ? 'nd' : pl === 3 ? 'rd' : 'th'} ({({ 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 })[pl]}pts)</option>;
                                        })}
                                      </Sel>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-3 pt-2">
                        <Btn
                          variant="primary"
                          size="sm"
                          onClick={function() {
                            if (currentRound < roundCount) {
                              updateTournamentAndFeatured(t.id, { currentRound: currentRound + 1 });
                              toast('Advanced to Round ' + (currentRound + 1), 'success');
                            } else {
                              var champ = prompt('Enter winning team name:');
                              if (champ && champ.trim()) {
                                updateTournamentAndFeatured(t.id, { status: 'complete', champion: champ.trim(), top4: [champ.trim()] });
                                toast('Tournament completed! Winner: ' + champ.trim(), 'success');
                              }
                            }
                          }}
                        >
                          {currentRound < roundCount ? 'Advance to Round ' + (currentRound + 1) : 'Finalize Tournament'}
                        </Btn>
                        <Btn
                          variant="secondary"
                          size="sm"
                          onClick={function() { setScreen('tournament-host-' + t.id); }}
                        >
                          View Public Page
                        </Btn>
                      </div>
                    </div>
                  )}

                  {!isTeamEvent && regIds.length === 0 && (
                    <div className="text-center py-8">
                      <Icon name="person_add" size={36} className="mx-auto text-on-surface/20 block mb-3" aria-hidden="true" />
                      <p className="text-on-surface/50 text-sm">No players registered yet.</p>
                    </div>
                  )}
                  {!isTeamEvent && regIds.length > 0 && (
                    <div className="space-y-4">
                      <div className="text-xs font-label uppercase tracking-widest text-slate-500 mb-2">Enter placements for Round {currentRound}</div>
                      <div className="space-y-2">
                        {regIds.map(function(username) {
                          return (
                            <div key={username} className="flex items-center gap-3 p-3 bg-surface-container rounded">
                              <span className="text-sm font-mono text-on-surface flex-1">{username}</span>
                              <Sel value="" onChange={function(val) {
                                if (!val) return;
                                var placement = parseInt(val);
                                var pts = { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 }[placement] || 0;
                                if (supabase.from && t.dbId) {
                                  var matchedPlayer = (players || []).find(function(p) { return p.username === username || p.name === username; });
                                  var playerId = matchedPlayer ? matchedPlayer.dbId || matchedPlayer.id : null;
                                  if (!playerId) { toast("Player " + username + " not found in roster", "error"); return; }
                                  supabase.from("game_results").insert({
                                    tournament_id: t.dbId,
                                    round_number: currentRound,
                                    game_number: currentRound,
                                    player_id: playerId,
                                    placement: placement,
                                    points: pts
                                  }).then(function(res) {
                                    if (res.error) toast("Failed to save: " + res.error.message, "error");
                                    else toast(username + " placed " + placement + (placement === 1 ? "st" : placement === 2 ? "nd" : placement === 3 ? "rd" : "th") + " (" + pts + "pts)", "success");
                                  }).catch(function() { toast("Failed to save result", "error"); });
                                } else {
                                  toast(username + " placed " + placement + (placement === 1 ? "st" : placement === 2 ? "nd" : placement === 3 ? "rd" : "th") + " (" + pts + "pts)", "success");
                                }
                              }} className="w-28">
                                <option value="">Place</option>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(function(p) {
                                  return <option key={p} value={p}>{p}{p === 1 ? "st" : p === 2 ? "nd" : p === 3 ? "rd" : "th"} ({({ 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 })[p]}pts)</option>;
                                })}
                              </Sel>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-3 pt-2">
                        <Btn
                          variant="primary"
                          size="sm"
                          onClick={function() {
                            if (currentRound < roundCount) {
                              updateTournamentAndFeatured(t.id, { currentRound: currentRound + 1 });
                              toast("Advanced to Round " + (currentRound + 1), "success");
                            } else {
                              var champ = prompt("Enter champion name:");
                              if (champ && champ.trim()) {
                                updateTournamentAndFeatured(t.id, { status: "complete", champion: champ.trim(), top4: [champ.trim()] });
                                toast("Tournament completed! Champion: " + champ.trim(), "success");
                              }
                            }
                          }}
                        >
                          {currentRound < roundCount ? "Advance to Round " + (currentRound + 1) : "Finalize Tournament"}
                        </Btn>
                        <Btn
                          variant="secondary"
                          size="sm"
                          onClick={function() { setScreen("tournament-host-" + t.id); }}
                        >
                          View Public Page
                        </Btn>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Registrations tab */}
        {tab === "registrations" && (
          <div className="space-y-5">
            <h2 className="font-editorial text-2xl text-on-background border-b border-outline-variant/10 pb-4">Player Registrations</h2>
            {tournaments.filter(function(t) { return t.status !== "complete"; }).map(function(t) {
              var matchingEvent = (featuredEvents || []).find(function(ev) { return ev.hostTournamentId === t.id; });
              var regIds = matchingEvent ? (matchingEvent.registeredIds || []) : [];
              return (
                <div key={t.id} className="bg-surface-container-low p-5 rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="font-editorial text-base text-on-surface flex-1">{t.name}</h3>
                    <span className={"px-2 py-0.5 font-label text-[10px] uppercase tracking-tighter rounded " + (t.status === "live" ? "bg-tertiary-container/10 text-tertiary" : "bg-primary/10 text-primary")}>
                      {regIds.length + "/" + t.size}
                    </span>
                  </div>
                  {regIds.length === 0 && (
                    <div className="text-center py-8">
                      <Icon name="person_add" size={36} className="mx-auto text-on-surface/20 block mb-3" aria-hidden="true" />
                      <p className="text-on-surface/50 text-sm">No players registered yet.</p>
                    </div>
                  )}
                  <div className="space-y-1">
                    {regIds.map(function(username, i) {
                      return (
                        <div key={username} className="flex items-center gap-3 py-2.5 border-b border-outline-variant/5 last:border-0">
                          <span className="text-xs font-mono text-slate-500 w-5">{i + 1}</span>
                          <span className="flex-1 text-sm font-mono text-on-surface">{username}</span>
                          <span className="px-2 py-0.5 bg-tertiary-container/10 text-tertiary font-label text-[10px] uppercase tracking-tighter rounded">Registered</span>
                          <button
                            onClick={function() {
                              if (confirm("Remove " + username + "?")) {
                                if (setFeaturedEvents) {
                                  setFeaturedEvents(function(evts) {
                                    return evts.map(function(ev) {
                                      if (ev.hostTournamentId !== t.id) return ev;
                                      return Object.assign({}, ev, {
                                        registeredIds: (ev.registeredIds || []).filter(function(u) { return u !== username; }),
                                        registered: Math.max(0, (ev.registered || 0) - 1)
                                      });
                                    });
                                  });
                                }
                                toast(username + " removed", "info");
                              }
                            }}
                            className="text-xs font-label uppercase text-error/70 hover:text-error transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Templates tab */}
        {tab === "templates" && (
          <TemplatesTab toast={toast} />
        )}

        {/* Embed tab */}
        {tab === "embed" && (
          <EmbedTab brandName={brandName} toast={toast} />
        )}

        {/* Command Center tab */}
        {tab === "commandcenter" && (
          <div className="flex flex-col gap-4 lg:flex-row lg:gap-4 lg:items-start">

            {/* Left column - event list + live stats */}
            <div className="w-full lg:w-48 flex-shrink-0 flex flex-col gap-3">
              <div className="bg-surface-container rounded-xl border border-on-surface/10 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-on-surface/8">
                  <span className="cond text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface/40">Your Events</span>
                  {tournaments.some(function(e) { return e.status === 'live' }) && (
                    <span className="cond text-[8px] font-bold uppercase text-red-400 px-1.5 py-0.5 bg-red-400/10 rounded">Live</span>
                  )}
                </div>
                <div className="p-2 flex flex-col gap-1">
                  {tournaments.length === 0 && (
                    <div className="text-[11px] text-on-surface/30 text-center py-4">No events yet</div>
                  )}
                  {tournaments.map(function(ev) {
                    var isActive = ev.id === selectedEventId
                    return (
                      <div
                        key={ev.id}
                        onClick={function() {
                          setSelectedEventId(ev.id)
                          setPendingPlacements({})
                          setSelectedPlayer(null)
                          setPlacementStack([])
                          setActiveRound(1)
                        }}
                        className={'rounded-lg p-2 cursor-pointer border transition-colors ' +
                          (isActive ? 'bg-primary/8 border-primary/25' : 'bg-white/[0.02] border-on-surface/8 hover:border-on-surface/15')}
                      >
                        <div className={'text-xs font-bold ' + (isActive ? 'text-primary' : 'text-on-surface/70')}>{ev.name}</div>
                        <div className="text-[10px] text-on-surface/35 mt-0.5">{isActive ? (activeRoundLobbyPlayers.length + ' registered') : (ev.registered || ev.players || 0) + ' registered'}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-surface-container rounded-xl border border-on-surface/10 overflow-hidden">
                <div className="px-3 py-2 border-b border-on-surface/8">
                  <span className="cond text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface/40">Live Stats</span>
                </div>
                <div className="p-3 flex flex-col gap-2">
                  {[
                    ['Players', activeRoundLobbyPlayers.length + ' / ' + (activeEvent ? (activeEvent.size || activeEvent.max_players || activeRoundLobbyPlayers.length) : 0), 'text-primary'],
                    ['Round', activeRound + ' / ' + totalRounds, 'text-secondary'],
                    ['Lobbies', Math.max(1, Math.ceil(activeRoundLobbyPlayers.length / 8)) + ' active', 'text-on-surface/50'],
                    ['Rounds done', lockedLobbies.length + ' / ' + totalRounds, 'text-tertiary'],
                  ].map(function(row) {
                    return (
                      <div key={row[0]} className="flex items-center justify-between">
                        <span className="text-[10px] text-on-surface/35">{row[0]}</span>
                        <span className={'cond text-[10px] font-bold ' + row[2]}>{row[1]}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Center column - round control + standings */}
            <div className="flex-1 flex flex-col gap-3">
              {activeEvent ? (
                <RoundControl
                  players={activeRoundLobbyPlayers}
                  round={activeRound}
                  totalRounds={totalRounds}
                  pendingPlacements={pendingPlacements}
                  selectedPlayer={selectedPlayer}
                  placementStack={placementStack}
                  onSelect={function(p) { setSelectedPlayer(p) }}
                  onPlace={function(rank) {
                    if (selectedPlayer) {
                      var existing = pendingPlacements[rank]
                      if (existing) {
                        setPendingPlacements(function(prev) {
                          var next = Object.assign({}, prev)
                          delete next[rank]
                          return next
                        })
                        setPlacementStack(function(s) { return s.filter(function(item) { return item.rank !== rank }) })
                      } else {
                        setPendingPlacements(function(prev) { return Object.assign({}, prev, { [rank]: selectedPlayer.id }) })
                        setPlacementStack(function(s) { return s.concat([{ rank: rank, playerId: selectedPlayer.id }]) })
                        setSelectedPlayer(null)
                      }
                    } else {
                      var pid = pendingPlacements[rank]
                      if (pid) {
                        setPendingPlacements(function(prev) {
                          var next = Object.assign({}, prev)
                          delete next[rank]
                          return next
                        })
                        setPlacementStack(function(s) { return s.filter(function(item) { return item.rank !== rank }) })
                      }
                    }
                  }}
                  onUndo={function() {
                    if (placementStack.length === 0) return
                    var last = placementStack[placementStack.length - 1]
                    setPendingPlacements(function(prev) {
                      var next = Object.assign({}, prev)
                      delete next[last.rank]
                      return next
                    })
                    setPlacementStack(function(s) { return s.slice(0, s.length - 1) })
                  }}
                  onConfirm={function() {
                    setTournamentState(Object.assign({}, tournamentState, {
                      lockedLobbies: (tournamentState.lockedLobbies || []).concat([{ round: activeRound, placements: pendingPlacements }])
                    }))
                    if (activeRound < totalRounds) { setActiveRound(activeRound + 1) }
                    setPendingPlacements({})
                    setPlacementStack([])
                    setSelectedPlayer(null)
                    toast('Round ' + activeRound + ' confirmed!', 'success')
                  }}
                  onSaveDraft={function() {
                    localStorage.setItem('tft-round-draft-' + (selectedEventId || 'default'), JSON.stringify(pendingPlacements))
                    toast('Draft saved', 'success')
                  }}
                />
              ) : (
                <div className="bg-surface-container rounded-xl border border-on-surface/10 p-8 text-center">
                  <Icon name="sports_esports" size={32} className="text-primary/30 mb-3" />
                  <div className="text-sm text-on-surface/40 font-semibold">No event selected</div>
                  <div className="text-xs text-on-surface/25 mt-1">Create an event first to use round control</div>
                </div>
              )}

              {/* Live Standings */}
              {activeEvent && (
                <div className="bg-surface-container rounded-xl border border-on-surface/10 overflow-hidden">
                  <div className="px-3 py-2 border-b border-on-surface/8 flex items-center justify-between">
                    <span className="cond text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface/40">Live Standings</span>
                    <span className="text-[9px] text-on-surface/20">Updates after confirm</span>
                  </div>
                  <div className="p-3 flex flex-col gap-1">
                    {lockedLobbies.length === 0 && (
                      <div className="text-[10px] text-on-surface/25 text-center py-2">Waiting for round 1...</div>
                    )}
                    {liveStandings.slice(0, 5).map(function(p, i) {
                      return (
                        <div key={p.id} className="flex items-center gap-2.5 py-1.5">
                          <span className="cond text-xs font-bold w-5 text-center text-on-surface/40">{'#' + (i+1)}</span>
                          <span className="flex-1 text-xs text-on-surface/70">{p.name || p.username}</span>
                          <span className="font-mono text-xs font-bold text-on-surface/50">{p.ccPts} pts</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right column - players + activity */}
            <div className="w-full lg:w-44 flex-shrink-0 flex flex-col gap-3">
              <div className="bg-surface-container rounded-xl border border-on-surface/10 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-on-surface/8">
                  <span className="cond text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface/40">Players</span>
                  <span className="cond text-[8px] font-bold text-secondary">{activeRoundLobbyPlayers.length}/{activeEvent ? (activeEvent.size || activeEvent.max_players || 8) : 8}</span>
                </div>
                <div className="p-2 flex flex-col">
                  {activeRoundLobbyPlayers.map(function(p) {
                    return (
                      <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-on-surface/[0.04] last:border-0">
                        <div className="w-4 h-4 rounded-full bg-secondary/20 border border-secondary/30 flex-shrink-0"></div>
                        <span className="flex-1 text-[10px] text-on-surface/70">{p.name}</span>
                        <span className="cond text-[8px] font-bold uppercase text-secondary/70 bg-secondary/8 px-1.5 rounded">In</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-surface-container rounded-xl border border-on-surface/10 overflow-hidden">
                <div className="px-3 py-2 border-b border-on-surface/8">
                  <span className="cond text-[8px] font-bold uppercase tracking-[0.12em] text-on-surface/40">Activity</span>
                </div>
                <div className="p-3 flex flex-col gap-2">
                  {activityItems.map(function(item, i) {
                    return (
                      <div key={item.label} className="flex gap-2 items-start">
                        <div className={'w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ' + item.dot}></div>
                        <div className="flex-1 text-[9px] text-on-surface/40 leading-relaxed">{item.label}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Secondary nav for sub-sections */}
        {tab !== "overview" && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-outline-variant/10">
            {[
              ["commandcenter", "Round Control", "tune"],
              ["announce", "Announce", "campaign"],
              ["branding", "Branding", "palette"],
              ["game-flow", "Game Flow", "shuffle"],
              ["registrations", "Players", "group"],
              ["templates", "Templates", "bookmark"],
              ["embed", "Embed", "code"]
            ].map(function(arr) {
              return (
                <PillTab
                  key={arr[0]}
                  icon={arr[2]}
                  active={tab === arr[0]}
                  onClick={function() { setTab(arr[0]); }}
                >
                  {arr[1]}
                </PillTab>
              );
            })}
            <PillTab
              icon="arrow_back"
              active={false}
              onClick={function() { setTab("overview"); navigate("/host/dashboard"); }}
            >
              Back to Overview
            </PillTab>
          </div>
        )}

        {/* Footer */}
        <footer className="pt-8 mt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] font-label uppercase tracking-[0.3em] text-slate-500">
            TFT Clash Engine | Host Dashboard | System Status: Optimal
          </p>
          <div className="flex gap-8">
            <button onClick={function() { setTab("announce"); }} className="text-[10px] font-label uppercase tracking-widest text-slate-400 hover:text-primary transition-colors">Announce</button>
            <button onClick={function() { setTab("branding"); }} className="text-[10px] font-label uppercase tracking-widest text-slate-400 hover:text-primary transition-colors">Branding</button>
            <button onClick={function() { setTab("game-flow"); }} className="text-[10px] font-label uppercase tracking-widest text-slate-400 hover:text-primary transition-colors">Game Flow</button>
            <button onClick={function() { navigate("/bracket"); }} className="text-[10px] font-label uppercase tracking-widest text-slate-400 hover:text-primary transition-colors">View Bracket</button>
          </div>
        </footer>

      </div>
    </PageLayout>
  );
}

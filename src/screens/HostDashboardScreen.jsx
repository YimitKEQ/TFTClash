import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Btn, Inp, Icon, Tag, Divider, PillTab } from '../components/ui'
import { Sel, Bar, StatusPill, ACCENT_COLORS, WIZ_STEPS } from './host-dashboard/HostComponents'
import { readTemplates, saveTemplate, deleteTemplate } from '../lib/tournamentTemplates.js'

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// Map DB phase + archived_at to the local status taxonomy used by the host UI.
function phaseToStatus(phase, archivedAt) {
  if (archivedAt) return 'archived';
  if (phase === 'complete') return 'complete';
  if (phase === 'in_progress') return 'live';
  if (phase === 'check_in') return 'live';
  if (phase === 'registration') return 'upcoming';
  return 'upcoming'; // draft, null, etc.
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
  var tournamentsJson = origin + '/api/public-tournaments?status=upcoming' + (slug ? '&host=' + encodeURIComponent(slug) : '')
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
  // Wrapped: localStorage can throw in private browsing or when storage is full.
  var _list = useState(function() { try { return readTemplates() } catch (e) { return [] } })
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
  var hostTournaments = ctx.hostTournaments;
  var setHostTournaments = ctx.setHostTournaments;
  var hostBranding = ctx.hostBranding;
  var setHostBranding = ctx.setHostBranding;
  var hostAnnouncements = ctx.hostAnnouncements;
  var setHostAnnouncements = ctx.setHostAnnouncements;
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

  // Load host tournaments from DB. DB is the only source of truth - replace local state on every load.
  useEffect(function() {
    if (!currentUser || !supabase.from || !currentUser.auth_user_id) return;
    var aid = currentUser.auth_user_id;
    if (typeof aid !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(aid)) return;
    supabase.from("tournaments")
      .select("id, name, date, max_players, host_id, phase, type, archived_at, champion, invite_only, entry_fee, rules_text, region, branding_json, max_rounds, round_count, format")
      .eq("host_id", aid)
      .neq("type", "season_clash")
      .order("date", { ascending: false })
      .then(function(res) {
        if (res.error) { return; }
        var rows = res.data || [];
        // Fetch registration counts in one round-trip
        var ids = rows.map(function(r) { return r.id; });
        var fetchCounts = ids.length === 0
          ? Promise.resolve({ data: [] })
          : supabase.from('registrations').select('tournament_id, status').in('tournament_id', ids);
        fetchCounts.then(function(rRes) {
          var counts = {};
          ((rRes && rRes.data) || []).forEach(function(r) {
            if (!counts[r.tournament_id]) counts[r.tournament_id] = 0;
            if (r.status === 'registered' || r.status === 'checked_in') counts[r.tournament_id]++;
          });
          var mapped = rows.map(function(dbT) {
            return {
              id: dbT.id,
              dbId: dbT.id,
              name: dbT.name,
              date: dbT.date,
              size: dbT.max_players || 32,
              invite: !!dbT.invite_only,
              entryFee: dbT.entry_fee || "",
              rules: dbT.rules_text || "",
              phase: dbT.phase,
              status: phaseToStatus(dbT.phase, dbT.archived_at),
              archived_at: dbT.archived_at || null,
              registered: counts[dbT.id] || 0,
              type: dbT.type,
              champion: dbT.champion || null,
              region: dbT.region || 'EU',
              totalGames: dbT.max_rounds || dbT.round_count || 4
            };
          });
          if (setHostTournaments) setHostTournaments(mapped);
        }).catch(function() {});
      }).catch(function() {});
  }, [currentUser ? currentUser.auth_user_id : null]);

  function uploadImage(file, type) {
    if (!file || !supabase.storage) return;
    if (!/^image\//.test(file.type || "")) { toast("Please select an image file", "error"); return; }
    if (file.size > 5 * 1024 * 1024) { toast("Image must be under 5MB", "error"); return; }
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


  function exportTournamentCSV(tournament) {
    var tournId = tournament.dbId || tournament.id;
    if (!tournId) {
      toast('No database ID for this tournament', 'error');
      return;
    }
    supabase
      .from('game_results')
      .select('round_number, game_number, lobby_id, player_id, placement, points, lobbies(lobby_number)')
      .eq('tournament_id', tournId)
      .order('round_number', { ascending: true })
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
        var header = 'Player,Round,Lobby,Placement,Points';
        var lines = rows.map(function(r) {
          var player = (players || []).find(function(p) { return p.id === r.player_id; });
          var playerName = player ? (player.username || player.name || ('Player ' + r.player_id)) : ('Player ' + r.player_id);
          var lobbyNum = (r.lobbies && r.lobbies.lobby_number) || 1;
          var lobbyLetter = String.fromCharCode(64 + lobbyNum);
          var pts = (r.points != null) ? r.points : 0;
          return [playerName, r.round_number, lobbyLetter, r.placement, pts].join(',');
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
    if (!currentUser || !currentUser.auth_user_id) { toast("Sign in required", "error"); return; }
    if (!supabase || !supabase.from) { toast("Database unavailable", "error"); return; }
    setWizCreating(true);
    var savedWizData = Object.assign({}, wizData);
    supabase.from("tournaments").insert({
      name: savedWizData.name,
      date: savedWizData.date,
      type: "flash_tournament",
      format: savedWizData.type,
      round_count: savedWizData.totalGames,
      max_rounds: savedWizData.totalGames,
      max_players: savedWizData.maxPlayers,
      phase: "draft",
      host_id: currentUser.auth_user_id,
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
      if (!res || !res.data) {
        toast("Tournament created but no ID returned", "error");
        return;
      }
      var dbT = res.data;
      var newT = {
        id: dbT.id,
        dbId: dbT.id,
        name: dbT.name,
        date: dbT.date,
        size: dbT.max_players || savedWizData.maxPlayers,
        invite: !!dbT.invite_only,
        entryFee: dbT.entry_fee || "",
        rules: dbT.rules_text || "",
        phase: dbT.phase,
        status: phaseToStatus(dbT.phase, dbT.archived_at),
        registered: 0,
        archived_at: dbT.archived_at || null,
        type: dbT.type
      };
      setTournaments(function(ts) { return ts.concat([newT]); });
      setShowCreate(false);
      setWizStep(0);
      setWizData({ name: "", date: "", type: "swiss", totalGames: 4, maxPlayers: 32, accentColor: "#ffc66b", entryFee: "", inviteOnly: false, rules: "", region: "EU" });
      toast("Tournament created!", "success");
      // Brief delay so the row is replicated to read replicas before FlashTournamentScreen
      // mounts and queries it. Without this the manage page can flash 'Tournament Not Found'.
      setTimeout(function() { navigate("/tournament/" + dbT.id); }, 350);
    }).catch(function(err) {
      setWizCreating(false);
      toast("Failed to create tournament: " + (err && err.message ? err.message : 'unknown'), "error");
    });
  }

  function saveBranding() {
    if (!supabase.from || !currentUser) { toast("Sign in required", "error"); return; }
    // Cap inputs so a misclick or a bad paste cannot bloat the row.
    var capped = {
      name: String(brandName || "").slice(0, 80),
      logo: brandLogo,
      color: String(brandColor || "").slice(0, 20),
      bio: String(brandBio || "").slice(0, 1000),
      logoUrl: String(brandLogoUrl || "").slice(0, 500),
      bannerUrl: String(brandBannerUrl || "").slice(0, 500)
    };
    supabase.from("host_profiles").update({
      org_name: capped.name,
      brand_color: capped.color,
      bio: capped.bio,
      logo_url: capped.logoUrl || capped.logo,
      banner_url: capped.bannerUrl
    }).eq("user_id", currentUser.auth_user_id).then(function(res) {
      if (res && res.error) { toast("Save failed: " + res.error.message, "error"); return; }
      if (setHostBranding) setHostBranding(capped);
      setBrandSaved(true);
      toast("Branding saved!", "success");
      setTimeout(function() { setBrandSaved(false); }, 3000);
    }).catch(function(err) {
      toast("Save failed: " + (err && err.message ? err.message : "unknown"), "error");
    });
  }

  function sendAnnouncement() {
    if (!announceMsg.trim()) { toast("Write a message first", "error"); return; }
    if (!supabase || !supabase.rpc) { toast("Notifications unavailable", "error"); return; }
    var msg = announceMsg.trim().slice(0, 500);
    // Resolve target tournaments. "all" = every host tournament with registrations;
    // otherwise = the single tournament whose name matches the dropdown value.
    var targetTournaments = announceTo === "all"
      ? tournaments.filter(function(t) { return t.dbId && (t.registered || 0) > 0; })
      : tournaments.filter(function(t) { return t.dbId && t.name === announceTo; });
    if (targetTournaments.length === 0) {
      toast(announceTo === "all" ? "No tournaments with registered players yet" : "Tournament not found", "error");
      return;
    }
    var calls = targetTournaments.map(function(t) {
      return supabase.rpc('notify_tournament_players', {
        p_tournament_id: t.dbId,
        p_title: t.name + ' - Announcement',
        p_body: msg,
        p_icon: 'campaign'
      });
    });
    Promise.all(calls).then(function(results) {
      var totalNotified = results.reduce(function(s, r) { return s + (r && typeof r.data === 'number' ? r.data : 0); }, 0);
      var anyError = results.find(function(r) { return r && r.error; });
      if (anyError) { toast("Send failed: " + anyError.error.message, "error"); return; }
      var a = { id: Date.now(), to: announceTo, msg: msg, sentAt: new Date().toLocaleString(), notified: totalNotified };
      var newArr = [a].concat(announcements);
      setAnnouncements(function() { return newArr; });
      if (setHostAnnouncements) setHostAnnouncements(newArr);
      setAnnounceMsg("");
      toast("Announcement sent to " + totalNotified + " player" + (totalNotified === 1 ? "" : "s"), "success");
    }).catch(function(err) {
      toast("Send failed: " + (err && err.message ? err.message : "unknown"), "error");
    });
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
                    {/* Publish: draft -> registration */}
                    {t.phase === 'draft' && t.dbId && (
                      <button
                        className="px-4 py-2 bg-secondary/10 text-secondary text-xs font-label font-bold uppercase tracking-wider rounded-full hover:bg-secondary/20 transition-colors disabled:opacity-50"
                        onClick={function() {
                          supabase.from('tournaments')
                            .update({ phase: 'registration', registration_open_at: new Date().toISOString() })
                            .eq('id', t.dbId)
                            .then(function(r) {
                              if (r.error) { toast('Publish failed: ' + r.error.message, 'error'); return; }
                              setTournaments(function(ts) { return ts.map(function(x) { return x.id === t.id ? Object.assign({}, x, { phase: 'registration', status: 'upcoming' }) : x; }); });
                              toast('Registration opened!', 'success');
                            });
                        }}
                      >
                        Publish
                      </button>
                    )}
                    {/* Open check-in: registration -> check_in */}
                    {t.phase === 'registration' && t.dbId && (
                      <button
                        className="px-4 py-2 bg-secondary/10 text-secondary text-xs font-label font-bold uppercase tracking-wider rounded-full hover:bg-secondary/20 transition-colors"
                        onClick={function() {
                          supabase.from('tournaments')
                            .update({ phase: 'check_in', checkin_open_at: new Date().toISOString() })
                            .eq('id', t.dbId)
                            .then(function(r) {
                              if (r.error) { toast('Open check-in failed: ' + r.error.message, 'error'); return; }
                              setTournaments(function(ts) { return ts.map(function(x) { return x.id === t.id ? Object.assign({}, x, { phase: 'check_in', status: 'live' }) : x; }); });
                              toast('Check-in opened!', 'success');
                            });
                        }}
                      >
                        Open Check-In
                      </button>
                    )}
                    {/* Manage: links into FlashTournamentScreen for full live management */}
                    {t.dbId && t.phase !== 'complete' && (
                      <button
                        className="px-4 py-2 bg-primary text-on-primary text-xs font-label font-bold uppercase tracking-wider rounded-full hover:brightness-110 transition-all"
                        onClick={function() { navigate('/tournament/' + t.dbId); }}
                      >
                        Manage
                      </button>
                    )}
                    {t.dbId && t.phase === 'complete' && (
                      <button
                        className="px-4 py-2 bg-surface-container-high text-on-surface text-xs font-label font-bold uppercase tracking-wider rounded-full hover:bg-surface-container-high/80 transition-colors"
                        onClick={function() { navigate('/tournament/' + t.dbId); }}
                      >
                        View
                      </button>
                    )}
                    {t.phase === 'complete' && (
                      <button
                        onClick={function() { exportTournamentCSV(t); }}
                        className="flex items-center gap-1 text-[10px] cond font-bold uppercase tracking-wide text-secondary hover:text-secondary/80 transition-colors bg-transparent border-0 cursor-pointer p-0"
                        title="Export results CSV"
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
                        var stillLive = t.phase !== 'complete' && t.phase !== 'cancelled';
                        var confirmMsg = stillLive
                          ? "This tournament is still live (" + (t.phase || 'in progress') + "). Deleting will force it to complete and players watching will see it end immediately. Proceed?"
                          : "Archive this tournament? Registrations and results are preserved.";
                        if (!confirm(confirmMsg)) return;
                        if (!t.dbId) {
                          setTournaments(function(ts) { return ts.filter(function(x) { return x.id !== t.id; }); });
                          toast("Tournament removed", "info");
                          return;
                        }
                        var nowIso = new Date().toISOString();
                        var patch = stillLive ? { phase: 'complete', archived_at: nowIso } : { archived_at: nowIso };
                        supabase.from('tournaments')
                          .update(patch)
                          .eq('id', t.dbId)
                          .eq('host_id', currentUser ? currentUser.auth_user_id : null)
                          .then(function(r) {
                            if (r.error) { toast("Delete failed: " + r.error.message, "error"); return; }
                            setTournaments(function(ts) { return ts.filter(function(x) { return x.id !== t.id; }); });
                            toast(stillLive ? "Tournament archived (forced complete)" : "Tournament archived", "info");
                          })
                          .catch(function(err) { toast("Delete failed: " + (err && err.message ? err.message : 'unknown'), "error"); });
                      }}
                    >
                      <Icon name="delete" size={18} aria-hidden="true" />
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

        {/* Templates tab */}
        {tab === "templates" && (
          <TemplatesTab toast={toast} />
        )}

        {/* Embed tab */}
        {tab === "embed" && (
          <EmbedTab brandName={brandName} toast={toast} />
        )}

        {/* Secondary nav for sub-sections */}
        {tab !== "overview" && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-outline-variant/10">
            {[
              ["announce", "Announce", "campaign"],
              ["branding", "Branding", "palette"],
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
            TFT Clash | Host Dashboard
          </p>
          <div className="flex gap-8">
            <button onClick={function() { setTab("announce"); }} className="text-[10px] font-label uppercase tracking-widest text-slate-400 hover:text-primary transition-colors">Announce</button>
            <button onClick={function() { setTab("branding"); }} className="text-[10px] font-label uppercase tracking-widest text-slate-400 hover:text-primary transition-colors">Branding</button>
            <button onClick={function() { setTab("templates"); }} className="text-[10px] font-label uppercase tracking-widest text-slate-400 hover:text-primary transition-colors">Templates</button>
            <button onClick={function() { setTab("embed"); }} className="text-[10px] font-label uppercase tracking-widest text-slate-400 hover:text-primary transition-colors">Embed</button>
          </div>
        </footer>

      </div>
    </PageLayout>
  );
}

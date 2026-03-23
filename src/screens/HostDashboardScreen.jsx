import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Btn, Inp, Tag } from '../components/ui'

// ─── Inline select ────────────────────────────────────────────────────────────
function Sel({ value, onChange, children, style }) {
  return (
    <select
      className="bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-on-surface text-sm w-full"
      value={value}
      onChange={function(e) { onChange(e.target.value); }}
      style={style || {}}
    >
      {children}
    </select>
  );
}

// ─── Inline progress bar ──────────────────────────────────────────────────────
function Bar({ val, max, color, h }) {
  var pct = max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0;
  var height = h || 6;
  return (
    <div style={{ height: height, background: 'rgba(255,255,255,.06)', borderRadius: height, overflow: 'hidden' }}>
      <div style={{ width: pct + '%', height: '100%', background: color || '#9B72CF', borderRadius: height, transition: 'width .4s' }} />
    </div>
  );
}

var ICON_REMAP = {"controller":"device-gamepad-2","megaphone-fill":"speakerphone","palette":"palette","chart-bar":"chart-bar","diagram-3-fill":"tournament","star-fill":"star","lock-fill":"lock","tag-fill":"tag","calendar-event-fill":"calendar-event","people-fill":"users","trophy":"trophy","alert-triangle":"alert-triangle","trending-up":"trending-up","clipboard":"clipboard"};

function tiIcon(name) {
  var mapped = ICON_REMAP[name] || name;
  return <i className={"ti ti-" + mapped} />;
}

var TABS = [
  ["overview", "Overview"],
  ["tournaments", "Tournaments"],
  ["analytics", "Analytics"],
  ["game-flow", "Game Flow"],
  ["registrations", "Players"],
  ["announce", "Announce"],
  ["branding", "Branding"]
];

// ─── HostDashboardScreen ──────────────────────────────────────────────────────
export default function HostDashboardScreen() {
  var ctx = useApp();
  var currentUser = ctx.currentUser;
  var players = ctx.players;
  var toast = ctx.toast;
  var setScreen = ctx.setScreen;
  var hostApps = ctx.hostApps;
  var hostTournaments = ctx.hostTournaments;
  var setHostTournaments = ctx.setHostTournaments;
  var hostBranding = ctx.hostBranding;
  var setHostBranding = ctx.setHostBranding;
  var hostAnnouncements = ctx.hostAnnouncements;
  var setHostAnnouncements = ctx.setHostAnnouncements;
  var featuredEvents = ctx.featuredEvents;
  var setFeaturedEvents = ctx.setFeaturedEvents;
  var navigate = useNavigate();

  var [tab, setTab] = useState("overview");
  var [showCreate, setShowCreate] = useState(false);
  var [tName, setTName] = useState("");
  var [tDate, setTDate] = useState("");
  var [tSize, setTSize] = useState("32");
  var [tInvite, setTInvite] = useState(false);
  var [tEntryFee, setTEntryFee] = useState("");
  var [tRules, setTRules] = useState("");

  var tournaments = hostTournaments || [];
  var setTournaments = setHostTournaments || function() {};

  var [brandName, setBrandName] = useState((hostBranding && hostBranding.name) || (currentUser && currentUser.username) || "My Org");
  var [brandLogo, setBrandLogo] = useState((hostBranding && hostBranding.logo) || "controller");
  var [brandColor, setBrandColor] = useState((hostBranding && hostBranding.color) || "#9B72CF");
  var [brandBio, setBrandBio] = useState((hostBranding && hostBranding.bio) || "");
  var [brandLogoUrl, setBrandLogoUrl] = useState((hostBranding && hostBranding.logoUrl) || "");
  var [brandBannerUrl, setBrandBannerUrl] = useState((hostBranding && hostBranding.bannerUrl) || "");

  var [wizStep, setWizStep] = useState(0);
  var [wizData, setWizData] = useState({ name: "", date: "", type: "swiss", totalGames: 4, maxPlayers: 32, accentColor: "#9B72CF", entryFee: "", inviteOnly: false, rules: "" });
  var [wizCreating, setWizCreating] = useState(false);

  var [uploadingLogo, setUploadingLogo] = useState(false);
  var [uploadingBanner, setUploadingBanner] = useState(false);
  var [dbProfileLoaded, setDbProfileLoaded] = useState(false);
  var [brandSaved, setBrandSaved] = useState(false);
  var [announceMsg, setAnnounceMsg] = useState("");
  var [announceTo, setAnnounceTo] = useState("all");
  var [announcements, setAnnouncements] = useState(hostAnnouncements || []);
  var [selectedT, setSelectedT] = useState(null);

  // Load host profile from DB on mount
  useEffect(function() {
    if (!currentUser || !supabase.from || dbProfileLoaded) return;
    supabase.from("host_profiles").select("*").eq("user_id", currentUser.id).single().then(function(res) {
      if (res.data) {
        var hp = res.data;
        setBrandName(hp.org_name || brandName);
        setBrandColor(hp.brand_color || brandColor);
        setBrandBio(hp.bio || "");
        if (hp.logo_url) setBrandLogoUrl(hp.logo_url);
        if (hp.banner_url) setBrandBannerUrl(hp.banner_url);
        setDbProfileLoaded(true);
      }
    });
  }, [currentUser]);

  // Load host tournaments from DB for analytics
  useEffect(function() {
    if (!currentUser || !supabase.from) return;
    supabase.from("tournaments").select("id, name, date, max_players, host_id")
      .eq("host_id", currentUser.id)
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
      });
  }, [currentUser && currentUser.id]);

  function uploadImage(file, type) {
    if (!file || !supabase.storage) return;
    var setUploading = type === "logo" ? setUploadingLogo : setUploadingBanner;
    var setUrl = type === "logo" ? setBrandLogoUrl : setBrandBannerUrl;
    setUploading(true);
    var path = "host-images/" + (currentUser ? currentUser.id : "anon") + "/" + type + "-" + Date.now() + "-" + file.name;
    supabase.storage.from("host-assets").upload(path, file, { cacheControl: "3600", upsert: true }).then(function(res) {
      setUploading(false);
      if (res.error) { toast("Upload failed: " + res.error.message, "error"); return; }
      var url = supabase.storage.from("host-assets").getPublicUrl(path).data.publicUrl;
      setUrl(url);
      toast((type === "logo" ? "Logo" : "Banner") + " uploaded!", "success");
    });
  }

  function handleLogoUpload(file) {
    if (!file || !supabase.storage) return;
    var path = "host-logos/" + (currentUser ? currentUser.id : "anon") + "/" + file.name;
    return supabase.storage.from("host-assets").upload(path, file, { upsert: true }).then(function(res) {
      if (!res.error) {
        var url = supabase.storage.from("host-assets").getPublicUrl(path).data.publicUrl;
        setBrandLogoUrl(url);
        return supabase.from("host_profiles").update({ logo_url: url }).eq("user_id", currentUser ? currentUser.id : "");
      } else {
        toast("Logo upload failed: " + res.error.message, "error");
      }
    });
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
          region: "",
          description: wizData.rules || "Tournament hosted by " + brandName,
          tags: wizData.inviteOnly ? ["Invite Only"] : ["Open"],
          logo: brandLogo,
          screen: "tournament-host-" + newT.id,
          hostTournamentId: newT.id
        }]);
      });
    }
    if (supabase.from) {
      supabase.from("tournaments").insert({
        name: wizData.name,
        date: wizData.date,
        type: wizData.type,
        total_games: wizData.totalGames,
        max_players: wizData.maxPlayers,
        host_id: currentUser ? currentUser.id : null,
        branding_json: { accent_color: wizData.accentColor }
      }).select().single().then(function(res) {
        setWizCreating(false);
        if (res && res.error) { console.error("[TFT] wizard tournament create failed:", res.error); }
        else if (res && res.data) {
          var dbId = res.data.id;
          setTournaments(function(ts) { return ts.map(function(t) { return t.name === wizData.name && !t.dbId ? Object.assign({}, t, { dbId: dbId }) : t; }); });
          if (setFeaturedEvents) {
            setFeaturedEvents(function(evts) { return evts.map(function(ev) { return ev.name === wizData.name && !ev.dbTournamentId ? Object.assign({}, ev, { dbTournamentId: dbId }) : ev; }); });
          }
        }
      });
    } else {
      setWizCreating(false);
    }
    setShowCreate(false);
    setWizStep(0);
    setWizData({ name: "", date: "", type: "swiss", totalGames: 4, maxPlayers: 32, accentColor: "#9B72CF", entryFee: "", inviteOnly: false, rules: "" });
    toast(wizData.entryFee ? "Tournament created - pending admin approval" : "Tournament created!", "success");
  }

  function createTournament() {
    if (!tName.trim() || !tDate.trim()) { toast("Name and date required", "error"); return; }
    var newT = {
      id: Date.now(),
      name: tName,
      date: tDate,
      size: parseInt(tSize),
      invite: tInvite,
      entryFee: tEntryFee,
      rules: tRules,
      status: tEntryFee ? "pending_approval" : "upcoming",
      registered: 0,
      approved: !tEntryFee
    };
    setTournaments(function(ts) { return ts.concat([newT]); });
    if (setFeaturedEvents) {
      setFeaturedEvents(function(evts) {
        return evts.concat([{
          id: "host-" + newT.id,
          name: tName,
          host: brandName,
          sponsor: null,
          status: "upcoming",
          date: tDate,
          time: "TBD",
          format: "Swiss",
          size: parseInt(tSize),
          registered: 0,
          registeredIds: [],
          prizePool: null,
          region: "",
          description: tRules || "Host tournament by " + brandName,
          tags: tInvite ? ["Invite Only"] : ["Open"],
          logo: brandLogo,
          screen: "tournament-host-" + newT.id,
          hostTournamentId: newT.id
        }]);
      });
    }
    if (supabase.from) {
      supabase.from("host_profiles").select("id").eq("user_id", currentUser ? currentUser.id : "").single()
        .then(function(hpRes) {
          var hpId = hpRes.data ? hpRes.data.id : null;
          return supabase.from("tournaments").insert({
            name: tName,
            date: tDate,
            format: "swiss",
            max_players: parseInt(tSize),
            invite_only: tInvite,
            entry_fee: tEntryFee || null,
            rules_text: tRules || null,
            host_profile_id: hpId,
            description: tRules || "Host tournament by " + brandName,
            region: ""
          }).select().single();
        }).then(function(res) {
          if (res && res.error) console.error("[TFT] Failed to create tournament:", res.error);
          else if (res && res.data) {
            var dbId = res.data.id;
            setTournaments(function(ts) { return ts.map(function(t) { return t.name === tName && !t.dbId ? Object.assign({}, t, { dbId: dbId }) : t; }); });
            if (setFeaturedEvents) {
              setFeaturedEvents(function(evts) { return evts.map(function(ev) { return ev.name === tName && !ev.dbTournamentId ? Object.assign({}, ev, { dbTournamentId: dbId }) : ev; }); });
            }
          }
        });
    }
    setShowCreate(false);
    setTName("");
    setTDate("");
    setTEntryFee("");
    setTRules("");
    setTInvite(false);
    toast(tEntryFee ? "Tournament created - pending admin approval for entry fee" : "Tournament created!", "success");
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
      }).eq("user_id", currentUser.id).then(function(res) {
        if (res.error) console.error("[TFT] host_profiles branding update failed:", res.error);
      });
    }
    setBrandSaved(true);
    toast("Branding saved!", "success");
    setTimeout(function() { setBrandSaved(false); }, 3000);
  }

  function sendAnnouncement() {
    if (!announceMsg.trim()) { toast("Write a message first", "error"); return; }
    var a = { id: Date.now(), to: announceTo, msg: announceMsg.trim(), sentAt: new Date().toLocaleString() };
    var newArr = [a].concat(announcements);
    setAnnouncements(function() { return newArr; });
    if (setHostAnnouncements) setHostAnnouncements(newArr);
    setAnnounceMsg("");
    toast("Announcement sent to " + (announceTo === "all" ? "all players" : announceTo + " players"), "success");
  }

  var liveTournaments = tournaments.filter(function(t) { return t.status === "live"; });
  var upcomingTournaments = tournaments.filter(function(t) { return t.status === "upcoming"; });
  var completedTournaments = tournaments.filter(function(t) { return t.status === "complete"; });
  var totalHosted = tournaments.length;
  var totalPlayers = tournaments.reduce(function(s, t) { return s + t.registered; }, 0);

  var ACCENT_COLORS = ["#9B72CF", "#4ECDC4", "#E8A838", "#F87171", "#6EE7B7", "#60A5FA", "#FB923C"];

  return (
    <PageLayout>
      <div className="page wrap">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 24 }}>{tiIcon(brandLogo)}</span>
              <h2 style={{ color: "#F2EDE4", fontSize: 20, margin: 0 }}>{brandName}</h2>
              <Tag color="#9B72CF">{tiIcon("device-gamepad-2")} Host</Tag>
              {liveTournaments.length > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(82,196,124,.12)", border: "1px solid rgba(82,196,124,.3)", borderRadius: 20, padding: "3px 9px", fontSize: 10, fontWeight: 700, color: "#6EE7B7" }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#52C47C", display: "inline-block" }} />LIVE
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: "#BECBD9", margin: 0 }}>Host Dashboard - manage tournaments, players, and branding.</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn v="dark" s="sm" onClick={function() { setScreen("featured"); navigate("/featured"); }}>Featured</Btn>
            <Btn v="primary" onClick={function() { setShowCreate(function(s) { return !s; }); }}>{showCreate ? "Cancel" : "+ New Tournament"}</Btn>
          </div>
        </div>

        {/* Tournament creation wizard */}
        {showCreate && (
          <Panel style={{ padding: "20px", marginBottom: 20, border: "1px solid rgba(232,168,56,.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <h3 style={{ fontSize: 15, color: "#F2EDE4", margin: 0 }}>New Tournament</h3>
              <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                {["Basics", "Format", "Branding", "Review"].map(function(label, i) {
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: wizStep === i ? "#9B72CF" : wizStep > i ? "#4ECDC4" : "rgba(255,255,255,.08)", border: "1px solid " + (wizStep === i ? "rgba(155,114,207,.6)" : wizStep > i ? "rgba(78,205,196,.4)" : "rgba(242,237,228,.1)"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: wizStep >= i ? "#fff" : "#9AAABF", transition: "all .2s" }}>{wizStep > i ? "check" : (i + 1)}</div>
                      <span style={{ fontSize: 10, color: wizStep === i ? "#C4B5FD" : "#9AAABF", fontWeight: wizStep === i ? 700 : 400, display: wizStep === i ? "inline" : "none" }}>{label}</span>
                      {i < 3 && <div style={{ width: 16, height: 1, background: wizStep > i ? "rgba(78,205,196,.4)" : "rgba(242,237,228,.08)" }} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {wizStep === 0 && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D4E0", marginBottom: 6 }}>Tournament Name</div>
                    <Inp value={wizData.name} onChange={function(v) { setWizData(function(d) { return Object.assign({}, d, { name: v }); }); }} placeholder="e.g. Weekly Clash #15" />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D4E0", marginBottom: 6 }}>Date</div>
                    <Inp value={wizData.date} onChange={function(v) { setWizData(function(d) { return Object.assign({}, d, { date: v }); }); }} placeholder="Mar 24 2026" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn v="dark" s="sm" onClick={function() { setShowCreate(false); setWizStep(0); }}>Cancel</Btn>
                  <Btn v="primary" s="sm" onClick={function() { if (!wizData.name.trim() || !wizData.date.trim()) { toast("Name and date required", "error"); return; } setWizStep(1); }}>Next - Format</Btn>
                </div>
              </div>
            )}

            {wizStep === 1 && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D4E0", marginBottom: 6 }}>Format</div>
                    <Sel value={wizData.type} onChange={function(v) { setWizData(function(d) { return Object.assign({}, d, { type: v }); }); }}>
                      <option value="swiss">Swiss</option>
                      <option value="standard">Standard</option>
                    </Sel>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D4E0", marginBottom: 6 }}>Games per Player</div>
                    <Sel value={String(wizData.totalGames)} onChange={function(v) { setWizData(function(d) { return Object.assign({}, d, { totalGames: parseInt(v) }); }); }}>
                      {[2, 3, 4, 5, 6, 7, 8].map(function(n) { return <option key={n} value={n}>{n + " games"}</option>; })}
                    </Sel>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D4E0", marginBottom: 6 }}>Max Players</div>
                    <Sel value={String(wizData.maxPlayers)} onChange={function(v) { setWizData(function(d) { return Object.assign({}, d, { maxPlayers: parseInt(v) }); }); }}>
                      {[8, 16, 24, 32, 48, 64, 96, 126, 128].map(function(n) { return <option key={n} value={n}>{n + " players"}</option>; })}
                    </Sel>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D4E0", marginBottom: 6 }}>Entry Fee <span style={{ color: "#9AAABF", fontWeight: 400 }}>(admin approval)</span></div>
                    <Inp value={wizData.entryFee} onChange={function(v) { setWizData(function(d) { return Object.assign({}, d, { entryFee: v }); }); }} placeholder="Leave blank = free" />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D4E0", marginBottom: 6 }}>Custom Rules <span style={{ color: "#9AAABF", fontWeight: 400 }}>(optional)</span></div>
                  <textarea
                    className="w-full bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-on-surface text-sm resize-y min-h-[60px] outline-none font-sans"
                    value={wizData.rules}
                    onChange={function(e) { var v = e.target.value; setWizData(function(d) { return Object.assign({}, d, { rules: v }); }); }}
                    placeholder="Any special rules or format notes..."
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div onClick={function() { setWizData(function(d) { return Object.assign({}, d, { inviteOnly: !d.inviteOnly }); }); }} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <div style={{ width: 36, height: 20, borderRadius: 99, background: wizData.inviteOnly ? "rgba(155,114,207,.3)" : "rgba(255,255,255,.08)", border: "1px solid " + (wizData.inviteOnly ? "rgba(155,114,207,.5)" : "rgba(242,237,228,.1)"), position: "relative", transition: "all .2s" }}>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", background: wizData.inviteOnly ? "#C4B5FD" : "#9AAABF", position: "absolute", top: 2, left: wizData.inviteOnly ? 18 : 2, transition: "left .2s" }} />
                    </div>
                    <span style={{ fontSize: 13, color: "#C8D4E0" }}>Invite-only registration</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn v="dark" s="sm" onClick={function() { setWizStep(0); }}>Back</Btn>
                  <Btn v="primary" s="sm" onClick={function() { setWizStep(2); }}>Next - Branding</Btn>
                </div>
              </div>
            )}

            {wizStep === 2 && (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D4E0", marginBottom: 8 }}>Tournament Accent Color</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    {ACCENT_COLORS.map(function(c) {
                      return (
                        <div key={c} onClick={function() { setWizData(function(d) { return Object.assign({}, d, { accentColor: c }); }); }}
                          style={{ width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer", border: wizData.accentColor === c ? "3px solid #fff" : "3px solid transparent", transition: "border .15s" }} />
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="color" value={wizData.accentColor} onChange={function(e) { var v = e.target.value; setWizData(function(d) { return Object.assign({}, d, { accentColor: v }); }); }} style={{ width: 36, height: 32, borderRadius: 6, border: "1px solid rgba(242,237,228,.12)", background: "transparent", cursor: "pointer", padding: 2 }} />
                    <span style={{ fontSize: 12, color: "#9AAABF", fontFamily: "monospace" }}>{wizData.accentColor}</span>
                  </div>
                </div>
                <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid " + wizData.accentColor + "44", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "#9AAABF", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>Preview</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#F2EDE4" }}>{wizData.name || "Tournament Name"}</div>
                  <div style={{ fontSize: 12, color: wizData.accentColor, fontWeight: 600, marginTop: 2 }}>{wizData.type === "swiss" ? "Swiss" : "Standard"} - {wizData.maxPlayers} players</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn v="dark" s="sm" onClick={function() { setWizStep(1); }}>Back</Btn>
                  <Btn v="primary" s="sm" onClick={function() { setWizStep(3); }}>Review</Btn>
                </div>
              </div>
            )}

            {wizStep === 3 && (
              <div>
                <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(242,237,228,.08)", borderRadius: 10, padding: "16px", marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#F2EDE4", marginBottom: 12 }}>{wizData.name}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      ["Date", wizData.date],
                      ["Format", wizData.type === "swiss" ? "Swiss" : "Standard"],
                      ["Games", String(wizData.totalGames) + " per player"],
                      ["Max Players", String(wizData.maxPlayers)],
                      ["Entry Fee", wizData.entryFee || "Free"],
                      ["Invite Only", wizData.inviteOnly ? "Yes" : "No"]
                    ].map(function(arr) {
                      return (
                        <div key={arr[0]} style={{ background: "rgba(255,255,255,.02)", borderRadius: 7, padding: "8px 10px" }}>
                          <div style={{ fontSize: 10, color: "#9AAABF", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>{arr[0]}</div>
                          <div style={{ fontSize: 13, color: "#F2EDE4", fontWeight: 600 }}>{arr[1]}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", background: wizData.accentColor }} />
                    <span style={{ fontSize: 12, color: "#9AAABF", fontFamily: "monospace" }}>{wizData.accentColor}</span>
                  </div>
                </div>
                {wizData.entryFee && (
                  <div style={{ background: "rgba(232,168,56,.06)", border: "1px solid rgba(232,168,56,.2)", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#E8A838" }}>
                    {tiIcon("alert-triangle")} Entry fee tournaments require admin approval before going live.
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn v="dark" s="sm" onClick={function() { setWizStep(2); }}>Back</Btn>
                  <Btn v="primary" onClick={submitWizard} disabled={wizCreating}>{wizCreating ? "Creating..." : "Create Tournament"}</Btn>
                </div>
              </div>
            )}
          </Panel>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 18, overflowX: "auto", whiteSpace: "nowrap", WebkitOverflowScrolling: "touch", msOverflowStyle: "none", scrollbarWidth: "none", flexWrap: "nowrap" }}>
          {TABS.map(function(arr) {
            var t = arr[0];
            var label = arr[1];
            return <Btn key={t} v={tab === t ? "primary" : "dark"} s="sm" onClick={function() { setTab(t); }} style={{ flexShrink: 0, whiteSpace: "nowrap" }}>{label}</Btn>;
          })}
        </div>

        {/* Overview tab */}
        {tab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 20 }}>
              {[
                ["Tournaments", "" + totalHosted, "#E8A838"],
                ["Players Hosted", "" + totalPlayers, "#6EE7B7"],
                ["Live Now", "" + liveTournaments.length, "#52C47C"],
                ["Upcoming", "" + upcomingTournaments.length, "#4ECDC4"]
              ].map(function(arr) {
                var l = arr[0]; var v = arr[1]; var c = arr[2];
                return (
                  <Panel key={l} style={{ padding: "18px", textAlign: "center" }}>
                    <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: c, lineHeight: 1 }}>{v}</div>
                    <div className="cond" style={{ fontSize: 10, color: "#BECBD9", fontWeight: 700, textTransform: "uppercase", marginTop: 6, letterSpacing: ".06em" }}>{l}</div>
                  </Panel>
                );
              })}
            </div>
            {liveTournaments.length > 0 && (
              <Panel style={{ padding: "18px", marginBottom: 16, border: "1px solid rgba(82,196,124,.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(82,196,124,.12)", border: "1px solid rgba(82,196,124,.3)", borderRadius: 20, padding: "3px 9px", fontSize: 11, fontWeight: 700, color: "#6EE7B7" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#52C47C", display: "inline-block" }} />LIVE
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#F2EDE4" }}>Active Tournament</span>
                </div>
                {liveTournaments.map(function(t) {
                  return (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#F2EDE4", marginBottom: 4 }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: "#BECBD9", marginBottom: 8 }}>{tiIcon("calendar-event")} {t.date} - {tiIcon("users")} {t.registered}/{t.size} players</div>
                        <Bar val={t.registered} max={t.size} color="#6EE7B7" h={4} />
                      </div>
                      <Btn v="primary" s="sm" onClick={function() { setScreen("bracket"); navigate("/bracket"); }}>Live Bracket</Btn>
                    </div>
                  );
                })}
              </Panel>
            )}
            <Panel style={{ padding: "18px" }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#F2EDE4", marginBottom: 12 }}>Quick Actions</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Btn v="ghost" s="sm" onClick={function() { setShowCreate(true); setTab("tournaments"); }}>+ New Tournament</Btn>
                <Btn v="ghost" s="sm" onClick={function() { setTab("announce"); }}>{tiIcon("speakerphone")} Announce</Btn>
                <Btn v="ghost" s="sm" onClick={function() { setTab("branding"); }}>{tiIcon("palette")} Edit Branding</Btn>
                <Btn v="ghost" s="sm" onClick={function() { setScreen("bracket"); navigate("/bracket"); }}>{tiIcon("tournament")} View Bracket</Btn>
                <Btn v="ghost" s="sm" onClick={function() { setScreen("featured"); navigate("/featured"); }}>{tiIcon("star")} Featured Page</Btn>
              </div>
            </Panel>
          </div>
        )}

        {/* Tournaments tab */}
        {tab === "tournaments" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {tournaments.map(function(t) {
              var statusColor = t.status === "live" ? "#6EE7B7" : t.status === "upcoming" ? "#4ECDC4" : t.status === "pending_approval" ? "#E8A838" : "#BECBD9";
              var statusLabel = t.status === "live" ? "Live" : t.status === "upcoming" ? "Upcoming" : t.status === "pending_approval" ? "Pending" : "Completed";
              return (
                <Panel key={t.id} style={{ padding: "18px", border: t.status === "live" ? "1px solid rgba(82,196,124,.25)" : "1px solid rgba(242,237,228,.07)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: "#F2EDE4" }}>{t.name}</span>
                        <Tag color={statusColor} size="sm">{statusLabel}</Tag>
                        {t.invite && <Tag color="#9B72CF" size="sm">{tiIcon("lock")} Invite Only</Tag>}
                        {t.entryFee && <Tag color="#EAB308" size="sm">{tiIcon("tag")} {t.entryFee}</Tag>}
                      </div>
                      <div style={{ fontSize: 13, color: "#BECBD9", marginBottom: 8 }}>{tiIcon("calendar-event")} {t.date} - {tiIcon("users")} {t.registered}/{t.size} registered</div>
                      <Bar val={t.registered} max={t.size} color="#E8A838" h={4} />
                      <div style={{ fontSize: 10, color: "#BECBD9", marginTop: 3 }}>{t.size - t.registered} spots remaining</div>
                      {t.rules && <div style={{ fontSize: 11, color: "#9AAABF", marginTop: 6, fontStyle: "italic" }}>{tiIcon("clipboard")} {t.rules}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                      {t.status === "upcoming" && (
                        <Btn v="ghost" s="sm" onClick={function() { updateTournamentAndFeatured(t.id, { status: "live" }); toast("Check-in opened! Tournament is now LIVE", "success"); }}>Open Check-In</Btn>
                      )}
                      {t.status === "live" && (
                        <Btn v="ghost" s="sm" onClick={function() { updateTournamentAndFeatured(t.id, { status: "closed" }); toast("Registration closed", "info"); }}>Close Registration</Btn>
                      )}
                      {(t.status === "live" || t.status === "closed") && (
                        <Btn v="primary" s="sm" onClick={function() {
                          var champ = prompt("Enter champion name:");
                          if (champ && champ.trim()) {
                            updateTournamentAndFeatured(t.id, { status: "complete", champion: champ.trim(), top4: [champ.trim()] });
                            toast("Tournament completed! Champion: " + champ.trim(), "success");
                          } else {
                            toast("Cancelled", "info");
                          }
                        }}>Complete</Btn>
                      )}
                      {t.status === "pending_approval" && (
                        <span style={{ fontSize: 11, color: "#E8A838", fontWeight: 600, padding: "5px 0" }}>Awaiting Approval</span>
                      )}
                      {t.status === "complete" && (
                        <Btn v="ghost" s="sm" onClick={function() { setScreen("tournament-host-" + t.id); }}>View Details</Btn>
                      )}
                      <Btn v="ghost" s="sm" onClick={function() {
                        if (confirm("Delete this tournament?")) {
                          setTournaments(function(ts) { return ts.filter(function(x) { return x.id !== t.id; }); });
                          if (setFeaturedEvents) {
                            setFeaturedEvents(function(evts) { return evts.filter(function(ev) { return ev.hostTournamentId !== t.id; }); });
                          }
                          toast("Tournament deleted", "info");
                        }
                      }} style={{ color: "#F87171" }}>Delete</Btn>
                    </div>
                  </div>
                </Panel>
              );
            })}
            {tournaments.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px", color: "#BECBD9" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{tiIcon("device-gamepad-2")}</div>
                <div style={{ fontSize: 14 }}>No tournaments yet. Create your first one above.</div>
              </div>
            )}
          </div>
        )}

        {/* Analytics tab */}
        {tab === "analytics" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 20 }}>
              {[
                ["Total Hosted", "" + totalHosted, "#E8A838"],
                ["Players Hosted", "" + totalPlayers, "#6EE7B7"],
                ["Completed", "" + completedTournaments.length, "#4ECDC4"],
                ["Upcoming", "" + upcomingTournaments.length, "#9B72CF"]
              ].map(function(arr) {
                var l = arr[0]; var v = arr[1]; var c = arr[2];
                return (
                  <Panel key={l} style={{ padding: "18px", textAlign: "center" }}>
                    <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: c, lineHeight: 1 }}>{v}</div>
                    <div className="cond" style={{ fontSize: 10, color: "#BECBD9", fontWeight: 700, textTransform: "uppercase", marginTop: 6, letterSpacing: ".06em" }}>{l}</div>
                  </Panel>
                );
              })}
            </div>
            <Panel style={{ padding: "18px", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F2EDE4", marginBottom: 14 }}>{tiIcon("chart-bar")} Tournament History</h3>
              {tournaments.length === 0 && (
                <div style={{ textAlign: "center", padding: "32px", color: "#BECBD9" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>{tiIcon("device-gamepad-2")}</div>
                  <div style={{ fontSize: 13 }}>No tournament data yet. Create your first tournament to see analytics here.</div>
                </div>
              )}
              {tournaments.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {tournaments.map(function(t) {
                    var fillPct = t.size > 0 ? Math.round((t.registered / t.size) * 100) : 0;
                    var statusColor = t.status === "live" ? "#6EE7B7" : t.status === "complete" ? "#E8A838" : t.status === "pending_approval" ? "#FB923C" : "#4ECDC4";
                    var statusLabel = t.status === "live" ? "Live" : t.status === "complete" ? "Completed" : t.status === "pending_approval" ? "Pending" : "Upcoming";
                    return (
                      <div key={t.id} style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(242,237,228,.06)", borderRadius: 10, padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: "#F2EDE4", flex: 1 }}>{t.name}</span>
                          <Tag color={statusColor} size="sm">{statusLabel}</Tag>
                          <span style={{ fontSize: 11, color: "#9AAABF" }}>{t.date}</span>
                        </div>
                        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: 100 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                              <span style={{ fontSize: 10, color: "#BECBD9" }}>Fill rate</span>
                              <span style={{ fontSize: 10, fontWeight: 700, color: "#E8A838" }}>{t.registered + "/" + t.size + " (" + fillPct + "%)"}</span>
                            </div>
                            <Bar val={t.registered} max={t.size} color="#E8A838" h={4} />
                          </div>
                          {t.status === "complete" && t.champion && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(232,168,56,.06)", border: "1px solid rgba(232,168,56,.15)", borderRadius: 8, padding: "4px 10px" }}>
                              <i className="ti ti-trophy" style={{ color: "#E8A838", fontSize: 13 }} />
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#E8A838" }}>{t.champion}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
            <Panel style={{ padding: "18px" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F2EDE4", marginBottom: 12 }}>{tiIcon("trending-up")} Performance Summary</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "rgba(255,255,255,.02)", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: "#9AAABF", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Avg Fill Rate</div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: "#6EE7B7" }}>
                    {tournaments.length === 0 ? "--" : Math.round(tournaments.reduce(function(s, t) { return s + (t.size > 0 ? (t.registered / t.size) : 0); }, 0) / tournaments.length * 100) + "%"}
                  </div>
                </div>
                <div style={{ background: "rgba(255,255,255,.02)", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: "#9AAABF", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Completed Events</div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: "#4ECDC4" }}>{completedTournaments.length}</div>
                </div>
              </div>
            </Panel>
          </div>
        )}

        {/* Game Flow tab */}
        {tab === "game-flow" && (
          <div>
            {tournaments.filter(function(t) { return t.status === "live" || t.status === "closed"; }).length === 0 && (
              <Panel style={{ padding: "40px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>&#9876;&#65039;</div>
                <h3 style={{ color: "#F2EDE4", marginBottom: 8 }}>No Live Tournaments</h3>
                <p style={{ color: "#BECBD9", fontSize: 13 }}>Open check-in on a tournament to start the game flow. You can then enter placements round by round.</p>
              </Panel>
            )}
            {tournaments.filter(function(t) { return t.status === "live" || t.status === "closed"; }).map(function(t) {
              var matchingEvent = (featuredEvents || []).find(function(ev) { return ev.hostTournamentId === t.id; });
              var regIds = matchingEvent ? (matchingEvent.registeredIds || []) : [];
              var roundCount = t.roundCount || 3;
              var currentRound = t.currentRound || 1;
              return (
                <Panel key={t.id} style={{ padding: "20px", marginBottom: 16, border: "1px solid rgba(82,196,124,.2)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#F2EDE4", margin: 0, flex: 1 }}>{t.name}</h3>
                    <Tag color="#6EE7B7" size="sm">Round {currentRound}/{roundCount}</Tag>
                    <Tag color="#E8A838" size="sm">{regIds.length} players</Tag>
                  </div>
                  {regIds.length === 0 && (
                    <div style={{ fontSize: 13, color: "#BECBD9", padding: "16px 0", textAlign: "center" }}>No players registered yet. Players need to register before you can enter results.</div>
                  )}
                  {regIds.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D4E0", marginBottom: 10 }}>Enter placements for Round {currentRound}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
                        {regIds.map(function(username) {
                          return (
                            <div key={username} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(255,255,255,.02)", borderRadius: 8, border: "1px solid rgba(242,237,228,.04)" }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#F2EDE4", flex: 1 }}>{username}</span>
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
                                    player_id: playerId,
                                    placement: placement,
                                    points: pts
                                  }).then(function(res) {
                                    if (res.error) toast("Failed to save: " + res.error.message, "error");
                                    else toast(username + " placed " + placement + (placement === 1 ? "st" : placement === 2 ? "nd" : placement === 3 ? "rd" : "th") + " (" + pts + "pts)", "success");
                                  });
                                } else {
                                  toast(username + " placed " + placement + (placement === 1 ? "st" : placement === 2 ? "nd" : placement === 3 ? "rd" : "th") + " (" + pts + "pts)", "success");
                                }
                              }} style={{ width: 90 }}>
                                <option value="">Place</option>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(function(p) {
                                  return <option key={p} value={p}>{p}{p === 1 ? "st" : p === 2 ? "nd" : p === 3 ? "rd" : "th"} ({({ 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 })[p]}pts)</option>;
                                })}
                              </Sel>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Btn v="primary" s="sm" onClick={function() {
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
                        }}>{currentRound < roundCount ? "Advance to Round " + (currentRound + 1) : "Finalize Tournament"}</Btn>
                        <Btn v="ghost" s="sm" onClick={function() { setScreen("tournament-host-" + t.id); }}>View Public Page</Btn>
                      </div>
                    </div>
                  )}
                </Panel>
              );
            })}
          </div>
        )}

        {/* Registrations / Players tab */}
        {tab === "registrations" && (
          <div>
            {tournaments.filter(function(t) { return t.status !== "complete"; }).map(function(t) {
              var matchingEvent = (featuredEvents || []).find(function(ev) { return ev.hostTournamentId === t.id; });
              var regIds = matchingEvent ? (matchingEvent.registeredIds || []) : [];
              return (
                <Panel key={t.id} style={{ padding: "18px", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <h3 style={{ fontSize: 14, color: "#F2EDE4", margin: 0, flex: 1 }}>{t.name}</h3>
                    <Tag color={t.status === "live" ? "#6EE7B7" : "#4ECDC4"} size="sm">{regIds.length + "/" + t.size}</Tag>
                  </div>
                  {regIds.length === 0 && (
                    <div style={{ fontSize: 13, color: "#BECBD9", padding: "16px 0", textAlign: "center" }}>No players registered yet.</div>
                  )}
                  {regIds.map(function(username, i) {
                    return (
                      <div key={username} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < regIds.length - 1 ? "1px solid rgba(242,237,228,.05)" : "none" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#F2EDE4" }}>{username}</div>
                        </div>
                        <Tag color="#6EE7B7" size="sm">Registered</Tag>
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
                          style={{ background: "rgba(220,38,38,.1)", border: "1px solid rgba(220,38,38,.3)", borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 700, color: "#F87171", cursor: "pointer", fontFamily: "inherit" }}
                        >Remove</button>
                      </div>
                    );
                  })}
                </Panel>
              );
            })}
          </div>
        )}

        {/* Announce tab */}
        {tab === "announce" && (
          <div>
            <Panel style={{ padding: "20px", marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, color: "#F2EDE4", marginBottom: 14 }}>Send Announcement</h3>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D4E0", marginBottom: 6 }}>Send to</div>
                <Sel value={announceTo} onChange={setAnnounceTo}>
                  <option value="all">All registered players</option>
                  {tournaments.map(function(t) { return <option key={t.id} value={t.name}>{t.name}</option>; })}
                </Sel>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D4E0", marginBottom: 6 }}>Message</div>
                <textarea
                  className="w-full bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-on-surface text-sm resize-y min-h-[90px] outline-none font-sans"
                  value={announceMsg}
                  onChange={function(e) { setAnnounceMsg(e.target.value); }}
                  placeholder="e.g. Check-in is now open! Join the Discord for lobby codes..."
                />
              </div>
              <Btn v="primary" onClick={sendAnnouncement}>{tiIcon("speakerphone")} Send Announcement</Btn>
            </Panel>
            <Panel style={{ padding: "18px" }}>
              <h3 style={{ fontSize: 14, color: "#F2EDE4", marginBottom: 14 }}>Sent Announcements</h3>
              {announcements.length === 0 && (
                <div style={{ fontSize: 13, color: "#BECBD9", padding: "16px 0", textAlign: "center" }}>No announcements sent yet.</div>
              )}
              {announcements.map(function(a) {
                return (
                  <div key={a.id} style={{ borderBottom: "1px solid rgba(242,237,228,.05)", padding: "12px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, background: "rgba(155,114,207,.1)", border: "1px solid rgba(155,114,207,.2)", borderRadius: 20, padding: "2px 8px", color: "#C4B5FD", fontWeight: 600 }}>To: {a.to}</span>
                      <span style={{ fontSize: 10, color: "#9AAABF", marginLeft: "auto" }}>{a.sentAt}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#C8D4E0", lineHeight: 1.5 }}>{a.msg}</div>
                  </div>
                );
              })}
            </Panel>
          </div>
        )}

        {/* Branding tab */}
        {tab === "branding" && (
          <Panel style={{ padding: "24px" }}>
            <h3 style={{ fontSize: 15, color: "#F2EDE4", marginBottom: 18 }}>{tiIcon("palette")} Host Branding</h3>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 24 }}>
              <div style={{ background: "linear-gradient(145deg,#0D1520,#0f1827)", border: "1px solid " + brandColor + "55", borderRadius: 14, padding: "16px 20px", minWidth: 220, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: brandColor + "22", border: "1px solid " + brandColor + "44", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                    {tiIcon(brandLogo)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#F2EDE4" }}>{brandName}</div>
                    <div style={{ fontSize: 11, color: brandColor, fontWeight: 600 }}>Host Partner</div>
                  </div>
                </div>
                {brandBio && <div style={{ fontSize: 12, color: "#C8D4E0", lineHeight: 1.5 }}>{brandBio}</div>}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D4E0", marginBottom: 6 }}>Org / Display Name</div>
                <Inp value={brandName} onChange={setBrandName} placeholder="Your org or community name" />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D4E0", marginBottom: 6 }}>Logo Icon</div>
                <Inp value={brandLogo} onChange={setBrandLogo} placeholder="e.g. icon names: controller, trophy" />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D4E0", marginBottom: 8 }}>Brand Color</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  {ACCENT_COLORS.map(function(c) {
                    return (
                      <div key={c} onClick={function() { setBrandColor(c); }}
                        style={{ width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer", border: brandColor === c ? "3px solid #fff" : "3px solid transparent", transition: "border .15s" }} />
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="color" value={brandColor} onChange={function(e) { setBrandColor(e.target.value); }} style={{ width: 36, height: 32, borderRadius: 6, border: "1px solid rgba(242,237,228,.12)", background: "transparent", cursor: "pointer", padding: 2 }} />
                  <Inp value={brandColor} onChange={setBrandColor} placeholder="#9B72CF" style={{ maxWidth: 120, fontFamily: "monospace" }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D4E0", marginBottom: 6 }}>Bio / Description <span style={{ color: "#9AAABF", fontWeight: 400 }}>(shown on Featured page)</span></div>
                <textarea
                  className="w-full bg-surface-container border border-outline-variant/10 rounded-sm px-3 py-2 text-on-surface text-sm resize-y min-h-[80px] outline-none font-sans"
                  value={brandBio}
                  onChange={function(e) { setBrandBio(e.target.value); }}
                  placeholder="Tell players about your org, community, and what kind of clashes you run..."
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D4E0", marginBottom: 6 }}>Logo Image <span style={{ color: "#9AAABF", fontWeight: 400 }}>(URL or upload)</span></div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Inp value={brandLogoUrl} onChange={setBrandLogoUrl} placeholder="https://example.com/logo.png" />
                  <label style={{ background: "rgba(155,114,207,.12)", border: "1px solid rgba(155,114,207,.3)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#C4B5FD", cursor: "pointer", whiteSpace: "nowrap" }}>
                    {uploadingLogo ? "Uploading..." : "Upload"}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={function(e) { if (e.target.files[0]) uploadImage(e.target.files[0], "logo"); }} />
                  </label>
                </div>
                {brandLogoUrl && <img src={brandLogoUrl} alt="Logo preview" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", marginTop: 8, border: "1px solid rgba(242,237,228,.1)" }} />}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#C8D4E0", marginBottom: 6 }}>Banner Image <span style={{ color: "#9AAABF", fontWeight: 400 }}>(URL or upload)</span></div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Inp value={brandBannerUrl} onChange={setBrandBannerUrl} placeholder="https://example.com/banner.png" />
                  <label style={{ background: "rgba(155,114,207,.12)", border: "1px solid rgba(155,114,207,.3)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#C4B5FD", cursor: "pointer", whiteSpace: "nowrap" }}>
                    {uploadingBanner ? "Uploading..." : "Upload"}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={function(e) { if (e.target.files[0]) uploadImage(e.target.files[0], "banner"); }} />
                  </label>
                </div>
                {brandBannerUrl && <img src={brandBannerUrl} alt="Banner preview" style={{ width: "100%", maxHeight: 120, borderRadius: 10, objectFit: "cover", marginTop: 8, border: "1px solid rgba(242,237,228,.1)" }} />}
              </div>
              <Btn v="primary" onClick={saveBranding}>{brandSaved ? "Saved!" : "Save Branding"}</Btn>
            </div>
          </Panel>
        )}

      </div>
    </PageLayout>
  );
}

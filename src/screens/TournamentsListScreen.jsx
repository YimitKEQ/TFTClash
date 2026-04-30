import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Btn, Panel, Icon, PillTab } from '../components/ui'
import SectionHeader from '../components/shared/SectionHeader.jsx'
import { supabase } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'
import RegionBadge from '../components/shared/RegionBadge'
import { canRegisterInRegion, normalizeRegion } from '../lib/regions.js'
import { resolveLinkedPlayer } from '../lib/linkedPlayer.js'

var phaseLabels = {
  draft: 'Draft',
  registration: 'Registration Open',
  check_in: 'Check-In',
  in_progress: 'Live Now',
  complete: 'Completed'
};

var phaseBadgeClasses = {
  draft: 'bg-surface-variant text-on-surface',
  registration: 'bg-secondary-container/20 text-secondary border border-secondary/30',
  check_in: 'bg-primary-container/20 text-primary border border-primary/30',
  in_progress: 'bg-tertiary-container/20 text-tertiary border border-tertiary/30',
  complete: 'bg-surface-variant text-on-surface-variant'
};

function getCountdown(dateStr) {
  if (!dateStr) return '';
  var now = new Date();
  var tDate = new Date(dateStr);
  var diff = tDate - now;
  if (diff <= 0) return '';
  var days = Math.floor(diff / 86400000);
  var hours = Math.floor((diff % 86400000) / 3600000);
  var mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return days + 'd ' + hours + 'h ' + mins + 'm';
  if (hours > 0) return hours + 'h ' + mins + 'm';
  return mins + 'm';
}

function getTopPrize(prizes) {
  if (!Array.isArray(prizes) || prizes.length === 0) return null;
  var first = prizes.find(function(p) { return p.placement === 1; }) || prizes[0];
  return first ? first.prize : null;
}

// Filling-rate threshold under which a tournament is not interesting enough to
// surface in the urgency strip. Anything below 60% is "still has plenty of
// room" and shouldn't be flagged as filling.
var FILLING_MIN_PCT = 60

function AlmostFullStrip(props) {
  var tournaments = props.tournaments || []
  var regCounts = props.regCounts || {}
  var navigate = props.navigate

  var rows = []
  for (var i = 0; i < tournaments.length; i++) {
    var t = tournaments[i]
    if (!t) continue
    if (t.phase !== 'registration') continue
    var max = Number(t.max_players) || 128
    if (max <= 0) continue
    var count = Number(regCounts[t.id]) || 0
    var pct = Math.round((count / max) * 100)
    if (pct < FILLING_MIN_PCT) continue
    if (pct >= 100) continue
    rows.push({ t: t, count: count, max: max, pct: pct })
  }
  if (rows.length === 0) return null

  rows.sort(function (a, b) { return b.pct - a.pct })
  var visible = rows.slice(0, 4)

  return (
    <div className="mb-8 rounded-2xl border border-tertiary/25 bg-surface-container p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Icon name="bolt" className="text-tertiary" />
          <h3 className="font-display text-base tracking-wide">FILLING UP FAST</h3>
        </div>
        <span className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/40">
          {rows.length > 4
            ? ('Top 4 of ' + rows.length + ' near capacity')
            : (rows.length + (rows.length === 1 ? ' clash' : ' clashes') + ' near capacity')}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        {visible.map(function (row) {
          var t = row.t
          var barColor = row.pct >= 90 ? '#FF6B6B' : (row.pct >= 75 ? '#FFB84D' : '#52D6A0')
          return (
            <button
              key={t.id}
              type="button"
              onClick={function () { navigate('/tournament/' + row.t.id) }}
              className="text-left rounded-xl border border-outline-variant/15 bg-surface-container-low/60 hover:bg-surface-container hover:border-tertiary/40 transition-colors p-3 sm:p-4 group"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-display text-sm sm:text-base tracking-wide text-on-surface truncate">
                    {t.name || 'Untitled clash'}
                  </div>
                  <div className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/50 mt-0.5">
                    {(t.region || 'EU') + ' · ' + (row.count + '/' + row.max + ' registered')}
                  </div>
                </div>
                <span
                  className="font-mono text-xs font-bold px-2 py-1 rounded flex-shrink-0"
                  style={{ background: barColor + '22', color: barColor }}
                >
                  {row.pct + '%'}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: row.pct + '%', background: barColor }}
                ></div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FeaturedSpotlight(props) {
  var t = props.tournament;
  var regCount = props.regCount || 0;
  var onView = props.onView;

  if (!t) return null;

  var prizes = Array.isArray(t.prize_pool_json) ? t.prize_pool_json : [];
  var topPrize = getTopPrize(prizes);
  var countdown = getCountdown(t.date);
  var maxP = t.max_players || 128;

  return (
    <section className="mb-10 relative overflow-hidden rounded-xl border border-outline-variant/10 shadow-2xl">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 to-transparent z-10" />
        <div className="absolute inset-0 bg-surface-container-low" />
        <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,198,107,0.08) 39px, rgba(255,198,107,0.08) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,198,107,0.08) 39px, rgba(255,198,107,0.08) 40px)'}} />
      </div>
      <div className="relative z-10 p-8 lg:p-12 flex flex-col justify-end min-h-[380px]">
        <div className="flex gap-3 mb-5 items-center">
          <span className="bg-primary-container text-on-primary-container px-3 py-1 text-[10px] font-bold font-label uppercase rounded">Featured</span>
          <span className={'px-3 py-1 text-[10px] font-bold font-label uppercase rounded ' + (phaseBadgeClasses[t.phase] || 'bg-surface-variant text-on-surface')}>{phaseLabels[t.phase] || t.phase}</span>
          {t.region && <RegionBadge region={t.region} size="md" />}
        </div>
        <h1 className="text-4xl lg:text-6xl font-black font-editorial text-on-background uppercase leading-tight mb-3">{t.name}</h1>
        {t.description && (
          <p className="text-on-surface-variant max-w-xl text-base mb-6 leading-relaxed">{t.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-6 lg:gap-8">
          {topPrize && (
            <div className="flex items-center gap-4">
              <div className="p-3 bg-surface-container-high rounded-full border border-outline-variant/20">
                <Icon name="emoji_events" className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-[10px] font-label text-on-surface-variant uppercase">Prize Pool</p>
                <p className="font-mono font-bold text-lg text-primary">{topPrize}</p>
              </div>
            </div>
          )}
          {countdown && (
            <div className={'flex items-center gap-4' + (topPrize ? ' border-l border-outline-variant/20 pl-6 lg:pl-8' : '')}>
              <div className="p-3 bg-surface-container-high rounded-full border border-outline-variant/20">
                <Icon name="schedule" className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-[10px] font-label text-on-surface-variant uppercase">Starts In</p>
                <p className="font-mono font-bold text-lg">{countdown}</p>
              </div>
            </div>
          )}
          <div className={'flex items-center gap-4' + (topPrize || countdown ? ' border-l border-outline-variant/20 pl-6 lg:pl-8' : '')}>
            <div className="p-3 bg-surface-container-high rounded-full border border-outline-variant/20">
              <Icon name="group" className="text-primary" size={20} />
            </div>
            <div>
              <p className="text-[10px] font-label text-on-surface-variant uppercase">Capacity</p>
              <p className="font-mono font-bold text-lg">{regCount + ' / ' + maxP}</p>
            </div>
          </div>
          <div className="ml-auto">
            <Btn variant="primary" size="lg" onClick={onView}>
              View Tournament
            </Btn>
          </div>
        </div>
      </div>
    </section>
  );
}

function TournamentCard(props) {
  var t = props.tournament;
  var regCount = props.regCount || 0;
  var onClick = props.onClick;
  var regionMismatch = props.regionMismatch;

  var prizes = Array.isArray(t.prize_pool_json) ? t.prize_pool_json : [];
  var topPrize = getTopPrize(prizes);
  var maxP = t.max_players || 128;
  var pct = Math.min(100, Math.round((regCount / maxP) * 100));
  var countdown = getCountdown(t.date);
  var dateStr = t.date ? new Date(t.date).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}) : 'TBD';
  var badgeClass = phaseBadgeClasses[t.phase] || 'bg-surface-variant text-on-surface';
  var phaseLabel = phaseLabels[t.phase] || t.phase;

  var fillColor = pct >= 90 ? '#F87171' : pct >= 60 ? '#E8A838' : '#9B72CF';

  return (
    <Panel
      onClick={onClick}
      padding="tight"
      className="group hover:border-primary/30 transition-all duration-300 cursor-pointer flex flex-col"
    >
      <div className="relative h-36 mb-4 overflow-hidden rounded bg-surface-container-high flex items-center justify-center flex-shrink-0">
        <div className="absolute inset-0 opacity-5" style={{backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,198,107,0.3) 0px, rgba(255,198,107,0.3) 1px, transparent 1px, transparent 10px)'}} />
        <Icon name="account_tree" className="text-on-surface-variant/20" size={48} />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span className={'text-[9px] font-bold px-2 py-1 rounded uppercase font-label ' + badgeClass}>{phaseLabel}</span>
          {t.region && <RegionBadge region={t.region} size="sm" />}
          {regionMismatch && (
            <span className="text-[9px] font-bold px-2 py-1 rounded uppercase font-label bg-error/15 text-error border border-error/30">Other Region</span>
          )}
        </div>
        {countdown && (
          <div className="absolute top-3 right-3">
            <span className="bg-primary/10 text-primary text-[9px] font-bold px-2 py-1 rounded uppercase font-label border border-primary/20">{countdown}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 space-y-3">
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-base font-bold leading-tight text-on-background group-hover:text-primary transition-colors">{t.name}</h3>
          {topPrize && (
            <span className="text-xs font-mono text-primary flex-shrink-0">{topPrize}</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 border-t border-outline-variant/10">
          <div>
            <p className="text-[9px] font-label uppercase text-on-surface-variant/50 mb-0.5">Format</p>
            <p className="text-xs font-medium capitalize">{t.seeding_method || 'Snake'}</p>
          </div>
          <div>
            <p className="text-[9px] font-label uppercase text-on-surface-variant/50 mb-0.5">Games</p>
            <p className="text-xs font-medium">{(t.round_count || 3) + ' rounds'}</p>
          </div>
          <div>
            <p className="text-[9px] font-label uppercase text-on-surface-variant/50 mb-0.5">Slots</p>
            <p className="text-xs font-medium">{regCount + ' / ' + maxP}</p>
          </div>
          <div>
            <p className="text-[9px] font-label uppercase text-on-surface-variant/50 mb-0.5">Date</p>
            <p className="text-xs font-medium">{dateStr}</p>
          </div>
        </div>

        <div>
          <div className="h-1 rounded-full bg-surface-container-highest overflow-hidden">
            <div className="h-1 rounded-full transition-all duration-300" style={{width: pct + '%', background: fillColor}} />
          </div>
        </div>

        <Btn variant="secondary" size="sm" className="w-full mt-auto">
          View Details
        </Btn>
      </div>
    </Panel>
  );
}

var FILTER_TABS = [
  {key: 'all', label: 'All'},
  {key: 'registration', label: 'Open'},
  {key: 'in_progress', label: 'Live'},
  {key: 'complete', label: 'Completed'}
];

export default function TournamentsListScreen() {
  var ctx = useApp();
  var navigate = useNavigate();
  var isAdmin = ctx.isAdmin;
  var currentUser = ctx.currentUser;
  var players = ctx.players || [];

  var linkedPlayer = resolveLinkedPlayer(currentUser, players);
  var userRegion = linkedPlayer ? normalizeRegion(linkedPlayer.region) : null;

  var [tournaments, setTournaments] = useState([]);
  var [loading, setLoading] = useState(true);
  var [regCounts, setRegCounts] = useState({});
  var [activeFilter, setActiveFilter] = useState('all');
  var [regionFilter, setRegionFilter] = useState(userRegion ? 'mine' : 'all');
  var [search, setSearch] = useState('');

  useEffect(function() {
    supabase
      .from('tournaments')
      .select('*')
      .eq('type', 'flash_tournament')
      .order('date', {ascending: false})
      .then(function(res) {
        if (res.data) setTournaments(res.data);
        setLoading(false);
      });
  }, []);

  useEffect(function() {
    if (tournaments.length === 0) return;
    var ids = tournaments.map(function(t) { return t.id; });
    supabase
      .from('registrations')
      .select('tournament_id')
      .in('tournament_id', ids)
      .then(function(res) {
        if (!res.data) return;
        var counts = {};
        res.data.forEach(function(r) {
          counts[r.tournament_id] = (counts[r.tournament_id] || 0) + 1;
        });
        setRegCounts(counts);
      });
  }, [tournaments]);

  var visible = tournaments.filter(function(t) {
    if (t.phase === 'draft' || t.status === 'draft') return isAdmin;
    return true;
  });

  var activeTournament = visible.find(function(t) {
    return t.phase === 'registration' || t.phase === 'in_progress' || t.phase === 'live' || t.status === 'upcoming';
  });
  var featured = activeTournament || null;

  var filtered = visible.filter(function(t) {
    if (activeFilter !== 'all' && t.phase !== activeFilter) return false;
    if (regionFilter === 'mine' && userRegion && !canRegisterInRegion(userRegion, t.region)) return false;
    if (regionFilter === 'EU' && normalizeRegion(t.region) !== 'EU') return false;
    if (regionFilter === 'NA' && normalizeRegion(t.region) !== 'NA') return false;
    if (search.trim()) {
      var q = search.trim().toLowerCase();
      if (!t.name || t.name.toLowerCase().indexOf(q) === -1) return false;
    }
    return true;
  });

  var gridItems = featured ? filtered.filter(function(t) { return t.id !== featured.id; }) : filtered;

  return (
    <PageLayout>
      <div>

        <SectionHeader
          eyebrow="Events"
          title="Tournaments"
          description="Flash tournaments, competitive events, and community clashes. Free to enter, play to win."
          className="mb-8"
        />

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-on-surface-variant">
            <Icon name="hourglass_empty" size={32} className="animate-spin opacity-50" />
            <span className="font-label uppercase tracking-widest text-sm">Loading Tournaments...</span>
          </div>
        )}

        {!loading && (
          <div>
            {featured && (
              <FeaturedSpotlight
                tournament={featured}
                regCount={regCounts[featured.id] || 0}
                onView={function() { navigate('/tournament/' + featured.id); }}
              />
            )}
            {!featured && tournaments.length > 0 && (
              <Panel padding="none" radius="xl" className="mb-10 relative overflow-hidden p-8 lg:p-12 flex flex-col items-center justify-center min-h-[200px] text-center">
                <Icon name="event_busy" size={40} className="text-on-surface-variant/30 mb-4" />
                <p className="font-label uppercase tracking-widest text-on-surface-variant text-sm">No active tournaments right now</p>
                <p className="text-xs text-on-surface-variant/50 mt-2">Check back soon for upcoming events.</p>
              </Panel>
            )}

            <AlmostFullStrip
              tournaments={visible}
              regCounts={regCounts}
              navigate={navigate}
            />

            <section className="space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  {FILTER_TABS.map(function(tab) {
                    return (
                      <PillTab
                        key={tab.key}
                        active={activeFilter === tab.key}
                        onClick={function() { setActiveFilter(tab.key); }}
                      >
                        {tab.label}
                      </PillTab>
                    );
                  })}
                  {[
                    {key: 'all', label: 'All Regions'},
                    userRegion ? {key: 'mine', label: 'My ' + userRegion} : null,
                    {key: 'EU', label: 'EU'},
                    {key: 'NA', label: 'NA'}
                  ].filter(Boolean).map(function(tab) {
                    return (
                      <PillTab
                        key={tab.key}
                        active={regionFilter === tab.key}
                        onClick={function() { setRegionFilter(tab.key); }}
                      >
                        {tab.label}
                      </PillTab>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Icon name="search" size={16} className="text-on-surface-variant/40" />
                    </span>
                    <input
                      type="text"
                      value={search}
                      onChange={function(e) { setSearch(e.target.value); }}
                      placeholder="Search tournaments..."
                      className="bg-surface-container-lowest border-0 border-b border-outline-variant/30 focus:border-primary focus:ring-0 text-sm py-2.5 pl-9 pr-4 transition-all outline-none text-on-background placeholder:text-on-surface-variant/40 min-w-[220px]"
                    />
                  </div>
                  {isAdmin && (
                    <Btn
                      variant="tertiary"
                      size="sm"
                      icon="add"
                      onClick={function() { navigate('/admin'); }}
                    >
                      Create Tournament
                    </Btn>
                  )}
                </div>
              </div>

              {gridItems.length === 0 && !featured && (
                <Panel padding="none" radius="sm" className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant">
                  <Icon name="search_off" size={40} className="opacity-30" />
                  {activeFilter !== 'all' || search ? (
                    <>
                      <p className="font-label uppercase tracking-wider text-sm text-on-surface/70">Nothing matches those filters</p>
                      <p className="text-xs text-on-surface/50 -mt-1">Try a broader region or clear the search.</p>
                      <Btn
                        variant="link"
                        onClick={function() { setActiveFilter('all'); setSearch(''); }}
                      >
                        Clear filters
                      </Btn>
                    </>
                  ) : (
                    <>
                      <p className="font-label uppercase tracking-wider text-sm text-on-surface/70">No tournaments scheduled right now</p>
                      <p className="text-xs text-on-surface/50 -mt-1">Flash tournaments and weekly clashes drop here first.</p>
                    </>
                  )}
                </Panel>
              )}

              {gridItems.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                  {gridItems.map(function(t) {
                    var mismatch = !!(userRegion && t.region && !canRegisterInRegion(userRegion, t.region));
                    return (
                      <TournamentCard
                        key={t.id}
                        tournament={t}
                        regCount={regCounts[t.id] || 0}
                        regionMismatch={mismatch}
                        onClick={function() { navigate('/tournament/' + t.id); }}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

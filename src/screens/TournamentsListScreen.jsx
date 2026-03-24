import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { Icon } from '../components/ui'
import { supabase } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'

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
        <div className="flex gap-3 mb-5">
          <span className="bg-primary-container text-on-primary-container px-3 py-1 text-[10px] font-bold font-condensed uppercase rounded-sm">Featured</span>
          <span className={'px-3 py-1 text-[10px] font-bold font-condensed uppercase rounded-sm ' + (phaseBadgeClasses[t.phase] || 'bg-surface-variant text-on-surface')}>{phaseLabels[t.phase] || t.phase}</span>
        </div>
        <h1 className="text-4xl lg:text-6xl font-black italic font-editorial text-on-background uppercase leading-tight mb-3">{t.name}</h1>
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
                <p className="text-[10px] font-condensed text-on-surface-variant uppercase">Prize Pool</p>
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
                <p className="text-[10px] font-condensed text-on-surface-variant uppercase">Starts In</p>
                <p className="font-mono font-bold text-lg">{countdown}</p>
              </div>
            </div>
          )}
          <div className={'flex items-center gap-4' + (topPrize || countdown ? ' border-l border-outline-variant/20 pl-6 lg:pl-8' : '')}>
            <div className="p-3 bg-surface-container-high rounded-full border border-outline-variant/20">
              <Icon name="group" className="text-primary" size={20} />
            </div>
            <div>
              <p className="text-[10px] font-condensed text-on-surface-variant uppercase">Capacity</p>
              <p className="font-mono font-bold text-lg">{regCount + ' / ' + maxP}</p>
            </div>
          </div>
          <button
            onClick={onView}
            className="ml-auto bg-primary text-on-primary font-condensed font-bold uppercase tracking-widest px-8 py-3 rounded-full shadow-[0_0_20px_rgba(255,198,107,0.25)] hover:scale-105 transition-all duration-200 text-sm"
          >
            View Tournament
          </button>
        </div>
      </div>
    </section>
  );
}

function TournamentCard(props) {
  var t = props.tournament;
  var regCount = props.regCount || 0;
  var onClick = props.onClick;

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
    <div
      onClick={onClick}
      className="group bg-surface-container-low p-4 rounded-sm border border-outline-variant/5 hover:border-primary/30 transition-all duration-300 cursor-pointer flex flex-col"
    >
      <div className="relative h-36 mb-4 overflow-hidden rounded-sm bg-surface-container-high flex items-center justify-center flex-shrink-0">
        <div className="absolute inset-0 opacity-5" style={{backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,198,107,0.3) 0px, rgba(255,198,107,0.3) 1px, transparent 1px, transparent 10px)'}} />
        <Icon name="account_tree" className="text-on-surface-variant/20" size={48} />
        <div className="absolute top-3 left-3">
          <span className={'text-[9px] font-bold px-2 py-1 rounded-sm uppercase font-condensed ' + badgeClass}>{phaseLabel}</span>
        </div>
        {countdown && (
          <div className="absolute top-3 right-3">
            <span className="bg-primary/10 text-primary text-[9px] font-bold px-2 py-1 rounded-sm uppercase font-condensed border border-primary/20">{countdown}</span>
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
            <p className="text-[9px] font-condensed uppercase text-on-surface-variant/50 mb-0.5">Format</p>
            <p className="text-xs font-medium capitalize">{t.seeding_method || 'Snake'}</p>
          </div>
          <div>
            <p className="text-[9px] font-condensed uppercase text-on-surface-variant/50 mb-0.5">Games</p>
            <p className="text-xs font-medium">{(t.round_count || 3) + ' rounds'}</p>
          </div>
          <div>
            <p className="text-[9px] font-condensed uppercase text-on-surface-variant/50 mb-0.5">Slots</p>
            <p className="text-xs font-medium">{regCount + ' / ' + maxP}</p>
          </div>
          <div>
            <p className="text-[9px] font-condensed uppercase text-on-surface-variant/50 mb-0.5">Date</p>
            <p className="text-xs font-medium">{dateStr}</p>
          </div>
        </div>

        <div>
          <div className="h-1 rounded-full bg-surface-container-highest overflow-hidden">
            <div className="h-1 rounded-full transition-all duration-300" style={{width: pct + '%', background: fillColor}} />
          </div>
        </div>

        <button className="w-full py-2 bg-surface-container-high text-xs font-bold uppercase font-condensed rounded-sm group-hover:bg-primary group-hover:text-on-primary transition-all duration-200 mt-auto">
          View Details
        </button>
      </div>
    </div>
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
  var setScreen = ctx.setScreen;
  var isAdmin = ctx.isAdmin;

  var [tournaments, setTournaments] = useState([]);
  var [loading, setLoading] = useState(true);
  var [regCounts, setRegCounts] = useState({});
  var [activeFilter, setActiveFilter] = useState('all');
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

  var featured = tournaments.length > 0
    ? (tournaments.find(function(t) { return t.phase === 'registration' || t.phase === 'in_progress'; }) || tournaments[0])
    : null;

  var filtered = tournaments.filter(function(t) {
    if (activeFilter !== 'all' && t.phase !== activeFilter) return false;
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

        <div className="mb-8">
          <span className="font-condensed text-xs uppercase tracking-widest text-primary font-bold">Events</span>
          <h1 className="text-4xl font-black font-editorial italic text-on-surface uppercase mt-1 mb-2">Tournaments</h1>
          <p className="text-on-surface-variant text-sm font-condensed uppercase tracking-wide">Flash tournaments, competitive events, and community clashes. Free to enter, play to win.</p>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-on-surface-variant">
            <Icon name="hourglass_empty" size={32} className="animate-spin opacity-50" />
            <span className="font-condensed uppercase tracking-widest text-sm">Loading Tournaments...</span>
          </div>
        )}

        {!loading && (
          <div>
            {featured && (
              <FeaturedSpotlight
                tournament={featured}
                regCount={regCounts[featured.id] || 0}
                onView={function() { setScreen('flash-' + featured.id); }}
              />
            )}

            <section className="space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center bg-surface-container-low p-1 rounded-full border border-outline-variant/10 self-start">
                  {FILTER_TABS.map(function(tab) {
                    var isActive = activeFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={function() { setActiveFilter(tab.key); }}
                        className={'px-5 py-1.5 rounded-full text-[11px] font-condensed font-bold uppercase tracking-wider transition-all ' + (isActive ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant/60 hover:text-on-surface')}
                      >
                        {tab.label}
                      </button>
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
                    <button
                      onClick={function() { setScreen('admin'); }}
                      className="flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-5 py-2 rounded-full text-[11px] font-bold uppercase font-condensed hover:bg-primary hover:text-on-primary transition-all"
                    >
                      <Icon name="add" size={14} />
                      Create Tournament
                    </button>
                  )}
                </div>
              </div>

              {gridItems.length === 0 && !featured && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant bg-surface-container-low rounded-sm border border-outline-variant/5">
                  <Icon name="search_off" size={40} className="opacity-30" />
                  <p className="font-condensed uppercase tracking-wider text-sm">No tournaments found</p>
                  {activeFilter !== 'all' && (
                    <button
                      onClick={function() { setActiveFilter('all'); setSearch(''); }}
                      className="text-xs text-primary hover:underline font-condensed uppercase"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}

              {gridItems.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                  {gridItems.map(function(t) {
                    return (
                      <TournamentCard
                        key={t.id}
                        tournament={t}
                        regCount={regCounts[t.id] || 0}
                        onClick={function() { setScreen('flash-' + t.id); }}
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

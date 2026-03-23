import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { Panel } from '../components/ui'
import { supabase } from '../lib/supabase.js'
import PageLayout from '../components/layout/PageLayout'

export default function TournamentsListScreen() {
  var ctx = useApp();
  var setScreen = ctx.setScreen;
  var currentUser = ctx.currentUser;
  var toast = ctx.toast;

  var [tournaments, setTournaments] = useState([]);
  var [loading, setLoading] = useState(true);
  var [regCounts, setRegCounts] = useState({});

  useEffect(function() {
    supabase.from('tournaments').select('*').eq('type', 'flash_tournament').order('date', {ascending: false}).then(function(res) {
      if (res.data) setTournaments(res.data);
      setLoading(false);
    });
  }, []);

  useEffect(function() {
    if (tournaments.length === 0) return;
    var ids = tournaments.map(function(t) { return t.id; });
    supabase.from('registrations').select('tournament_id').in('tournament_id', ids).then(function(res) {
      if (!res.data) return;
      var counts = {};
      res.data.forEach(function(r) { counts[r.tournament_id] = (counts[r.tournament_id] || 0) + 1; });
      setRegCounts(counts);
    });
  }, [tournaments]);

  var phaseLabels = {draft: 'Draft', registration: 'Registration Open', check_in: 'Check-In Open', in_progress: 'In Progress', complete: 'Completed'};
  var phaseBadgeBg = {draft: 'rgba(154,170,191,.1)', registration: 'rgba(155,114,207,.15)', check_in: 'rgba(232,168,56,.15)', in_progress: 'rgba(82,196,124,.15)', complete: 'rgba(78,205,196,.15)'};
  var phaseBadgeColor = {draft: '#9AAABF', registration: '#9B72CF', check_in: '#E8A838', in_progress: '#52C47C', complete: '#4ECDC4'};

  return (

    <PageLayout>    <div className="page wrap">
      <div style={{marginBottom: 28}}>
        <h1 style={{color: '#F2EDE4', fontSize: 24, fontWeight: 700, margin: 0, marginBottom: 6}}>Tournaments</h1>
        <p style={{color: '#BECBD9', fontSize: 13, margin: 0}}>Flash tournaments, competitive events, and community clashes. Free to enter, play to win.</p>
      </div>

      {loading && <div style={{textAlign: 'center', padding: '60px 0', color: '#9AAABF'}}>Loading tournaments...</div>}

      {!loading && tournaments.length === 0 && (
        <Panel style={{padding: '48px 20px', textAlign: 'center'}}>
          <div style={{fontSize: 28, marginBottom: 12}}>{'!'}</div>
          <div style={{fontWeight: 700, fontSize: 16, color: '#F2EDE4', marginBottom: 6}}>No Tournaments Yet</div>
          <div style={{fontSize: 13, color: '#9AAABF', lineHeight: 1.5}}>Flash tournaments will appear here when admins create them.</div>
        </Panel>
      )}

      {!loading && tournaments.length > 0 && (
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14}}>
          {tournaments.map(function(t) {
            var regCount = regCounts[t.id] || 0;
            var maxP = t.max_players || 128;
            var pct = Math.min(100, Math.round((regCount / maxP) * 100));
            var dateStr = t.date ? new Date(t.date).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : 'TBD';
            var prizes = Array.isArray(t.prize_pool_json) ? t.prize_pool_json : [];
            var badgeBg = phaseBadgeBg[t.phase] || 'rgba(154,170,191,.1)';
            var badgeColor = phaseBadgeColor[t.phase] || '#9AAABF';
            var now = new Date();
            var tDate = t.date ? new Date(t.date) : null;
            var diff = tDate ? (tDate - now) : 0;
            var countdownStr = '';
            if (diff > 0) {
              var days = Math.floor(diff / 86400000);
              var hours = Math.floor((diff % 86400000) / 3600000);
              var mins = Math.floor((diff % 3600000) / 60000);
              countdownStr = days > 0 ? (days + 'd ' + hours + 'h') : (hours > 0 ? (hours + 'h ' + mins + 'm') : (mins + 'm'));
            }
            return (
              <div key={t.id} onClick={function() { setScreen('flash-' + t.id); }} style={{background: 'rgba(17,24,39,.85)', border: '1px solid rgba(242,237,228,.06)', borderRadius: 12, padding: '20px', cursor: 'pointer', transition: 'border-color .2s, transform .15s'}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8, flexWrap: 'wrap'}}>
                  <span style={{fontSize: 11, fontWeight: 700, color: badgeColor, background: badgeBg, borderRadius: 20, padding: '3px 10px', letterSpacing: '.4px', textTransform: 'uppercase'}}>{phaseLabels[t.phase] || t.phase}</span>
                  <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                    {countdownStr && (
                      <span style={{fontSize: 11, fontWeight: 700, color: '#E8A838', background: 'rgba(232,168,56,.1)', borderRadius: 12, padding: '2px 8px', border: '1px solid rgba(232,168,56,.2)'}}>{'\u23F0 ' + countdownStr}</span>
                    )}
                    <span style={{fontSize: 11, color: '#9AAABF'}}>{dateStr}</span>
                  </div>
                </div>
                <div style={{fontWeight: 700, fontSize: 17, color: '#F2EDE4', marginBottom: 8}}>{t.name}</div>
                {prizes.length > 0 && (
                  <div style={{display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap'}}>
                    {prizes.slice(0, 3).map(function(p, i) {
                      return <span key={i} style={{background: 'rgba(232,168,56,.1)', border: '1px solid rgba(232,168,56,.2)', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: '#E8A838', fontWeight: 600}}>{'#' + p.placement + ' ' + p.prize}</span>;
                    })}
                  </div>
                )}
                <div style={{marginBottom: 6}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#BECBD9', marginBottom: 4}}>
                    <span>{regCount + ' / ' + maxP + ' players'}</span>
                    <span>{pct + '%'}</span>
                  </div>
                  <div style={{height: 4, borderRadius: 2, background: 'rgba(255,255,255,.06)'}}>
                    <div style={{height: 4, borderRadius: 2, background: pct >= 90 ? '#F87171' : pct >= 60 ? '#E8A838' : '#9B72CF', width: pct + '%', transition: 'width .3s'}}/>
                  </div>
                </div>
                <div style={{fontSize: 12, color: '#9AAABF'}}>{(t.round_count || 3) + ' games \u00B7 ' + (t.seeding_method || 'snake') + ' seeding'}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </PageLayout>
  );
}

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { TIER_PRICES } from '../../lib/paypal.js'
import { Panel, Icon } from '../../components/ui'

function tierColor(tier) {
  if (tier === 'host') return '#9B72CF'
  if (tier === 'bundle') return '#E8A838'
  if (tier === 'pro') return '#4ECDC4'
  if (tier === 'scrim') return '#6EE7B7'
  return '#BECBD9'
}

function tierPrice(tier) {
  return TIER_PRICES[tier] || 0
}

function TierBar(props) {
  var tier = props.tier
  var count = props.count
  var total = props.total
  var pct = total > 0 ? Math.round((count / total) * 100) : 0
  var revenue = count * tierPrice(tier)
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="font-nav text-[10px] uppercase tracking-wider font-bold w-16 text-on-surface/50">{tier}</div>
      <div className="flex-1 h-3 bg-surface-container rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: pct + '%', backgroundColor: tierColor(tier) }} />
      </div>
      <div className="font-mono text-xs font-bold text-on-surface/60 w-8 text-right">{count}</div>
      <div className="font-mono text-xs font-bold text-primary w-16 text-right">${revenue.toFixed(0)}</div>
    </div>
  )
}

export default function OpsRevenue() {
  var _subs = useState([])
  var subs = _subs[0]
  var setSubs = _subs[1]

  var _recentSubs = useState([])
  var recentSubs = _recentSubs[0]
  var setRecentSubs = _recentSubs[1]

  var _newsletter = useState(0)
  var newsletter = _newsletter[0]
  var setNewsletter = _newsletter[1]

  var _loading = useState(true)
  var loading = _loading[0]
  var setLoading = _loading[1]

  useEffect(function() {
    Promise.all([
      supabase.from('user_subscriptions').select('tier, status, created_at, user_id, players(username)').eq('status', 'active'),
      supabase.from('user_subscriptions').select('tier, status, created_at, user_id, players(username)').order('created_at', { ascending: false }).limit(20),
      supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }),
    ]).then(function(results) {
      setSubs(results[0].data || [])
      setRecentSubs(results[1].data || [])
      setNewsletter(results[2].count || 0)
      setLoading(false)
    }).catch(function() { setLoading(false) })
  }, [])

  var tierCounts = {}
  subs.forEach(function(s) { tierCounts[s.tier] = (tierCounts[s.tier] || 0) + 1 })
  var totalSubs = subs.length

  var mrr = (tierCounts.pro || 0) * TIER_PRICES.pro
    + (tierCounts.scrim || 0) * TIER_PRICES.scrim
    + (tierCounts.bundle || 0) * TIER_PRICES.bundle
    + (tierCounts.host || 0) * TIER_PRICES.host

  var arr = mrr * 12

  if (loading) {
    return (
      <div className="py-12 text-center text-on-surface/30 text-xs font-nav uppercase tracking-widest">Loading revenue data...</div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Revenue KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-surface-container-low border border-outline-variant/10 rounded p-4">
          <div className="font-nav text-[10px] uppercase tracking-widest text-on-surface/40 font-bold mb-1">MRR</div>
          <div className="font-mono text-3xl font-black text-primary">${mrr.toFixed(0)}</div>
          <div className="font-nav text-[10px] text-on-surface/30 uppercase">Monthly recurring</div>
        </div>
        <div className="bg-surface-container-low border border-outline-variant/10 rounded p-4">
          <div className="font-nav text-[10px] uppercase tracking-widest text-on-surface/40 font-bold mb-1">ARR</div>
          <div className="font-mono text-3xl font-black text-on-surface">${arr.toFixed(0)}</div>
          <div className="font-nav text-[10px] text-on-surface/30 uppercase">Annual projected</div>
        </div>
        <div className="bg-surface-container-low border border-outline-variant/10 rounded p-4">
          <div className="font-nav text-[10px] uppercase tracking-widest text-on-surface/40 font-bold mb-1">Active Subs</div>
          <div className="font-mono text-3xl font-black text-tertiary">{totalSubs}</div>
          <div className="font-nav text-[10px] text-on-surface/30 uppercase">Paying users</div>
        </div>
        <div className="bg-surface-container-low border border-outline-variant/10 rounded p-4">
          <div className="font-nav text-[10px] uppercase tracking-widest text-on-surface/40 font-bold mb-1">Newsletter</div>
          <div className="font-mono text-3xl font-black text-on-surface">{newsletter}</div>
          <div className="font-nav text-[10px] text-on-surface/30 uppercase">Subscribers</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Tier Breakdown */}
        <Panel>
          <div className="flex items-center gap-2 mb-4">
            <Icon name="monetization_on" size={16} className="text-primary" />
            <span className="font-bold text-sm text-on-surface">Subscription Tiers</span>
          </div>
          {totalSubs === 0 ? (
            <div className="text-center py-6 text-on-surface/20 text-xs font-nav uppercase tracking-widest">No active subscriptions yet</div>
          ) : (
            <div>
              <div className="flex items-center gap-3 py-1 mb-2">
                <div className="w-16" />
                <div className="flex-1 text-[10px] text-on-surface/30 font-nav uppercase tracking-wider">Distribution</div>
                <div className="w-8 text-[10px] text-on-surface/30 font-nav uppercase tracking-wider text-right">#</div>
                <div className="w-16 text-[10px] text-on-surface/30 font-nav uppercase tracking-wider text-right">Rev</div>
              </div>
              <TierBar tier="host" count={tierCounts.host || 0} total={totalSubs} />
              <TierBar tier="bundle" count={tierCounts.bundle || 0} total={totalSubs} />
              <TierBar tier="pro" count={tierCounts.pro || 0} total={totalSubs} />
              <TierBar tier="scrim" count={tierCounts.scrim || 0} total={totalSubs} />
              <div className="border-t border-outline-variant/10 mt-3 pt-3 flex justify-between items-center">
                <span className="font-nav text-[10px] uppercase tracking-wider text-on-surface/40 font-bold">Total MRR</span>
                <span className="font-mono text-xl font-black text-primary">${mrr.toFixed(2)}</span>
              </div>
            </div>
          )}
        </Panel>

        {/* Recent Subscription Activity */}
        <Panel className="!p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-2">
            <Icon name="receipt_long" size={16} className="text-tertiary" />
            <span className="font-nav text-xs font-bold uppercase tracking-widest text-on-surface/60">
              Recent Subscription Activity
            </span>
          </div>
          {recentSubs.length === 0 ? (
            <div className="py-8 text-center text-on-surface/20 text-xs font-nav uppercase tracking-widest">No subscriptions yet</div>
          ) : (
            <div className="max-h-[350px] overflow-y-auto">
              {recentSubs.map(function(s, i) {
                var player = s.players || {}
                return (
                  <div key={s.user_id + '-' + (s.created_at || i)} className="flex items-center gap-3 px-4 py-2.5 border-b border-outline-variant/5 last:border-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ backgroundColor: tierColor(s.tier) }}>
                      {(player.username || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-on-surface truncate">{player.username || 'Unknown'}</div>
                      <div className="font-nav text-[10px] text-on-surface/25 uppercase">{s.tier} / {s.status}</div>
                    </div>
                    <span className="font-mono text-xs font-bold" style={{ color: tierColor(s.tier) }}>${tierPrice(s.tier)}/mo</span>
                    <span className="font-mono text-[10px] text-on-surface/25 shrink-0">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString() : '-'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

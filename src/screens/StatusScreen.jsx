import { useEffect, useState } from 'react'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Icon, Panel } from '../components/ui'
import { supabase } from '../lib/supabase'

var COMPONENTS = [
  { id: 'web',  label: 'Web App',         desc: 'tftclash.com SPA' },
  { id: 'api',  label: 'Serverless API',  desc: '/api/health, /api/paypal-webhook' },
  { id: 'db',   label: 'Database',        desc: 'Supabase Postgres + Auth' },
  { id: 'pay',  label: 'Payments',        desc: 'PayPal subscriptions' }
]

function StatusPill(props) {
  var ok = props.status === 'ok'
  var degraded = props.status === 'degraded'
  var label = ok ? 'Operational' : (degraded ? 'Degraded' : 'Down')
  var color = ok ? 'bg-success/15 text-success border-success/40'
    : degraded ? 'bg-tertiary/15 text-tertiary border-tertiary/40'
    : 'bg-error/15 text-error border-error/40'
  return (
    <span className={'inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wide ' + color}>
      <span className={'w-1.5 h-1.5 rounded-full ' + (ok ? 'bg-success' : degraded ? 'bg-tertiary' : 'bg-error')} />
      {label}
    </span>
  )
}

export default function StatusScreen() {
  var checkedState = useState(null)
  var checked = checkedState[0]
  var setChecked = checkedState[1]
  var loadingState = useState(false)
  var loading = loadingState[0]
  var setLoading = loadingState[1]

  function runChecks() {
    setLoading(true)
    var t0 = Date.now()
    var apiPromise = fetch('/api/health', { cache: 'no-store' })
      .then(function(r){ return r.ok ? r.json().then(function(j){ return { ok: true, sha: j.sha, env: j.env } }) : { ok: false } })
      .catch(function(){ return { ok: false } })
    var dbPromise = supabase.from('players').select('id', { head: true, count: 'exact' }).limit(1)
      .then(function(res){ return { ok: !res.error } })
      .catch(function(){ return { ok: false } })
    Promise.all([apiPromise, dbPromise]).then(function(results){
      var api = results[0]
      var db = results[1]
      var elapsed = Date.now() - t0
      setChecked({
        web: { status: 'ok', detail: 'Page loaded' },
        api: { status: api.ok ? 'ok' : 'down', detail: api.ok ? ('sha ' + (api.sha || '').slice(0, 7) + ' / ' + (api.env || 'unknown')) : 'health check failed' },
        db:  { status: db.ok  ? 'ok' : 'down', detail: db.ok ? 'query succeeded' : 'query failed' },
        pay: { status: 'ok', detail: 'Live PayPal status not polled from client' },
        elapsed: elapsed,
        when: new Date().toISOString()
      })
      setLoading(false)
    })
  }

  useEffect(function(){ runChecks() }, [])

  var summary = checked ? (
    (checked.web.status === 'ok' && checked.api.status === 'ok' && checked.db.status === 'ok') ? 'ok'
    : (checked.api.status === 'down' || checked.db.status === 'down') ? 'down'
    : 'degraded'
  ) : 'ok'

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto pt-8 pb-16">
        <div className="mb-8">
          <span className="font-label text-xs uppercase tracking-widest text-secondary">Live Health</span>
          <h1 className="font-editorial text-4xl md:text-5xl mt-2 text-on-surface">System Status</h1>
          <p className="text-on-surface-variant mt-3 max-w-xl">
            Live probe of the front-end, API, database, and payments. Refresh to re-run the checks.
          </p>
        </div>

        <Panel>
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="font-editorial text-xl text-on-surface">Overall</div>
              {checked && (
                <div className="text-xs text-on-surface-variant mt-1">
                  Last checked {new Date(checked.when).toLocaleTimeString()} ({checked.elapsed} ms)
                </div>
              )}
            </div>
            <StatusPill status={summary} />
          </div>

          <div className="flex flex-col gap-3">
            {COMPONENTS.map(function(c){
              var s = checked ? checked[c.id] : { status: 'ok', detail: 'Probing...' }
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 p-4 bg-surface-container-low rounded">
                  <div className="min-w-0">
                    <div className="font-bold text-on-surface text-sm">{c.label}</div>
                    <div className="text-xs text-on-surface-variant truncate">{c.desc}</div>
                    <div className="text-[11px] font-mono text-on-surface-variant/70 mt-1 truncate">{s.detail}</div>
                  </div>
                  <StatusPill status={s.status} />
                </div>
              )
            })}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <Btn variant="secondary" size="sm" icon="refresh" onClick={runChecks} disabled={loading}>
              {loading ? 'Checking...' : 'Re-check'}
            </Btn>
            <a
              href="https://discord.gg/tftclash"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <Icon name="forum" size={14} />
              Report issue in Discord
            </a>
          </div>
        </Panel>
      </div>
    </PageLayout>
  )
}

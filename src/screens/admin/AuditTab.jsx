import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { Panel, Btn, Icon } from '../../components/ui'

var AUDIT_COLS = { INFO: '#4ECDC4', ACTION: '#52C47C', WARN: '#E8A838', RESULT: '#9B72CF', BROADCAST: '#E8A838', DANGER: '#F87171' }
var FILTERS = ['All', 'ACTION', 'WARN', 'DANGER', 'BROADCAST', 'INFO']
var PAGE_SIZE = 25

export default function AuditTab() {
  var _entries = useState([])
  var entries = _entries[0]
  var setEntries = _entries[1]

  var _loading = useState(true)
  var loading = _loading[0]
  var setLoading = _loading[1]

  var _filter = useState('All')
  var filter = _filter[0]
  var setFilter = _filter[1]

  var _page = useState(0)
  var page = _page[0]
  var setPage = _page[1]

  var _hasMore = useState(true)
  var hasMore = _hasMore[0]
  var setHasMore = _hasMore[1]

  useEffect(function() {
    setEntries([])
    setPage(0)
    setHasMore(true)
    loadPage(0, filter)
  }, [filter])

  function loadPage(pageNum, currentFilter) {
    setLoading(true)
    var q = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)
    if (currentFilter && currentFilter !== 'All') q = q.eq('action', currentFilter)
    q.then(function(res) {
      setLoading(false)
      if (res.error) { console.error('[TFT] Audit fetch error:', res.error); return }
      var data = res.data || []
      if (pageNum === 0) {
        setEntries(data)
      } else {
        setEntries(function(prev) { return prev.concat(data) })
      }
      if (data.length < PAGE_SIZE) setHasMore(false)
    })
  }

  function loadMore() {
    var nextPage = page + 1
    setPage(nextPage)
    loadPage(nextPage, filter)
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(function(f) {
          var col = AUDIT_COLS[f]
          return (
            <button
              key={f}
              onClick={function() { setFilter(f) }}
              className={'px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-sm border transition-all ' + (filter === f ? 'bg-primary/10 border-primary text-primary' : 'border-outline-variant/20 text-on-surface/50 hover:bg-white/5')}
              style={filter === f && col ? { borderColor: col + '66', color: col, background: col + '18' } : {}}
            >
              {f}
            </button>
          )
        })}
      </div>

      <Panel>
        {loading && entries.length === 0 && (
          <div className="text-center py-10 text-on-surface/40 text-sm">Loading...</div>
        )}
        {!loading && entries.length === 0 && (
          <div className="text-center py-10 text-on-surface/40">
            <Icon name="assignment" size={32} className="block mx-auto mb-2" />
            <div className="text-sm">No audit entries found.</div>
          </div>
        )}
        {entries.map(function(entry) {
          var col = AUDIT_COLS[entry.action] || '#888'
          return (
            <div key={entry.id} className="flex items-start gap-3 py-2.5 border-b border-outline-variant/5 last:border-0">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm mt-0.5 flex-shrink-0 whitespace-nowrap" style={{ color: col, background: col + '18', border: '1px solid ' + col + '33' }}>{entry.action}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-on-surface">{entry.details && entry.details.message || entry.action}</div>
                <div className="text-[11px] text-on-surface/40 mt-0.5">
                  {entry.actor_name || 'System'} &mdash; {entry.created_at ? new Date(entry.created_at).toLocaleString() : ''}
                </div>
              </div>
            </div>
          )
        })}
        {hasMore && !loading && entries.length > 0 && (
          <div className="pt-4 text-center">
            <Btn variant="secondary" size="sm" onClick={loadMore}>Load More</Btn>
          </div>
        )}
        {loading && entries.length > 0 && (
          <div className="pt-3 text-center text-on-surface/40 text-xs">Loading more...</div>
        )}
      </Panel>
    </div>
  )
}

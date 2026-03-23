import { useState, useEffect } from 'react'
import PageLayout from '../components/layout/PageLayout'
import { Panel, Icon } from '../components/ui'
import { supabase } from '../lib/supabase.js'

export default function GearScreen() {
  var _items = useState([])
  var items = _items[0]
  var setItems = _items[1]
  var _loading = useState(true)
  var loading = _loading[0]
  var setLoading = _loading[1]

  useEffect(function() {
    supabase.from('gear_items').select('*').order('sort_order').then(function(res) {
      if (res.data) setItems(res.data)
      setLoading(false)
    })
  }, [])

  var categories = []
  items.forEach(function(item) {
    if (categories.indexOf(item.category) === -1) categories.push(item.category)
  })

  return (
    <PageLayout showSidebar={false}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-on-surface mb-1" style={{ fontFamily: "'Playfair Display',serif" }}>Gear</h2>
        <div className="text-sm text-on-surface/40">Official TFT Clash merchandise and gear</div>
      </div>

      {loading && (
        <div className="text-center py-10 text-sm text-on-surface/40">Loading...</div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-16 text-sm text-on-surface/40">
          <div className="mb-3 opacity-50">
            <Icon name="shopping_bag" className="text-4xl" />
          </div>
          No items available yet. Stay tuned for official TFT Clash merch.
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="flex flex-col gap-6">
          {categories.map(function(cat) {
            var catItems = items.filter(function(i) { return i.category === cat })
            return (
              <div key={cat}>
                <div
                  className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: '#9B72CF', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: '.1em' }}
                >
                  {cat}
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>
                  {catItems.map(function(item) {
                    return (
                      <Panel key={item.id} className="p-0 overflow-hidden">
                        {item.image_url
                          ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-full object-cover"
                              style={{ height: 140 }}
                            />
                          )
                          : (
                            <div
                              className="w-full flex items-center justify-center"
                              style={{ height: 140, background: 'linear-gradient(135deg,rgba(155,114,207,.15),rgba(155,114,207,.05))' }}
                            >
                              <Icon name="shopping_bag" className="text-3xl opacity-40" style={{ color: '#9B72CF' }} />
                            </div>
                          )
                        }
                        <div className="p-3">
                          <div className="text-sm font-bold text-on-surface mb-1">{item.name}</div>
                          <div className="text-xs text-on-surface/60 mb-2 leading-relaxed">{item.description || ''}</div>
                          <div className="flex items-center justify-between">
                            {item.price && (
                              <span className="text-sm font-bold" style={{ color: '#E8A838' }}>{item.price}</span>
                            )}
                            {item.external_url && (
                              <a
                                href={item.external_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-semibold"
                                style={{ color: '#9B72CF', textDecoration: 'none' }}
                              >
                                View
                              </a>
                            )}
                          </div>
                        </div>
                      </Panel>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PageLayout>
  )
}

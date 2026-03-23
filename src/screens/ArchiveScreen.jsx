import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { PAST_CLASHES } from '../lib/constants.js'
import { ordinal } from '../lib/utils.js'
import PageLayout from '../components/layout/PageLayout'
import PageHeader from '../components/shared/PageHeader'
import { Panel, Btn } from '../components/ui'

export default function ArchiveScreen() {
  var navigate = useNavigate()
  var ctx = useApp()
  var pastClashes = ctx.pastClashes
  var currentUser = ctx.currentUser

  var [open, setOpen] = useState(null)

  var all = (pastClashes && pastClashes.length > 0) ? pastClashes : (PAST_CLASHES || [])

  function toggleOpen(id) {
    setOpen(function(prev) { return prev === id ? null : id })
  }

  return (
    <PageLayout>
      <div className="pt-8 pb-16">
        <PageHeader
          title="Clash"
          goldWord="Archive"
          description={all.length + ' event' + (all.length !== 1 ? 's' : '') + ' recorded'}
        />

        <div className="mb-4">
          <Btn variant="ghost" size="sm" onClick={function() { navigate(-1) }}>
            Back
          </Btn>
        </div>

        {all.length === 0 && (
          <div className="text-center py-16">
            <i className="ti ti-inbox text-5xl text-on-surface/20 block mb-4" />
            <div className="font-bold text-base text-on-surface mb-2">No clashes archived yet</div>
            <div className="text-sm text-on-surface/50">
              Completed clashes will appear here after the admin finalizes them.
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {all.map(function(c) {
            var myFinish = currentUser ? (c.top3 || []).indexOf(currentUser.username) : -1
            var myPos = myFinish >= 0 ? myFinish + 1 : null
            var isOpen = open === c.id

            return (
              <Panel key={c.id} className="overflow-hidden p-0">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-[#0A0F1A] hover:bg-[#0D1220] transition-colors"
                  onClick={function() { toggleOpen(c.id) }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{
                      background: 'rgba(232,168,56,.08)',
                      border: '1px solid rgba(232,168,56,.2)',
                      color: '#E8A838',
                    }}
                  >
                    {'#' + c.id}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-on-surface">{c.name}</div>
                    <div className="text-[11px] text-on-surface/50 mt-0.5 font-['Barlow_Condensed',sans-serif]">
                      {c.date}
                      {c.season ? ' - ' + c.season : ''}
                      {c.players ? ' - ' + c.players + 'p' : ''}
                      {c.lobbies ? ' - ' + c.lobbies + (c.lobbies === 1 ? ' lobby' : ' lobbies') : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <i className="ti ti-trophy text-sm text-[#E8A838]" />
                    <span className="font-bold text-[#E8A838] text-xs">{c.champion}</span>
                    <span className="text-on-surface/40 text-xs ml-1">{isOpen ? 'v' : '>'}</span>
                  </div>
                </div>

                {isOpen && (
                  <div
                    className="px-4 py-4"
                    style={{
                      background: '#0D121E',
                      borderTop: '1px solid rgba(242,237,228,.07)',
                    }}
                  >
                    {(c.top3 && c.top3.length > 0) && (
                      <div className="mb-4">
                        <div
                          className="text-[11px] font-bold uppercase tracking-widest mb-3"
                          style={{ color: '#C8D4E0' }}
                        >
                          Top Finishers
                        </div>
                        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))' }}>
                          {c.top3.map(function(name, i) {
                            var placeColor = i === 0 ? '#E8A838' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#9B72CF'
                            return (
                              <div
                                key={i}
                                className="rounded-lg py-2 px-3 text-center"
                                style={{
                                  background: 'rgba(232,168,56,.05)',
                                  border: '1px solid rgba(232,168,56,.15)',
                                }}
                              >
                                <div className="text-base mb-1">
                                  <i className="ti ti-award" style={{ color: placeColor }} />
                                </div>
                                <div className="text-xs font-bold" style={{ color: placeColor }}>{name}</div>
                                <div className="text-[10px] text-on-surface/40 mt-0.5">{ordinal(i + 1)}</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {c.report && (
                      <div className="flex gap-2 flex-wrap mb-4">
                        {c.report.mostImproved && (
                          <div
                            className="rounded-lg px-3 py-2 text-xs"
                            style={{
                              background: 'rgba(78,205,196,.06)',
                              border: '1px solid rgba(78,205,196,.2)',
                            }}
                          >
                            <span className="font-bold" style={{ color: '#4ECDC4' }}>
                              <i className="ti ti-trending-up mr-1" />
                              Most Improved:
                            </span>{' '}
                            <span className="text-on-surface">{c.report.mostImproved}</span>
                          </div>
                        )}
                        {c.report.biggestUpset && (
                          <div
                            className="rounded-lg px-3 py-2 text-xs"
                            style={{
                              background: 'rgba(248,113,113,.06)',
                              border: '1px solid rgba(248,113,113,.2)',
                            }}
                          >
                            <span className="font-bold" style={{ color: '#F87171' }}>
                              <i className="ti ti-bolt mr-1" />
                              Upset:
                            </span>{' '}
                            <span className="text-on-surface">{c.report.biggestUpset}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {myPos && (
                      <div
                        className="rounded-xl px-4 py-3 flex items-center gap-3"
                        style={{
                          background: 'rgba(155,114,207,.08)',
                          border: '1px solid rgba(155,114,207,.25)',
                        }}
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-extrabold flex-shrink-0"
                          style={{
                            background: 'rgba(155,114,207,.15)',
                            border: '1px solid rgba(155,114,207,.4)',
                            color: '#9B72CF',
                          }}
                        >
                          {'#' + myPos}
                        </div>
                        <div>
                          <div className="font-bold text-sm" style={{ color: '#C4B5FD' }}>Your Position</div>
                          <div className="text-xs text-on-surface/60">
                            {currentUser.username + ' finished ' + ordinal(myPos) + ' in this event'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Panel>
            )
          })}
        </div>
      </div>
    </PageLayout>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Panel, Icon } from '../components/ui'
import SectionHeader from '../components/shared/SectionHeader.jsx'
import { readMyPredictionsAcrossThreads, scorePrediction, clearPrediction } from '../lib/predictions.js'

function eventIdFromThread(threadId) {
  if (!threadId) return null
  if (threadId.indexOf('t-') === 0) return threadId.slice(2)
  return null
}

function lookupName(players, id) {
  if (!id) return null
  var match = (players || []).find(function (p) { return String(p.id) === String(id) })
  if (match) return match.name
  return String(id)
}

function PredictionRow(props) {
  var entry = props.entry
  var event = props.event
  var players = props.players
  var onForget = props.onForget
  var onOpen = props.onOpen
  var isCompleted = props.isCompleted
  var actualWinnerId = props.actualWinnerId
  var actualTop4Ids = props.actualTop4Ids

  var winnerName = lookupName(players, entry.prediction.winner)
  var top4 = entry.prediction.top4 || []
  var startsAt = event && (event.starts_at || event.startTime || event.startsAt)
  var startMs = startsAt ? new Date(startsAt).getTime() : 0
  var locked = isCompleted || (startMs && Date.now() >= startMs)

  var score = isCompleted
    ? scorePrediction(entry.prediction, actualWinnerId, actualTop4Ids)
    : 0

  var winnerHit = isCompleted && actualWinnerId && String(entry.prediction.winner) === String(actualWinnerId)
  var actualTop4Set = (actualTop4Ids || []).map(function (i) { return String(i) })

  return (
    <Panel elevation="elevated" radius="xl" padding="default">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 text-[10px] font-label tracking-widest uppercase text-on-surface-variant/60">
            <Icon name="event" size={12} />
            <span>{startsAt ? new Date(startsAt).toLocaleString() : 'Date TBD'}</span>
            {isCompleted ? (
              <span className="text-success">· Final</span>
            ) : locked ? (
              <span className="text-tertiary">· Locked</span>
            ) : (
              <span className="text-primary">· Open</span>
            )}
          </div>
          <h3 className="font-display text-lg leading-tight text-on-surface">
            {event ? (event.name || event.title || 'Tournament') : 'Unknown event'}
          </h3>
          {event && event.host && (
            <div className="text-xs text-on-surface-variant/60 mt-0.5">Hosted by {event.host}</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {isCompleted ? (
            <div className="font-display text-2xl text-tertiary">{score}<span className="text-xs text-on-surface-variant/60 ml-1">pts</span></div>
          ) : null}
          {event && (
            <Btn variant="ghost" size="sm" icon="open_in_new" onClick={function () { onOpen(event) }}>
              View
            </Btn>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg bg-surface-container-high border border-outline-variant/10 p-3">
          <div className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/60 mb-1">Your winner pick</div>
          <div className="flex items-center gap-2">
            <span className="font-display text-base text-on-surface">{winnerName || '—'}</span>
            {isCompleted && (winnerHit ? (
              <span className="text-xs px-1.5 py-0.5 rounded bg-success/15 text-success font-label tracking-wide">+5 HIT</span>
            ) : (
              <span className="text-xs px-1.5 py-0.5 rounded bg-error/10 text-on-surface-variant/60 font-label tracking-wide">MISS</span>
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-surface-container-high border border-outline-variant/10 p-3">
          <div className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/60 mb-1">Your top 4</div>
          {top4.length === 0 ? (
            <div className="text-xs text-on-surface-variant/40 italic">none</div>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {top4.map(function (id) {
                var name = lookupName(players, id)
                var hit = isCompleted && actualTop4Set.indexOf(String(id)) >= 0
                return (
                  <li
                    key={String(id)}
                    className={'text-xs px-2 py-0.5 rounded-full border ' + (isCompleted
                      ? (hit ? 'bg-success/15 border-success/40 text-success' : 'bg-surface-container border-outline-variant/15 text-on-surface-variant/50')
                      : 'bg-primary/10 border-primary/30 text-on-surface')}
                  >
                    {name}
                    {hit && ' +2'}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant/10 text-[10px] font-label tracking-widest uppercase text-on-surface-variant/40">
        <span>Submitted {entry.prediction.ts ? new Date(entry.prediction.ts).toLocaleDateString() : '—'}</span>
        {!locked && (
          <button
            type="button"
            onClick={function () { onForget(entry.threadId) }}
            className="text-error hover:underline"
          >
            forget pick
          </button>
        )}
      </div>
    </Panel>
  )
}

export default function PredictionsScreen() {
  var navigate = useNavigate()
  var ctx = useApp()
  var currentUser = ctx.currentUser
  var featuredEvents = ctx.featuredEvents
  var players = ctx.players
  var setScreen = ctx.setScreen
  var pastClashes = ctx.pastClashes

  var _entries = useState(function () { return readMyPredictionsAcrossThreads(currentUser) })
  var entries = _entries[0]
  var setEntries = _entries[1]

  useEffect(function () {
    function refresh() { setEntries(readMyPredictionsAcrossThreads(currentUser)) }
    function onStorage(e) {
      if (e.key === 'tft-predictions-v1') refresh()
    }
    window.addEventListener('storage', onStorage)
    return function () { window.removeEventListener('storage', onStorage) }
  }, [currentUser])

  function findEvent(eventId) {
    if (!eventId) return null
    var all = featuredEvents || []
    var match = all.find(function (e) { return String(e.id) === String(eventId) })
    if (match) return match
    var pastMatch = (pastClashes || []).find(function (c) { return String(c.id) === String(eventId) })
    return pastMatch || null
  }

  function handleForget(threadId) {
    clearPrediction(threadId, currentUser)
    setEntries(readMyPredictionsAcrossThreads(currentUser))
  }

  function handleOpen(event) {
    if (!event) return
    if (event.id) {
      navigate('/tournament/' + event.id)
      if (typeof setScreen === 'function') setScreen('tournament-' + event.id)
    }
  }

  var openCount = 0
  var lockedCount = 0
  var finalCount = 0
  var totalScore = 0

  var rowProps = entries.map(function (entry) {
    var eventId = eventIdFromThread(entry.threadId)
    var event = findEvent(eventId)
    var startsAt = event && (event.starts_at || event.startTime || event.startsAt)
    var startMs = startsAt ? new Date(startsAt).getTime() : 0

    var standings = []
    if (event && event.results && Array.isArray(event.results)) standings = event.results
    var isCompleted = !!(event && (event.completed || event.is_completed || (standings.length > 0)))
    var actualWinnerId = isCompleted && standings[0] ? (standings[0].player_id || standings[0].id) : null
    var actualTop4Ids = isCompleted ? standings.slice(0, 4).map(function (s) { return s.player_id || s.id }) : []

    if (isCompleted) {
      finalCount += 1
      totalScore += scorePrediction(entry.prediction, actualWinnerId, actualTop4Ids)
    } else if (startMs && Date.now() >= startMs) {
      lockedCount += 1
    } else {
      openCount += 1
    }

    return {
      entry: entry,
      event: event,
      isCompleted: isCompleted,
      actualWinnerId: actualWinnerId,
      actualTop4Ids: actualTop4Ids,
    }
  })

  return (
    <PageLayout>
      <div className="space-y-6">
        <SectionHeader
          eyebrow="Your picks"
          title="Predictions dashboard"
          subtitle="Every winner + top-4 you've called across the platform. Scoring locks at lobby start."
        />

        {!currentUser && (
          <Panel elevation="elevated" radius="xl" padding="default">
            <div className="flex items-center gap-3">
              <Icon name="info" className="text-on-surface-variant" />
              <div className="text-sm text-on-surface-variant flex-1">
                Sign in to sync your picks across devices. Guest picks are stored on this browser only.
              </div>
              <Btn variant="primary" size="sm" onClick={function () { navigate('/login') }}>Sign in</Btn>
            </div>
          </Panel>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Panel elevation="elevated" radius="xl" padding="default" className="text-center">
            <div className="font-display text-3xl text-on-surface">{entries.length}</div>
            <div className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/60 mt-1">Total picks</div>
          </Panel>
          <Panel elevation="elevated" radius="xl" padding="default" className="text-center">
            <div className="font-display text-3xl text-primary">{openCount}</div>
            <div className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/60 mt-1">Open</div>
          </Panel>
          <Panel elevation="elevated" radius="xl" padding="default" className="text-center">
            <div className="font-display text-3xl text-tertiary">{lockedCount}</div>
            <div className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/60 mt-1">Locked</div>
          </Panel>
          <Panel elevation="elevated" radius="xl" padding="default" className="text-center">
            <div className="font-display text-3xl text-success">{totalScore}</div>
            <div className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/60 mt-1">Total points · {finalCount} final</div>
          </Panel>
        </div>

        {entries.length === 0 ? (
          <Panel elevation="elevated" radius="xl" padding="default">
            <div className="text-center py-8">
              <Icon name="psychology" className="text-on-surface-variant/40 text-5xl mb-3" />
              <div className="font-display text-lg text-on-surface mb-1">No predictions yet</div>
              <div className="text-sm text-on-surface-variant/60 mb-4">
                Pick a winner + top 4 on any tournament to start tracking.
              </div>
              <Btn variant="primary" size="sm" icon="event" onClick={function () { navigate('/events') }}>
                Browse events
              </Btn>
            </div>
          </Panel>
        ) : (
          <div className="space-y-3">
            {rowProps.map(function (row) {
              return (
                <PredictionRow
                  key={row.entry.threadId}
                  entry={row.entry}
                  event={row.event}
                  players={players}
                  isCompleted={row.isCompleted}
                  actualWinnerId={row.actualWinnerId}
                  actualTop4Ids={row.actualTop4Ids}
                  onForget={handleForget}
                  onOpen={handleOpen}
                />
              )
            })}
          </div>
        )}
      </div>
    </PageLayout>
  )
}

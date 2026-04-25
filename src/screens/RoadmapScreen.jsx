import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import PageLayout from '../components/layout/PageLayout'
import { Btn, Panel, Icon } from '../components/ui'
import SectionHeader from '../components/shared/SectionHeader.jsx'
import {
  readIdeas,
  readMyVotes,
  toggleVote,
  submitIdea,
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_ORDER,
} from '../lib/roadmap.js'

function IdeaCard(props) {
  var idea = props.idea
  var voted = !!props.voted
  var onVote = props.onVote
  var statusColor = STATUS_COLORS[idea.status] || 'text-on-surface-variant'

  return (
    <Panel elevation="elevated" radius="xl" padding="default" className="flex gap-4 items-start">
      <button
        onClick={function () { onVote(idea.id) }}
        className={'shrink-0 flex flex-col items-center justify-center min-w-[60px] h-[64px] rounded-lg border transition-colors ' + (voted ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-surface-container-high border-outline-variant/15 text-on-surface hover:border-primary/30')}
        aria-label={voted ? 'Remove vote' : 'Vote'}
      >
        <Icon name={voted ? 'thumb_up' : 'thumb_up_off_alt'} size={18} />
        <span className="font-mono text-sm font-bold">{idea.votes || 0}</span>
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={'font-label text-[10px] tracking-widest uppercase font-bold ' + statusColor}>
            {STATUS_LABELS[idea.status] || idea.status}
          </span>
          {idea.submittedBy && (
            <span className="text-[10px] text-on-surface-variant/40">{'by ' + idea.submittedBy}</span>
          )}
        </div>
        <h3 className="font-display text-base font-bold text-on-surface mb-1 leading-tight">{idea.title}</h3>
        {idea.body && <p className="text-sm text-on-surface-variant leading-snug">{idea.body}</p>}
      </div>
    </Panel>
  )
}

export default function RoadmapScreen() {
  var ctx = useApp()
  var currentUser = ctx.currentUser
  var toast = ctx.toast

  var _ideas = useState(function () { return readIdeas() })
  var ideas = _ideas[0]
  var setIdeas = _ideas[1]

  var _myVotes = useState(function () { return readMyVotes() })
  var myVotes = _myVotes[0]
  var setMyVotes = _myVotes[1]

  var _showSubmit = useState(false)
  var showSubmit = _showSubmit[0]
  var setShowSubmit = _showSubmit[1]

  var _title = useState('')
  var title = _title[0]
  var setTitle = _title[1]
  var _body = useState('')
  var body = _body[0]
  var setBody = _body[1]

  useEffect(function () {
    function onStorage(e) {
      if (!e.key) return
      if (e.key.indexOf('tft-roadmap-') === 0) {
        setIdeas(readIdeas())
        setMyVotes(readMyVotes())
      }
    }
    window.addEventListener('storage', onStorage)
    return function () { window.removeEventListener('storage', onStorage) }
  }, [])

  function onVote(id) {
    var res = toggleVote(id)
    setIdeas(res.ideas)
    setMyVotes(res.myVotes)
  }

  function onSubmit() {
    if (!title.trim() || title.trim().length < 4) {
      toast && toast('Idea title needs at least 4 characters', 'error')
      return
    }
    var who = (currentUser && currentUser.username) || 'anonymous'
    var res = submitIdea({ title: title.trim(), body: body.trim(), submittedBy: who })
    setIdeas(res.ideas)
    setMyVotes(res.myVotes)
    setTitle('')
    setBody('')
    setShowSubmit(false)
    toast && toast('Idea submitted to roadmap', 'success')
  }

  var grouped = {}
  STATUS_ORDER.forEach(function (s) { grouped[s] = [] })
  ideas.forEach(function (idea) {
    var key = grouped[idea.status] ? idea.status : 'considering'
    grouped[key].push(idea)
  })
  Object.keys(grouped).forEach(function (k) {
    grouped[k].sort(function (a, b) { return (b.votes || 0) - (a.votes || 0) })
  })

  return (
    <PageLayout maxWidth="max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 inline-flex mb-4">
          <Icon name="rocket_launch" className="text-primary text-sm" />
          <span className="font-label text-xs tracking-widest uppercase text-primary font-semibold">Public Roadmap</span>
        </div>
        <h1 className="font-editorial italic text-on-background font-extrabold leading-tight mb-3" style={{ fontSize: 'clamp(28px,4vw,42px)' }}>
          What we're building<br />
          <span className="text-primary">and what's coming next.</span>
        </h1>
        <p className="text-on-surface-variant max-w-2xl">
          Vote on what matters. Top-voted ideas get bumped into Planned each month.
          Submit your own — we read every one.
        </p>
        <div className="mt-5 flex gap-2 flex-wrap">
          <Btn variant="primary" size="sm" icon="lightbulb" onClick={function () { setShowSubmit(function (v) { return !v }) }}>
            {showSubmit ? 'Cancel' : 'Submit an idea'}
          </Btn>
        </div>
      </div>

      {showSubmit && (
        <Panel elevation="elevated" radius="xl" padding="default" className="mb-6 space-y-3">
          <SectionHeader eyebrow="New idea" title="Suggest a feature" />
          <input
            type="text"
            value={title}
            onChange={function (e) { setTitle(e.target.value.slice(0, 100)) }}
            placeholder="Short title (e.g. Auto-DM tournament reminders)"
            className="w-full bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/40"
          />
          <textarea
            value={body}
            onChange={function (e) { setBody(e.target.value.slice(0, 500)) }}
            placeholder="Why it matters + how you'd see it work (optional)"
            rows={3}
            className="w-full bg-surface-container-high border border-outline-variant/15 rounded px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-primary/40 resize-none"
          />
          <div className="flex gap-2 justify-end">
            <Btn variant="secondary" size="sm" onClick={function () { setShowSubmit(false) }}>Cancel</Btn>
            <Btn variant="primary" size="sm" icon="send" onClick={onSubmit} disabled={title.trim().length < 4}>
              Submit
            </Btn>
          </div>
        </Panel>
      )}

      <div className="space-y-10">
        {STATUS_ORDER.map(function (s) {
          var list = grouped[s] || []
          if (list.length === 0) return null
          return (
            <div key={s}>
              <div className="flex items-center gap-3 mb-4">
                <div className={'w-2 h-2 rounded-full ' + (s === 'shipping' ? 'bg-tertiary' : s === 'planned' ? 'bg-primary' : s === 'shipped' ? 'bg-success' : 'bg-on-surface-variant')} />
                <h2 className={'font-label text-sm tracking-widest uppercase font-bold ' + (STATUS_COLORS[s] || 'text-on-surface-variant')}>
                  {STATUS_LABELS[s]}
                </h2>
                <span className="text-xs font-mono text-on-surface-variant/40">{list.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {list.map(function (idea) {
                  return (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      voted={!!myVotes[idea.id]}
                      onVote={onVote}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </PageLayout>
  )
}

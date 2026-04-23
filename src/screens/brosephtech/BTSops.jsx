import React from 'react';
import { supabase } from '../../lib/supabase';
import { BT_CREW, getCrewForStepRole, cardAssignees, workloadStatus } from '../../lib/btcrew';
import useBTSync from './useBTSync';

var SOPS_TABLES = ['bt_content_cards'];
var ACTIVE_COLUMN_IDS = ['ideas', 'writing', 'production', 'review'];

var SOPS = [
  {
    id: 'short',
    title: 'Short-Form Production',
    subtitle: 'TikTok / YouTube Shorts - 30 to 90 seconds',
    icon: 'bolt',
    color: '#E8A020',
    owner: 'Levitate + Cathy + Bacrif',
    cadenceTarget: '3-5 per week',
    steps: [
      { role: 'Levitate', action: 'Pick topic: trending TFT mechanic, patch highlight, or hot meta build. Must be explainable in under 60 seconds. Confirm there is current search interest by checking TFT Reddit hot posts and pro Twitter.' },
      { role: 'Cathy', action: 'Write 30-60 second script. Hook must land in the first 3 seconds with a pattern break (e.g. "This augment combo is broken" / "You need to stop ignoring this"). Max 120 words total.' },
      { role: 'Levitate', action: 'Approve script or request changes. One revision cycle max - speed matters more than perfection on shorts.' },
      { role: 'Levitate', action: 'Record gameplay showing exactly what the script describes. Capture minimum 2x the footage length you need so the editor has cut options.' },
      { role: 'Bacrif', action: 'Edit: cut dead time aggressively, add captions (auto-gen then verify every word), trending audio if appropriate, 1-second BrosephTech wing flash as intro. Export 9:16 1080x1920 mp4.' },
      { role: 'Axel', action: 'Design TikTok cover frame if needed (TikTok shows first frame as thumbnail). Bold 4-word text + clear hero subject, BT blue/gold palette.' },
      { role: 'Levitate', action: 'Upload to TikTok + YouTube Shorts. Schedule for peak time (8-9pm CET) or post immediately if the topic is time-sensitive (patch day).' },
      { role: 'Levitate', action: 'Monitor first 2 hours. Reply to all comments in first hour. Check view velocity at 30 min and 2 hrs. After 48 hrs, note avg views in the Metrics tab.' },
    ],
    tips: [
      'Avoid intros over 2 seconds - the algorithm punishes slow hooks',
      'If views stall under 500 in first hour, consider boosting with a Patreon teaser or a community post',
      'Cross-post to TikTok and YouTube Shorts simultaneously - never just one platform',
      'Use trending TFT search terms in the title and the first pinned comment',
    ],
  },
  {
    id: 'longform',
    title: 'Long-Form Production',
    subtitle: 'YouTube main channel - 10 to 20 minutes',
    icon: 'videocam',
    color: '#5BA3DB',
    owner: 'Levitate + Cathy + Bacrif + Axel',
    cadenceTarget: '1-2 per week',
    steps: [
      { role: 'Levitate', action: 'Topic research: what is the highest-searched TFT question right now? Check TFT Reddit, patch notes, pro player Twitter, TFTacademy trends. Confirm it has search volume before committing to 10+ hours of production.' },
      { role: 'Cathy', action: 'Write full script. Structure: Hook (30s) then Overview (1 min) then Deep-dive sections (bulk of video) then Summary + Patreon CTA. Aim for 1500-2000 words for a 10-12 min video.' },
      { role: 'Levitate', action: 'Review and approve script. Annotate any gameplay cues directly in the script ("show this unit combo here", "board state at stage 4-1").' },
      { role: 'Levitate', action: 'Record gameplay clips matching script cues. Record voiceover separately with a proper mic for clean audio. Save all raw files to the shared drive in the correct project folder.' },
      { role: 'Bacrif', action: 'Edit: sync voiceover with gameplay, add lower thirds for every unit/item name, BT intro card (3-5s), chapter markers matching script sections, 20s end screen with Patreon + next video CTA. Export 16:9 1080p60.' },
      { role: 'Axel', action: 'Design YouTube thumbnail. Rules: big text (3-5 words max), contrasting colors, max 3 visual elements (character/board, expression, text). A/B test two thumbnails if the topic is competitive.' },
      { role: 'Levitate', action: 'SEO pass: title with primary keyword in the first 40 chars, description with keyword in the first 150 chars plus full content summary, 5-8 tags, add to the correct playlist.' },
      { role: 'Levitate', action: 'Upload, set premiere for 48 hrs out or publish immediately if patch-relevant. Post a teaser clip in Patreon the same day. Announce on TikTok and Twitter within 1 hr of publish.' },
      { role: 'Levitate', action: 'After 7 days: log avg views in the Metrics tab. Note if the thumbnail or title was changed mid-run, and record what drove the change.' },
    ],
    tips: [
      'Patch-day videos outperform evergreen content 3:1 in the first 48 hrs - prioritize speed over polish when a patch drops',
      'Add chapter timestamps - they improve retention metrics and YouTube rewards that',
      'Cross-promote every long-form as at least 2 Shorts clips within 72 hrs',
      'If the first 500 views show under 40% retention in the first 60 seconds, the hook is broken - pull the video and re-cut',
    ],
  },
  {
    id: 'patreon',
    title: 'Patreon Post',
    subtitle: 'Exclusive member content and early access',
    icon: 'volunteer_activism',
    color: '#FF424D',
    owner: 'Levitate',
    cadenceTarget: '2+ per week',
    steps: [
      { role: 'Levitate', action: 'Pick exclusive content type: early access to an upcoming video, a detailed written guide, a tier list breakdown, a Q&A session, or a behind-the-scenes process post.' },
      { role: 'Levitate', action: 'Draft the post. Written posts should be 400-800 words with images where they add value. Video posts can use unedited raw footage or early-access cuts of upcoming main channel content.' },
      { role: 'Levitate', action: 'Set the correct tier visibility. All-access = all tiers. Exclusive content = paid tiers only. Early access videos get a 48-hour paid-tier window before going public.' },
      { role: 'Levitate', action: 'Publish and announce on Twitter + TikTok with a teaser: "Full breakdown exclusive to Patreon members - link in bio". Always drive external traffic toward the Patreon page on every announcement.' },
    ],
    tips: [
      'Post at least 2x per week to justify the membership fee - members expect value per dollar',
      'The best Patreon hook is content that directly helps rank up - meta guides, coaching session replays, tier lists before public release',
      'Monthly goal: 1 major exclusive guide + 4+ smaller supporting posts',
      'Pin a welcome post at the top of the Patreon feed so new members instantly see value',
    ],
  },
  {
    id: 'collab',
    title: 'Collab Content',
    subtitle: 'Guest features, podcast spots, team streams',
    icon: 'group',
    color: '#A78BFA',
    owner: 'Levitate + Maestosoya + Bacrif',
    cadenceTarget: '1-2 per month',
    steps: [
      { role: 'Levitate', action: 'Identify the guest and the hook. Why is this collab interesting right now? What does each side get out of it (reach, authority, content bank)?' },
      { role: 'Maestosoya', action: 'Reach out to the guest with a tight pitch: format, expected length, deliverables for both sides, proposed dates. Keep the outreach message under 120 words.' },
      { role: 'Levitate', action: 'Once confirmed, prep a shared doc with: topic list, board state screenshots to react to, 3 guaranteed talking points the guest can carry the conversation on. Send it 48 hrs before recording.' },
      { role: 'Levitate', action: 'Record session. Use OBS with the guest on a separate audio track for clean editing. Record at least 1.5x the target runtime.' },
      { role: 'Bacrif', action: 'Cut down to target runtime, prioritize the guest\'s best insights, add BT-branded lower thirds whenever the guest speaks.' },
      { role: 'Levitate', action: 'Both channels post on the same day. Tag the guest in every caption, thumbnail, and pinned comment. Cross-promote to their community.' },
    ],
    tips: [
      'Collabs with creators slightly larger than you have the highest ROI - they have reach, you bring the content',
      'Always clip 3-5 short-form moments from every collab for TikTok - free content bank',
      'Have a signed release or clear written agreement before the recording session, not after',
    ],
  },
];

function Icon(props) {
  return (
    <span className={'material-symbols-outlined ' + (props.className || '')} style={props.style}>
      {props.name}
    </span>
  );
}

function CrewAvatar(props) {
  var member = props.member;
  if (!member) return null;
  var size = props.size || 24;
  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center font-bold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: member.color,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18), 0 4px 12px -4px ' + member.halo,
        fontSize: size >= 36 ? 14 : 11,
      }}
      title={member.name}
    >
      {member.initial}
    </div>
  );
}

function CrewMap(props) {
  var cards = props.cards || [];
  var maxCap = 8;
  var rows = BT_CREW.map(function(m) {
    var memberCards = cards.filter(function(c) {
      if (ACTIVE_COLUMN_IDS.indexOf(c.column_id) === -1) return false;
      return cardAssignees(c).indexOf(m.name) !== -1;
    });
    var status = workloadStatus(memberCards.length);
    var pct = Math.min(100, Math.round((memberCards.length / maxCap) * 100));
    return { member: m, count: memberCards.length, status: status, pct: pct };
  });

  return (
    <div className="bg-gradient-to-br from-[#13172a] to-[#0f1320] border border-white/10 rounded-2xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="groups" className="text-[#E8A020] text-base" />
        <h3 className="text-white text-sm font-bold">The crew</h3>
        <p className="text-[11px] text-white/40">Active cards per crew member.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {rows.map(function(row) {
          return (
            <div
              key={row.member.id}
              className="bg-[#0b0e1a]/60 border border-white/5 rounded-xl px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <CrewAvatar member={row.member} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-bold truncate">{row.member.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-white text-base font-bold leading-none tabular-nums">{row.count}</p>
                  <p className="text-[9px] uppercase tracking-wider font-bold mt-0.5" style={{ color: row.status.color }}>{row.status.label}</p>
                </div>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{ width: row.pct + '%', background: row.status.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SopCard(props) {
  var sop = props.sop;
  var [open, setOpen] = React.useState(props.defaultOpen || false);

  return (
    <div className="bg-gradient-to-br from-[#13172a] to-[#0f1320] border border-white/5 rounded-2xl overflow-hidden transition-all hover:border-white/10">
      <button
        onClick={function() { setOpen(function(v) { return !v; }); }}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span
          className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: sop.color + '18', border: '1px solid ' + sop.color + '30' }}
        >
          <Icon name={sop.icon} style={{ color: sop.color }} className="text-2xl" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold">{sop.title}</p>
          <p className="text-white/40 text-sm mt-0.5">{sop.subtitle}</p>
        </div>
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">Target</p>
            <p className="text-xs text-white/60 font-semibold">{sop.cadenceTarget}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">Steps</p>
            <p className="text-xs text-white/60 font-semibold">{sop.steps.length}</p>
          </div>
        </div>
        <Icon name={open ? 'expand_less' : 'expand_more'} className="text-white/40 text-xl shrink-0" />
      </button>

      {open && (
        <div className="border-t border-white/5 px-5 pb-5 pt-4">
          <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white/30 uppercase tracking-wider font-semibold">Owner flow:</span>
              <div className="flex items-center gap-1.5">
                {sop.owner.split('+').map(function(part) {
                  var name = part.trim();
                  var member = getCrewForStepRole(name);
                  if (!member) return <span key={name} className="text-white/70">{name}</span>;
                  return (
                    <span key={member.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: member.accent, color: member.color }}>
                      <CrewAvatar member={member} size={16} />
                      <span className="font-semibold">{member.name}</span>
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="sm:hidden">
              <span className="text-white/30 uppercase tracking-wider font-semibold">Target: </span>
              <span className="text-white/70">{sop.cadenceTarget}</span>
            </div>
          </div>

          <ol className="flex flex-col gap-3 mb-5">
            {sop.steps.map(function(step, i) {
              var member = getCrewForStepRole(step.role);
              var roleColor = member ? member.color : sop.color;
              var roleAccent = member ? member.accent : (sop.color + '15');
              return (
                <li key={i} className="flex gap-3">
                  <span
                    className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold mt-0.5"
                    style={{
                      backgroundColor: sop.color + '20',
                      color: sop.color,
                      border: '1px solid ' + sop.color + '30',
                    }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <span
                      className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-1.5 py-1 rounded mr-2 mb-0.5"
                      style={{ backgroundColor: roleAccent, color: roleColor }}
                    >
                      {member ? <CrewAvatar member={member} size={16} /> : null}
                      {step.role}
                    </span>
                    <span className="text-white/80 text-sm leading-relaxed">{step.action}</span>
                  </div>
                </li>
              );
            })}
          </ol>

          <div
            className="rounded-xl p-4 border"
            style={{
              backgroundColor: sop.color + '08',
              borderColor: sop.color + '25',
            }}
          >
            <p className="text-xs font-bold mb-2.5 flex items-center gap-1.5" style={{ color: sop.color }}>
              <Icon name="tips_and_updates" className="text-base" />
              Pro tips
            </p>
            <ul className="flex flex-col gap-1.5">
              {sop.tips.map(function(tip, i) {
                return (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                    <span style={{ color: sop.color }} className="mt-0.5 font-bold">-</span>
                    <span className="flex-1">{tip}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function BTSops() {
  var [search, setSearch] = React.useState('');
  var [cards, setCards] = React.useState([]);

  function loadCards() {
    supabase
      .from('bt_content_cards')
      .select('*')
      .then(function(res) {
        if (res.error) {
          console.error('bt_content_cards load failed', res.error);
          return;
        }
        setCards(res.data || []);
      });
  }

  React.useEffect(function() {
    loadCards();
  }, []);

  useBTSync(SOPS_TABLES, function() { loadCards(); });

  var filtered = SOPS.filter(function(s) {
    if (!search.trim()) return true;
    var q = search.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.subtitle.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Russo One, sans-serif' }}>Production SOPs</h2>
          <p className="text-sm text-white/40 mt-0.5">Standard operating procedures for BrosephTech content</p>
        </div>
        <div className="relative">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-lg" />
          <input
            type="text"
            value={search}
            onChange={function(e) { setSearch(e.target.value); }}
            placeholder="Search SOPs..."
            className="bg-[#13172a] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white text-sm focus:outline-none focus:border-[#5BA3DB] transition-colors w-64"
          />
        </div>
      </div>

      <CrewMap cards={cards} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-gradient-to-br from-[#5BA3DB]/10 to-transparent border border-[#5BA3DB]/15 rounded-xl p-4">
          <Icon name="rocket_launch" className="text-[#5BA3DB] text-xl mb-2" />
          <p className="text-2xl font-bold text-white leading-none" style={{ fontFamily: 'Russo One, sans-serif' }}>{SOPS.length}</p>
          <p className="text-[11px] text-white/50 mt-1.5 uppercase tracking-wider">Workflows documented</p>
        </div>
        <div className="bg-gradient-to-br from-[#E8A020]/10 to-transparent border border-[#E8A020]/15 rounded-xl p-4">
          <Icon name="fast_forward" className="text-[#E8A020] text-xl mb-2" />
          <p className="text-2xl font-bold text-white leading-none" style={{ fontFamily: 'Russo One, sans-serif' }}>3-5</p>
          <p className="text-[11px] text-white/50 mt-1.5 uppercase tracking-wider">Shorts per week</p>
        </div>
        <div className="bg-gradient-to-br from-[#10B981]/10 to-transparent border border-[#10B981]/15 rounded-xl p-4">
          <Icon name="videocam" className="text-[#10B981] text-xl mb-2" />
          <p className="text-2xl font-bold text-white leading-none" style={{ fontFamily: 'Russo One, sans-serif' }}>1-2</p>
          <p className="text-[11px] text-white/50 mt-1.5 uppercase tracking-wider">Long-form per week</p>
        </div>
        <div className="bg-gradient-to-br from-[#FF424D]/10 to-transparent border border-[#FF424D]/15 rounded-xl p-4">
          <Icon name="volunteer_activism" className="text-[#FF424D] text-xl mb-2" />
          <p className="text-2xl font-bold text-white leading-none" style={{ fontFamily: 'Russo One, sans-serif' }}>2+</p>
          <p className="text-[11px] text-white/50 mt-1.5 uppercase tracking-wider">Patreon posts/week</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-white/30">
            <Icon name="search_off" className="text-4xl mb-2 block" />
            No SOPs match "{search}"
          </div>
        ) : (
          filtered.map(function(sop, i) {
            return <SopCard key={sop.id} sop={sop} defaultOpen={i === 0 && !search} />;
          })
        )}
      </div>
    </div>
  );
}

export default BTSops;

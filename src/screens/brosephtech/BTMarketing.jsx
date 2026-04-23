import React from 'react';
import { supabase } from '../../lib/supabase';
import { CURRENT_SET, MECHANIC_TERMS, findChampInText, nextPatch } from '../../lib/btset17';

var TOOLS = [
  { id: 'repurpose', label: 'Repurposer', icon: 'all_inclusive', desc: 'One brief becomes 5 platform-native posts' },
  { id: 'description', label: 'Description Builder', icon: 'description', desc: 'YouTube/TikTok description with one clear CTA' },
  { id: 'hook', label: 'Hook Sharpener', icon: 'bolt', desc: 'Score and angle your opener line' },
];

var POWER_WORDS = [
  'broken', 'busted', 'insane', 'op', 'free lp', 'climb', 'climbing',
  'best', 'worst', 'secret', 'meta', 'pro', 'easy', 'simple',
  'guaranteed', 'fastest', 'must', 'never', 'always', 'killer', 'cracked',
  'overpowered', 'unstoppable', 'instant', 'ultimate', 'top', 'free',
  'destroy', 'dominate', 'crushing', 'masterclass', 'unbeatable',
];

var PRIMARY_CTAS = [
  { id: 'subscribe', label: 'Subscribe', text: 'Subscribe so you do not miss the next patch breakdown.' },
  { id: 'newsletter', label: 'Newsletter', text: 'Get the patch cheat sheet in your inbox: brosephtech.com/newsletter' },
  { id: 'watch', label: 'Watch next', text: 'Watch the related video pinned in the description.' },
  { id: 'comment', label: 'Comment', text: 'Drop your spot in the comments. I read every one.' },
];

function Icon(props) {
  return (
    <span className={'material-symbols-outlined ' + (props.className || '')} style={props.style}>
      {props.name}
    </span>
  );
}

function nl(parts) {
  return parts.filter(function(p) { return p !== null && p !== undefined && p !== ''; }).join('\n');
}

function CopyButton(props) {
  var [copied, setCopied] = React.useState(false);
  function copy() {
    if (!props.text) return;
    try {
      navigator.clipboard.writeText(props.text);
      setCopied(true);
      setTimeout(function() { setCopied(false); }, 1400);
    } catch (e) {
      var ta = document.createElement('textarea');
      ta.value = props.text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(function() { setCopied(false); }, 1400);
    }
  }
  return (
    <button
      onClick={copy}
      className={'flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold transition-all ' + (copied ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10 border border-white/10')}
    >
      <Icon name={copied ? 'check' : 'content_copy'} className="text-sm" />
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function VariantCard(props) {
  var charCount = (props.text || '').length;
  return (
    <div className="bg-[#0f1320] border border-white/5 rounded-xl overflow-hidden">
      <div className="px-3 sm:px-4 py-2.5 border-b border-white/5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: (props.color || '#5BA3DB') + '20', color: props.color || '#5BA3DB' }}
          >
            <Icon name={props.icon || 'article'} className="text-base" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-white font-bold truncate">{props.title}</p>
            <p className="text-[10px] text-white/40 truncate">{props.hint}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-white/30 font-mono">{charCount}</span>
          <CopyButton text={props.text} />
        </div>
      </div>
      <pre className="p-3 sm:p-4 text-xs text-white/80 font-mono leading-relaxed whitespace-pre-wrap break-words max-h-72 overflow-y-auto">{props.text}</pre>
    </div>
  );
}

// ---------- Repurposer templates ----------

function buildXThread(card, brief) {
  var hook = brief.hookLine || brief.hook || ('Quick read on ' + (card.title || 'this patch') + ' for TFT.');
  var points = (brief.talkingPoints || []).filter(Boolean);
  var cta = brief.cta || 'Full breakdown on YouTube. Link in bio.';

  var lines = [];
  lines.push(hook);
  if (points.length === 0) {
    lines.push('1/ The setup. What changed and why it matters.');
    lines.push('2/ The opener. Who you contest and what you greed for.');
    lines.push('3/ The pivot. When you slam vs save.');
    lines.push('4/ The payoff. Final board and item priority.');
  } else {
    for (var i = 0; i < Math.min(points.length, 6); i++) {
      lines.push((i + 1) + '/ ' + points[i]);
    }
  }
  lines.push((lines.length) + '/ ' + cta);

  return lines.join('\n\n');
}

function buildTikTokScript(card, brief) {
  var hook = brief.hookLine || brief.hook || 'You are losing LP because you skipped this.';
  var points = (brief.talkingPoints || []).filter(Boolean);
  var body;
  if (points.length === 0) {
    body = 'Show me the comp. Show me the items. Tell them why it works in 3 sentences.';
  } else {
    body = points.slice(0, 3).map(function(p, i) { return (i + 1) + '. ' + p; }).join(' ');
  }
  var cta = brief.cta || 'Full guide on the channel.';

  var blocks = [
    '[0:00 - 0:03] HOOK (text on screen, big):',
    '"' + hook + '"',
    '',
    '[0:03 - 0:25] BODY (b-roll: board + item builds):',
    body,
    '',
    '[0:25 - 0:30] CTA:',
    cta,
  ];
  return blocks.join('\n');
}

function buildLinkedIn(card, brief) {
  var hook = brief.hookLine || brief.hook || 'Three lessons from this week\'s patch that translate beyond TFT.';
  var points = (brief.talkingPoints || []).filter(Boolean);
  var lessons;
  if (points.length === 0) {
    lessons = [
      'Lesson 1: When the meta shifts, the players who pivot fast win.',
      'Lesson 2: Greed is a strategy, not a personality flaw.',
      'Lesson 3: Repetition compounds. One game a day beats six on Saturday.',
    ];
  } else {
    lessons = points.slice(0, 3).map(function(p, i) { return 'Lesson ' + (i + 1) + ': ' + p; });
  }
  var cta = brief.cta || 'Following along? Tell me what you would add.';

  return [hook, '', lessons.join('\n\n'), '', cta].join('\n');
}

function buildReddit(card, brief) {
  var hook = brief.hookLine || brief.hook || 'Notes after 50 games on the new patch.';
  var points = (brief.talkingPoints || []).filter(Boolean);
  var bullets;
  if (points.length === 0) {
    bullets = [
      '- Top 4 rate is real if you avoid the obvious traps',
      '- Item priority shifts because of the new mechanic',
      '- Best opener depends on portal but defaults to the strongest 1-cost',
      '- Late game pivot is more reliable than the social media meta suggests',
    ];
  } else {
    bullets = points.map(function(p) { return '- ' + p; });
  }
  var title = (card.patch_id ? '[Patch ' + card.patch_id + '] ' : '') + (card.title || 'Notes from the new patch');
  var cta = brief.cta || 'Curious what y\'all are running. What\'s working?';

  return [
    'Title: ' + title,
    '',
    hook,
    '',
    bullets.join('\n'),
    '',
    cta,
  ].join('\n');
}

function buildNewsletter(card, brief) {
  var hook = brief.hookLine || brief.hook || 'The short version of what changed and what to do about it.';
  var points = (brief.talkingPoints || []).filter(Boolean);
  var body;
  if (points.length === 0) {
    body = 'Patch landed. The shape of the meta moved. Three things matter: opener, pivot trigger, and item priority. Everything else is detail.';
  } else {
    body = points.slice(0, 3).join(' ');
  }
  var cta = brief.cta || 'Watch the full breakdown on the channel - link below.';

  return [
    'Subject: ' + (card.title || 'This week in TFT'),
    '',
    hook,
    '',
    body,
    '',
    'One ask:',
    cta,
    '',
    '- Levitate',
  ].join('\n');
}

// ---------- Description builder ----------

function suggestHashtags(card, brief) {
  var seed = ((card.title || '') + ' ' + ((brief && brief.hookLine) || '') + ' ' + ((brief && brief.talkingPoints) || []).join(' ')).toLowerCase();
  var champs = findChampInText(seed);
  var tags = [];
  tags.push('#TFT');
  tags.push('#TeamfightTactics');
  if (card.patch_id) tags.push('#Patch' + card.patch_id.replace('.', ''));
  tags.push('#Set' + (CURRENT_SET.number));
  tags.push('#SpaceGods');
  for (var i = 0; i < champs.length && tags.length < 8; i++) {
    var slug = '#' + champs[i].replace(/[^a-zA-Z0-9]/g, '');
    if (tags.indexOf(slug) === -1) tags.push(slug);
  }
  for (var j = 0; j < MECHANIC_TERMS.length && tags.length < 8; j++) {
    if (seed.indexOf(MECHANIC_TERMS[j]) !== -1) {
      var t = '#' + MECHANIC_TERMS[j].split(/\s+/).map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join('');
      if (tags.indexOf(t) === -1) tags.push(t);
    }
  }
  return tags;
}

function buildDescription(card, brief, ctaId, chapters) {
  var b = brief || {};
  var hook = b.hookLine || b.hook || (card.title || 'TFT breakdown');
  var summary = (b.talkingPoints || []).slice(0, 3).join(' ');
  if (!summary) summary = 'Full breakdown of the comp, the opener, the pivot, and the items.';

  var chapterBlock = '';
  var chapterList = (chapters || '').split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
  if (chapterList.length) {
    chapterBlock = ['Chapters:'].concat(chapterList).join('\n');
  }

  var ctaItem = PRIMARY_CTAS.find(function(c) { return c.id === ctaId; }) || PRIMARY_CTAS[0];

  var links = [
    'Newsletter: brosephtech.com/newsletter',
    'Channel: youtube.com/@brosephtech',
    'Twitter / X: x.com/brosephtech',
  ];

  var hashtags = suggestHashtags(card, b).join(' ');

  return nl([
    hook,
    '',
    summary,
    '',
    chapterBlock,
    chapterBlock ? '' : null,
    'One ask:',
    ctaItem.text,
    '',
    'Links:',
    links.join('\n'),
    '',
    hashtags,
  ]);
}

// ---------- Hook scoring ----------

function scoreHook(text) {
  var raw = (text || '').trim();
  if (!raw) return { score: 0, signals: [] };
  var lower = raw.toLowerCase();
  var len = raw.length;
  var words = raw.split(/\s+/).filter(Boolean).length;
  var score = 50;
  var signals = [];

  // Length tuned for spoken hook (3 seconds = ~9 words)
  if (words < 4) {
    score -= 12;
    signals.push({ ok: false, text: 'Too short - aim for 6-12 words spoken' });
  } else if (words > 16) {
    score -= 18;
    signals.push({ ok: false, text: 'Too long - cut to under 12 words' });
  } else if (words >= 6 && words <= 12) {
    score += 14;
    signals.push({ ok: true, text: 'Tight word count' });
  }

  if (raw.indexOf('?') !== -1) {
    score += 10;
    signals.push({ ok: true, text: 'Question opens a loop' });
  }

  var numHits = raw.match(/\d+/g);
  if (numHits && numHits.length > 0) {
    score += 12;
    signals.push({ ok: true, text: 'Specific number' });
  }

  var powerHits = 0;
  for (var i = 0; i < POWER_WORDS.length; i++) {
    if (lower.indexOf(POWER_WORDS[i]) !== -1) powerHits++;
  }
  if (powerHits > 0) {
    score += Math.min(powerHits * 6, 14);
    signals.push({ ok: true, text: 'Power word x' + powerHits });
  }

  if (lower.indexOf('you') !== -1 || lower.indexOf('your') !== -1) {
    score += 8;
    signals.push({ ok: true, text: 'Direct address' });
  }

  if (lower.indexOf('how to') === 0 || lower.indexOf('here is') === 0 || lower.indexOf('this is') === 0) {
    score -= 6;
    signals.push({ ok: false, text: 'Generic opener' });
  }

  if (raw === raw.toUpperCase() && len > 8) {
    score -= 14;
    signals.push({ ok: false, text: 'All caps reads like spam' });
  }

  if (score < 0) score = 0;
  if (score > 100) score = 100;
  return { score: Math.round(score), signals: signals };
}

function sharpenHook(text) {
  var t = (text || '').trim();
  if (!t) {
    return [
      { angle: 'Curiosity', text: 'What if your opener has been wrong since the patch dropped?' },
      { angle: 'Contrarian', text: 'Stop forcing the popular comp. The data says otherwise.' },
      { angle: 'Specific', text: '50 games. 47% top 4. Here is the line nobody plays.' },
    ];
  }

  var firstNoun = t.split(/\s+/).filter(function(w) { return w.length > 3; })[0] || 'this comp';
  var stripped = t.replace(/[?!.,]+$/, '');

  return [
    {
      angle: 'Curiosity',
      text: 'What if ' + stripped.charAt(0).toLowerCase() + stripped.slice(1) + ' is the lie costing you LP?',
    },
    {
      angle: 'Contrarian',
      text: 'Everyone says ' + firstNoun + ' is busted. They are wrong, and here is why.',
    },
    {
      angle: 'Specific',
      text: '50 games on ' + firstNoun + '. The exact line that hit Challenger.',
    },
  ];
}

// ---------- Repurposer tool ----------

function Repurposer(props) {
  var cards = props.cards;
  var [selectedId, setSelectedId] = React.useState('');

  var pickable = cards.filter(function(c) {
    return c.column_id === 'published' || c.column_id === 'review' || c.column_id === 'production';
  });

  var card = pickable.find(function(c) { return c.id === selectedId; }) || pickable[0];

  if (!card) {
    return (
      <div className="bg-[#13172a] border border-white/5 rounded-xl p-6 text-center">
        <Icon name="inbox" className="text-3xl text-white/20" />
        <p className="text-sm text-white/60 mt-2">No cards in production, review, or published yet.</p>
        <p className="text-xs text-white/40 mt-1">Drop a brief on the Content Board to use the Repurposer.</p>
      </div>
    );
  }

  var brief = card.brief || {};

  var variants = [
    { title: 'X / Twitter thread', hint: '5-7 tweets, hook first', icon: 'tag', color: '#1DA1F2', text: buildXThread(card, brief) },
    { title: 'TikTok / Shorts script', hint: '3s hook, 22s body, 5s CTA', icon: 'music_video', color: '#E8A020', text: buildTikTokScript(card, brief) },
    { title: 'LinkedIn post', hint: 'Lesson framing, scannable', icon: 'work', color: '#0A66C2', text: buildLinkedIn(card, brief) },
    { title: 'Reddit / r/CompetitiveTFT', hint: 'Data-forward, low marketing', icon: 'forum', color: '#FF4500', text: buildReddit(card, brief) },
    { title: 'Newsletter blurb', hint: 'Short, one ask', icon: 'mail', color: '#10B981', text: buildNewsletter(card, brief) },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-[#13172a] border border-white/5 rounded-xl p-3 sm:p-4">
        <label className="block text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-2">Source card</label>
        <select
          value={card.id}
          onChange={function(e) { setSelectedId(e.target.value); }}
          className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 h-11 text-sm text-white focus:outline-none focus:border-[#5BA3DB]/50"
        >
          {pickable.map(function(c) {
            var label = (c.patch_id ? '[' + c.patch_id + '] ' : '') + (c.title || 'Untitled') + ' - ' + (c.column_id || '');
            return <option key={c.id} value={c.id}>{label}</option>;
          })}
        </select>
        {!brief.hookLine && !brief.talkingPoints ? (
          <p className="text-[11px] text-amber-300/80 mt-2 flex items-center gap-1.5">
            <Icon name="warning" className="text-sm" /> No brief filled in - using sensible defaults. Fill the brief on the Board for sharper output.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {variants.map(function(v) {
          return <VariantCard key={v.title} title={v.title} hint={v.hint} icon={v.icon} color={v.color} text={v.text} />;
        })}
      </div>
    </div>
  );
}

// ---------- Description builder tool ----------

function DescriptionBuilder(props) {
  var cards = props.cards;
  var [selectedId, setSelectedId] = React.useState('');
  var [chapters, setChapters] = React.useState('00:00 Hook\n00:25 Comp + items\n02:10 Opener\n04:30 Pivot trigger\n06:50 Final board');
  var [ctaId, setCtaId] = React.useState('newsletter');

  var pickable = cards;
  var card = pickable.find(function(c) { return c.id === selectedId; }) || pickable[0];

  if (!card) {
    return (
      <div className="bg-[#13172a] border border-white/5 rounded-xl p-6 text-center">
        <Icon name="inbox" className="text-3xl text-white/20" />
        <p className="text-sm text-white/60 mt-2">No cards yet. Add one on the Content Board.</p>
      </div>
    );
  }

  var brief = card.brief || {};
  var description = buildDescription(card, brief, ctaId, chapters);

  return (
    <div className="space-y-4">
      <div className="bg-[#13172a] border border-white/5 rounded-xl p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-2">Source card</label>
          <select
            value={card.id}
            onChange={function(e) { setSelectedId(e.target.value); }}
            className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 h-11 text-sm text-white focus:outline-none focus:border-[#5BA3DB]/50"
          >
            {pickable.map(function(c) {
              var label = (c.patch_id ? '[' + c.patch_id + '] ' : '') + (c.title || 'Untitled');
              return <option key={c.id} value={c.id}>{label}</option>;
            })}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-2">Primary CTA (one only)</label>
          <select
            value={ctaId}
            onChange={function(e) { setCtaId(e.target.value); }}
            className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 h-11 text-sm text-white focus:outline-none focus:border-[#5BA3DB]/50"
          >
            {PRIMARY_CTAS.map(function(c) {
              return <option key={c.id} value={c.id}>{c.label}</option>;
            })}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-2">Chapters (one per line, mm:ss label)</label>
          <textarea
            value={chapters}
            onChange={function(e) { setChapters(e.target.value); }}
            rows={5}
            className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#5BA3DB]/50"
          />
        </div>
      </div>

      <VariantCard
        title="YouTube / TikTok description"
        hint="First 100 chars matter for SEO - put the hook there"
        icon="description"
        color="#5BA3DB"
        text={description}
      />
    </div>
  );
}

// ---------- Hook sharpener tool ----------

function HookSharpener() {
  var [draft, setDraft] = React.useState('');
  var current = scoreHook(draft);
  var variants = sharpenHook(draft);

  function scoreColor(s) {
    if (s >= 75) return '#10B981';
    if (s >= 55) return '#E8A020';
    if (s >= 35) return '#F59E0B';
    return '#EF4444';
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-[#5BA3DB]/10 via-[#13172a] to-[#0f1320] border border-[#5BA3DB]/20 rounded-xl p-4 flex items-start gap-3">
        <span className="w-8 h-8 rounded-lg bg-[#5BA3DB]/15 flex items-center justify-center shrink-0">
          <Icon name="lightbulb" className="text-[#5BA3DB] text-base" />
        </span>
        <p className="text-xs text-white/70 leading-relaxed">
          The first 3 seconds decide retention. Promise a payoff, pose a question, or name a specific number. Cut throat-clearing - no "in this video" or "today we are going to".
        </p>
      </div>

      <div className="bg-[#13172a] border border-white/5 rounded-xl p-3 sm:p-4">
        <label className="block text-[11px] text-white/40 font-semibold uppercase tracking-wider mb-2">Draft hook</label>
        <textarea
          value={draft}
          onChange={function(e) { setDraft(e.target.value); }}
          placeholder="Type the first sentence the viewer hears..."
          rows={3}
          className="w-full bg-[#0b0e1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#5BA3DB]/50 resize-y"
        />
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full transition-all" style={{ width: current.score + '%', backgroundColor: scoreColor(current.score) }} />
          </div>
          <span className="text-sm font-bold tabular-nums" style={{ color: scoreColor(current.score) }}>{current.score}/100</span>
        </div>
        {current.signals.length ? (
          <ul className="mt-3 space-y-1">
            {current.signals.map(function(s, idx) {
              return (
                <li key={idx} className="text-[11px] flex items-center gap-1.5">
                  <Icon name={s.ok ? 'check_circle' : 'error'} className={'text-sm ' + (s.ok ? 'text-emerald-400' : 'text-amber-400')} />
                  <span className={s.ok ? 'text-emerald-300/90' : 'text-amber-200/90'}>{s.text}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {variants.map(function(v) {
          var s = scoreHook(v.text);
          return (
            <div key={v.angle} className="bg-[#0f1320] border border-white/5 rounded-xl p-3 sm:p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-[#E8A020]">{v.angle}</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: scoreColor(s.score) }}>{s.score}</span>
              </div>
              <p className="text-sm text-white leading-snug flex-1">{v.text}</p>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full" style={{ width: s.score + '%', backgroundColor: scoreColor(s.score) }} />
                </div>
                <CopyButton text={v.text} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Main wrapper ----------

function BTMarketing() {
  var [tool, setTool] = React.useState('repurpose');
  var [cards, setCards] = React.useState([]);
  var [loading, setLoading] = React.useState(true);

  React.useEffect(function() {
    var cancelled = false;
    setLoading(true);
    supabase
      .from('bt_content_cards')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(function(res) {
        if (cancelled) return;
        if (res.error) {
          console.warn('bt_content_cards load failed', res.error);
          setCards([]);
        } else {
          setCards(res.data || []);
        }
        setLoading(false);
      });
    return function() { cancelled = true; };
  }, []);

  var np = nextPatch();

  return (
    <div className="space-y-5">
      {/* Header strip */}
      <div className="bg-gradient-to-br from-[#1a1f36] via-[#13172a] to-[#0f1320] border border-[#E8A020]/20 rounded-xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#E8A020]/15 flex items-center justify-center shrink-0">
          <Icon name="campaign" className="text-[#E8A020] text-2xl" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight" style={{ fontFamily: 'Russo One, sans-serif' }}>
            MARKETING LAB
          </h2>
          <p className="text-xs text-white/60 mt-1 leading-relaxed">
            Distribution {'>'} creation. Take one brief, ship five posts. Hooks first. One CTA per piece.
            {np ? ' Next patch ' + np.label + ' on ' + new Date(np.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + '.' : ''}
          </p>
        </div>
      </div>

      {/* Tool tabs */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
        {TOOLS.map(function(t) {
          var active = tool === t.id;
          return (
            <button
              key={t.id}
              onClick={function() { setTool(t.id); }}
              className={'flex-1 min-w-[140px] flex flex-col items-start gap-1 px-3 sm:px-4 py-3 rounded-xl border transition-all ' + (active ? 'bg-[#E8A020]/10 border-[#E8A020]/40 text-[#E8A020]' : 'bg-[#13172a] border-white/5 text-white/60 hover:text-white/90 hover:border-white/10')}
            >
              <div className="flex items-center gap-1.5">
                <Icon name={t.icon} className="text-base" />
                <span className="text-sm font-bold">{t.label}</span>
              </div>
              <span className="text-[10px] text-left opacity-80 leading-snug">{t.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Active tool */}
      {loading ? (
        <div className="bg-[#13172a] border border-white/5 rounded-xl p-8 text-center">
          <Icon name="hourglass_empty" className="text-2xl text-white/30 animate-pulse" />
          <p className="text-sm text-white/50 mt-2">Loading cards...</p>
        </div>
      ) : (
        <div>
          {tool === 'repurpose' && <Repurposer cards={cards} />}
          {tool === 'description' && <DescriptionBuilder cards={cards} />}
          {tool === 'hook' && <HookSharpener />}
        </div>
      )}
    </div>
  );
}

export default BTMarketing;

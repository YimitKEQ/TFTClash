// BrosephTech crew - canonical source of truth.
// Use throughout the BT command center for assignees, owners, role labels.
// All colors are picked to play with the glassmorphism palette (orbs in pink, gold, teal).

var BT_CREW = [
  {
    id: 'levitate',
    name: 'Levitate',
    title: 'Founder',
    short: 'Founder',
    role: 'creator',
    initial: 'L',
    color: '#5BA3DB',
    accent: 'rgba(91,163,219,0.18)',
    halo: 'rgba(91,163,219,0.55)',
    blurb: 'Runs the channel and the show.',
  },
  {
    id: 'maestosoya',
    name: 'Maestosoya',
    title: 'Co-Founder & Strategy',
    short: 'Strategy + collabs',
    role: 'strategy',
    initial: 'M',
    color: '#E8A020',
    accent: 'rgba(232,160,32,0.18)',
    halo: 'rgba(232,160,32,0.55)',
    blurb: 'Runs collabs, partnerships, and the bigger picture roadmap.',
  },
  {
    id: 'broseph',
    name: 'Broseph',
    title: 'Founder',
    short: 'Founder, brand',
    role: 'founder',
    initial: 'B',
    color: '#EF8B8C',
    accent: 'rgba(239,139,140,0.18)',
    halo: 'rgba(239,139,140,0.55)',
    blurb: 'Original founder, brand DNA, north-star calls.',
  },
  {
    id: 'cathy',
    name: 'Cathy',
    title: 'Scriptwriter',
    short: 'Scripts + research',
    role: 'script',
    initial: 'C',
    color: '#A78BFA',
    accent: 'rgba(167,139,250,0.18)',
    halo: 'rgba(167,139,250,0.55)',
    blurb: 'Writes hooks, scripts, and the story spine of every video.',
  },
  {
    id: 'bacrif',
    name: 'Bacrif',
    title: 'Video Editor',
    short: 'Edit + post',
    role: 'edit',
    initial: 'B',
    color: '#10B981',
    accent: 'rgba(16,185,129,0.18)',
    halo: 'rgba(16,185,129,0.55)',
    blurb: 'Cuts the footage, syncs the audio, ships the timeline.',
  },
  {
    id: 'axel',
    name: 'Axel',
    title: 'Graphics & Thumbnails',
    short: 'Graphics + thumbs',
    role: 'gfx',
    initial: 'A',
    color: '#3D8FA0',
    accent: 'rgba(61,143,160,0.18)',
    halo: 'rgba(61,143,160,0.55)',
    blurb: 'Owns the look: thumbnails, lower thirds, motion graphics.',
  },
];

var BT_CREW_NAMES = BT_CREW.map(function(m) { return m.name; });

var BT_CREW_BY_NAME = (function() {
  var idx = {};
  BT_CREW.forEach(function(m) { idx[m.name] = m; });
  return idx;
})();

var BT_CREW_BY_ROLE = (function() {
  var idx = {};
  BT_CREW.forEach(function(m) { idx[m.role] = m; });
  return idx;
})();

// Legacy assignee strings used before the crew was named.
// Stored DB rows still reference these labels - migrate them on read.
var BT_LEGACY_ALIASES = {
  'Co-Founder': 'Maestosoya',
  'Founder 3': 'Broseph',
  'Scriptwriter': 'Cathy',
  'Editor': 'Bacrif',
  'GFX': 'Axel',
  'Script': 'Cathy',
  'Edit': 'Bacrif',
  'Editing': 'Bacrif',
  'Thumbnail': 'Axel',
  'Thumbnails': 'Axel',
  'Designer': 'Axel',
};

function resolveCrewName(value) {
  if (!value) return '';
  if (BT_CREW_BY_NAME[value]) return value;
  if (BT_LEGACY_ALIASES[value]) return BT_LEGACY_ALIASES[value];
  return value;
}

function getCrewMember(value) {
  var resolved = resolveCrewName(value);
  return BT_CREW_BY_NAME[resolved] || null;
}

function getCrewByRole(role) {
  return BT_CREW_BY_ROLE[role] || null;
}

// SOP step roles map to crew members so we can show the right avatar in steps.
function getCrewForStepRole(stepRole) {
  if (!stepRole) return null;
  var member = getCrewMember(stepRole);
  if (member) return member;
  var lowered = stepRole.toLowerCase();
  if (lowered === 'cathy' || lowered === 'scriptwriter' || lowered === 'script') return BT_CREW_BY_NAME.Cathy;
  if (lowered === 'bacrif' || lowered === 'editor' || lowered === 'edit') return BT_CREW_BY_NAME.Bacrif;
  if (lowered === 'axel' || lowered === 'gfx' || lowered === 'graphics' || lowered === 'thumbnail') return BT_CREW_BY_NAME.Axel;
  if (lowered === 'maestosoya' || lowered === 'co-founder') return BT_CREW_BY_NAME.Maestosoya;
  if (lowered === 'broseph' || lowered === 'founder') return BT_CREW_BY_NAME.Broseph;
  if (lowered === 'levitate') return BT_CREW_BY_NAME.Levitate;
  return null;
}

// Workload classification based on count of active (non-archive, non-published) cards.
// Tuned for a 6-person team at 3-5 shorts + 1-2 longforms per week.
function workloadStatus(activeCount) {
  if (activeCount === 0) return { id: 'idle',     label: 'Idle',     color: '#6B7280' };
  if (activeCount <= 2)  return { id: 'light',    label: 'Light',    color: '#A78BFA' };
  if (activeCount <= 4)  return { id: 'healthy',  label: 'Healthy',  color: '#10B981' };
  if (activeCount <= 6)  return { id: 'heavy',    label: 'Heavy',    color: '#E8A020' };
  return                  { id: 'swamped',  label: 'Swamped',  color: '#EF4444' };
}

export {
  BT_CREW,
  BT_CREW_NAMES,
  BT_CREW_BY_NAME,
  BT_LEGACY_ALIASES,
  resolveCrewName,
  getCrewMember,
  getCrewByRole,
  getCrewForStepRole,
  workloadStatus,
};

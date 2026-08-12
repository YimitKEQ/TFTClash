/**
 * voiceLog.js - persist /record sessions to bt_voice_sessions so the dashboard
 * "Recent recordings" feed and history stay populated.
 *
 * Two-step: insert once the recording is transcribed (transcript + summary +
 * duration), then patch with tasks_created / card_ids / meeting_id after the
 * user approves which suggestions become tasks. Best-effort: a logging failure
 * never breaks the recording flow.
 */

import { supabase } from './supabase.js';

export async function logVoiceSession(row) {
  var r = row || {};
  var insert = {
    guild_id: String(r.guildId || ''),
    channel_id: String(r.channelId || ''),
    channel_name: String(r.channelName || ''),
    status: r.status || 'transcribed',
    requested_by: String(r.requestedBy || ''),
    started_at: r.startedAt || null,
    recording_started_at: r.startedAt || null,
    ended_at: r.endedAt || null,
    duration_seconds: Math.max(0, Math.round(r.durationSeconds || 0)),
    transcript: String(r.transcript || ''),
    segments: Array.isArray(r.segments) ? r.segments : [],
    summary: String(r.summary || ''),
    stt_engine: String(r.sttEngine || ''),
    ai_engine: String(r.aiEngine || ''),
  };
  if (!insert.guild_id || !insert.channel_id) return null;
  try {
    var res = await supabase.from('bt_voice_sessions').insert(insert).select('id').single();
    if (res.error) { console.warn('[voiceLog] insert failed: ' + res.error.message); return null; }
    return res.data ? res.data.id : null;
  } catch (e) {
    console.warn('[voiceLog] insert threw: ' + ((e && e.message) || e));
    return null;
  }
}

export async function updateVoiceSession(id, patch) {
  if (!id) return;
  var p = patch || {};
  var row = { updated_at: new Date().toISOString() };
  if (p.status != null) row.status = p.status;
  if (p.tasksCreated != null) row.tasks_created = p.tasksCreated;
  if (p.cardIds != null) row.card_ids = Array.isArray(p.cardIds) ? p.cardIds : [];
  if (p.meetingId != null) row.meeting_id = p.meetingId;
  if (p.error != null) row.error = String(p.error);
  if (p.pending !== undefined) row.pending = p.pending; // null clears it
  try {
    var res = await supabase.from('bt_voice_sessions').update(row).eq('id', id);
    if (res.error) console.warn('[voiceLog] update failed: ' + res.error.message);
  } catch (e) {
    console.warn('[voiceLog] update threw: ' + ((e && e.message) || e));
  }
}

/**
 * Persist a suggestion set awaiting approval.
 *
 * The pending list used to live only in an in-memory Map, so any restart threw
 * a meeting's tasks away and the only recovery was to record it again, which is
 * impossible after the fact. It happened for real on 2026-08-12.
 *
 * The transcript is deliberately NOT copied in here: the same row already has
 * it, and duplicating tens of thousands of characters per meeting is waste.
 */
export async function savePending(id, token, payload) {
  if (!id || !token) return;
  var p = payload || {};
  var pending = {
    token: String(token),
    savedAtMs: Date.now(),
    tasks: Array.isArray(p.tasks) ? p.tasks : [],
    summary: String(p.summary || ''),
    recap: (p.recap && typeof p.recap === 'object') ? p.recap : null,
    durationSeconds: p.durationSeconds || 0,
    meetingTitle: String(p.meetingTitle || ''),
    byline: String(p.byline || ''),
    createdBy: String(p.createdBy || ''),
    engine: String(p.engine || ''),
  };
  await updateVoiceSession(id, { pending: pending });
}

/**
 * Rehydrate a suggestion set by its button token, for when the process that
 * created it is gone. Returns a payload in the same shape the in-memory map
 * holds, with the transcript pulled back off the session row.
 */
export async function loadPending(token) {
  if (!token) return null;
  try {
    var res = await supabase
      .from('bt_voice_sessions')
      .select('id, transcript, pending')
      .eq('pending->>token', String(token))
      .limit(1)
      .maybeSingle();
    if (res.error || !res.data || !res.data.pending) return null;
    var pd = res.data.pending;
    return {
      tasks: Array.isArray(pd.tasks) ? pd.tasks : [],
      transcript: String(res.data.transcript || ''),
      summary: String(pd.summary || ''),
      recap: pd.recap || {},
      durationSeconds: pd.durationSeconds || 0,
      meetingTitle: String(pd.meetingTitle || ''),
      byline: String(pd.byline || ''),
      createdBy: String(pd.createdBy || ''),
      engine: String(pd.engine || ''),
      voiceSessionId: res.data.id,
      selected: null,
      processing: false,
      restored: true,
    };
  } catch (e) {
    console.warn('[voiceLog] loadPending threw: ' + ((e && e.message) || e));
    return null;
  }
}

export async function clearPending(id) {
  if (!id) return;
  await updateVoiceSession(id, { pending: null });
}

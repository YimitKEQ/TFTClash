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
  try {
    var res = await supabase.from('bt_voice_sessions').update(row).eq('id', id);
    if (res.error) console.warn('[voiceLog] update failed: ' + res.error.message);
  } catch (e) {
    console.warn('[voiceLog] update threw: ' + ((e && e.message) || e));
  }
}

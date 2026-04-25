// Tiny audio-cue helper. Plays Web-Audio-synthesized notes — no asset hosting.
// Respects per-user opt-out via localStorage 'tft-sfx' = '0'.

var ctx = null
function getCtx() {
  if (typeof window === "undefined") return null
  if (ctx) return ctx
  var AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  try { ctx = new AC(); return ctx } catch (e) { return null }
}

function isMuted() {
  try { return localStorage.getItem("tft-sfx") === "0" } catch (e) { return false }
}

export function setSfxEnabled(on) {
  try { localStorage.setItem("tft-sfx", on ? "1" : "0") } catch (e) {}
}

export function getSfxEnabled() {
  try { return localStorage.getItem("tft-sfx") !== "0" } catch (e) { return true }
}

function tone(freq, dur, volume, type) {
  var c = getCtx()
  if (!c || isMuted()) return
  // Resume on user gesture if browser auto-suspended
  if (c.state === "suspended" && typeof c.resume === "function") {
    try { c.resume() } catch (e) {}
  }
  var o = c.createOscillator()
  var g = c.createGain()
  o.frequency.value = freq
  o.type = type || "sine"
  g.gain.setValueAtTime(0, c.currentTime)
  g.gain.linearRampToValueAtTime(volume || 0.08, c.currentTime + 0.01)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur)
  o.connect(g)
  g.connect(c.destination)
  o.start()
  o.stop(c.currentTime + dur + 0.05)
}

export function sfxLock() {
  tone(660, 0.18, 0.06, "sine")
  setTimeout(function () { tone(880, 0.16, 0.05, "sine") }, 80)
}

export function sfxWin() {
  tone(523, 0.10, 0.08, "triangle")
  setTimeout(function () { tone(659, 0.10, 0.08, "triangle") }, 90)
  setTimeout(function () { tone(784, 0.18, 0.10, "triangle") }, 180)
}

export function sfxTick() { tone(440, 0.05, 0.04, "square") }
export function sfxFinalTick() { tone(880, 0.08, 0.07, "square") }

export function sfxAdvance() {
  tone(523, 0.07, 0.06, "triangle")
  setTimeout(function () { tone(784, 0.14, 0.08, "triangle") }, 60)
}

export function sfxToast() { tone(987, 0.05, 0.04, "sine") }

export function sfxError() {
  tone(220, 0.12, 0.07, "sawtooth")
  setTimeout(function () { tone(180, 0.16, 0.07, "sawtooth") }, 80)
}

/**
 * sounds.ts — Web Audio API tone generator.
 * No external audio files needed. All tones are synthesised in real-time.
 * Always check soundEnabled + soundVolume from settings before calling.
 *
 * Safari/iOS note: AudioContext must be created/resumed synchronously inside a
 * user-gesture handler. Call primeAudio() at the START of every click handler
 * before scheduling tones — this unlocks the context synchronously so the
 * subsequent tone() calls (which schedule ~100ms ahead) play correctly.
 */

let _ctx: AudioContext | null = null;

/**
 * Call this SYNCHRONOUSLY inside a click/touch handler before playing sounds.
 * Creates (or resumes) the AudioContext while still in the user-gesture frame.
 */
export function primeAudio() {
  try {
    if (!_ctx || _ctx.state === "closed") {
      _ctx = new AudioContext();
    }
    if (_ctx.state === "suspended") {
      _ctx.resume(); // fire-and-forget — just kicks off the unlock
    }
  } catch { /* AudioContext not available (e.g. server-side render) */ }
}

function getCtx(): AudioContext | null {
  try {
    if (!_ctx || _ctx.state === "closed") _ctx = new AudioContext();
    if (_ctx.state === "suspended") _ctx.resume();
    return _ctx;
  } catch { return null; }
}

/** Low-level: play a single oscillator tone */
function tone(
  freq: number,
  type: OscillatorType,
  duration: number,
  vol: number,
  delay = 0
) {
  const ac = getCtx();
  if (!ac) return;
  try {
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type;
    osc.frequency.value = freq;
    // 0.1s base offset gives the AudioContext time to resume before the note plays
    const t0 = ac.currentTime + delay + 0.1;
    gain.gain.setValueAtTime(Math.min(1, Math.max(0, vol)), t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.start(t0);
    osc.stop(t0 + duration + 0.01);
  } catch { /* AudioContext not available */ }
}

/** Frequency sweep (siren-like) */
function sweep(
  freqStart: number,
  freqEnd: number,
  type: OscillatorType,
  duration: number,
  vol: number,
  delay = 0
) {
  const ac = getCtx();
  if (!ac) return;
  try {
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type;
    const t0 = ac.currentTime + delay + 0.1;
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.linearRampToValueAtTime(freqEnd, t0 + duration);
    gain.gain.setValueAtTime(Math.min(1, Math.max(0, vol)), t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  } catch {}
}

/** Resolve effective volume (0-1) from settings volume (0-100) */
function v(settingsVol: number) {
  return Math.min(1, Math.max(0, settingsVol / 100)) * 0.4;
}

// ── Named sound effects ────────────────────────────────────────────

/** Two-tone notification ding */
export function playNotification(vol = 60) {
  tone(880, "sine", 0.12, v(vol));
  tone(1100, "sine", 0.18, v(vol), 0.13);
}

/** Rising arpeggio — success / approve */
export function playSuccess(vol = 60) {
  tone(523.25, "sine", 0.1, v(vol));
  tone(659.25, "sine", 0.1, v(vol), 0.1);
  tone(783.99, "sine", 0.22, v(vol), 0.2);
}

/** Low buzz — error / reject */
export function playError(vol = 60) {
  tone(220, "sawtooth", 0.28, v(vol) * 0.6);
  tone(180, "sawtooth", 0.18, v(vol) * 0.5, 0.15);
}

/** Descending minor — late check-in alert */
export function playLate(vol = 60) {
  tone(587.33, "sine", 0.18, v(vol));
  tone(440,    "sine", 0.28, v(vol), 0.2);
}

/** Triple pulse — recurring lateness warning */
export function playAlert(vol = 60) {
  const vv = v(vol);
  tone(880, "square", 0.08, vv * 0.5);
  tone(880, "square", 0.08, vv * 0.5, 0.2);
  tone(880, "square", 0.08, vv * 0.5, 0.4);
  tone(1100, "sine",  0.25, vv,        0.55);
}

/** Soft click — drag & drop interaction */
export function playClick(vol = 60) {
  tone(1200, "sine", 0.04, v(vol) * 0.5);
}

/** Card drop "thud" */
export function playDrop(vol = 60) {
  tone(200, "sine", 0.12, v(vol));
  tone(150, "sine", 0.15, v(vol), 0.06);
}

/** Info ping */
export function playInfo(vol = 60) {
  tone(1046.5, "sine", 0.15, v(vol) * 0.7);
}

// ── NEW: Alarm Sounds ──────────────────────────────────────────────

/**
 * Classic alarm clock bell — rapid repeating double-ring.
 * Perfect for check-in reminders or scheduled alerts.
 */
export function playAlarmClock(vol = 60) {
  const vv = v(vol) * 0.8;
  tone(1480, "square", 0.06, vv, 0.00);
  tone(1320, "square", 0.06, vv, 0.08);
  tone(1480, "square", 0.06, vv, 0.18);
  tone(1320, "square", 0.06, vv, 0.26);
  tone(1480, "square", 0.06, vv, 0.45);
  tone(1320, "square", 0.06, vv, 0.53);
  tone(1480, "square", 0.06, vv, 0.63);
  tone(1320, "square", 0.06, vv, 0.71);
}

/**
 * Gentle morning chime — peaceful wake-up sound.
 * Pentatonic scale ascending.
 */
export function playMorningChime(vol = 60) {
  const vv = v(vol);
  const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  notes.forEach((freq, i) => {
    tone(freq, "sine", 0.35, vv * (1 - i * 0.06), i * 0.14);
  });
}

/**
 * Urgent siren — escalating sweep, for critical lateness alerts.
 */
export function playUrgentSiren(vol = 60) {
  const vv = v(vol) * 0.6;
  sweep(600, 1200, "sawtooth", 0.3, vv, 0.0);
  sweep(600, 1200, "sawtooth", 0.3, vv, 0.35);
  sweep(600, 1400, "sawtooth", 0.4, vv, 0.70);
}

/**
 * Snooze tap — soft dismissal sound.
 */
export function playSnooze(vol = 60) {
  const vv = v(vol) * 0.5;
  tone(440, "sine", 0.08, vv, 0.0);
  tone(392, "sine", 0.12, vv, 0.1);
  tone(349, "sine", 0.18, vv, 0.22);
}

/**
 * Clock tick — single mechanical tick sound.
 */
export function playTick(vol = 60) {
  const vv = v(vol) * 0.3;
  tone(2400, "square", 0.015, vv, 0.0);
  tone(1200, "square", 0.020, vv * 0.5, 0.015);
}

/**
 * Recurring lateness alarm — serious pulsed warning.
 * Used when an employee has been late 3+ times.
 */
export function playRecurringLatenessAlarm(vol = 60) {
  const vv = v(vol);
  tone(220, "sawtooth", 0.15, vv * 0.5, 0.0);
  sweep(440, 660, "square", 0.18, vv * 0.6, 0.2);
  sweep(440, 660, "square", 0.18, vv * 0.6, 0.45);
  tone(880, "sine", 0.3, vv, 0.7);
  tone(1100, "sine", 0.2, vv * 0.8, 0.95);
}

/**
 * Check-in success — satisfying punch-in sound.
 */
export function playCheckIn(vol = 60) {
  const vv = v(vol);
  tone(440, "sine", 0.06, vv * 0.5, 0.0);
  tone(880, "sine", 0.12, vv,       0.07);
  tone(1320,"sine", 0.22, vv * 0.8, 0.18);
}

/**
 * Check-out farewell — gentle descending goodbye tone.
 */
export function playCheckOut(vol = 60) {
  const vv = v(vol);
  tone(1320,"sine", 0.10, vv * 0.8, 0.0);
  tone(880, "sine", 0.12, vv,       0.12);
  tone(660, "sine", 0.22, vv * 0.7, 0.25);
}

/**
 * Shift alarm — loud repeating dual-tone alarm.
 * Plays 3 full rings (~3 seconds total). Used when the app
 * is opened via a shift-start/end push notification tap.
 * Call primeAudio() in the same user-gesture frame first.
 */
export function playShiftAlarm(vol = 90) {
  const vv = v(vol);
  // Three full double-ring bursts
  for (let ring = 0; ring < 3; ring++) {
    const base = ring * 0.9;
    // High-low alternating square wave — classic alarm bell
    tone(1480, "square", 0.08, vv, base + 0.00);
    tone(1175, "square", 0.08, vv, base + 0.10);
    tone(1480, "square", 0.08, vv, base + 0.20);
    tone(1175, "square", 0.08, vv, base + 0.30);
    tone(1480, "square", 0.08, vv, base + 0.40);
    tone(1175, "square", 0.08, vv, base + 0.50);
    // Brief pause then a sweeping siren
    sweep(800, 1600, "sawtooth", 0.25, vv * 0.6, base + 0.65);
  }
}

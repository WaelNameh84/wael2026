/**
 * alarm.ts — Loud shift alarm engine using Web Audio API.
 * Sounds are synthesised in real-time with DynamicsCompressor for
 * maximum perceived loudness (iPhone-alarm level intensity).
 */

const ALARM_STORAGE_KEY = "setting_shift_alarms";

export type AlarmSoundType = "radar" | "digital" | "bell" | "siren" | "chime" | "horn" | "marimba" | "galaxy" | "xylophone" | "pulse" | "crystal";

export interface ShiftAlarmSettings {
  enabled: boolean;
  startTime: string;
  endTime: string;
  soundType: AlarmSoundType;
  volume: number;         // 0.0 – 1.0
  repeatCount: number;    // how many times the pattern fires (1-5)
}

function defaultAlarmSettings(): ShiftAlarmSettings {
  return { enabled: false, startTime: "09:00", endTime: "17:00", soundType: "radar", volume: 1.0, repeatCount: 3 };
}

export function getAlarmSettings(): ShiftAlarmSettings {
  try {
    const raw = localStorage.getItem(ALARM_STORAGE_KEY);
    if (!raw) return defaultAlarmSettings();
    const parsed = JSON.parse(raw);
    // migrate old soundType values
    const legacyMap: Record<string, AlarmSoundType> = { beep: "digital", bell: "bell", horn: "horn", chime: "chime" };
    if (parsed.soundType && legacyMap[parsed.soundType]) parsed.soundType = legacyMap[parsed.soundType];
    return { ...defaultAlarmSettings(), ...parsed };
  } catch {
    return defaultAlarmSettings();
  }
}

export function saveAlarmSettings(s: ShiftAlarmSettings) {
  localStorage.setItem(ALARM_STORAGE_KEY, JSON.stringify(s));
}

/* ─── Shared, warm AudioContext ────────────────────────────── */
//
// Browsers block Web Audio playback unless an AudioContext was created
// (or resumed) during a direct user gesture. Creating a fresh context at
// setTimeout fire-time always fails silently.
//
// Solution: one shared context that is created + resumed during the user's
// interaction (enabling/testing the alarm in Settings), then kept alive
// with an inaudible heartbeat so the browser never suspends it.

let _sharedCtx: AudioContext | null = null;
let _keepAliveInterval: ReturnType<typeof setInterval> | null = null;

/** Returns the warm shared context, or null if Web Audio isn't available. */
function getSharedCtx(): AudioContext | null {
  if (_sharedCtx && _sharedCtx.state !== "closed") return _sharedCtx;
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    _sharedCtx = new Ctor();
    return _sharedCtx;
  } catch { return null; }
}

/**
 * MUST be called from a user-gesture handler (e.g. enabling the alarm toggle
 * or pressing the Test button in Settings).  It creates / resumes the shared
 * AudioContext and starts a silent heartbeat so the browser never suspends it.
 */
export function warmUpAudioContext(): void {
  const ctx = getSharedCtx();
  if (!ctx) return;

  const doResume = () => {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  };
  doResume();

  // Silent 1-sample buffer played every 25 s keeps the context "running"
  // even when the tab is in the background or the screen is idle.
  if (_keepAliveInterval) clearInterval(_keepAliveInterval);
  _keepAliveInterval = setInterval(() => {
    if (!_sharedCtx || _sharedCtx.state === "closed") {
      if (_keepAliveInterval) clearInterval(_keepAliveInterval);
      return;
    }
    if (_sharedCtx.state === "suspended") _sharedCtx.resume().catch(() => {});
    try {
      const buf = _sharedCtx.createBuffer(1, 1, 22_050);
      const src = _sharedCtx.createBufferSource();
      src.buffer = buf;
      src.connect(_sharedCtx.destination);
      src.start();
    } catch { /* ignore */ }
  }, 25_000);
}

/** Stop the heartbeat (call when alarm is disabled). */
export function stopAudioKeepAlive(): void {
  if (_keepAliveInterval) { clearInterval(_keepAliveInterval); _keepAliveInterval = null; }
}

/** @deprecated — use getSharedCtx() internally */
function buildCtx(): AudioContext | null {
  return getSharedCtx();
}

function addCompressor(ctx: AudioContext): AudioNode {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value      = 6;
  comp.ratio.value     = 20;
  comp.attack.value    = 0.001;
  comp.release.value   = 0.15;
  comp.connect(ctx.destination);
  return comp;
}

type OscType = OscillatorType;

/** Schedule a single oscillator tone */
function sched(
  ctx: AudioContext,
  out: AudioNode,
  freq: number,
  vol: number,
  t0: number,
  dur: number,
  type: OscType = "sine",
  detune = 0,
) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(out);
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value    = detune;
  gain.gain.setValueAtTime(Math.min(1, vol), t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Schedule a frequency sweep */
function sweepSched(
  ctx: AudioContext,
  out: AudioNode,
  freqFrom: number,
  freqTo: number,
  vol: number,
  t0: number,
  dur: number,
  type: OscType = "sawtooth",
) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(out);
  osc.type = type;
  osc.frequency.setValueAtTime(freqFrom, t0);
  osc.frequency.linearRampToValueAtTime(freqTo, t0 + dur);
  gain.gain.setValueAtTime(Math.min(1, vol), t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/* ─── Sound patterns ───────────────────────────────────────── */

/**
 * "Radar" — iPhone's iconic default alarm.
 * Three ascending staccato beeps, then a pause. Repeats.
 * Pattern duration: ~1.2 s per cycle.
 */
function schedRadar(ctx: AudioContext, out: AudioNode, vol: number, t0: number) {
  const freqs = [1047, 1319, 1568];   // C6, E6, G6
  freqs.forEach((f, i) => {
    const bt = t0 + i * 0.18;
    sched(ctx, out, f,      vol,        bt,       0.14, "square");
    sched(ctx, out, f * 2,  vol * 0.2,  bt,       0.14, "square");  // harmonic layer
    sched(ctx, out, f * 0.5, vol * 0.15, bt,       0.14, "square");  // sub layer
  });
  return 1.2;   // cycle length seconds
}

/**
 * "Digital" — Rapid alternating beep-beep of a digital alarm clock.
 * Fast double-pulse groups with short break.
 * Pattern duration: ~1.4 s per cycle.
 */
function schedDigital(ctx: AudioContext, out: AudioNode, vol: number, t0: number) {
  const HIGH = 1800, LOW = 1400;
  for (let i = 0; i < 8; i++) {
    const bt = t0 + i * 0.09;
    sched(ctx, out, i % 2 === 0 ? HIGH : LOW, vol, bt, 0.07, "square");
  }
  return 1.4;
}

/**
 * "Bell" — Rich church-bell overtone stack, loud and resonant.
 * Pattern duration: ~2.2 s per cycle.
 */
function schedBell(ctx: AudioContext, out: AudioNode, vol: number, t0: number) {
  const partials = [
    [1046.5, 1.0],
    [1318.5, 0.6],
    [1568,   0.45],
    [2093,   0.3],
    [2637,   0.2],
  ];
  partials.forEach(([f, amp]) => {
    sched(ctx, out, f, vol * amp, t0, 1.8, "sine");
  });
  // Attack transient click
  sched(ctx, out, 3000, vol * 0.4, t0, 0.02, "square");
  return 2.2;
}

/**
 * "Siren" — Emergency siren sweep, very attention-grabbing.
 * Pattern duration: ~1.6 s per cycle.
 */
function schedSiren(ctx: AudioContext, out: AudioNode, vol: number, t0: number) {
  sweepSched(ctx, out, 440,  1200, vol * 0.9, t0,       0.4, "sawtooth");
  sweepSched(ctx, out, 1200, 440,  vol * 0.9, t0 + 0.4, 0.4, "sawtooth");
  sweepSched(ctx, out, 440,  1600, vol * 0.9, t0 + 0.8, 0.5, "sawtooth");
  // harmonic doubler
  sweepSched(ctx, out, 880,  2400, vol * 0.3, t0,        0.4, "square");
  sweepSched(ctx, out, 2400, 880,  vol * 0.3, t0 + 0.4, 0.4, "square");
  return 1.6;
}

/**
 * "Chime" — Ascending pentatonic chime, bright and clear.
 * Pattern duration: ~2.0 s per cycle.
 */
function schedChime(ctx: AudioContext, out: AudioNode, vol: number, t0: number) {
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
  notes.forEach((f, i) => {
    const bt = t0 + i * 0.22;
    sched(ctx, out, f,      vol * (1 - i * 0.05), bt, 0.55, "sine");
    sched(ctx, out, f * 2,  vol * 0.15,            bt, 0.4,  "sine");  // shimmer
  });
  return 2.0;
}

/**
 * "Horn" — Powerful foghorn / air-horn blast.
 * Pattern duration: ~2.0 s per cycle.
 */
function schedHorn(ctx: AudioContext, out: AudioNode, vol: number, t0: number) {
  // Root + fifth + octave layered sawtooth for a full, honking tone
  sched(ctx, out, 220,  vol * 0.9, t0,       0.55, "sawtooth");
  sched(ctx, out, 330,  vol * 0.7, t0,       0.55, "sawtooth");
  sched(ctx, out, 440,  vol * 0.5, t0,       0.55, "square");
  sched(ctx, out, 220,  vol * 0.7, t0 + 0.7, 0.55, "sawtooth");
  sched(ctx, out, 330,  vol * 0.5, t0 + 0.7, 0.55, "sawtooth");
  sched(ctx, out, 550,  vol * 0.8, t0 + 1.3, 0.45, "sawtooth");
  sched(ctx, out, 660,  vol * 0.6, t0 + 1.3, 0.45, "sawtooth");
  sched(ctx, out, 440,  vol * 0.9, t0 + 1.3, 0.45, "square");
  return 2.0;
}

/* ─── Percussive helper (marimba / xylophone envelope) ─────── */

/**
 * Single mallet-struck note: instant attack → fast exponential decay.
 * Two oscillators (sine + detuned triangle) for woody warmth.
 */
function schedPercussive(
  ctx: AudioContext,
  out: AudioNode,
  freq: number,
  vol: number,
  t0: number,
  dur: number,
) {
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(out);
  osc1.type = "sine";
  osc2.type = "triangle";
  osc1.frequency.value = freq;
  osc2.frequency.value = freq * 2.003;   // tiny detune for natural overtone
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(Math.min(1, vol), t0 + 0.007);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc1.start(t0); osc2.start(t0);
  osc1.stop(t0 + dur + 0.02); osc2.stop(t0 + dur + 0.02);
}

/* ─── New iPhone / Samsung sounds ──────────────────────────── */

/**
 * "Marimba" — iPhone's iconic marimba alarm.
 * Three ascending runs of three notes each (G4→C5→E5, then up two steps per group).
 * Pattern duration: ~1.6 s per cycle.
 */
function schedMarimba(ctx: AudioContext, out: AudioNode, vol: number, t0: number) {
  const groups = [
    [392.00, 523.25, 659.25],   // G4, C5, E5
    [523.25, 659.25, 783.99],   // C5, E5, G5
    [659.25, 783.99, 1046.50],  // E5, G5, C6
  ];
  let cursor = t0;
  groups.forEach((group) => {
    group.forEach((f, i) => {
      schedPercussive(ctx, out, f,      vol,        cursor + i * 0.1, 0.35);
      schedPercussive(ctx, out, f * 2,  vol * 0.12, cursor + i * 0.1, 0.2);  // shimmer
    });
    cursor += 0.43;
  });
  return 1.6;
}

/**
 * "Galaxy" — Samsung Galaxy "Over the Horizon" inspired melodic ringtone.
 * Ascending E-major scale with warm triangle-wave tones.
 * Pattern duration: ~2.2 s per cycle.
 */
function schedGalaxy(ctx: AudioContext, out: AudioNode, vol: number, t0: number) {
  // E4 G#4 B4 C#5 E5 G#5 B5 E6 (E major, two octaves)
  const melody: [number, number][] = [
    [329.63, 0.18],   // E4
    [415.30, 0.18],   // G#4
    [493.88, 0.18],   // B4
    [554.37, 0.22],   // C#5
    [659.25, 0.18],   // E5
    [830.61, 0.18],   // G#5
    [987.77, 0.25],   // B5
    [1318.5, 0.50],   // E6 — held finale
  ];
  let cursor = t0;
  melody.forEach(([f, dur]) => {
    // Warm triangle fundamental
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(out);
    osc.type = "triangle";
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, cursor);
    gain.gain.linearRampToValueAtTime(Math.min(1, vol * 0.95), cursor + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, cursor + dur);
    osc.start(cursor); osc.stop(cursor + dur + 0.02);
    // Harmonic shimmer
    sched(ctx, out, f * 2, vol * 0.1, cursor, dur * 0.6, "sine");
    cursor += dur * 0.82;   // slight overlap — legato feel
  });
  return 2.3;
}

/**
 * "Xylophone" — Samsung-style bright two-octave xylophone run.
 * C major ascending, very high-pitched and attention-grabbing.
 * Pattern duration: ~1.5 s per cycle.
 */
function schedXylophone(ctx: AudioContext, out: AudioNode, vol: number, t0: number) {
  // C5 → C7 diatonic run
  const notes = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50,
                 1174.66, 1318.51, 1396.91, 1567.98, 1760.00, 1975.53, 2093.00];
  notes.forEach((f, i) => {
    schedPercussive(ctx, out, f,     vol * (1 - i * 0.025), t0 + i * 0.09, 0.26);
    schedPercussive(ctx, out, f * 2, vol * 0.10,            t0 + i * 0.09, 0.14);
  });
  return 1.7;
}

/**
 * "Pulse" — iPhone "Pulse" alarm: rhythmic ascending double-pulse groups.
 * Three groups, each a quick hi-lo-hi staccato.
 * Pattern duration: ~1.7 s per cycle.
 */
function schedPulse(ctx: AudioContext, out: AudioNode, vol: number, t0: number) {
  const groups: [number, number][] = [[880, 659.25], [1046.5, 783.99], [1318.5, 987.77]];
  let cursor = t0;
  groups.forEach(([hi, lo]) => {
    sched(ctx, out, hi, vol * 0.95, cursor,        0.08, "sine");
    sched(ctx, out, lo, vol * 0.80, cursor + 0.13, 0.08, "sine");
    sched(ctx, out, hi, vol * 0.95, cursor + 0.26, 0.10, "sine");
    // Harmonic layer
    sched(ctx, out, hi * 2, vol * 0.15, cursor,        0.06, "sine");
    sched(ctx, out, hi * 2, vol * 0.15, cursor + 0.26, 0.07, "sine");
    cursor += 0.54;
  });
  return 1.8;
}

/**
 * "Crystal" — iPhone "Crystal" alarm: clear high sine-bell cascade.
 * Four bright tones descending then re-ascending, very loud and clean.
 * Pattern duration: ~2.0 s per cycle.
 */
function schedCrystal(ctx: AudioContext, out: AudioNode, vol: number, t0: number) {
  // Down then up: E6 → C6 → A5 → E5 → A5 → C6 → E6 → G6
  const arc: [number, number, number][] = [
    [1318.5,  vol,        0.30],
    [1046.5,  vol * 0.90, 0.28],
    [880.00,  vol * 0.85, 0.26],
    [659.25,  vol * 0.80, 0.24],
    [880.00,  vol * 0.85, 0.26],
    [1046.5,  vol * 0.90, 0.28],
    [1318.5,  vol,        0.35],
    [1567.98, vol * 0.95, 0.55],  // high G6 finale
  ];
  let cursor = t0;
  arc.forEach(([f, v, dur]) => {
    sched(ctx, out, f,     v,         cursor, dur, "sine");
    sched(ctx, out, f * 2, v * 0.18,  cursor, dur * 0.6, "sine");   // shimmer
    sched(ctx, out, f * 3, v * 0.07,  cursor, dur * 0.4, "sine");   // bright top
    cursor += dur * 0.78;
  });
  return 2.4;
}

/* ─── Main playback function ────────────────────────────────── */

const schedulers: Record<AlarmSoundType, (ctx: AudioContext, out: AudioNode, vol: number, t0: number) => number> = {
  radar:     schedRadar,
  digital:   schedDigital,
  bell:      schedBell,
  siren:     schedSiren,
  chime:     schedChime,
  horn:      schedHorn,
  marimba:   schedMarimba,
  galaxy:    schedGalaxy,
  xylophone: schedXylophone,
  pulse:     schedPulse,
  crystal:   schedCrystal,
};

/**
 * Play the alarm sound. `volume` is 0.0–1.0.
 * `repeatCount` determines how many pattern cycles to synthesise.
 */
export async function playAlarmSound(
  type: AlarmSoundType = "radar",
  volume = 1.0,
  repeatCount = 3,
): Promise<void> {
  // Always use the shared warm context — never create a fresh one here,
  // because a new context started without a user gesture is always suspended
  // and resume() without gesture fails in every modern browser.
  const ctx = getSharedCtx();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    try { await ctx.resume(); } catch { return; /* still suspended — no gesture */ }
  }
  if (ctx.state !== "running") return;

  const out    = addCompressor(ctx);
  const sched_ = schedulers[type] ?? schedRadar;
  const clampV = Math.max(0.05, Math.min(1.0, volume));

  let cursor = ctx.currentTime + 0.05;
  let totalDur = 0;

  for (let i = 0; i < repeatCount; i++) {
    const cycleLen = sched_(ctx, out, clampV, cursor);
    cursor   += cycleLen;
    totalDur += cycleLen;
  }

  // Disconnect compressor after all tones finish (don't close — shared context)
  setTimeout(() => { try { out.disconnect(); } catch {} }, (totalDur + 0.5) * 1000);
}

/* ─── Notification sound ────────────────────────────────────── */

export type NotifSoundType = "ding" | "chime" | "ping" | "pop" | "whistle" | "none";
const NOTIF_SOUND_KEY = "setting_notif_sound";

export function getNotifSoundType(): NotifSoundType {
  return (localStorage.getItem(NOTIF_SOUND_KEY) as NotifSoundType) || "ding";
}
export function saveNotifSoundType(t: NotifSoundType) {
  localStorage.setItem(NOTIF_SOUND_KEY, t);
}

export async function playNotifSound(type?: NotifSoundType, vol = 0.7): Promise<void> {
  const t = type ?? getNotifSoundType();
  if (t === "none") return;

  const ctx = getSharedCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") { try { await ctx.resume(); } catch {} }

  const out = addCompressor(ctx);
  const v   = Math.max(0.05, Math.min(1, vol));

  switch (t) {
    case "ding":
      sched(ctx, out, 1046.5, v,        ctx.currentTime,        0.4,  "sine");
      sched(ctx, out, 1318.5, v * 0.5,  ctx.currentTime + 0.05, 0.3,  "sine");
      break;
    case "chime":
      sched(ctx, out, 523.25, v,        ctx.currentTime,        0.25, "sine");
      sched(ctx, out, 783.99, v,        ctx.currentTime + 0.15, 0.3,  "sine");
      sched(ctx, out, 1046.5, v * 0.8,  ctx.currentTime + 0.3,  0.35, "sine");
      break;
    case "ping":
      sched(ctx, out, 1760,   v,        ctx.currentTime,        0.18, "sine");
      sched(ctx, out, 2200,   v * 0.4,  ctx.currentTime + 0.02, 0.12, "sine");
      break;
    case "pop":
      sched(ctx, out, 300,    v * 0.8,  ctx.currentTime,        0.04, "square");
      sched(ctx, out, 800,    v * 0.5,  ctx.currentTime + 0.02, 0.06, "sine");
      break;
    case "whistle":
      sweepSched(ctx, out, 600, 1400, v, ctx.currentTime, 0.25, "sine");
      break;
  }
  // Don't close the shared context — just disconnect after sound finishes
  setTimeout(() => { try { out.disconnect(); } catch {} }, 1000);
}

/* ─── Scheduling ────────────────────────────────────────────── */

const activeAlarmTimers: ReturnType<typeof setTimeout>[] = [];

// Tracks the next fire time for each alarm so we can detect missed alarms
// when the app returns to foreground after being backgrounded.
interface ScheduledAlarm {
  hour: number; minute: number;
  label: string; body: string;
  nextFireAt: number;   // epoch ms
}
const _scheduled: ScheduledAlarm[] = [];
let _visibilityHandler: (() => void) | null = null;

const MISSED_GRACE_MS = 3 * 60 * 1000; // play missed alarm up to 3 min late

function msUntilNext(hour: number, minute: number): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

/** Fire an alarm: play sound + show browser notification. */
function fireAlarm(settings: ShiftAlarmSettings, label: string, body: string) {
  playAlarmSound(settings.soundType, settings.volume, settings.repeatCount);
  if ("Notification" in window && Notification.permission === "granted") {
    // Prefer Service-Worker notification (works when tab is in background)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(label, {
          body,
          icon: "/icon-192.svg",
          badge: "/icon-192.svg",
          vibrate: [300, 100, 300, 100, 300],
          requireInteraction: true,
          tag: "shift-alarm",
          renotify: true,
        } as NotificationOptions);
      }).catch(() => {
        try { new Notification(label, { body, icon: "/icon-192.svg" }); } catch {}
      });
    } else {
      try { new Notification(label, { body, icon: "/icon-192.svg" }); } catch {}
    }
  }
}

export function scheduleShiftAlarms(settings: ShiftAlarmSettings, lang: "en" | "ar" | "sv" = "ar") {
  cancelShiftAlarms();
  if (!settings.enabled) return;

  const [startH, startM] = settings.startTime.split(":").map(Number);
  const [endH,   endM  ] = settings.endTime.split(":").map(Number);

  const startLabels: Record<string, string> = {
    en: "🔔 Shift Starting!", ar: "🔔 بدء الدوام!", sv: "🔔 Arbetspasset börjar!",
  };
  const endLabels: Record<string, string> = {
    en: "🔔 Shift Ending!", ar: "🔔 انتهاء الدوام!", sv: "🔔 Arbetspasset slutar!",
  };

  const scheduleOne = (hour: number, minute: number, label: string, body: string) => {
    const delay = msUntilNext(hour, minute);
    const nextFireAt = Date.now() + delay;

    // Keep _scheduled in sync for missed-alarm detection
    const existing = _scheduled.find(s => s.hour === hour && s.minute === minute);
    if (existing) { existing.nextFireAt = nextFireAt; existing.label = label; existing.body = body; }
    else _scheduled.push({ hour, minute, label, body, nextFireAt });

    const id = setTimeout(() => {
      fireAlarm(settings, label, body);
      scheduleOne(hour, minute, label, body);   // reschedule for next day
    }, delay);
    activeAlarmTimers.push(id);
  };

  scheduleOne(startH, startM, startLabels[lang] ?? startLabels.en, settings.startTime);
  scheduleOne(endH,   endM,   endLabels[lang]   ?? endLabels.en,   settings.endTime);

  // ── Visibility handler: resume AudioContext + catch missed alarms ──────
  // On mobile, AudioContext is suspended when the app goes to background.
  // The keepalive interval also stops. When the user reopens the app,
  // the page becomes "visible" again — we resume the context here AND
  // check whether an alarm was missed while the app was away (within 3 min).
  if (_visibilityHandler) {
    document.removeEventListener("visibilitychange", _visibilityHandler);
  }
  _visibilityHandler = () => {
    if (document.visibilityState !== "visible") return;

    // 1. Resume suspended AudioContext immediately (counts as user-return gesture)
    if (_sharedCtx && _sharedCtx.state === "suspended") {
      _sharedCtx.resume().catch(() => {});
    }

    // 2. Check for missed alarms
    const now = Date.now();
    for (const alarm of _scheduled) {
      const overdue = now - alarm.nextFireAt;
      if (overdue >= 0 && overdue <= MISSED_GRACE_MS) {
        fireAlarm(settings, alarm.label, alarm.body);
        // Update next fire to tomorrow so it doesn't double-fire
        alarm.nextFireAt += 24 * 60 * 60 * 1000;
      }
    }
  };
  document.addEventListener("visibilitychange", _visibilityHandler);
}

export function cancelShiftAlarms() {
  activeAlarmTimers.forEach(id => clearTimeout(id));
  activeAlarmTimers.splice(0, activeAlarmTimers.length);
  _scheduled.splice(0, _scheduled.length);
  if (_visibilityHandler) {
    document.removeEventListener("visibilitychange", _visibilityHandler);
    _visibilityHandler = null;
  }
}

export function bootShiftAlarms(lang: "en" | "ar" | "sv" = "ar") {
  const settings = getAlarmSettings();
  if (!settings.enabled) return;
  if (!("AudioContext" in window || "webkitAudioContext" in window)) return;
  scheduleShiftAlarms(settings, lang);
}

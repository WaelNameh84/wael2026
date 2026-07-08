const ALARM_STORAGE_KEY = "setting_shift_alarms";

export interface ShiftAlarmSettings {
  enabled: boolean;
  startTime: string;
  endTime: string;
  soundType: "beep" | "bell" | "chime" | "horn";
  volume: number;
}

export function getAlarmSettings(): ShiftAlarmSettings {
  try {
    const raw = localStorage.getItem(ALARM_STORAGE_KEY);
    if (!raw) return defaultAlarmSettings();
    return { ...defaultAlarmSettings(), ...JSON.parse(raw) };
  } catch {
    return defaultAlarmSettings();
  }
}

export function saveAlarmSettings(s: ShiftAlarmSettings) {
  localStorage.setItem(ALARM_STORAGE_KEY, JSON.stringify(s));
}

function defaultAlarmSettings(): ShiftAlarmSettings {
  return { enabled: false, startTime: "09:00", endTime: "17:00", soundType: "bell", volume: 0.7 };
}

const activeAlarmTimers: ReturnType<typeof setTimeout>[] = [];

function msUntilNext(hour: number, minute: number): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

async function playSound(type: ShiftAlarmSettings["soundType"], volume: number): Promise<void> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();

  /* Chrome / Safari require explicit resume — this is the root cause of the silent test button */
  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const playTone = (freq: number, startTime: number, duration: number, oscType: OscillatorType = "sine") => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = oscType;
    osc.frequency.setValueAtTime(freq, startTime);
    const safeVolume = Math.max(0.001, volume);
    gain.gain.setValueAtTime(safeVolume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  };

  const t = ctx.currentTime;

  switch (type) {
    case "beep":
      playTone(880, t,       0.3, "square");
      playTone(880, t + 0.4, 0.3, "square");
      playTone(880, t + 0.8, 0.5, "square");
      break;
    case "bell":
      playTone(1046, t,       1.5, "sine");
      playTone(1318, t + 0.1, 1.2, "sine");
      playTone(1568, t + 0.2, 1.0, "sine");
      break;
    case "chime":
      [523, 659, 784, 1047].forEach((freq, i) => playTone(freq, t + i * 0.25, 0.8, "sine"));
      break;
    case "horn":
      playTone(220, t,       0.5, "sawtooth");
      playTone(330, t + 0.6, 0.5, "sawtooth");
      playTone(440, t + 1.2, 0.8, "sawtooth");
      break;
  }

  /* Close the context after the longest possible sound + buffer to free resources */
  const maxDuration = type === "chime" ? 1.6 : type === "horn" ? 2.2 : type === "bell" ? 2.0 : 1.5;
  setTimeout(() => ctx.close().catch(() => {}), (maxDuration + 0.2) * 1000);
}

export async function playAlarmSound(type: ShiftAlarmSettings["soundType"] = "bell", volume = 0.7): Promise<void> {
  await playSound(type, volume);
}

export function scheduleShiftAlarms(settings: ShiftAlarmSettings, lang: "en" | "ar" | "sv" = "ar") {
  cancelShiftAlarms();
  if (!settings.enabled) return;

  const [startH, startM] = settings.startTime.split(":").map(Number);
  const [endH, endM] = settings.endTime.split(":").map(Number);

  const startLabels: Record<string, string> = {
    en: "🔔 Shift Starting Soon!",
    ar: "🔔 بدء الدوام!",
    sv: "🔔 Arbetspasset börjar!",
  };
  const endLabels: Record<string, string> = {
    en: "🔔 Shift Ending Soon!",
    ar: "🔔 انتهاء الدوام!",
    sv: "🔔 Arbetspasset slutar!",
  };

  const scheduleAlarm = (hour: number, minute: number, label: string, onFire: () => void) => {
    const delay = msUntilNext(hour, minute);
    const id = setTimeout(() => {
      onFire();
      scheduleAlarm(hour, minute, label, onFire);
    }, delay);
    activeAlarmTimers.push(id);
  };

  scheduleAlarm(startH, startM, startLabels[lang] ?? startLabels.en, () => {
    playAlarmSound(settings.soundType, settings.volume);
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(startLabels[lang] ?? startLabels.en, {
        body: settings.startTime,
        icon: "/icon-192.svg",
        silent: true,
      });
    }
  });

  scheduleAlarm(endH, endM, endLabels[lang] ?? endLabels.en, () => {
    playAlarmSound(settings.soundType, settings.volume);
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(endLabels[lang] ?? endLabels.en, {
        body: settings.endTime,
        icon: "/icon-192.svg",
        silent: true,
      });
    }
  });
}

export function cancelShiftAlarms() {
  activeAlarmTimers.forEach(id => clearTimeout(id));
  activeAlarmTimers.splice(0, activeAlarmTimers.length);
}

export function bootShiftAlarms(lang: "en" | "ar" | "sv" = "ar") {
  const settings = getAlarmSettings();
  if (!settings.enabled) return;
  if (!("AudioContext" in window || "webkitAudioContext" in window)) return;
  scheduleShiftAlarms(settings, lang);
}

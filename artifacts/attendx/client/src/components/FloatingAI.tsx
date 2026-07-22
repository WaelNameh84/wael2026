import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { useTTS } from "@/hooks/use-tts";
import { useSettings } from "@/hooks/use-settings";
import { useGetMe } from "@/lib/api-client/index";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, X, Loader2, Mic, MicOff, GripVertical, User, Sparkles, Zap, Star, Heart, MessageCircle, Cpu, Wand2, Rocket, Brain, KeyRound, Eye, EyeOff, CheckCircle2, XCircle, Shield, Globe, Atom, Compass, Gem, Ghost, Crown, Coffee, Flame, Target } from "lucide-react";
import { Robot3DIcon, Gem3DIcon, Brain3DIcon, Flame3DIcon, Star3DIcon, Orb3DIcon, Shield3DIcon, Crown3DIcon, Rocket3DIcon, Eye3DIcon, Neural3DIcon, Hologram3DIcon, Infinity3DIcon, Dna3DIcon, Chip3DIcon } from "@/components/AiIcons3D";
import AvatarAI from "@/components/AvatarAI";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface Message { role: "user" | "assistant"; content: string; }

const LANG_TO_SPEECH: Record<string, string> = { ar: "ar-SA", en: "en-US", sv: "sv-SE" };

type SpeechRecognitionCtor = new () => {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};

const BTN_SIZE = 56;
const AI_BTN_SIZES: Record<string, number> = { small: 44, medium: 56, large: 68 };
const PANEL_W = 360;
const PANEL_H = 480;
const MARGIN = 12;
const STORAGE_KEY = "floating-ai-pos";

function getDefaultPos() {
  return { x: window.innerWidth - BTN_SIZE - MARGIN, y: window.innerHeight - BTN_SIZE - MARGIN };
}
function loadPos(): { x: number; y: number } | null {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function savePos(p: { x: number; y: number }) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }
function clamp(p: { x: number; y: number }) {
  return { x: Math.max(0, Math.min(p.x, window.innerWidth - BTN_SIZE)), y: Math.max(0, Math.min(p.y, window.innerHeight - BTN_SIZE)) };
}
function getPanelStyle(btn: { x: number; y: number }): React.CSSProperties {
  const w = window.innerWidth, h = window.innerHeight;
  let left = btn.x + BTN_SIZE / 2 > w / 2 ? btn.x + BTN_SIZE - PANEL_W : btn.x;
  let top  = btn.y + BTN_SIZE / 2 > h / 2 ? btn.y - PANEL_H - MARGIN  : btn.y + BTN_SIZE + MARGIN;
  left = Math.max(MARGIN, Math.min(left, w - PANEL_W - MARGIN));
  top  = Math.max(MARGIN, Math.min(top,  h - PANEL_H - MARGIN));
  return { position: "fixed", left, top, width: PANEL_W, height: PANEL_H };
}

function authFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("auth_token");
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    },
  });
}

/* ── AI Icon map ── */
function AiIcon({ icon, size = 6 }: { icon: string; size?: number }) {
  const cls = `w-${size} h-${size}`;
  // 3D icons
  if (icon === "robot3d")    return <Robot3DIcon    size={size} />;
  if (icon === "gem3d")      return <Gem3DIcon      size={size} />;
  if (icon === "brain3d")    return <Brain3DIcon    size={size} />;
  if (icon === "fire3d")     return <Flame3DIcon    size={size} />;
  if (icon === "star3d")     return <Star3DIcon     size={size} />;
  if (icon === "orb3d")      return <Orb3DIcon      size={size} />;
  if (icon === "shield3d")   return <Shield3DIcon   size={size} />;
  if (icon === "crown3d")    return <Crown3DIcon    size={size} />;
  if (icon === "rocket3d")   return <Rocket3DIcon   size={size} />;
  if (icon === "eye3d")      return <Eye3DIcon      size={size} />;
  if (icon === "neural3d")   return <Neural3DIcon   size={size} />;
  if (icon === "hologram3d") return <Hologram3DIcon size={size} />;
  if (icon === "infinity3d") return <Infinity3DIcon size={size} />;
  if (icon === "dna3d")      return <Dna3DIcon      size={size} />;
  if (icon === "chip3d")     return <Chip3DIcon     size={size} />;
  // flat icons
  if (icon === "bot")      return <Bot           className={cls} />;
  if (icon === "sparkles") return <Sparkles      className={cls} />;
  if (icon === "brain")    return <Brain         className={cls} />;
  if (icon === "zap")      return <Zap           className={cls} />;
  if (icon === "star")     return <Star          className={cls} />;
  if (icon === "heart")    return <Heart         className={cls} />;
  if (icon === "message")  return <MessageCircle className={cls} />;
  if (icon === "cpu")      return <Cpu           className={cls} />;
  if (icon === "wand")     return <Wand2         className={cls} />;
  if (icon === "rocket")   return <Rocket        className={cls} />;
  if (icon === "shield")   return <Shield        className={cls} />;
  if (icon === "globe")    return <Globe         className={cls} />;
  if (icon === "atom")     return <Atom          className={cls} />;
  if (icon === "compass")  return <Compass       className={cls} />;
  if (icon === "gem")      return <Gem           className={cls} />;
  if (icon === "ghost")    return <Ghost         className={cls} />;
  if (icon === "crown")    return <Crown         className={cls} />;
  if (icon === "coffee")   return <Coffee        className={cls} />;
  if (icon === "flame")    return <Flame         className={cls} />;
  if (icon === "target")   return <Target        className={cls} />;
  return <Bot className={cls} />;
}

/* ── Button shape styles ── */
function getShapeClass(shape: string): string {
  switch (shape) {
    case "circle":   return "rounded-full";
    case "rounded":  return "rounded-2xl";
    case "square":   return "rounded-lg";
    case "gradient": return "rounded-full";
    case "neon":     return "rounded-full";
    case "glass":    return "rounded-2xl";
    case "ring":     return "rounded-full";
    case "pill":     return "rounded-full";
    case "hexagon":  return "";
    case "blob":     return "";
    default:         return "rounded-full";
  }
}

function getShapeStyle(
  shape: string, color: string,
  colors: Record<string, { bg: string; text: string }>,
  customColor: string,
  isOpen: boolean
): React.CSSProperties {
  if (isOpen) return {};
  const c = colors[color] ?? colors["primary"];
  const bgColor = c.bg;

  switch (shape) {
    case "gradient":
      return {
        background: `linear-gradient(135deg, ${bgColor}, #7c3aed)`,
        color: "#fff",
        boxShadow: `0 0 20px ${bgColor}80, 0 4px 15px rgba(0,0,0,0.3)`,
      };
    case "neon":
      return {
        background: "transparent",
        color: bgColor,
        border: `2px solid ${bgColor}`,
        boxShadow: `0 0 12px ${bgColor}, 0 0 30px ${bgColor}60, inset 0 0 8px ${bgColor}20`,
      };
    case "glass":
      return {
        background: `${bgColor}30`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: `1px solid ${bgColor}60`,
        color: "#fff",
        boxShadow: `0 8px 32px rgba(0,0,0,0.2), 0 0 0 1px ${bgColor}40`,
      };
    case "ring":
      return {
        background: "transparent",
        border: `3px solid ${bgColor}`,
        color: bgColor,
        boxShadow: `0 0 0 3px ${bgColor}30`,
      };
    case "pill":
      if (color === "primary") return {};
      return { backgroundColor: c.bg, color: c.text };
    case "hexagon":
      return {
        ...(color === "primary" ? {} : { backgroundColor: c.bg, color: c.text }),
        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
      };
    case "blob":
      return {
        ...(color === "primary" ? {} : { backgroundColor: c.bg, color: c.text }),
        borderRadius: "40% 60% 70% 30% / 40% 50% 60% 50%",
      };
    default:
      if (color === "primary") return {};
      return { backgroundColor: c.bg, color: c.text };
  }
}

export default function FloatingAI() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { speak, stop: stopSpeaking, isSpeaking } = useTTS();
  const { assistantName, assistantPersonality, ttsEnabled, wakeWord, aiButtonIcon, aiButtonShape, aiButtonColor, aiButtonCustomColor, aiEnabled, aiButtonSize, aiAvatarStyle } = useSettings();

  /* ── Dynamic button size based on user preference ── */
  const effectiveBtnSize = AI_BTN_SIZES[aiButtonSize] ?? BTN_SIZE;
  const isPill = aiButtonShape === "pill";
  const pillW  = Math.round(effectiveBtnSize * 1.45);
  const pillH  = Math.round(effectiveBtnSize * 0.8);

  const AI_COLORS: Record<string, { bg: string; text: string }> = {
    primary:  { bg: "hsl(var(--primary))",  text: "hsl(var(--primary-foreground))" },
    violet:   { bg: "#7c3aed", text: "#fff" },
    rose:     { bg: "#e11d48", text: "#fff" },
    amber:    { bg: "#d97706", text: "#fff" },
    emerald:  { bg: "#059669", text: "#fff" },
    sky:      { bg: "#0284c7", text: "#fff" },
    slate:    { bg: "#475569", text: "#fff" },
    black:    { bg: "#18181b", text: "#fff" },
    white:    { bg: "#f8fafc", text: "#1e293b" },
    custom:   { bg: aiButtonCustomColor, text: "#fff" },
  };

  const { data: me } = useGetMe();
  const [location] = useLocation();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  /* ── Quick Key Setup ── */
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [setupKey, setSetupKey] = useState("");
  const [showSetupKey, setShowSetupKey] = useState(false);
  const [setupStatus, setSetupStatus] = useState<"idle" | "verifying" | "valid" | "invalid">("idle");
  const [setupError, setSetupError] = useState("");

  const [pos, setPos] = useState<{ x: number; y: number }>(() => loadPos() ?? getDefaultPos());
  const isDragging  = useRef(false);
  const hasMoved    = useRef(false);
  const dragStart   = useRef({ px: 0, py: 0, bx: 0, by: 0 });
  const btnRef      = useRef<HTMLButtonElement>(null);
  const livePos     = useRef(loadPos() ?? getDefaultPos());
  const bottomRef   = useRef<HTMLDivElement>(null);
  const recRef      = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const wakeRecRef  = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const pendingTr   = useRef("");
  const msgsRef     = useRef(messages);
  msgsRef.current   = messages;

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) setVoiceSupported(true);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    const onResize = () => {
      const c = clamp(livePos.current);
      livePos.current = c;
      savePos(c);
      setPos(c);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    return () => { wakeRecRef.current?.abort(); wakeRecRef.current = null; };
  }, []);

  useEffect(() => {
    if (open && msgsRef.current.length === 0) {
      const firstName = me?.name?.split(" ")[0] ?? "";
      const name = assistantName || "مساعدك الذكي";
      const greet = firstName
        ? `أهلاً ${firstName}! أنا ${name}، كيف أساعدك اليوم؟`
        : `أهلاً! أنا ${name}. كيف أساعدك؟`;
      setMessages([{ role: "assistant", content: greet }]);
    }
    if (open && !localStorage.getItem("gemini_api_key")) {
      const token = localStorage.getItem("auth_token");
      fetch("/api/settings/my-ai-key", { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.key) {
            localStorage.setItem("gemini_api_key", data.key);
          } else {
            setShowKeySetup(true);
          }
        })
        .catch(() => setShowKeySetup(true));
    }
  }, [open, me?.name, assistantName]);

  const handleQuickSaveKey = useCallback(async () => {
    const key = setupKey.trim();
    if (!key) return;
    setSetupStatus("verifying"); setSetupError("");
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/ai/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ key }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.valid) {
        localStorage.setItem("gemini_api_key", key);
        fetch("/api/settings/my-ai-key", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ key }) }).catch(() => {});
        setSetupStatus("valid");
        setSetupKey("");
        setTimeout(() => setShowKeySetup(false), 1200);
        toast({ title: "✅ تم حفظ المفتاح — المساعد جاهز!" });
      } else {
        const reason = data?.reason ?? "";
        const errMap: Record<string, string> = {
          unauthorized: "المفتاح غير مصرح به أو منتهي الصلاحية",
          invalid_key: "المفتاح غير صحيح",
          bad_request: "طلب غير صحيح",
        };
        setSetupStatus("invalid");
        setSetupError(errMap[reason] || reason || "فشل التحقق من المفتاح");
      }
    } catch {
      setSetupStatus("invalid"); setSetupError("فشل الاتصال بالخادم");
    }
  }, [setupKey, toast]);

  if (location === "/ai") return null;

  const handleSend = async (overrideText?: string, fromVoice = false) => {
    const msg = (overrideText ?? input).trim();
    if (!msg || pending) return;
    if (!overrideText) setInput("");
    const history = msgsRef.current;
    const next: Message[] = [...history, { role: "user", content: msg }];
    setMessages(next);
    setPending(true);
    try {
      const clientApiKey = localStorage.getItem("gemini_api_key") || "";
      const res = await authFetch("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message: msg,
          conversationHistory: history.map(m => ({ role: m.role, content: m.content })),
          assistantName: assistantName || "مساعدك الذكي",
          personality: (assistantPersonality || "friendly") as "professional" | "friendly" | "concise",
          userName: me?.name || "",
          ...(clientApiKey ? { clientApiKey } : {}),
        }),
      });
      if (res.status === 503) { setShowKeySetup(true); throw new Error("لم يتم ضبط مفتاح Gemini API. أدخل المفتاح في الأسفل."); }
      if (res.status === 401) throw new Error("انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.");
      if (res.status === 403) throw new Error("ليس لديك صلاحية لاستخدام هذه الخدمة.");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error ?? `خطأ: ${res.status}`);
      }
      const data = await res.json();
      const reply = data?.reply ?? "عذراً، حدث خطأ.";
      setMessages([...next, { role: "assistant", content: reply }]);
      if (fromVoice || ttsEnabled) speak(reply, undefined, fromVoice);
    } catch (e: any) {
      toast({ title: "خطأ في المساعد الذكي", description: e?.message ?? "فشل الاتصال", variant: "destructive" });
    } finally {
      setPending(false);
    }
  };

  const stopListening = useCallback(() => {
    recRef.current?.stop(); recRef.current = null; setListening(false);
  }, []);

  const stopWakeListening = useCallback(() => {
    wakeRecRef.current?.abort(); wakeRecRef.current = null; setWakeEnabled(false);
  }, []);

  const startActiveListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    stopSpeaking();
    pendingTr.current = "";
    const rec = new SR();
    rec.lang = LANG_TO_SPEECH[i18n.language] ?? "ar-SA";
    rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onresult = (e: any) => {
      let tr = "";
      for (let i = 0; i < e.results.length; i++) tr += e.results[i][0].transcript;
      setInput(tr);
      if (e.results[e.results.length - 1].isFinal) pendingTr.current = tr;
    };
    rec.onerror = (e: any) => {
      setListening(false);
      if (e.error !== "aborted") toast({ title: "خطأ في الميكروفون", variant: "destructive" });
    };
    rec.onend = () => {
      setListening(false); recRef.current = null;
      const tr = pendingTr.current.trim(); pendingTr.current = "";
      if (tr) { setInput(""); handleSend(tr, true); }
    };
    recRef.current = rec;
    try { rec.start(); } catch { setListening(false); }
  }, [i18n.language, stopSpeaking]);

  const startWakeListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const word = (wakeWord || "مساعد").toLowerCase().trim();
    const nameWord = (assistantName || "").toLowerCase().trim();
    const rec = new SR();
    rec.lang = LANG_TO_SPEECH[i18n.language] ?? "ar-SA";
    rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      const lower = transcript.toLowerCase();
      const heard = lower.includes(word) || (nameWord.length > 1 && lower.includes(nameWord));
      if (heard) {
        rec.abort(); wakeRecRef.current = null; setWakeEnabled(false);
        setOpen(true);
        setTimeout(() => startActiveListening(), 600);
      }
    };
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "permission-denied") {
        toast({ title: "لم يتم السماح بالميكروفون", variant: "destructive" });
      }
      wakeRecRef.current = null; setWakeEnabled(false);
    };
    rec.onend = () => { if (wakeRecRef.current === rec) { wakeRecRef.current = null; setWakeEnabled(false); } };
    wakeRecRef.current = rec;
    try { rec.start(); setWakeEnabled(true); } catch { setWakeEnabled(false); }
  }, [wakeWord, assistantName, i18n.language, startActiveListening, toast]);

  const startListening = useCallback(() => {
    if (listening) { stopListening(); return; }
    startActiveListening();
  }, [listening, stopListening, startActiveListening]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    isDragging.current = true;
    hasMoved.current   = false;
    dragStart.current  = { px: e.clientX, py: e.clientY, bx: livePos.current.x, by: livePos.current.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    // remove transition during drag for instant feel
    if (btnRef.current) btnRef.current.style.transition = "none";
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.px;
    const dy = e.clientY - dragStart.current.py;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved.current = true;
    if (!hasMoved.current) return;
    // move button directly on DOM — zero React re-renders during drag
    const next = clamp({ x: dragStart.current.bx + dx, y: dragStart.current.by + dy });
    livePos.current = next;
    if (btnRef.current) {
      btnRef.current.style.left = `${next.x}px`;
      btnRef.current.style.top  = `${next.y}px`;
    }
    e.preventDefault();
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    // restore transition
    if (btnRef.current) btnRef.current.style.transition = "";
    if (!hasMoved.current) {
      setOpen(o => !o);
    } else {
      const snapped = livePos.current;
      savePos(snapped);
      setPos(snapped);       // sync React state once on release
    }
    e.preventDefault();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (listening) stopListening(); handleSend(); }
  };

  const panelStyle = getPanelStyle(pos);
  const name = assistantName || "المساعد الذكي";
  const initial = name.charAt(0);

  const btnShapeClass = getShapeClass(aiButtonShape);
  const btnStyle = getShapeStyle(aiButtonShape, aiButtonColor, AI_COLORS, aiButtonCustomColor, open);

  const isNeonOrRing = aiButtonShape === "neon" || aiButtonShape === "ring";

  /* ── Avatar emoji per style ── */
  const AVATAR_EMOJI: Record<string, string> = {
    human: "", robot: "🤖", cat: "🐱", alien: "👽", panda: "🐼", fox: "🦊",
  };

  if (!aiEnabled) return null;

  return (
    <>
      {open && (
        <div className="z-50 flex flex-col bg-card border border-card-border rounded-2xl shadow-2xl overflow-hidden" style={panelStyle}>
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 bg-primary text-primary-foreground flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold overflow-hidden">
              {AVATAR_EMOJI[aiAvatarStyle] ? (
                <span className="text-base leading-none">{AVATAR_EMOJI[aiAvatarStyle]}</span>
              ) : (
                initial
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{name}</p>
              <p className="text-[10px] opacity-70">
                {listening ? "🎙 يستمع..." : isSpeaking ? "🔊 يتحدث..." : pending ? "يفكر..." : "متاح للمساعدة"}
              </p>
            </div>
            <button onClick={() => { setOpen(false); stopSpeaking(); }} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Key Setup Panel ── */}
          {showKeySetup && (
            <div className="flex-shrink-0 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                <KeyRound className="w-3.5 h-3.5 flex-shrink-0" />
                <p className="text-xs font-semibold">إعداد مفتاح Gemini API</p>
                {localStorage.getItem("gemini_api_key") && (
                  <button onClick={() => setShowKeySetup(false)} className="ms-auto text-[10px] underline opacity-60 hover:opacity-100">إخفاء</button>
                )}
              </div>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Input
                    type={showSetupKey ? "text" : "password"}
                    value={setupKey}
                    onChange={e => { setSetupKey(e.target.value); setSetupStatus("idle"); setSetupError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleQuickSaveKey()}
                    placeholder="أدخل مفتاح API..."
                    className="h-8 pe-8 font-mono text-xs bg-white dark:bg-background"
                    autoComplete="off"
                  />
                  <button type="button" onClick={() => setShowSetupKey(v => !v)}
                    className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showSetupKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
                <Button onClick={handleQuickSaveKey} disabled={!setupKey.trim() || setupStatus === "verifying"}
                  size="sm" className="h-8 px-2.5 text-xs flex-shrink-0 gap-1">
                  {setupStatus === "verifying"
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <KeyRound className="w-3 h-3" />}
                  {setupStatus === "verifying" ? "جاري…" : "اختبر وحفظ"}
                </Button>
              </div>
              {setupStatus === "valid" && <p className="text-[10px] text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> تم الحفظ — المساعد جاهز!</p>}
              {setupStatus === "invalid" && <p className="text-[10px] text-destructive flex items-center gap-1"><XCircle className="w-3 h-3" /> {setupError || "المفتاح غير صالح"}</p>}
              {setupStatus === "verifying" && <p className="text-[10px] text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> اختبار الاتصال بـ Gemini…</p>}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold",
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-gradient-to-br from-violet-500 to-primary text-white"
                )}>
                  {msg.role === "user" ? <User className="w-3 h-3" /> : initial}
                </div>
                <div className={cn(
                  "max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted text-foreground rounded-tl-sm"
                )}>
                  {msg.content}
                </div>
              </div>
            ))}

            {pending && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-primary flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">{initial}</div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2.5 flex gap-1 items-center">
                  {[0,150,300].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </div>
              </div>
            )}

            {listening && (
              <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-ping inline-block" />
                أنا أستمع...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Wake word bar */}
          {voiceSupported && wakeWord && (
            <div className="px-3 py-1.5 border-t border-border/50 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {wakeEnabled ? `🎙 تنصّت لـ "${wakeWord}"...` : `كلمة التنشيط: "${wakeWord}"`}
              </span>
              <button
                onClick={() => wakeEnabled ? stopWakeListening() : startWakeListening()}
                disabled={listening || pending}
                className={cn(
                  "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                  wakeEnabled
                    ? "bg-primary/10 border-primary/30 text-primary animate-pulse"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                )}
              >
                <Sparkles className="w-2.5 h-2.5" />
                {wakeEnabled ? "إيقاف" : "تفعيل"}
              </button>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-border flex gap-2 items-end flex-shrink-0">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={listening ? "أستمع..." : "اكتب سؤالاً..."}
              className="resize-none text-xs min-h-[36px] max-h-24"
              rows={1}
              disabled={pending || listening}
            />
            {voiceSupported && (
              <Button type="button" onClick={startListening} disabled={pending || isSpeaking}
                size="icon" variant={listening ? "destructive" : "outline"}
                className={cn("h-9 w-9 flex-shrink-0", listening && "animate-pulse")}>
                {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </Button>
            )}
            <Button onClick={() => { if (listening) stopListening(); handleSend(); }}
              disabled={!input.trim() || pending} size="icon" className="h-9 w-9 flex-shrink-0">
              {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      )}

      {/* Floating draggable button */}
      <button
        ref={btnRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          position: "fixed", left: pos.x, top: pos.y,
          width:  open ? effectiveBtnSize : isPill ? pillW : effectiveBtnSize,
          height: open ? effectiveBtnSize : isPill ? pillH : effectiveBtnSize,
          touchAction: "none", zIndex: 50,
          ...(open ? { background: "var(--muted)", color: "var(--foreground)", borderRadius: "50%" } : btnStyle),
        }}
        className={cn(
          "shadow-2xl flex items-center justify-center transition-all duration-200 select-none cursor-grab active:cursor-grabbing",
          btnShapeClass,
          open ? "" : (aiButtonColor === "primary" && !["gradient","neon","glass","ring"].includes(aiButtonShape))
            ? "bg-primary text-primary-foreground" : "",
          aiButtonShape === "neon" && !open && "bg-transparent",
          aiButtonShape === "ring" && !open && "bg-transparent",
        )}
      >
        {open ? <X className="w-5 h-5 pointer-events-none" /> : (
          <div className="relative pointer-events-none">
            <AiIcon icon={aiButtonIcon} size={isNeonOrRing ? 5 : 6} />
            <span className={cn(
              "absolute -top-1 -end-1 w-3 h-3 rounded-full border-2 border-background",
              isSpeaking ? "bg-primary animate-pulse" : listening ? "bg-destructive animate-ping" : "bg-green-400"
            )} />
          </div>
        )}
        <GripVertical className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 opacity-20 pointer-events-none" />
      </button>
    </>
  );
}

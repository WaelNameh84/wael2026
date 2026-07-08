import { useState, useRef, useEffect, useCallback } from "react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTTS } from "@/hooks/use-tts";
import { useSettings } from "@/hooks/use-settings";
import { useGetMe } from "@/lib/api-client/index";
import { Send, Loader2, Mic, MicOff, Sparkles, Volume2, VolumeX, Settings, Bot, KeyRound, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { authFetch } from "@/lib/api-url";

interface Message { role: "user" | "assistant"; content: string; ts: number; }

type SRCtor = new () => {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
declare global { interface Window { SpeechRecognition: SRCtor; webkitSpeechRecognition: SRCtor; } }

const LANG_SPEECH: Record<string, string> = { ar: "ar-SA", en: "en-US", sv: "sv-SE" };

type AssistantState = "idle" | "wake-listening" | "wake-detected" | "question-listening" | "thinking" | "speaking";

function OrbAnimation({ state, wakeWord, assistantName }: { state: AssistantState; wakeWord: string; assistantName: string }) {
  const colors: Record<AssistantState, string> = {
    "idle":               "from-slate-400/30 via-slate-300/20 to-transparent",
    "wake-listening":     "from-primary/40 via-primary/20 to-transparent",
    "wake-detected":      "from-emerald-400/70 via-emerald-300/40 to-transparent",
    "question-listening": "from-red-400/60 via-red-300/30 to-transparent",
    "thinking":           "from-violet-400/60 via-violet-300/30 to-transparent",
    "speaking":           "from-primary/70 via-primary/40 to-transparent",
  };
  const pulse: Record<AssistantState, string> = {
    "idle":               "animate-pulse",
    "wake-listening":     "animate-pulse",
    "wake-detected":      "animate-ping",
    "question-listening": "animate-ping",
    "thinking":           "animate-spin",
    "speaking":           "animate-pulse",
  };
  const labels: Record<AssistantState, string> = {
    "idle":               `${assistantName} — قل "${wakeWord}" للتفعيل`,
    "wake-listening":     `أنصت لـ "${wakeWord}"...`,
    "wake-detected":      "تم التعرف! اسألني...",
    "question-listening": "أنا أستمع...",
    "thinking":           "أفكر...",
    "speaking":           "أتحدث...",
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-36 h-36 flex items-center justify-center">
        <div className={cn(
          "absolute inset-0 rounded-full bg-gradient-radial opacity-60",
          colors[state], pulse[state]
        )} style={{ animationDuration: state === "thinking" ? "1s" : "2s" }} />
        <div className={cn(
          "absolute inset-4 rounded-full bg-gradient-radial opacity-80",
          colors[state]
        )} />
        <div className={cn(
          "relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-2xl border-2 transition-colors duration-500",
          state === "idle" || state === "wake-listening"
            ? "bg-muted border-border"
            : state === "wake-detected" || state === "question-listening"
              ? "bg-red-500 border-red-400"
              : state === "thinking"
                ? "bg-violet-600 border-violet-400"
                : "bg-primary border-primary/50"
        )}>
          {state === "thinking" ? (
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          ) : state === "question-listening" || state === "wake-detected" ? (
            <Mic className="w-8 h-8 text-white" />
          ) : state === "speaking" ? (
            <div className="flex items-end gap-[3px]">
              {[5,9,13,9,5].map((h, i) => (
                <span key={i} className="w-1 rounded-full bg-white animate-wave"
                  style={{ height: h, animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
          ) : (
            <Bot className="w-8 h-8 text-muted-foreground" />
          )}
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">{assistantName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{labels[state]}</p>
      </div>
    </div>
  );
}

function MessageBubble({ msg, assistantName }: { msg: Message; assistantName: string }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3 items-end", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mb-1 text-[9px] font-bold text-white",
        isUser ? "bg-primary" : "bg-gradient-to-br from-violet-500 to-primary"
      )}>
        {isUser ? "أنت" : assistantName.charAt(0)}
      </div>
      <div className={cn(
        "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm",
        isUser
          ? "bg-primary text-primary-foreground rounded-br-sm"
          : "bg-card border border-border text-foreground rounded-bl-sm"
      )}>
        {msg.content}
      </div>
    </div>
  );
}

export default function AiPage() {
  const { i18n } = useTranslation();
  const { toast } = useToast();
  const { speak, stop: stopSpeaking } = useTTS();
  const { ttsEnabled, wakeWord, assistantName, assistantPersonality } = useSettings();
  const { data: me } = useGetMe();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<AssistantState>("idle");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const [isPending, setIsPending] = useState(false);

  /* ── Quick Key Setup ── */
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [setupKey, setSetupKey] = useState("");
  const [showSetupKey, setShowSetupKey] = useState(false);
  const [setupStatus, setSetupStatus] = useState<"idle" | "verifying" | "valid" | "invalid">("idle");
  const [setupError, setSetupError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const activeRecRef = useRef<InstanceType<SRCtor> | null>(null);
  const wakeRecRef = useRef<InstanceType<SRCtor> | null>(null);
  const pendingRef = useRef("");
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Build greeting when user data is available
  useEffect(() => {
    if (messagesRef.current.length === 0) {
      const userName = me?.name ? `, ${me.name.split(" ")[0]}` : "";
      const greeting = `مرحباً${userName}! أنا ${assistantName || "مساعدك الذكي"}. يمكنك قول "${wakeWord || "مساعد"}" لتفعيلي صوتياً، أو اكتب سؤالك مباشرة.`;
      setMessages([{ role: "assistant", content: greeting, ts: Date.now() }]);
    }
  }, [me?.name]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!SR);
  }, []);

  /* show key setup banner if no key stored — also try syncing from server */
  useEffect(() => {
    if (!localStorage.getItem("gemini_api_key")) {
      const token = localStorage.getItem("auth_token");
      fetch("/api/settings/my-ai-key", { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.key) {
            localStorage.setItem("gemini_api_key", data.key);
            setShowKeySetup(false);
          } else {
            setShowKeySetup(true);
          }
        })
        .catch(() => setShowKeySetup(true));
    }
  }, []);

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
        setShowKeySetup(false);
        toast({ title: "✅ تم حفظ المفتاح — المساعد جاهز!" });
      } else {
        const reason = data?.reason ?? "";
        const errMap: Record<string, string> = {
          unauthorized: "المفتاح غير مصرح به أو منتهي الصلاحية",
          invalid_key: "المفتاح غير صحيح",
          bad_request: "طلب غير صحيح",
        };
        const msg = errMap[reason] || reason || "فشل التحقق من المفتاح";
        setSetupStatus("invalid"); setSetupError(msg);
      }
    } catch {
      setSetupStatus("invalid"); setSetupError("فشل الاتصال بالخادم");
    }
  }, [setupKey, toast]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, state]);

  const sendMessage = useCallback(async (text: string, fromVoice = false) => {
    const msg = text.trim();
    if (!msg || isPending) return;
    const history = messagesRef.current;
    const next: Message[] = [...history, { role: "user", content: msg, ts: Date.now() }];
    setMessages(next);
    setState("thinking");
    setIsPending(true);
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

      if (res.status === 503) {
        setShowKeySetup(true);
        throw new Error("لم يتم ضبط مفتاح Gemini API. أدخل مفتاحك أدناه.");
      }
      if (res.status === 401) {
        throw new Error("انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.");
      }
      if (res.status === 403) {
        throw new Error("ليس لديك صلاحية لاستخدام هذه الخدمة.");
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData?.error ?? `خطأ من الخادم: ${res.status}`;
        if (errMsg.includes("API key") || errMsg.includes("authentication") || errMsg.includes("credential")) {
          throw new Error("مفتاح Gemini API غير صالح. يرجى تحديثه من الإعدادات > المساعد الذكي.");
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      const reply = data?.reply ?? "عذراً، لم أتمكن من توليد رد.";
      setMessages([...next, { role: "assistant", content: reply, ts: Date.now() }]);
      if (fromVoice || ttsEnabled) {
        setState("speaking");
        speak(reply, () => setState("idle"), fromVoice);
      } else {
        setState("idle");
      }
    } catch (e: any) {
      toast({ title: "خطأ في المساعد الذكي", description: e?.message ?? "فشل الاتصال", variant: "destructive" });
      setState("idle");
    } finally {
      setIsPending(false);
    }
  }, [isPending, speak, toast, ttsEnabled, assistantName, assistantPersonality, me?.name]);

  const startActiveListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    stopSpeaking();
    pendingRef.current = "";
    const rec = new SR();
    rec.lang = LANG_SPEECH[i18n.language] ?? "ar-SA";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => setState("question-listening");
    rec.onresult = (e: any) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setInput(t);
      if (e.results[e.results.length - 1].isFinal) pendingRef.current = t;
    };
    rec.onerror = (e: any) => {
      const err = e.error;
      if (err === "not-allowed" || err === "permission-denied") {
        toast({ title: "لم يتم السماح بالميكروفون", description: "افتح إعدادات المتصفح وأذن للميكروفون.", variant: "destructive" });
      }
      setState("idle");
    };
    rec.onend = () => {
      activeRecRef.current = null;
      const transcript = pendingRef.current.trim();
      pendingRef.current = "";
      setInput("");
      if (transcript) sendMessage(transcript, true);
      else setState("idle");
    };
    activeRecRef.current = rec;
    try { rec.start(); } catch { setState("idle"); }
  }, [i18n.language, sendMessage, stopSpeaking, toast]);

  const startWakeListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const word = (wakeWord || "مساعد").toLowerCase().trim();
    const nameWord = (assistantName || "").toLowerCase().trim();
    const rec = new SR();
    rec.lang = LANG_SPEECH[i18n.language] ?? "ar-SA";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      const lower = transcript.toLowerCase();
      const heard = lower.includes(word) || (nameWord.length > 1 && lower.includes(nameWord));
      if (heard) {
        rec.abort();
        wakeRecRef.current = null;
        setState("wake-detected");
        setTimeout(() => startActiveListening(), 600);
      }
    };
    rec.onerror = (e: any) => {
      const err = e.error;
      if (err === "not-allowed" || err === "permission-denied") {
        toast({ title: "لم يتم السماح بالميكروفون", description: "افتح إعدادات المتصفح وأذن للميكروفون.", variant: "destructive" });
      }
      wakeRecRef.current = null;
      setWakeEnabled(false);
      setState("idle");
    };
    rec.onend = () => {
      if (wakeRecRef.current === rec) {
        wakeRecRef.current = null;
        setWakeEnabled(false);
        setState("idle");
      }
    };
    wakeRecRef.current = rec;
    try {
      rec.start();
      setState("wake-listening");
      setWakeEnabled(true);
    } catch {
      setState("idle");
    }
  }, [wakeWord, i18n.language, startActiveListening, toast]);

  const stopWakeListening = useCallback(() => {
    wakeRecRef.current?.abort();
    wakeRecRef.current = null;
    setWakeEnabled(false);
    setState("idle");
  }, []);

  const handleMicClick = () => {
    if (state === "question-listening") { activeRecRef.current?.stop(); return; }
    if (state === "speaking") { stopSpeaking(); setState("idle"); return; }
    if (state === "thinking") return;
    if (state === "wake-listening") { stopWakeListening(); return; }
    startActiveListening();
  };

  const handleWakeToggle = () => {
    if (wakeEnabled) stopWakeListening();
    else startWakeListening();
  };

  const handleSend = () => {
    if (!input.trim() || isPending) return;
    const text = input.trim();
    setInput("");
    sendMessage(text, false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              {assistantName || "المساعد الذكي"}
            </h1>
            {wakeWord && (
              <p className="text-xs text-muted-foreground mt-0.5">كلمة التنشيط: <span className="font-semibold text-primary">"{wakeWord}"</span></p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {ttsEnabled
              ? <Volume2 className="w-4 h-4 text-muted-foreground" />
              : <VolumeX className="w-4 h-4 text-muted-foreground" />
            }
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Quick Key Setup Banner ── */}
        {showKeySetup && (
          <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <KeyRound className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm font-semibold">إعداد مفتاح Gemini API</p>
              {localStorage.getItem("gemini_api_key") && (
                <button onClick={() => setShowKeySetup(false)} className="ms-auto text-xs underline opacity-60 hover:opacity-100">إخفاء</button>
              )}
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              أدخل مفتاح API الخاص بك من <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google AI Studio</a> — سيتم اختبار الاتصال وحفظه فوراً.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showSetupKey ? "text" : "password"}
                  value={setupKey}
                  onChange={e => { setSetupKey(e.target.value); setSetupStatus("idle"); setSetupError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleQuickSaveKey()}
                  placeholder="أدخل مفتاح API هنا..."
                  className="pe-9 font-mono text-sm bg-white dark:bg-background"
                  autoComplete="off"
                />
                <button type="button" onClick={() => setShowSetupKey(v => !v)}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showSetupKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button onClick={handleQuickSaveKey} disabled={!setupKey.trim() || setupStatus === "verifying"} size="sm" className="flex-shrink-0 gap-1.5">
                {setupStatus === "verifying"
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري الاختبار…</>
                  : <><KeyRound className="w-3.5 h-3.5" /> اختبر وحفظ</>}
              </Button>
            </div>
            {setupStatus === "valid" && <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> تم التحقق من المفتاح وحفظه بنجاح</p>}
            {setupStatus === "invalid" && <p className="text-xs text-destructive flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {setupError || "المفتاح غير صالح"}</p>}
            {setupStatus === "verifying" && <p className="text-xs text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> جاري اختبار الاتصال بـ Gemini…</p>}
          </div>
        )}

        {/* Orb */}
        {voiceSupported && (
          <div className="flex flex-col items-center py-6 mb-4 bg-card border border-border rounded-2xl relative">
            <OrbAnimation state={state} wakeWord={wakeWord || "مساعد"} assistantName={assistantName || "مساعدي"} />
            <div className="flex gap-3 mt-4">
              <Button
                variant={state === "question-listening" ? "destructive" : "outline"}
                size="sm"
                onClick={handleMicClick}
                disabled={state === "thinking" || state === "wake-listening" || state === "wake-detected"}
                className="gap-2"
              >
                {state === "question-listening"
                  ? <><MicOff className="w-4 h-4" /> إيقاف</>
                  : state === "speaking"
                    ? <><VolumeX className="w-4 h-4" /> إيقاف الصوت</>
                    : <><Mic className="w-4 h-4" /> تحدث الآن</>
                }
              </Button>
              <Button
                variant={wakeEnabled ? "default" : "outline"}
                size="sm"
                onClick={handleWakeToggle}
                disabled={state === "question-listening" || state === "thinking" || state === "wake-detected"}
                className={cn("gap-2", wakeEnabled && "animate-pulse")}
              >
                <Sparkles className="w-4 h-4" />
                {wakeEnabled ? `إيقاف "${wakeWord || "مساعد"}"` : `تفعيل "${wakeWord || "مساعد"}"`}
              </Button>
            </div>
            {!voiceSupported && (
              <p className="text-xs text-muted-foreground mt-3">متصفحك لا يدعم التعرف على الصوت</p>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 px-1">
          {messages.map((msg, i) => <MessageBubble key={i} msg={msg} assistantName={assistantName || "م"} />)}
          {state === "thinking" && (
            <div className="flex gap-3 items-end">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-primary flex items-center justify-center flex-shrink-0 mb-1 text-[9px] font-bold text-white">
                {(assistantName || "م").charAt(0)}
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={state === "question-listening" ? "أنا أستمع..." : "اكتب سؤالك هنا..."}
            className="resize-none min-h-[44px] max-h-32"
            rows={1}
            disabled={state === "thinking" || state === "question-listening"}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isPending}
            size="icon"
            className="h-11 w-11 flex-shrink-0"
          >
            {isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </Button>
        </div>
      </div>
    </Layout>
  );
}

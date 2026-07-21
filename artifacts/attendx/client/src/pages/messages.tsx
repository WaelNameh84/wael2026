import { useState, useRef, useCallback } from "react";
import { NoMessagesIllustration } from "@/components/ui/empty-illustrations";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@/lib/api-client/index";
import { cn } from "@/lib/utils";
import {
  Send, Inbox, Trash2, Reply, Loader2, PenSquare,
  Globe, ArrowRight, ChevronDown, Mic, MicOff
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { apiUrl, authHeaders as auth } from "@/lib/api-url";

function useMicInput(onText: (t: string) => void) {
  const recognitionRef = useRef<any>(null);
  const [listening, setListening] = useState(false);
  const { toast } = useToast();

  const toggle = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "المتصفح لا يدعم الإدخال الصوتي", variant: "destructive" });
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "ar-SA";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      if (transcript) onText(transcript);
    };
    rec.onerror = () => {
      toast({ title: "خطأ في الإدخال الصوتي", variant: "destructive" });
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening, onText, toast]);

  return { listening, toggle };
}

function avatar(name: string) {
  return (name ?? "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function fmtDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "الآن";
  if (diffMins < 60) return `${diffMins}د`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}س`;
  if (date.getFullYear() === now.getFullYear())
    return date.toLocaleDateString("ar", { day: "numeric", month: "short" });
  return date.toLocaleDateString("ar", { day: "numeric", month: "short", year: "numeric" });
}

type Msg = {
  id: number; senderId: number; receiverId: number | null;
  subject: string; body: string; isRead: boolean;
  isBroadcast: boolean; parentId: number | null;
  createdAt: string; senderName?: string; receiverName?: string;
};
type User = { id: number; name: string; email: string; role: string };

export default function MessagesPage() {
  return <MessagesContent />;
}

function MessagesContent() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const isAdmin = me?.role === "admin" || me?.role === "manager";

  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [selected, setSelected] = useState<Msg | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const { data: inbox = [], isLoading: loadingInbox } = useQuery<Msg[]>({
    queryKey: ["messages-inbox"],
    queryFn: async () => {
      const r = await fetch(apiUrl("/api/messages/inbox"), { headers: auth() });
      return r.ok ? r.json() : [];
    },
    refetchInterval: 30_000,
  });

  const { data: sent = [], isLoading: loadingSent } = useQuery<Msg[]>({
    queryKey: ["messages-sent"],
    queryFn: async () => {
      const r = await fetch(apiUrl("/api/messages/sent"), { headers: auth() });
      return r.ok ? r.json() : [];
    },
  });

  const { data: thread } = useQuery<{ parent: Msg; replies: Msg[] }>({
    queryKey: ["message-thread", selected?.id],
    queryFn: async () => {
      const r = await fetch(apiUrl(`/api/messages/${selected!.id}/thread`), { headers: auth() });
      return r.ok ? r.json() : { parent: selected, replies: [] };
    },
    enabled: !!selected,
  });

  const list = tab === "inbox" ? inbox : sent;
  const isLoading = tab === "inbox" ? loadingInbox : loadingSent;
  const unread = inbox.filter(m => !m.isRead).length;

  async function openMsg(msg: Msg) {
    setSelected(msg);
    if (!msg.isRead && tab === "inbox") {
      await fetch(apiUrl(`/api/messages/${msg.id}/read`), { method: "PATCH", headers: auth() });
      qc.invalidateQueries({ queryKey: ["messages-inbox"] });
      qc.invalidateQueries({ queryKey: ["messages-unread-count"] });
    }
  }

  async function del(id: number) {
    setDeleting(id);
    await fetch(apiUrl(`/api/messages/${id}`), { method: "DELETE", headers: auth() });
    toast({ title: "تم حذف الرسالة" });
    if (selected?.id === id) setSelected(null);
    qc.invalidateQueries({ queryKey: ["messages-inbox"] });
    qc.invalidateQueries({ queryKey: ["messages-sent"] });
    qc.invalidateQueries({ queryKey: ["messages-unread-count"] });
    setDeleting(null);
  }

  if (selected) {
    return (
      <Layout>
        <MsgDetail
          msg={selected}
          thread={thread}
          myId={me?.id ?? 0}
          tab={tab}
          deleting={deleting}
          onBack={() => setSelected(null)}
          onDelete={() => del(selected.id)}
          onReply={() => setReplyOpen(true)}
        />
        {replyOpen && (
          <ReplyDialog
            parentMsg={selected}
            myId={me?.id ?? 0}
            onClose={() => setReplyOpen(false)}
            onSent={() => {
              setReplyOpen(false);
              qc.invalidateQueries({ queryKey: ["message-thread", selected.id] });
              toast({ title: "تم إرسال الرد ✓" });
            }}
          />
        )}
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">الرسائل</h1>
          <Button onClick={() => setComposeOpen(true)} size="sm" className="gap-2">
            <PenSquare className="w-4 h-4" />
            رسالة جديدة
          </Button>
        </div>

        <div className="flex bg-muted/40 rounded-xl p-1 gap-1">
          <button
            onClick={() => setTab("inbox")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all",
              tab === "inbox" ? "bg-background shadow text-foreground" : "text-muted-foreground"
            )}
          >
            <Inbox className="w-4 h-4" />
            الوارد
            {unread > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {unread}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("sent")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all",
              tab === "sent" ? "bg-background shadow text-foreground" : "text-muted-foreground"
            )}
          >
            <Send className="w-4 h-4" />
            المُرسَلة
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
              <NoMessagesIllustration />
              <div>
                <p className="font-medium text-sm text-foreground/80">
                  {tab === "inbox" ? "لا توجد رسائل في صندوق الوارد" : "لا توجد رسائل مُرسَلة"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {tab === "inbox" ? "ستظهر الرسائل الواردة هنا" : "ستظهر الرسائل التي أرسلتها هنا"}
                </p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((msg) => {
                const name = tab === "inbox"
                  ? (msg.isBroadcast ? "إشعار عام" : (msg.senderName ?? "—"))
                  : (msg.isBroadcast ? "للجميع" : (msg.receiverName ?? "—"));
                const isUnread = !msg.isRead && tab === "inbox";
                return (
                  <li key={msg.id}>
                    <button
                      onClick={() => openMsg(msg)}
                      className={cn(
                        "w-full text-start flex items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/40 active:bg-muted/60",
                        isUnread && "bg-primary/5"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5",
                        msg.isBroadcast
                          ? "bg-amber-100 text-amber-700"
                          : "bg-primary/10 text-primary"
                      )}>
                        {msg.isBroadcast ? "📢" : avatar(name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className={cn("text-sm truncate", isUnread ? "font-bold text-foreground" : "font-medium text-foreground/80")}>
                            {name}
                          </span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">{fmtDate(msg.createdAt)}</span>
                        </div>
                        <p className={cn("text-sm truncate", isUnread ? "text-foreground font-medium" : "text-muted-foreground")}>
                          {msg.subject}
                        </p>
                        <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{msg.body}</p>
                      </div>
                      {isUnread && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {composeOpen && (
        <ComposeDialog
          isAdmin={isAdmin ?? false}
          onClose={() => setComposeOpen(false)}
          onSent={() => {
            setComposeOpen(false);
            qc.invalidateQueries({ queryKey: ["messages-sent"] });
            toast({ title: "تم إرسال الرسالة ✓" });
          }}
        />
      )}
    </Layout>
  );
}

function MsgDetail({ msg, thread, myId, tab, deleting, onBack, onDelete, onReply }: {
  msg: Msg; thread?: { parent: Msg; replies: Msg[] };
  myId: number; tab: string; deleting: number | null;
  onBack: () => void; onDelete: () => void; onReply: () => void;
}) {
  const name = tab === "inbox"
    ? (msg.isBroadcast ? "إشعار عام" : (msg.senderName ?? "—"))
    : (msg.isBroadcast ? "للجميع" : (msg.receiverName ?? "—"));

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowRight className="w-4 h-4" />
        الرسائل
      </button>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold mb-3">{msg.subject}</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold",
                msg.isBroadcast ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"
              )}>
                {msg.isBroadcast ? "📢" : avatar(name)}
              </div>
              <div>
                <p className="text-sm font-semibold">{name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(msg.createdAt).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {tab === "inbox" && !msg.isBroadcast && (
                <Button variant="outline" size="sm" onClick={onReply} className="gap-1.5">
                  <Reply className="w-3.5 h-3.5" />
                  رد
                </Button>
              )}
              <Button
                variant="ghost" size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
                disabled={deleting === msg.id}
              >
                {deleting === msg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        {msg.isBroadcast && (
          <div className="mx-5 mt-4 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 rounded-lg">
            <Globe className="w-4 h-4 flex-shrink-0" />
            هذه رسالة موجهة لجميع الموظفين
          </div>
        )}

        <div className="px-5 py-5">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{msg.body}</p>
        </div>

        {thread?.replies && thread.replies.length > 0 && (
          <div className="border-t border-border px-5 py-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {thread.replies.length} {thread.replies.length === 1 ? "رد" : "ردود"}
            </p>
            {thread.replies.map(reply => (
              <div key={reply.id} className={cn(
                "rounded-xl p-4",
                reply.senderId === myId
                  ? "bg-primary/8 border border-primary/15 ms-6"
                  : "bg-muted/50 me-6"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                    {avatar(reply.senderName ?? "?")}
                  </div>
                  <span className="text-xs font-semibold">
                    {reply.senderId === myId ? "أنت" : reply.senderName}
                  </span>
                  <span className="text-xs text-muted-foreground ms-auto">{fmtDate(reply.createdAt)}</span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{reply.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ComposeDialog({ isAdmin, onClose, onSent }: {
  isAdmin: boolean; onClose: () => void; onSent: () => void;
}) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [receiverId, setReceiverId] = useState("");
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [sending, setSending] = useState(false);
  const { listening: micListening, toggle: toggleMic } = useMicInput((text) => setBody(prev => prev ? prev + " " + text : text));

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users-list"],
    queryFn: async () => {
      const r = await fetch(apiUrl("/api/users"), { headers: auth() });
      return r.ok ? r.json() : [];
    },
    enabled: true,
  });

  const targets = isAdmin
    ? users.filter(u => u.role !== "admin" && u.role !== "manager")
    : users.filter(u => u.role === "admin" || u.role === "manager");

  async function send() {
    if (!subject.trim() || !body.trim()) {
      toast({ title: "يرجى ملء الموضوع والرسالة", variant: "destructive" });
      return;
    }
    if (!isBroadcast && !receiverId) {
      toast({ title: "يرجى اختيار المستلم", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const r = await fetch(apiUrl("/api/messages"), {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, isBroadcast, receiverId: isBroadcast ? undefined : Number(receiverId) }),
      });
      if (!r.ok) throw new Error();
      onSent();
    } catch {
      toast({ title: "فشل الإرسال، حاول مرة أخرى", variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenSquare className="w-5 h-5 text-primary" />
            رسالة جديدة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {isAdmin && (
            <div className="space-y-1.5">
              <Label>إلى</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsBroadcast(false)}
                  className={cn(
                    "py-2.5 px-4 rounded-xl border-2 text-sm font-medium transition-all",
                    !isBroadcast
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-muted-foreground"
                  )}
                >
                  موظف محدد
                </button>
                <button
                  onClick={() => { setIsBroadcast(true); setReceiverId(""); }}
                  className={cn(
                    "py-2.5 px-4 rounded-xl border-2 text-sm font-medium transition-all flex items-center justify-center gap-2",
                    isBroadcast
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700"
                      : "border-border text-muted-foreground hover:border-muted-foreground"
                  )}
                >
                  <Globe className="w-4 h-4" />
                  للجميع
                </button>
              </div>
            </div>
          )}

          {!isBroadcast && (
            <div className="space-y-1.5">
              {!isAdmin && <Label>إلى</Label>}
              <Select value={receiverId} onValueChange={setReceiverId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder={isAdmin ? "اختر الموظف..." : "اختر المدير..."} />
                </SelectTrigger>
                <SelectContent>
                  {targets.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                          {avatar(u.name)}
                        </div>
                        {u.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isBroadcast && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2.5 rounded-lg">
              <Globe className="w-4 h-4 flex-shrink-0" />
              ستصل هذه الرسالة لجميع الموظفين
            </div>
          )}

          <div className="space-y-1.5">
            <Label>الموضوع</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="اكتب موضوع الرسالة..."
              className="h-11"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>الرسالة</Label>
              <button
                type="button"
                onClick={toggleMic}
                title={micListening ? "إيقاف التسجيل" : "إدخال صوتي"}
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all",
                  micListening
                    ? "bg-red-100 border-red-300 text-red-600 dark:bg-red-900/30 dark:border-red-700 dark:text-red-400 animate-pulse"
                    : "bg-muted border-border text-muted-foreground hover:text-primary hover:border-primary/40"
                )}
              >
                {micListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                {micListening ? "إيقاف" : "صوت"}
              </button>
            </div>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={micListening ? "🎙 جارٍ الاستماع..." : "اكتب رسالتك هنا..."}
              rows={5}
              className={cn("resize-none transition-all", micListening && "border-red-300 dark:border-red-700")}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">إلغاء</Button>
          <Button onClick={send} disabled={sending} className="flex-1 gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            إرسال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReplyDialog({ parentMsg, myId, onClose, onSent }: {
  parentMsg: Msg; myId: number; onClose: () => void; onSent: () => void;
}) {
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const replyTo = parentMsg.senderId === myId ? parentMsg.receiverId : parentMsg.senderId;
  const { listening: micListening, toggle: toggleMic } = useMicInput((text) => setBody(prev => prev ? prev + " " + text : text));

  async function send() {
    if (!body.trim()) { toast({ title: "اكتب ردك أولاً", variant: "destructive" }); return; }
    setSending(true);
    try {
      const r = await fetch(apiUrl("/api/messages"), {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ subject: `رد: ${parentMsg.subject}`, body, receiverId: replyTo, parentId: parentMsg.id, isBroadcast: false }),
      });
      if (!r.ok) throw new Error();
      onSent();
    } catch {
      toast({ title: "فشل الإرسال", variant: "destructive" });
    } finally { setSending(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Reply className="w-5 h-5 text-primary" />
            رد على الرسالة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="bg-muted/50 rounded-xl px-4 py-3 border-s-4 border-primary/30">
            <p className="text-xs font-semibold text-muted-foreground mb-1">{parentMsg.senderName} · {parentMsg.subject}</p>
            <p className="text-sm text-muted-foreground line-clamp-2">{parentMsg.body}</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>ردك</Label>
              <button
                type="button"
                onClick={toggleMic}
                title={micListening ? "إيقاف التسجيل" : "إدخال صوتي"}
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all",
                  micListening
                    ? "bg-red-100 border-red-300 text-red-600 dark:bg-red-900/30 dark:border-red-700 dark:text-red-400 animate-pulse"
                    : "bg-muted border-border text-muted-foreground hover:text-primary hover:border-primary/40"
                )}
              >
                {micListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                {micListening ? "إيقاف" : "صوت"}
              </button>
            </div>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder={micListening ? "🎙 جارٍ الاستماع..." : "اكتب ردك هنا..."}
              rows={4}
              className={cn("resize-none transition-all", micListening && "border-red-300 dark:border-red-700")}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">إلغاء</Button>
          <Button onClick={send} disabled={sending} className="flex-1 gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Reply className="w-4 h-4" />}
            إرسال الرد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

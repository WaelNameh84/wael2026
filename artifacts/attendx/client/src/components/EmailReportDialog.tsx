import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail } from "lucide-react";

interface EmailReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmail?: string;
  isArabic: boolean;
  onSend: (email: string) => Promise<void>;
}

/**
 * Small dialog to collect a recipient address before sending the fully
 * styled report as a real email (instead of the old mailto: plain-text link).
 */
export function EmailReportDialog({ open, onOpenChange, defaultEmail, isArabic, onSend }: EmailReportDialogProps) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail ?? "");
      setError("");
    }
  }, [open, defaultEmail]);

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(isArabic ? "أدخل بريداً إلكترونياً صحيحاً" : "Enter a valid email address");
      return;
    }
    setSending(true);
    setError("");
    try {
      await onSend(trimmed);
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || (isArabic ? "فشل إرسال البريد" : "Failed to send email"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!sending) onOpenChange(v); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            {isArabic ? "إرسال التقرير عبر البريد" : "Send Report by Email"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label className="text-xs text-muted-foreground">
            {isArabic ? "البريد الإلكتروني للمستلم" : "Recipient email"}
          </Label>
          <Input
            type="email"
            autoFocus
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@example.com"
            onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            {isArabic ? "إلغاء" : "Cancel"}
          </Button>
          <Button onClick={handleSend} disabled={sending} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {isArabic ? "إرسال" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

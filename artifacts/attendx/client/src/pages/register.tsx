import { useState } from "react";
import { Link } from "wouter";
import { useRegister } from "@/lib/api-client/index";
import { useTranslation } from "@/lib/i18n";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Clock, Loader2, CheckCircle } from "lucide-react";

export default function RegisterPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { appName } = useAppConfig();
  const registerMutation = useRegister();
  const [pending, setPending] = useState(false);

  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result: any = await registerMutation.mutateAsync({ data: form });
      if (result?.pending) {
        setPending(true);
      }
    } catch (err: any) {
      toast({ title: t("failed"), description: err?.data?.error || "Please try again.", variant: "destructive" });
    }
  };

  if (pending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-2">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">{t("account_pending_title")}</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("account_pending_desc")}</p>
          </div>
          <Link href="/login">
            <Button variant="outline" className="w-full">{t("back_to_login")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
            <Clock className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t("create_account")}</h1>
          <p className="text-sm text-muted-foreground">{t("join_team", { appName })}</p>
        </div>

        <div className="bg-card border border-card-border rounded-2xl p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("name")}</Label>
              <Input id="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t("full_name_placeholder")} required data-testid="input-name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@company.com" required data-testid="input-email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("password")}</Label>
              <Input id="password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={t("min_6_chars")} required minLength={6} data-testid="input-password" />
            </div>
            <Button type="submit" className="w-full" disabled={registerMutation.isPending} data-testid="button-register">
              {registerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
              {t("register")}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {t("have_account")}{" "}
          <Link href="/login" className="text-primary hover:underline">{t("login")}</Link>
        </p>
      </div>
    </div>
  );
}

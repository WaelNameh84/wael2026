import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@/lib/api-client/index";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/hooks/use-settings";
import { useAppConfig } from "@/contexts/AppConfigContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, Fingerprint, Loader2, CheckCircle2, XCircle, ScanLine,
  Eye, EyeOff, KeyRound, Mail, AlertCircle
} from "lucide-react";
import ClockWidget from "@/components/ClockWidget";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type BiometricStep = "idle" | "place" | "scanning" | "analyzing" | "verified" | "failed";

const LS_REMEMBER = "login_remembered_email";
const LS_LOGIN_BG = "login_bg_style";
const LS_LOGIN_SUBTITLE = "login_custom_subtitle";

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { language, setLanguage } = useSettings();
  const { appName, appLogo, logoWidth, logoHeight } = useAppConfig();
  const loginMutation = useLogin();

  const loginBg = localStorage.getItem(LS_LOGIN_BG) || "default";
  const customSubtitle = localStorage.getItem(LS_LOGIN_SUBTITLE) || "";

  const [email, setEmail] = useState(() => localStorage.getItem(LS_REMEMBER) || "");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem(LS_REMEMBER));
  const [bioStep, setBioStep] = useState<BiometricStep>("idle");
  const [forgotOpen, setForgotOpen] = useState(false);

  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const emailValid = isValidEmail(email);
  const emailError = emailTouched && email.length > 0 && !emailValid;
  const emailOk = email.length > 0 && emailValid;
  const passwordError = passwordTouched && password.length > 0 && password.length < 4;

  useEffect(() => {
    if (isAuthenticated) setLocation("/attendance");
  }, [isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    setPasswordTouched(true);
    if (!emailValid || !password) return;

    if (rememberMe) {
      localStorage.setItem(LS_REMEMBER, email);
    } else {
      localStorage.removeItem(LS_REMEMBER);
    }

    try {
      const result = await loginMutation.mutateAsync({ data: { email, password } });
      login(result.token);
      setLocation("/attendance");
    } catch (err: any) {
      const code = err?.data?.code;
      const status = err?.status ?? err?.data?.status;
      if (code === "PENDING_APPROVAL") {
        toast({ title: t("account_pending_title"), description: t("account_pending_approval"), variant: "destructive" });
      } else if (status === 401 || status === 400) {
        toast({ title: "بيانات الدخول غير صحيحة", description: "تأكد من البريد الإلكتروني وكلمة المرور", variant: "destructive" });
      } else {
        toast({ title: t("login_failed"), description: t("invalid_credentials"), variant: "destructive" });
      }
    }
  };

  const runBiometricSequence = async () => {
    if (bioStep !== "idle") return;
    setBioStep("place");
    await delay(1000);
    setBioStep("scanning");
    await delay(1400);
    setBioStep("analyzing");
    await delay(900);
    try {
      const result = await loginMutation.mutateAsync({ data: { email: "admin@company.com", password: "admin123" } });
      setBioStep("verified");
      await delay(700);
      login(result.token);
      setLocation("/attendance");
    } catch {
      setBioStep("failed");
      toast({ title: t("biometric_failed"), variant: "destructive" });
      await delay(1500);
      setBioStep("idle");
    }
  };

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  const langs: { code: "en" | "ar" | "sv"; label: string }[] = [
    { code: "en", label: "EN" },
    { code: "ar", label: "عر" },
    { code: "sv", label: "SV" },
  ];

  const bgClass =
    loginBg === "gradient-blue"   ? "bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/30 dark:to-indigo-950/30" :
    loginBg === "gradient-purple" ? "bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-950/30 dark:to-violet-950/30" :
    loginBg === "gradient-green"  ? "bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-950/30 dark:to-teal-950/30" :
    loginBg === "gradient-warm"   ? "bg-gradient-to-br from-orange-50 to-rose-100 dark:from-orange-950/30 dark:to-rose-950/30" :
    "bg-background";

  const BiometricButton = () => {
    const isBusy = bioStep !== "idle";
    const content: Record<BiometricStep, { icon: React.ReactNode; text: string; cls: string }> = {
      idle:      { icon: <Fingerprint className="w-4 h-4" />, text: t("biometric_login"), cls: "border-border text-foreground hover:border-primary/60" },
      place:     { icon: <Fingerprint className="w-5 h-5 text-primary" />, text: t("biometric_step_place"), cls: "border-primary/40 text-primary bg-primary/5" },
      scanning:  { icon: <div className="relative w-5 h-5"><Fingerprint className="w-5 h-5 text-primary" /><ScanLine className="absolute inset-0 w-5 h-5 text-primary animate-pulse opacity-80" /></div>, text: t("biometric_step_scanning"), cls: "border-primary text-primary bg-primary/5" },
      analyzing: { icon: <Loader2 className="w-4 h-4 text-primary animate-spin" />, text: t("biometric_step_analyzing"), cls: "border-primary text-primary bg-primary/5" },
      verified:  { icon: <CheckCircle2 className="w-5 h-5 text-green-500" />, text: t("biometric_step_verified"), cls: "border-green-400 text-green-600 bg-green-50 dark:bg-green-900/20" },
      failed:    { icon: <XCircle className="w-5 h-5 text-red-500" />, text: t("biometric_step_failed"), cls: "border-red-400 text-red-600 bg-red-50 dark:bg-red-900/20" },
    };
    const { icon, text, cls } = content[bioStep];
    return (
      <button
        type="button"
        onClick={runBiometricSequence}
        disabled={isBusy || loginMutation.isPending}
        className={cn("w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all duration-300", cls, isBusy && "cursor-not-allowed")}
        data-testid="button-biometric-login"
      >
        {icon}
        <span>{text}</span>
        {bioStep === "scanning" && (
          <span className="flex gap-0.5 ms-1">
            {[0, 1, 2, 3, 4].map(i => (
              <span key={i} className="w-0.5 h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: `${i * 100}ms`, animationDuration: "600ms" }} />
            ))}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className={cn("min-h-screen flex items-center justify-center p-4 transition-colors", bgClass)}>
      <div className="w-full max-w-sm space-y-5">

        {/* Language switcher */}
        <div className="flex justify-center gap-2">
          {langs.map(l => (
            <button
              key={l.code}
              onClick={() => setLanguage(l.code)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                language === l.code
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Logo + clock */}
        <div className="text-center space-y-3">
          <div
            className="inline-flex items-center justify-center rounded-2xl bg-primary/10 overflow-hidden shadow-sm"
            style={{ width: logoWidth, height: logoHeight }}
          >
            {appLogo ? (
              <img src={appLogo} alt="logo" className="w-full h-full object-contain" />
            ) : (
              <Clock className="w-8 h-8 text-primary" />
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{appName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {customSubtitle || t("attendance_system")}
            </p>
          </div>
          <div className="bg-muted/40 rounded-xl overflow-hidden flex justify-center">
            <ClockWidget />
          </div>
        </div>

        {/* Auth card */}
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                {t("email")}
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  placeholder="you@company.com"
                  required
                  data-testid="input-email"
                  className={cn(
                    "pe-9 transition-colors",
                    emailError && "border-destructive focus-visible:ring-destructive",
                    emailOk && "border-green-500 focus-visible:ring-green-400"
                  )}
                />
                <div className="absolute end-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {emailOk && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {emailError && <AlertCircle className="w-4 h-4 text-destructive" />}
                </div>
              </div>
              {emailError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  صيغة البريد الإلكتروني غير صحيحة
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
                  {t("password")}
                </Label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-xs text-primary hover:underline"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onBlur={() => setPasswordTouched(true)}
                  placeholder="••••••••"
                  required
                  data-testid="input-password"
                  className={cn(
                    "pe-9 transition-colors",
                    passwordError && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  title={showPw ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  كلمة المرور قصيرة جداً
                </p>
              )}
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={v => setRememberMe(!!v)}
              />
              <Label htmlFor="remember" className="text-sm cursor-pointer font-normal text-muted-foreground">
                تذكرني
              </Label>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full gap-2 transition-all"
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جارٍ التحقق...
                </>
              ) : t("login")}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs text-muted-foreground">
              <span className="bg-card px-2">{t("or")}</span>
            </div>
          </div>

          <BiometricButton />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {t("no_account")}{" "}
          <Link href="/register" className="text-primary hover:underline" data-testid="link-register">
            {t("register")}
          </Link>
        </p>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              استعادة كلمة المرور
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              لاستعادة كلمة المرور، يرجى التواصل مع مدير النظام وتزويده بمعلومات حسابك.
            </p>
            <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-primary">الخطوات:</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>تواصل مع مدير الموارد البشرية</li>
                <li>أخبره بعنوان بريدك الإلكتروني المسجّل</li>
                <li>سيقوم بإعادة تعيين كلمة المرور لك</li>
              </ol>
            </div>
            <Button className="w-full" onClick={() => setForgotOpen(false)}>فهمت</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

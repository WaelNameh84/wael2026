import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import {
  useListUsers, useCreateUser, useDeleteUser, useUpdateUser,
  getListUsersQueryKey
} from "@/lib/api-client/index";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Trash2, Loader2, Pencil, BarChart3, Users, Shield, Briefcase, Camera, X, Filter } from "lucide-react";
import { authFetch, apiUrl } from "@/lib/api-url";
import EmployeeRecordDialog, { type EmpUser } from "@/pages/employee-record";
import { NoEmployeesIllustration } from "@/components/ui/empty-illustrations";
import { motion, AnimatePresence } from "framer-motion";

type Dept = { id: number; name: string };

/* ─── DeptSelect — top-level so React never remounts it ─── */
function DeptSelect({
  value, onChange, departments, placeholder,
}: { value: string; onChange: (v: string) => void; departments: Dept[]; placeholder: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">—</SelectItem>
        {departments.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/* ─── FormAddEdit — top-level so React never remounts it ─────────────────
   Defining components inside another component makes React see a NEW type
   on every parent re-render, which unmounts/remounts the inner component
   and steals focus from any active input (keyboard disappears on mobile).
─────────────────────────────────────────────────────────────────────────── */
type FormData = {
  name: string; email?: string; password?: string;
  role: string; department: string; position: string; phone: string;
  workHoursPerDay: number; salary: string | number;
  contractType: "monthly" | "daily";
  breakMinutes?: string | number;
  transportAllowance?: string | number;
  housingAllowance?: string | number;
  avatarUrl: string;
  workStartTime?: string;
  workEndTime?: string;
};

function FormAddEdit({
  isEdit, formData, setFormData, onSubmit, isPending,
  departments, isArabic, t,
}: {
  isEdit: boolean;
  formData: FormData;
  setFormData: (fn: (prev: FormData) => FormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  departments: Dept[];
  isArabic: boolean;
  t: (key: string) => string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5 mt-3">
      {/* Avatar */}
      <div className="flex justify-center">
        <div className="relative">
          <EmpAvatar name={formData.name || "?"} avatarUrl={formData.avatarUrl} size="xl" />
          <AvatarUploadButton onUploaded={url => setFormData((f) => ({ ...f, avatarUrl: url }))} />
          {formData.avatarUrl && (
            <button
              type="button"
              onClick={() => setFormData((f) => ({ ...f, avatarUrl: "" }))}
              className="absolute -top-1 -end-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center shadow"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>{t("name")}</Label>
          <Input value={formData.name} onChange={e => setFormData((f) => ({ ...f, name: e.target.value }))} required data-testid="input-emp-name" />
        </div>
        {!isEdit && (
          <div className="space-y-1">
            <Label>{t("email")}</Label>
            <Input type="email" value={formData.email ?? ""} onChange={e => setFormData((f) => ({ ...f, email: e.target.value }))} required data-testid="input-emp-email" />
          </div>
        )}
        {!isEdit && (
          <div className="space-y-1">
            <Label>{t("password")}</Label>
            <Input type="password" value={formData.password ?? ""} onChange={e => setFormData((f) => ({ ...f, password: e.target.value }))} required data-testid="input-emp-password" />
          </div>
        )}
        <div className="space-y-1">
          <Label>{t("role")}</Label>
          <Select value={formData.role} onValueChange={v => setFormData((f) => ({ ...f, role: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="employee">👤 {isArabic ? "موظف" : "Employee"}</SelectItem>
              <SelectItem value="manager">👔 {isArabic ? "مدير الشركة" : "Company Manager"}</SelectItem>
              <SelectItem value="admin">🛡️ {isArabic ? "مدير النظام" : "Admin"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t("department")}</Label>
          <DeptSelect
            value={formData.department}
            onChange={v => setFormData((f) => ({ ...f, department: v === "none" ? "" : v }))}
            departments={departments}
            placeholder={t("department")}
          />
        </div>
        <div className="space-y-1">
          <Label>{t("position")}</Label>
          <Input value={formData.position} onChange={e => setFormData((f) => ({ ...f, position: e.target.value }))} data-testid="input-emp-position" />
        </div>
        <div className="space-y-1">
          <Label>{t("phone")}</Label>
          <Input value={formData.phone} onChange={e => setFormData((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label>{t("work_hours_day")}</Label>
          <Input type="number" min={1} max={24} value={formData.workHoursPerDay} onChange={e => setFormData((f) => ({ ...f, workHoursPerDay: Number(e.target.value) }))} />
        </div>
        <div className="space-y-1">
          <Label className="flex items-center gap-1">
            🕐 {isArabic ? "بداية الدوام الخاص" : "Custom Shift Start"}
          </Label>
          <Input
            type="time"
            value={formData.workStartTime ?? ""}
            onChange={e => setFormData((f) => ({ ...f, workStartTime: e.target.value }))}
            placeholder={isArabic ? "مثل: 09:00" : "e.g. 09:00"}
          />
        </div>
        <div className="space-y-1">
          <Label className="flex items-center gap-1">
            🕕 {isArabic ? "نهاية الدوام الخاص" : "Custom Shift End"}
          </Label>
          <Input
            type="time"
            value={formData.workEndTime ?? ""}
            onChange={e => setFormData((f) => ({ ...f, workEndTime: e.target.value }))}
            placeholder={isArabic ? "مثل: 17:00" : "e.g. 17:00"}
          />
        </div>
        {(formData.workStartTime || formData.workEndTime) && (
          <div className="col-span-2 text-xs text-muted-foreground bg-primary/5 rounded-lg px-3 py-2">
            {isArabic
              ? `⚙️ دوام مخصص: سيُستخدم هذا الوقت لحساب التأخر والساعات والأوفرتايم بدلاً من الإعداد العام للشركة.`
              : `⚙️ Custom shift: This overrides the company-wide work start/end time for this employee.`}
          </div>
        )}
        <div className="space-y-1">
          <Label>{isArabic ? "نوع العقد" : "Contract Type"}</Label>
          <Select value={formData.contractType} onValueChange={v => setFormData((f) => ({ ...f, contractType: v as "monthly" | "daily" }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">📅 {isArabic ? "شهري" : "Monthly"}</SelectItem>
              <SelectItem value="daily">📆 {isArabic ? "يومي" : "Daily"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{formData.contractType === "daily" ? (isArabic ? "الأجر اليومي" : "Daily Rate") : t("salary")}</Label>
          <Input type="number" min={0} placeholder="0" value={formData.salary} onChange={e => setFormData((f) => ({ ...f, salary: e.target.value }))} data-testid="input-emp-salary" />
        </div>
        {formData.contractType === "daily" && (
          <div className="col-span-2 space-y-1">
            <Label className="flex items-center gap-1">
              ☕ {isArabic ? "مدة الاستراحة (دقيقة)" : "Break Duration (minutes)"}
            </Label>
            <Input
              type="number"
              min={0}
              max={120}
              placeholder={isArabic ? "0 = بدون استراحة" : "0 = no break"}
              value={formData.breakMinutes ?? ""}
              onChange={e => setFormData((f) => ({ ...f, breakMinutes: e.target.value }))}
            />
            {Number(formData.breakMinutes) > 0 && (
              <p className="text-xs text-muted-foreground">
                {isArabic
                  ? `⚡ ${Number(formData.breakMinutes)} دقيقة استراحة لن تُحتسب من الأجر — تُخصم من إجمالي ساعات الدوام.`
                  : `⚡ ${Number(formData.breakMinutes)} min break will not be counted as paid time.`}
              </p>
            )}
          </div>
        )}
        {isEdit && (
          <>
            <div className="space-y-1">
              <Label>{isArabic ? "بدل نقل" : "Transport Allowance"}</Label>
              <Input type="number" min={0} placeholder="0" value={formData.transportAllowance ?? ""} onChange={e => setFormData((f) => ({ ...f, transportAllowance: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{isArabic ? "بدل سكن" : "Housing Allowance"}</Label>
              <Input type="number" min={0} placeholder="0" value={formData.housingAllowance ?? ""} onChange={e => setFormData((f) => ({ ...f, housingAllowance: e.target.value }))} />
            </div>
          </>
        )}
      </div>
      <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isPending} data-testid={isEdit ? undefined : "button-create-employee"}>
        {isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
        {isEdit ? t("save_changes") : t("add_employee")}
      </Button>
    </form>
  );
}

type UserRecord = {
  id: number; name: string; email: string; role: string;
  department?: string | null; position?: string | null;
  phone?: string | null; workHoursPerDay?: number | null;
  salary?: number | null;
  contractType?: "monthly" | "daily" | null;
  breakMinutes?: number | null;
  transportAllowance?: number | null;
  housingAllowance?: number | null;
  avatarUrl?: string | null;
  workStartTime?: string | null;
  workEndTime?: string | null;
};

/** Generate a deterministic gradient background from the name initials */
function nameToGradient(name: string) {
  const palettes = [
    "linear-gradient(135deg,#667eea,#764ba2)",
    "linear-gradient(135deg,#f093fb,#f5576c)",
    "linear-gradient(135deg,#4facfe,#00f2fe)",
    "linear-gradient(135deg,#43e97b,#38f9d7)",
    "linear-gradient(135deg,#fa709a,#fee140)",
    "linear-gradient(135deg,#a18cd1,#fbc2eb)",
    "linear-gradient(135deg,#fccb90,#d57eeb)",
    "linear-gradient(135deg,#fd7043,#ffca28)",
    "linear-gradient(135deg,#0ba360,#3cba92)",
    "linear-gradient(135deg,#f77062,#fe5196)",
    "linear-gradient(135deg,#2980b9,#6dd5fa)",
    "linear-gradient(135deg,#11998e,#38ef7d)",
  ];
  let code = 0;
  for (let i = 0; i < name.length; i++) code = (code * 31 + name.charCodeAt(i)) >>> 0;
  return palettes[code % palettes.length];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Employee avatar: photo if exists, else gradient initials */
function EmpAvatar({ name, avatarUrl, size = "lg" }: { name: string; avatarUrl?: string | null; size?: "sm" | "md" | "lg" | "xl" | "2xl" }) {
  const dim = size === "2xl" ? "w-32 h-32" : size === "xl" ? "w-24 h-24" : size === "lg" ? "w-14 h-14" : size === "md" ? "w-11 h-11" : "w-9 h-9";
  const text = size === "2xl" ? "text-4xl" : size === "xl" ? "text-2xl" : size === "lg" ? "text-lg" : "text-sm";
  if (avatarUrl) {
    // data URLs are used directly; server-relative paths need the API base prepended
    const src = avatarUrl.startsWith("data:") ? avatarUrl : apiUrl(avatarUrl);
    return (
      <img
        src={src}
        alt={name}
        className={`${dim} rounded-2xl object-cover border-2 border-white/40 shadow-md flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md border-2 border-white/20`}
      style={{ background: nameToGradient(name) }}
    >
      <span className={`${text} font-bold text-white`}>{getInitials(name)}</span>
    </div>
  );
}

/** Photo upload button — calls /api/uploads and returns the path */
function AvatarUploadButton({ onUploaded }: { onUploaded: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "الرجاء اختيار صورة", variant: "destructive" }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ title: "الصورة كبيرة جداً (max 5MB)", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await authFetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, fileData }),
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      onUploaded(data.path);
    } catch {
      toast({ title: "فشل رفع الصورة", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="absolute -bottom-1 -end-1 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow hover:bg-primary/90 transition-colors"
        title="تغيير الصورة"
      >
        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
      </button>
    </>
  );
}

export default function EmployeesPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [viewMode] = useState<"grid" | "list">("grid");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [recordUser, setRecordUser] = useState<EmpUser | null>(null);

  const isArabic = i18n.language === "ar";

  const emptyForm = {
    name: "", email: "", password: "emp123",
    role: "employee" as "admin" | "employee",
    department: "", position: "", phone: "",
    workHoursPerDay: 8, salary: "" as string | number,
    contractType: "monthly" as "monthly" | "daily",
    breakMinutes: "" as string | number,
    avatarUrl: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({
    name: "", department: "", position: "", phone: "",
    workHoursPerDay: 8, salary: "" as string | number,
    contractType: "monthly" as "monthly" | "daily",
    breakMinutes: "" as string | number,
    transportAllowance: "" as string | number,
    housingAllowance: "" as string | number,
    role: "employee" as "admin" | "manager" | "employee",
    avatarUrl: "",
    workStartTime: "" as string,
    workEndTime: "" as string,
  });

  const { data: users, isLoading } = useListUsers({ search: debouncedSearch }, { query: { queryKey: getListUsersQueryKey({ search: debouncedSearch }) } });
  const createMut = useCreateUser();
  const deleteMut = useDeleteUser();
  const updateMut = useUpdateUser();

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const fetchDepts = useCallback(async () => {
    try {
      const res = await authFetch("/api/departments");
      if (res.ok) setDepartments(await res.json());
    } catch { }
  }, []);

  useEffect(() => { fetchDepts(); }, [fetchDepts]);

  // Debounce search — wait 400ms after typing stops before hitting the server
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMut.mutateAsync({
        data: {
          ...form,
          workHoursPerDay: Number(form.workHoursPerDay),
          salary: form.salary !== "" ? Number(form.salary) : undefined,
          breakMinutes: form.breakMinutes !== "" ? Number(form.breakMinutes) : 0,
          avatarUrl: form.avatarUrl || undefined,
        } as any
      });
      toast({ title: "✓ " + t("add_employee") });
      setAddOpen(false);
      setForm(emptyForm);
      refresh();
    } catch (e: any) {
      toast({ title: t("failed"), description: e?.data?.error, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`${t("delete_employee")}: ${name}?`)) return;
    try {
      await deleteMut.mutateAsync({ id });
      toast({ title: "✓ " + t("delete_employee") });
      refresh();
    } catch (e: any) {
      toast({ title: t("failed"), description: e?.data?.error ?? "Delete failed", variant: "destructive" });
    }
  };

  const openEdit = (u: UserRecord) => {
    setEditUser(u);
    setEditForm({
      name: u.name,
      department: u.department ?? "",
      position: u.position ?? "",
      phone: u.phone ?? "",
      workHoursPerDay: u.workHoursPerDay ?? 8,
      salary: u.salary ?? "",
      contractType: (u.contractType ?? "monthly") as "monthly" | "daily",
      breakMinutes: u.breakMinutes ?? "",
      transportAllowance: u.transportAllowance ?? "",
      housingAllowance: u.housingAllowance ?? "",
      role: (u.role ?? "employee") as "admin" | "manager" | "employee",
      avatarUrl: u.avatarUrl ?? "",
      workStartTime: u.workStartTime ?? "",
      workEndTime: u.workEndTime ?? "",
    });
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    try {
      await updateMut.mutateAsync({
        id: editUser.id,
        data: {
          ...editForm,
          workHoursPerDay: Number(editForm.workHoursPerDay),
          salary: editForm.salary !== "" ? Number(editForm.salary) : null,
          breakMinutes: editForm.breakMinutes !== "" ? Number(editForm.breakMinutes) : 0,
          transportAllowance: editForm.transportAllowance !== "" ? Number(editForm.transportAllowance) : 0,
          housingAllowance: editForm.housingAllowance !== "" ? Number(editForm.housingAllowance) : 0,
          avatarUrl: editForm.avatarUrl || null,
          workStartTime: editForm.workStartTime || null,
          workEndTime: editForm.workEndTime || null,
        } as any
      });
      toast({ title: "✓ " + t("edit_employee") });
      setEditOpen(false);
      refresh();
    } catch (e: any) {
      toast({ title: t("failed"), description: e?.data?.error, variant: "destructive" });
    }
  };

  const formatSalary = (v: number | null | undefined) => {
    if (v == null) return "—";
    return v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // Filter — memoized so it only re-runs when data or filters change
  const filtered = useMemo(() => (users ?? []).filter(u => {
    if (deptFilter !== "all" && (u as any).department !== deptFilter) return false;
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    return true;
  }), [users, deptFilter, roleFilter]);

  // Stats — memoized single pass over the array
  const { total, admins, managers, employees } = useMemo(() => ({
    total:     users?.length ?? 0,
    admins:    users?.filter(u => u.role === "admin").length ?? 0,
    managers:  users?.filter(u => u.role === "manager").length ?? 0,
    employees: users?.filter(u => u.role === "employee").length ?? 0,
  }), [users]);

  const roleLabel = (role: string) => {
    if (role === "admin") return isArabic ? "مدير النظام" : "Admin";
    if (role === "manager") return isArabic ? "مدير الشركة" : "Manager";
    return isArabic ? "موظف" : "Employee";
  };

  const roleBadgeClass = (role: string) =>
    role === "admin" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800" :
    role === "manager" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800" :
    "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800";

  return (
    <Layout>
      <div className="space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              {t("employees")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isArabic ? "إدارة بيانات وملفات الموظفين" : "Manage employee profiles and data"}
            </p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-md" size="lg" data-testid="button-add-employee">
                <Plus className="w-4 h-4" /> {t("add_employee")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <Plus className="w-5 h-5" /> {t("add_employee")}
                </DialogTitle>
              </DialogHeader>
              <FormAddEdit
                isEdit={false}
                formData={form as FormData}
                setFormData={setForm as any}
                onSubmit={handleCreate}
                isPending={createMut.isPending}
                departments={departments}
                isArabic={isArabic}
                t={t}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* ── Stats Bar ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: isArabic ? "إجمالي الموظفين" : "Total", value: total, icon: Users, color: "text-primary", bg: "bg-primary/10" },
            { label: isArabic ? "موظف" : "Employees", value: employees, icon: Briefcase, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-900/20" },
            { label: isArabic ? "مدير الشركة" : "Managers", value: managers, icon: Shield, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20" },
            { label: isArabic ? "مدير النظام" : "Admins", value: admins, icon: Shield, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20" },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 flex items-center gap-3 border border-border/50`}>
              <div className={`w-9 h-9 rounded-lg bg-white/60 dark:bg-black/20 flex items-center justify-center ${s.color}`}>
                <s.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xl font-bold">{isLoading ? "—" : s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="ps-9" placeholder={t("search_employees")} value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-employees" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder={isArabic ? "كل الأقسام" : "All Depts"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isArabic ? "كل الأقسام" : "All Departments"}</SelectItem>
                {departments.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder={isArabic ? "كل الأدوار" : "All Roles"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isArabic ? "كل الأدوار" : "All Roles"}</SelectItem>
                <SelectItem value="employee">{isArabic ? "موظف" : "Employee"}</SelectItem>
                <SelectItem value="manager">{isArabic ? "مدير" : "Manager"}</SelectItem>
                <SelectItem value="admin">{isArabic ? "مدير النظام" : "Admin"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Grid ── */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-card border border-card-border rounded-2xl overflow-hidden">
                <Skeleton className="h-28 w-full rounded-none" />
                <div className="p-4 pt-10 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <NoEmployeesIllustration />
            <div>
              <p className="font-medium text-sm text-foreground/80">{t("no_employees")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isArabic ? "أضف أول موظف لبدء الإدارة" : "Add your first employee to get started"}
              </p>
            </div>
            <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> {t("add_employee")}
            </Button>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((user, idx) => (
                <motion.div
                  key={user.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.04, duration: 0.25 }}
                  className="bg-card border border-card-border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow duration-200 group"
                  data-testid={`row-employee-${user.id}`}
                >
                  {/* Cover gradient */}
                  <div
                    className="h-24 relative"
                    style={{ background: nameToGradient(user.name) }}
                  >
                    <div className="absolute inset-0 opacity-20"
                      style={{ backgroundImage: "radial-gradient(circle at 20% 80%, rgba(255,255,255,0.4) 0%, transparent 50%)" }}
                    />
                    {/* Action buttons */}
                    <div className="absolute top-2 end-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setRecordUser(user as EmpUser)}
                        className="w-7 h-7 rounded-lg bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-colors"
                        title={isArabic ? "السجل الكامل" : "Full Record"}
                        data-testid={`button-record-employee-${user.id}`}
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEdit(user as UserRecord)}
                        className="w-7 h-7 rounded-lg bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-colors"
                        title={t("edit")}
                        data-testid={`button-edit-employee-${user.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id, user.name)}
                        className="w-7 h-7 rounded-lg bg-red-500/70 backdrop-blur-sm text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                        title={t("delete")}
                        data-testid={`button-delete-employee-${user.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Avatar — centered, overlaps cover */}
                  <div className="flex justify-center -mt-16">
                    <div className="relative">
                      <EmpAvatar name={user.name} avatarUrl={user.avatarUrl} size="2xl" />
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-4 pb-4 pt-2">
                    <div className="flex flex-col items-center text-center gap-1">
                      <p className="font-semibold text-sm leading-tight">{user.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${roleBadgeClass(user.role)}`}>
                        {roleLabel(user.role)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate text-center">{user.email}</p>

                    <div className="mt-3 space-y-1">
                      {(user as any).department && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Briefcase className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{(user as any).department}</span>
                        </div>
                      )}
                      {(user as any).position && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="w-3 h-3 flex-shrink-0 text-center">🪪</span>
                          <span className="truncate">{(user as any).position}</span>
                        </div>
                      )}
                      {(user as any).salary != null && (
                        <div className="mt-2 pt-2 border-t border-border">
                          <p className="text-xs font-semibold text-foreground">
                            {formatSalary((user as any).salary)}
                            <span className="text-muted-foreground font-normal">
                              {(user as any).contractType === "daily" ? (isArabic ? " / يوم" : " / day") : (isArabic ? " / شهر" : " / mo")}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Mobile actions */}
                    <div className="flex gap-1.5 mt-3 sm:hidden">
                      <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => setRecordUser(user as EmpUser)}>
                        <BarChart3 className="w-3 h-3 me-1" /> {isArabic ? "سجل" : "Record"}
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => openEdit(user as UserRecord)}>
                        <Pencil className="w-3 h-3 me-1" /> {t("edit")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive border-destructive/30 hover:bg-destructive hover:text-white flex-shrink-0"
                        onClick={() => handleDelete(user.id, user.name)}
                        title={t("delete")}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Employee Full Record Dialog */}
        <EmployeeRecordDialog user={recordUser} onClose={() => setRecordUser(null)} />

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <EmpAvatar name={editUser?.name ?? "?"} avatarUrl={editUser?.avatarUrl} size="sm" />
                {t("edit_employee")}: {editUser?.name}
              </DialogTitle>
            </DialogHeader>
            <FormAddEdit
              isEdit={true}
              formData={editForm as FormData}
              setFormData={setEditForm as any}
              onSubmit={handleEdit}
              isPending={updateMut.isPending}
              departments={departments}
              isArabic={isArabic}
              t={t}
            />
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

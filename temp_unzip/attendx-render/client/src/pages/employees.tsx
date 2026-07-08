import { useState, useEffect, useCallback } from "react";
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
import { Plus, Search, Trash2, User, Loader2, Pencil } from "lucide-react";
import { authFetch } from "@/lib/api-url";

type Dept = { id: number; name: string };

type UserRecord = {
  id: number; name: string; email: string; role: string;
  department?: string | null; position?: string | null;
  phone?: string | null; workHoursPerDay?: number | null;
  salary?: number | null;
};

export default function EmployeesPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [departments, setDepartments] = useState<Dept[]>([]);

  const isArabic = i18n.language === "ar";
  const locale = "en-US";

  const emptyForm = {
    name: "", email: "", password: "emp123",
    role: "employee" as "admin" | "employee",
    department: "", position: "", phone: "",
    workHoursPerDay: 8, salary: "" as string | number
  };
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({
    name: "", department: "", position: "", phone: "",
    workHoursPerDay: 8, salary: "" as string | number
  });

  const { data: users, isLoading } = useListUsers({ search }, { query: { queryKey: getListUsersQueryKey({ search }) } });
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMut.mutateAsync({
        data: {
          ...form,
          workHoursPerDay: Number(form.workHoursPerDay),
          salary: form.salary !== "" ? Number(form.salary) : undefined,
        } as any
      });
      toast({ title: t("add_employee") + " ✓" });
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
      toast({ title: t("delete_employee") + " ✓" });
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
        } as any
      });
      toast({ title: t("edit_employee") + " ✓" });
      setEditOpen(false);
      refresh();
    } catch (e: any) {
      toast({ title: t("failed"), description: e?.data?.error, variant: "destructive" });
    }
  };

  const formatSalary = (v: number | null | undefined) => {
    if (v == null) return "—";
    return v.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const DeptSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={t("department")} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">—</SelectItem>
        {departments.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold">{t("employees")}</h1>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-employee">
                <Plus className="w-4 h-4" /> {t("add_employee")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{t("add_employee")}</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{t("name")}</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required data-testid="input-emp-name" />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("email")}</Label>
                    <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required data-testid="input-emp-email" />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("password")}</Label>
                    <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required data-testid="input-emp-password" />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("role")}</Label>
                    <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">{t("employee")}</SelectItem>
                        <SelectItem value="admin">{t("admin")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{t("department")}</Label>
                    <DeptSelect value={form.department} onChange={v => setForm(f => ({ ...f, department: v === "none" ? "" : v }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("position")}</Label>
                    <Input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} data-testid="input-emp-position" />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("phone")}</Label>
                    <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("work_hours_day")}</Label>
                    <Input type="number" min={1} max={24} value={form.workHoursPerDay} onChange={e => setForm(f => ({ ...f, workHoursPerDay: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label>{t("salary")}</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={form.salary}
                      onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
                      data-testid="input-emp-salary"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMut.isPending} data-testid="button-create-employee">
                  {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
                  {t("add_employee")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={t("search_employees")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search-employees"
          />
        </div>

        <div className="bg-card border border-card-border rounded-xl divide-y divide-border">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : users?.map(user => (
            <div key={user.id} className="px-5 py-4 flex items-center gap-4" data-testid={`row-employee-${user.id}`}>
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <div className="text-end hidden sm:block">
                <p className="text-xs text-muted-foreground">{user.department ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{user.position ?? "—"}</p>
              </div>
              {(user as any).salary != null && (
                <p className="text-xs text-muted-foreground hidden md:block">
                  {formatSalary((user as any).salary)}
                </p>
              )}
              <Badge variant={user.role === "admin" ? "default" : "secondary"} className="capitalize">{user.role}</Badge>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => openEdit(user as UserRecord)} data-testid={`button-edit-employee-${user.id}`}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(user.id, user.name)} data-testid={`button-delete-employee-${user.id}`}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {users?.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t("no_employees")}</p>
          )}
        </div>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t("edit_employee")}: {editUser?.name}</DialogTitle></DialogHeader>
            <form onSubmit={handleEdit} className="space-y-3 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label>{t("name")}</Label>
                  <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <Label>{t("department")}</Label>
                  <DeptSelect value={editForm.department} onChange={v => setEditForm(f => ({ ...f, department: v === "none" ? "" : v }))} />
                </div>
                <div className="space-y-1">
                  <Label>{t("position")}</Label>
                  <Input value={editForm.position} onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>{t("phone")}</Label>
                  <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>{t("work_hours_day")}</Label>
                  <Input type="number" min={1} max={24} value={editForm.workHoursPerDay} onChange={e => setEditForm(f => ({ ...f, workHoursPerDay: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>{t("salary")}</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={editForm.salary}
                    onChange={e => setEditForm(f => ({ ...f, salary: e.target.value }))}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={updateMut.isPending}>
                {updateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
                {t("save_changes")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

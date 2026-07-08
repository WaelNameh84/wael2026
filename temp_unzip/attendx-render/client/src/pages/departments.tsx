import { useState, useEffect, useCallback } from "react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import { useGetMe } from "@/lib/api-client/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2, Users, Trash2, AlertTriangle } from "lucide-react";
import { authFetch } from "@/lib/api-url";

type Department = { id: number; name: string; employeeCount: number; createdAt: string };

const DEPT_COLOR_LIST = [
  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
];

function getDeptColor(id: number) {
  return DEPT_COLOR_LIST[id % DEPT_COLOR_LIST.length];
}

export default function DepartmentsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: me } = useGetMe();
  const isAdmin = me?.role === "admin";

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newDept, setNewDept] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fetchDepts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/departments");
      if (res.ok) {
        setDepartments(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error ?? t("failed"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("failed"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => { fetchDepts(); }, [fetchDepts]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newDept.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/departments", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const dept = await res.json();
        setDepartments(prev => [...prev, dept].sort((a, b) => a.name.localeCompare(b.name)));
        toast({ title: `"${name}" ${t("added")}` });
        setNewDept("");
        setAddOpen(false);
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error ?? t("failed"), variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (dept: Department) => {
    setDeleteTarget(dept);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await authFetch(`/api/departments/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setDepartments(prev => prev.filter(d => d.id !== deleteTarget.id));
        toast({ title: t("delete_department") + " ✓" });
        setDeleteOpen(false);
        setDeleteTarget(null);
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error ?? t("failed"), variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t("departments")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("department_management")}</p>
          </div>

          {isAdmin && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" /> {t("add_department")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t("add_department")}</DialogTitle></DialogHeader>
                <form onSubmit={handleAdd} className="space-y-4 mt-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t("department_name")}</label>
                    <Input
                      value={newDept}
                      onChange={e => setNewDept(e.target.value)}
                      placeholder="e.g. Marketing"
                      required
                      autoFocus
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={saving}>
                    <Plus className="w-4 h-4 me-2" /> {t("add_department")}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map(dept => (
              <div
                key={dept.id}
                className="bg-card border border-card-border rounded-xl p-5 flex items-start gap-4 hover:shadow-sm transition-shadow"
                data-testid={`card-dept-${dept.name}`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${getDeptColor(dept.id)}`}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{t(`dept_${dept.name}`, { defaultValue: dept.name })}</p>
                  <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                    <Users className="w-3.5 h-3.5" />
                    <span>{dept.employeeCount} {t("employee_count")}</span>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => confirmDelete(dept)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-colors flex-shrink-0"
                    data-testid={`button-delete-dept-${dept.id}`}
                    title={t("delete_department")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && departments.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>{t("no_departments")}</p>
          </div>
        )}

        {isAdmin && (
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  {t("delete_department")}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <p className="text-sm text-muted-foreground">
                  {t("delete_dept_confirm")} <strong>"{deleteTarget ? t(`dept_${deleteTarget.name}`, { defaultValue: deleteTarget.name }) : ""}"</strong>?
                </p>
                {(deleteTarget?.employeeCount ?? 0) > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg text-sm text-orange-700 dark:text-orange-300">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{t("delete_dept_warning").replace("{count}", String(deleteTarget?.employeeCount))}</span>
                  </div>
                )}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>
                    {t("cancel")}
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={saving}>
                    {t("delete_department")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Layout>
  );
}

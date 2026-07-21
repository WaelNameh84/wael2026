import { useState } from "react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import { useGetMe } from "@/lib/api-client/index";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2, Users, Trash2, AlertTriangle, Search, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/api-url";
import { motion, AnimatePresence } from "framer-motion";

type Department = { id: number; name: string; employeeCount: number; createdAt: string };

/* ── Smart department icon & gradient mapping ──────────────────────────
   Checks both Arabic and English keywords in the department name.
   Returns { emoji, gradient, label } */
interface DeptVisual { emoji: string; gradient: string; bg: string; textColor: string }

const DEPT_MAP: { keywords: string[]; visual: DeptVisual }[] = [
  {
    keywords: [
      // AR
      "نجار", "نجارة", "أثاث",
      // EN
      "carpenter", "carpentry", "woodwork", "wood", "furniture",
      // FR
      "menuisier", "menuiserie", "bois", "ébéniste",
      // DE
      "tischler", "schreiner", "holz",
      // ES
      "carpintero", "carpintería", "madera",
      // TR
      "marangoz", "ahşap",
      // SV
      "snickare", "träarbete",
      // UR
      "بڑھئی", "لکڑی",
    ],
    visual: { emoji: "🪚", gradient: "linear-gradient(135deg,#92400e,#d97706)", bg: "bg-amber-50 dark:bg-amber-900/20", textColor: "text-amber-700 dark:text-amber-300" },
  },
  {
    keywords: [
      "حداد", "حدادة", "حديد", "لحام",
      "blacksmith", "ironwork", "iron", "steel", "welding", "welder",
      "forgeron", "soudeur", "acier",
      "schmied", "schweißer", "stahl",
      "herrero", "soldador", "acero",
      "demirci", "kaynak",
      "smed", "svetsare",
      "لوہار", "ویلڈر",
    ],
    visual: { emoji: "⚒️", gradient: "linear-gradient(135deg,#1c1917,#57534e)", bg: "bg-stone-50 dark:bg-stone-900/30", textColor: "text-stone-700 dark:text-stone-300" },
  },
  {
    keywords: [
      "دهان", "دهانة", "طلاء", "صباغ", "صباغة",
      "paint", "painter", "painting", "coating",
      "peintre", "peinture",
      "maler", "anstreicher",
      "pintor", "pintura",
      "boyacı", "boya",
      "målare",
      "پینٹر", "رنگ ساز",
    ],
    visual: { emoji: "🖌️", gradient: "linear-gradient(135deg,#be185d,#f472b6)", bg: "bg-pink-50 dark:bg-pink-900/20", textColor: "text-pink-700 dark:text-pink-300" },
  },
  {
    keywords: [
      "بلاط", "بلاطة", "تبليط", "سيراميك",
      "ceramic", "tile", "tiling", "mosaic", "flooring",
      "carrelage", "carreleur",
      "fliese", "fliesenleger",
      "azulejo", "baldosa", "alicatado",
      "fayans", "döşeme",
      "kakel",
      "ٹائل",
    ],
    visual: { emoji: "🏠", gradient: "linear-gradient(135deg,#713f12,#a16207)", bg: "bg-yellow-50 dark:bg-yellow-900/20", textColor: "text-yellow-700 dark:text-yellow-300" },
  },
  {
    keywords: [
      "جبس", "جبسية", "جبصين",
      "gypsum", "plaster", "drywall", "stucco", "gyp",
      "plâtre", "plaquiste",
      "gips", "verputz",
      "yeso", "escayola",
      "alçı", "sıva",
      "gips", "puts",
      "جپسم",
    ],
    visual: { emoji: "🧱", gradient: "linear-gradient(135deg,#d4a96a,#e8c99a)", bg: "bg-orange-50 dark:bg-orange-900/20", textColor: "text-orange-700 dark:text-orange-300" },
  },
  {
    keywords: [
      "مقاول", "مقاولات", "إنشاء", "بناء", "خرسانة", "اسمنت",
      "contractor", "construction", "build", "concrete", "cement",
      "entrepreneur", "construction", "béton",
      "bauunternehmer", "beton", "bau",
      "contratista", "construcción", "hormigón",
      "müteahhit", "inşaat", "beton",
      "byggare", "betong",
      "ٹھیکیدار", "تعمیر",
    ],
    visual: { emoji: "🏗️", gradient: "linear-gradient(135deg,#374151,#6b7280)", bg: "bg-gray-50 dark:bg-gray-900/30", textColor: "text-gray-700 dark:text-gray-300" },
  },
  {
    keywords: [
      "سباك", "سباكة", "ماء", "صرف",
      "plumb", "plumber", "pipe", "water", "sanit",
      "plombier", "plomberie",
      "klempner", "sanitär", "rohre",
      "fontanero", "plomería", "tuberías",
      "tesisatçı", "su tesisatı",
      "rörmokare",
      "پلمبر", "پانی",
    ],
    visual: { emoji: "🔧", gradient: "linear-gradient(135deg,#0369a1,#0ea5e9)", bg: "bg-sky-50 dark:bg-sky-900/20", textColor: "text-sky-700 dark:text-sky-300" },
  },
  {
    keywords: [
      "كهربائي", "كهرباء", "طاقة",
      "electric", "elec", "power", "electrical",
      "électricien", "électricité",
      "elektriker", "elektro", "strom",
      "electricista", "electricidad",
      "elektrikçi", "elektrik",
      "elektriker",
      "بجلی", "الیکٹریشن",
    ],
    visual: { emoji: "⚡", gradient: "linear-gradient(135deg,#713f12,#f59e0b)", bg: "bg-yellow-50 dark:bg-yellow-900/20", textColor: "text-yellow-700 dark:text-yellow-300" },
  },
  {
    keywords: [
      "محاسب", "محاسبة", "مالية", "مراجع", "ميزانية",
      "finance", "accounting", "account", "audit", "budget", "cfo",
      "comptable", "comptabilité", "finances",
      "buchhalter", "buchhaltung", "finanzen",
      "contable", "contabilidad", "finanzas",
      "muhasebe", "mali",
      "revisor", "bokföring",
      "اکاؤنٹنٹ", "مالیات",
    ],
    visual: { emoji: "💰", gradient: "linear-gradient(135deg,#166534,#22c55e)", bg: "bg-green-50 dark:bg-green-900/20", textColor: "text-green-700 dark:text-green-300" },
  },
  {
    keywords: [
      "موارد بشرية", "توظيف", "شؤون موظفين",
      "hr", "human", "resource", "recruit", "personnel", "people",
      "ressources humaines", "rh", "recrutement",
      "personalabteilung", "personal", "rekrutierung",
      "recursos humanos", "rrhh", "reclutamiento",
      "insan kaynakları", "ik",
      "personalavdelning",
      "انسانی وسائل",
    ],
    visual: { emoji: "👥", gradient: "linear-gradient(135deg,#5b21b6,#a78bfa)", bg: "bg-violet-50 dark:bg-violet-900/20", textColor: "text-violet-700 dark:text-violet-300" },
  },
  {
    keywords: [
      "تقنية", "برمجة", "حاسوب", "شبكة",
      "it", "tech", "software", "develop", "computer", "network", "cyber", "data",
      "informatique", "programmation", "réseau",
      "informatik", "programmierung", "netzwerk",
      "informática", "programación", "redes",
      "bilişim", "yazılım", "ağ",
      "datorteknik", "programmering",
      "آئی ٹی", "کمپیوٹر",
    ],
    visual: { emoji: "💻", gradient: "linear-gradient(135deg,#1e40af,#3b82f6)", bg: "bg-blue-50 dark:bg-blue-900/20", textColor: "text-blue-700 dark:text-blue-300" },
  },
  {
    keywords: [
      "تسويق", "إعلام", "علامة", "رقمي",
      "marketing", "media", "advertising", "brand", "digital",
      "marketing", "publicité", "médias",
      "marketing", "werbung", "medien",
      "marketing", "publicidad", "medios",
      "pazarlama", "reklam", "medya",
      "marknadsföring",
      "مارکیٹنگ",
    ],
    visual: { emoji: "📣", gradient: "linear-gradient(135deg,#be123c,#f43f5e)", bg: "bg-rose-50 dark:bg-rose-900/20", textColor: "text-rose-700 dark:text-rose-300" },
  },
  {
    keywords: [
      "مبيعات", "بيع", "تجاري", "عملاء",
      "sales", "commercial", "customer", "crm", "sell",
      "ventes", "commercial", "clients",
      "vertrieb", "verkauf", "kunden",
      "ventas", "vendedor", "clientes",
      "satış", "müşteri",
      "försäljning",
      "سیلز", "فروخت",
    ],
    visual: { emoji: "🛒", gradient: "linear-gradient(135deg,#c2410c,#f97316)", bg: "bg-orange-50 dark:bg-orange-900/20", textColor: "text-orange-700 dark:text-orange-300" },
  },
  {
    keywords: [
      "صحة", "طب", "مستشفى", "تمريض", "عيادة",
      "health", "medical", "hospital", "nurse", "clinic", "doctor", "pharma",
      "santé", "médical", "hôpital", "infirmier",
      "gesundheit", "medizin", "krankenhaus", "pflege",
      "salud", "médico", "hospital", "enfermero",
      "sağlık", "tıp", "hastane", "hemşire",
      "hälsa", "sjukvård",
      "صحت", "طب",
    ],
    visual: { emoji: "🏥", gradient: "linear-gradient(135deg,#0f766e,#14b8a6)", bg: "bg-teal-50 dark:bg-teal-900/20", textColor: "text-teal-700 dark:text-teal-300" },
  },
  {
    keywords: [
      "قانون", "محامي", "شريعة", "حقوق",
      "legal", "law", "attorney", "lawyer", "jurist",
      "juridique", "droit", "avocat",
      "recht", "jurist", "anwalt",
      "legal", "derecho", "abogado",
      "hukuk", "avukat",
      "juridik", "advokat",
      "قانون", "وکیل",
    ],
    visual: { emoji: "⚖️", gradient: "linear-gradient(135deg,#1e293b,#475569)", bg: "bg-slate-50 dark:bg-slate-900/30", textColor: "text-slate-700 dark:text-slate-300" },
  },
  {
    keywords: [
      "تصميم", "رسم", "فن", "إبداع",
      "design", "graphic", "art", "creative",
      "design", "graphisme", "art", "créatif",
      "design", "gestaltung", "kunst",
      "diseño", "arte", "creativo",
      "tasarım", "sanat",
      "design", "konst",
      "ڈیزائن", "فن",
    ],
    visual: { emoji: "🎨", gradient: "linear-gradient(135deg,#7c3aed,#ec4899)", bg: "bg-fuchsia-50 dark:bg-fuchsia-900/20", textColor: "text-fuchsia-700 dark:text-fuchsia-300" },
  },
  {
    keywords: [
      "مستودع", "مخزن", "شحن", "مخزون",
      "warehouse", "logistics", "shipping", "inventory", "stock", "supply",
      "entrepôt", "logistique", "expédition",
      "lager", "logistik", "versand",
      "almacén", "logística", "envío",
      "depo", "lojistik", "kargo",
      "lager", "logistik",
      "گودام", "مال",
    ],
    visual: { emoji: "📦", gradient: "linear-gradient(135deg,#78350f,#b45309)", bg: "bg-amber-50 dark:bg-amber-900/20", textColor: "text-amber-700 dark:text-amber-300" },
  },
  {
    keywords: [
      "مطبخ", "طبخ", "مطعم",
      "chef", "cook", "food", "restaurant", "catering", "kitchen",
      "chef", "cuisinier", "restauration",
      "koch", "küche", "restaurant",
      "chef", "cocina", "restaurante",
      "aşçı", "mutfak", "restoran",
      "kock", "kök", "mat",
      "باورچی", "کھانا",
    ],
    visual: { emoji: "👨‍🍳", gradient: "linear-gradient(135deg,#dc2626,#f97316)", bg: "bg-red-50 dark:bg-red-900/20", textColor: "text-red-700 dark:text-red-300" },
  },
  {
    keywords: [
      "حماية", "أمن", "حارس",
      "security", "guard", "protection", "safety",
      "sécurité", "garde",
      "sicherheit", "wachmann",
      "seguridad", "guardia",
      "güvenlik", "koruma",
      "säkerhet", "vakt",
      "سیکیورٹی", "محافظ",
    ],
    visual: { emoji: "🛡️", gradient: "linear-gradient(135deg,#1e3a5f,#2563eb)", bg: "bg-blue-50 dark:bg-blue-900/20", textColor: "text-blue-700 dark:text-blue-300" },
  },
  {
    keywords: [
      "تعليم", "مدرسة", "تدريب", "معلم", "أستاذ",
      "education", "school", "training", "teacher", "teach", "learn",
      "éducation", "école", "formation", "enseignant",
      "bildung", "schule", "lehrer",
      "educación", "escuela", "formación", "maestro",
      "eğitim", "okul", "öğretmen",
      "utbildning", "skola", "lärare",
      "تعلیم", "استاد",
    ],
    visual: { emoji: "📚", gradient: "linear-gradient(135deg,#1d4ed8,#06b6d4)", bg: "bg-cyan-50 dark:bg-cyan-900/20", textColor: "text-cyan-700 dark:text-cyan-300" },
  },
  {
    keywords: [
      "هندسة", "ميكانيك", "مدني", "معماري",
      "engineer", "engineering", "mechanic", "civil", "architect", "mechanical",
      "ingénieur", "génie", "mécanique",
      "ingenieur", "technik", "mechaniker",
      "ingeniero", "ingeniería", "mecánico",
      "mühendis", "mühendislik", "mimar",
      "ingenjör", "teknik",
      "انجینئر", "میکانک",
    ],
    visual: { emoji: "⚙️", gradient: "linear-gradient(135deg,#374151,#6b7280)", bg: "bg-gray-50 dark:bg-gray-900/30", textColor: "text-gray-700 dark:text-gray-300" },
  },
  {
    keywords: [
      "زراعة", "مزرعة", "نبات", "حديقة",
      "agriculture", "farm", "plant", "garden", "agri",
      "agriculture", "ferme", "jardin",
      "landwirtschaft", "bauernhof", "garten",
      "agricultura", "granja", "jardín",
      "tarım", "çiftlik", "bahçe",
      "jordbruk", "trädgård",
      "زراعت", "باغ",
    ],
    visual: { emoji: "🌱", gradient: "linear-gradient(135deg,#14532d,#22c55e)", bg: "bg-green-50 dark:bg-green-900/20", textColor: "text-green-700 dark:text-green-300" },
  },
  {
    keywords: [
      "سائق", "نقل", "سيارة",
      "transport", "driver", "delivery", "car", "vehicle", "fleet", "logistics",
      "chauffeur", "transport", "livraison",
      "fahrer", "transport", "lieferung",
      "conductor", "transporte", "entrega",
      "şoför", "sürücü", "nakliye",
      "chaufför", "transport",
      "ڈرائیور", "گاڑی",
    ],
    visual: { emoji: "🚗", gradient: "linear-gradient(135deg,#1e40af,#0ea5e9)", bg: "bg-blue-50 dark:bg-blue-900/20", textColor: "text-blue-700 dark:text-blue-300" },
  },
  {
    keywords: [
      "نظافة", "صيانة",
      "clean", "cleaning", "maintenance", "janitor", "housekeep", "facility",
      "nettoyage", "entretien", "maintenance",
      "reinigung", "wartung", "hausmeister",
      "limpieza", "mantenimiento",
      "temizlik", "bakım",
      "städning", "underhåll",
      "صفائی", "دیکھ بھال",
    ],
    visual: { emoji: "🧹", gradient: "linear-gradient(135deg,#0f766e,#06b6d4)", bg: "bg-cyan-50 dark:bg-cyan-900/20", textColor: "text-cyan-700 dark:text-cyan-300" },
  },
  {
    keywords: [
      "إدارة", "مدير", "رئيس",
      "management", "admin", "executive", "ceo", "general", "director", "manager",
      "direction", "directeur", "gérant",
      "verwaltung", "geschäftsführer", "leitung",
      "dirección", "gerente", "director",
      "yönetim", "müdür", "genel müdür",
      "ledning", "chef",
      "انتظامیہ", "مینیجر",
    ],
    visual: { emoji: "👔", gradient: "linear-gradient(135deg,#1e293b,#334155)", bg: "bg-slate-50 dark:bg-slate-900/30", textColor: "text-slate-700 dark:text-slate-300" },
  },
  {
    keywords: [
      "عقار", "عقارات", "تأجير",
      "real estate", "realty", "property", "estate", "rent", "lease",
      "immobilier", "location",
      "immobilien", "miete",
      "inmobiliaria", "bienes raíces",
      "gayrimenkul", "kiralama",
      "fastighet",
      "جائیداد",
    ],
    visual: { emoji: "🏘️", gradient: "linear-gradient(135deg,#0369a1,#38bdf8)", bg: "bg-sky-50 dark:bg-sky-900/20", textColor: "text-sky-700 dark:text-sky-300" },
  },
  {
    keywords: [
      "طباعة", "نشر",
      "print", "printing", "publish", "press", "media",
      "imprimerie", "édition",
      "druckerei", "verlag",
      "imprenta", "editorial",
      "baskı", "matbaa",
      "tryckeri",
      "پرنٹنگ",
    ],
    visual: { emoji: "🖨️", gradient: "linear-gradient(135deg,#1e3a5f,#64748b)", bg: "bg-slate-50 dark:bg-slate-900/30", textColor: "text-slate-700 dark:text-slate-300" },
  },
  {
    keywords: [
      "خياطة", "ملابس", "أزياء",
      "tailor", "fashion", "sewing", "textile", "clothes", "garment",
      "couture", "mode", "vêtements",
      "schneiderei", "mode", "textil",
      "sastrería", "moda", "costura",
      "terzilik", "moda", "tekstil",
      "skräddare", "mode",
      "درزی", "لباس",
    ],
    visual: { emoji: "👗", gradient: "linear-gradient(135deg,#9d174d,#db2777)", bg: "bg-pink-50 dark:bg-pink-900/20", textColor: "text-pink-700 dark:text-pink-300" },
  },
];

const FALLBACK_VISUALS: DeptVisual[] = [
  { emoji: "🏢", gradient: "linear-gradient(135deg,#4f46e5,#818cf8)", bg: "bg-indigo-50 dark:bg-indigo-900/20", textColor: "text-indigo-700 dark:text-indigo-300" },
  { emoji: "🌐", gradient: "linear-gradient(135deg,#0891b2,#22d3ee)", bg: "bg-cyan-50 dark:bg-cyan-900/20", textColor: "text-cyan-700 dark:text-cyan-300" },
  { emoji: "⭐", gradient: "linear-gradient(135deg,#d97706,#fbbf24)", bg: "bg-amber-50 dark:bg-amber-900/20", textColor: "text-amber-700 dark:text-amber-300" },
  { emoji: "🔮", gradient: "linear-gradient(135deg,#7c3aed,#c084fc)", bg: "bg-purple-50 dark:bg-purple-900/20", textColor: "text-purple-700 dark:text-purple-300" },
  { emoji: "🎯", gradient: "linear-gradient(135deg,#dc2626,#f87171)", bg: "bg-red-50 dark:bg-red-900/20", textColor: "text-red-700 dark:text-red-300" },
];

function getDeptVisual(name: string, id: number): DeptVisual {
  const lower = name.toLowerCase();
  for (const entry of DEPT_MAP) {
    if (entry.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      return entry.visual;
    }
  }
  return FALLBACK_VISUALS[id % FALLBACK_VISUALS.length];
}

/* ── Live emoji preview while typing ── */
function DeptPreview({ name }: { name: string }) {
  if (!name.trim()) return null;
  const visual = getDeptVisual(name, 0);
  return (
    <motion.div
      key={visual.emoji}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30"
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-md flex-shrink-0"
        style={{ background: visual.gradient }}>
        {visual.emoji}
      </div>
      <div>
        <p className="font-semibold text-sm">{name}</p>
        <p className="text-xs text-muted-foreground">
          هذا هو الشكل الذي سيظهر به القسم
        </p>
      </div>
    </motion.div>
  );
}

export default function DepartmentsPage() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: me } = useGetMe();
  const isAdmin = me?.role === "admin" || me?.role === "manager";

  const [addOpen, setAddOpen] = useState(false);
  const [newDept, setNewDept] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  /* ── Fetch ── */
  const { data: departments = [], isLoading } = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await authFetch("/api/departments", { signal: ctrl.signal } as any);
        clearTimeout(timer);
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Failed"); }
        return res.json();
      } catch (e) { clearTimeout(timer); throw e; }
    },
    staleTime: 30_000, gcTime: 120_000, retry: 2,
  });

  /* ── Add ── */
  const addMut = useMutation({
    mutationFn: async (name: string) => {
      const res = await authFetch("/api/departments", { method: "POST", body: JSON.stringify({ name }) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Failed"); }
      return res.json();
    },
    onSuccess: (_d, name) => { qc.invalidateQueries({ queryKey: ["departments"] }); toast({ title: `✓ "${name}" ${t("added")}` }); setNewDept(""); setAddOpen(false); },
    onError: (err: Error) => { toast({ title: err.message ?? t("failed"), variant: "destructive" }); },
  });

  /* ── Delete ── */
  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await authFetch(`/api/departments/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Failed"); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments"] }); toast({ title: "✓ " + t("delete_department") }); setDeleteOpen(false); setDeleteTarget(null); },
    onError: (err: Error) => { toast({ title: err.message ?? t("failed"), variant: "destructive" }); },
  });

  const handleAdd = (e: React.FormEvent) => { e.preventDefault(); const name = newDept.trim(); if (!name) return; addMut.mutate(name); };

  const filtered = departments.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  const totalEmp = departments.reduce((s, d) => s + d.employeeCount, 0);

  return (
    <Layout>
      <div className="space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" />
              {t("departments")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("department_management")}</p>
          </div>
          {isAdmin && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-md" size="lg">
                  <Plus className="w-4 h-4" /> {t("add_department")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" /> {t("add_department")}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAdd} className="space-y-4 mt-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t("department_name")}</label>
                    <Input
                      value={newDept}
                      onChange={e => setNewDept(e.target.value)}
                      placeholder={isArabic ? "مثال: نجارة، محاسبة، تقنية..." : "e.g. Carpentry, Accounting, IT..."}
                      required
                      autoFocus
                    />
                  </div>
                  {/* Live preview */}
                  <DeptPreview name={newDept} />
                  <Button type="submit" className="w-full h-11 font-semibold" disabled={addMut.isPending}>
                    {addMut.isPending ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <Plus className="w-4 h-4 me-2" />}
                    {t("add_department")}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* ── Stats ── */}
        {!isLoading && departments.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary/10 rounded-xl p-4 flex items-center gap-3 border border-border/50">
              <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold">{departments.length}</p>
                <p className="text-xs text-muted-foreground">{isArabic ? "عدد الأقسام" : "Departments"}</p>
              </div>
            </div>
            <div className="bg-sky-50 dark:bg-sky-900/20 rounded-xl p-4 flex items-center gap-3 border border-border/50">
              <div className="w-9 h-9 rounded-lg bg-sky-100 dark:bg-sky-800/40 flex items-center justify-center">
                <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-xl font-bold">{totalEmp}</p>
                <p className="text-xs text-muted-foreground">{isArabic ? "إجمالي الموظفين" : "Total Employees"}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Search ── */}
        {departments.length > 3 && (
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="ps-9" placeholder={isArabic ? "ابحث عن قسم..." : "Search departments..."} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        )}

        {/* ── Grid ── */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card border border-card-border rounded-2xl overflow-hidden">
                <Skeleton className="h-24 w-full rounded-none" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 && departments.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 opacity-40" />
            </div>
            <p className="font-medium">{t("no_departments")}</p>
            <p className="text-sm mt-1 opacity-70">
              {isArabic ? "ابدأ بإضافة أول قسم في شركتك" : "Start by adding your first department"}
            </p>
            {isAdmin && (
              <Button className="mt-4 gap-2" onClick={() => setAddOpen(true)}>
                <Plus className="w-4 h-4" /> {t("add_department")}
              </Button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((dept, idx) => {
                const visual = getDeptVisual(dept.name, dept.id);
                return (
                  <motion.div
                    key={dept.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05, duration: 0.25 }}
                    className="bg-card border border-card-border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow duration-200 group"
                    data-testid={`card-dept-${dept.name}`}
                  >
                    {/* Cover banner with gradient */}
                    <div className="h-24 relative flex items-center justify-center" style={{ background: visual.gradient }}>
                      <div className="absolute inset-0 opacity-20"
                        style={{ backgroundImage: "radial-gradient(circle at 30% 70%, rgba(255,255,255,0.5) 0%, transparent 60%)" }} />
                      <span className="text-5xl drop-shadow-lg" role="img">{visual.emoji}</span>
                      {isAdmin && (
                        <button
                          onClick={() => { setDeleteTarget(dept); setDeleteOpen(true); }}
                          className="absolute top-2 end-2 w-7 h-7 rounded-lg bg-black/25 backdrop-blur-sm text-white flex items-center justify-center hover:bg-red-500/80 transition-all sm:opacity-0 sm:group-hover:opacity-100"
                          data-testid={`button-delete-dept-${dept.id}`}
                          title={t("delete_department")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Body */}
                    <div className="p-4">
                      <p className="font-bold text-base leading-tight">
                        {t(`dept_${dept.name}`, { defaultValue: dept.name })}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${visual.bg} ${visual.textColor}`}>
                          <Users className="w-3 h-3" />
                          {dept.employeeCount} {t("employee_count")}
                        </div>
                      </div>
                      {dept.createdAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {isArabic ? "تأسس" : "Since"} {new Date(dept.createdAt).toLocaleDateString(isArabic ? "ar-SA-u-ca-gregory" : "en-US", { year: "numeric", month: "short" })}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}

        {/* Delete Confirm */}
        {isAdmin && (
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" /> {t("delete_department")}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                {deleteTarget && (() => {
                  const visual = getDeptVisual(deleteTarget.name, deleteTarget.id);
                  return (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ background: visual.gradient }}>
                        {visual.emoji}
                      </div>
                      <div>
                        <p className="font-semibold">{t(`dept_${deleteTarget.name}`, { defaultValue: deleteTarget.name })}</p>
                        <p className="text-xs text-muted-foreground">{deleteTarget.employeeCount} {t("employee_count")}</p>
                      </div>
                    </div>
                  );
                })()}
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
                  <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>{t("cancel")}</Button>
                  <Button variant="destructive" className="flex-1" onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)} disabled={deleteMut.isPending}>
                    {deleteMut.isPending ? <Loader2 className="w-4 h-4 animate-spin me-1" /> : null}
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

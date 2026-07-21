import { useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useTranslation } from "@/lib/i18n";
import { useListLeave, getListLeaveQueryKey } from "@/lib/api-client/index";
import { useHolidays } from "@/pages/holidays";
import { DayPicker } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Circle, PartyPopper } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "react-day-picker/style.css";

type LeaveStatus = "approved" | "pending" | "rejected" | "cancelled";

const STATUS_COLORS: Record<LeaveStatus, string> = {
  approved: "#22c55e",
  pending:  "#f59e0b",
  rejected: "#ef4444",
  cancelled: "#94a3b8",
};

const STATUS_BG: Record<LeaveStatus, string> = {
  approved: "bg-green-500/20 text-green-700 dark:text-green-300",
  pending:  "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  rejected: "bg-red-500/20 text-red-700 dark:text-red-300",
  cancelled: "bg-slate-400/20 text-slate-600 dark:text-slate-400",
};

function dateRange(start: string, end: string): Date[] {
  const dates: Date[] = [];
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export default function LeaveCalendarPage() {
  const { t } = useTranslation();
  const { data: leaves, isLoading } = useListLeave(undefined, {
    query: { queryKey: getListLeaveQueryKey() },
  });
  const { data: holidays } = useHolidays();

  const [month, setMonth] = useState<Date>(new Date());

  const { modifiers, modifierStyles, selectedLeave } = useMemo(() => {
    if (!leaves) return { modifiers: {}, modifierStyles: {}, selectedLeave: {} };

    const approved: Date[] = [];
    const pending: Date[] = [];
    const rejected: Date[] = [];
    const cancelled: Date[] = [];
    const dayLeaveMap: Record<string, typeof leaves[0]> = {};

    for (const leave of leaves) {
      const dates = dateRange(leave.startDate, leave.endDate);
      const bucket =
        leave.status === "approved" ? approved :
        leave.status === "pending"  ? pending  :
        leave.status === "rejected" ? rejected : cancelled;
      for (const d of dates) {
        bucket.push(d);
        const key = d.toISOString().slice(0, 10);
        if (!dayLeaveMap[key] || leave.status === "approved") {
          dayLeaveMap[key] = leave;
        }
      }
    }

    const holiday: Date[] = (holidays ?? []).map(h => new Date(h.date + "T00:00:00"));

    return {
      modifiers: { approved, pending, rejected, cancelled, holiday },
      modifierStyles: {
        approved:  { backgroundColor: STATUS_COLORS.approved  + "33", color: STATUS_COLORS.approved,  borderRadius: "6px", fontWeight: "600" },
        pending:   { backgroundColor: STATUS_COLORS.pending   + "33", color: STATUS_COLORS.pending,   borderRadius: "6px", fontWeight: "600" },
        rejected:  { backgroundColor: STATUS_COLORS.rejected  + "33", color: STATUS_COLORS.rejected,  borderRadius: "6px", fontWeight: "600" },
        cancelled: { backgroundColor: STATUS_COLORS.cancelled + "33", color: STATUS_COLORS.cancelled, borderRadius: "6px", fontWeight: "600" },
        holiday:   { backgroundColor: "#a855f733", color: "#a855f7", borderRadius: "6px", fontWeight: "700", textDecoration: "underline" },
      },
      selectedLeave: dayLeaveMap,
    };
  }, [leaves, holidays]);

  const holidayMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const h of holidays ?? []) map[h.date] = h.name;
    return map;
  }, [holidays]);

  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const hoveredLeave = hoveredDay ? (selectedLeave as any)[hoveredDay] : null;
  const hoveredHoliday = hoveredDay ? holidayMap[hoveredDay] : null;

  const leaveTypes: Record<string, string> = {
    annual: t("annual_leave"),
    sick: t("sick_leave"),
    emergency: t("emergency_leave"),
    unpaid: t("unpaid_leave"),
  };

  const getTypeLabel = (type: string) =>
    leaveTypes[type] ?? type.replace(/_/g, " ");

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-primary" />
              {t("leave_calendar")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("my_leave_history")}</p>
          </div>
          <Link href="/leave">
            <Button variant="outline" size="sm">{t("list_view")}</Button>
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Calendar */}
          <div className="bg-card border border-card-border rounded-xl p-4 flex-shrink-0 flex justify-center">
            {isLoading ? (
              <Skeleton className="w-64 h-72" />
            ) : (
              <DayPicker
                month={month}
                onMonthChange={setMonth}
                modifiers={modifiers as any}
                modifiersStyles={modifierStyles as any}
                onDayMouseEnter={(day) => {
                  setHoveredDay(day.toISOString().slice(0, 10));
                }}
                onDayMouseLeave={() => setHoveredDay(null)}
                showOutsideDays={false}
                className="[--rdp-accent-color:hsl(var(--primary))]"
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="flex-1 space-y-4">
            {/* Legend */}
            <div className="bg-card border border-card-border rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold">{t("calendar_legend")}</p>
              <div className="space-y-1.5">
                {(["approved", "pending", "rejected", "cancelled"] as LeaveStatus[]).map(s => (
                  <div key={s} className="flex items-center gap-2 text-sm">
                    <Circle className="w-3.5 h-3.5 flex-shrink-0" style={{ fill: STATUS_COLORS[s], color: STATUS_COLORS[s] }} />
                    <span>{s === "approved" ? t("approved") : s === "pending" ? t("pending") : s === "rejected" ? t("rejected") : t("cancelled")}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-sm">
                  <PartyPopper className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#a855f7" }} />
                  <span>{t("holidays_menu")}</span>
                </div>
              </div>
            </div>

            {/* Hovered holiday tooltip */}
            {hoveredHoliday && !hoveredLeave && (
              <div className="bg-card border border-card-border rounded-xl p-4 space-y-1.5 animate-in fade-in">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <PartyPopper className="w-4 h-4" style={{ color: "#a855f7" }} />
                  {hoveredHoliday}
                </p>
                <p className="text-xs text-muted-foreground">{hoveredDay}</p>
              </div>
            )}

            {/* Hovered day tooltip */}
            {hoveredLeave && (
              <div className="bg-card border border-card-border rounded-xl p-4 space-y-2 animate-in fade-in">
                <p className="text-sm font-semibold">{getTypeLabel(hoveredLeave.type)}</p>
                <p className="text-xs text-muted-foreground">{hoveredLeave.startDate} → {hoveredLeave.endDate}</p>
                <Badge className={cn("text-xs capitalize border-0", STATUS_BG[hoveredLeave.status as LeaveStatus])}>
                  {hoveredLeave.status === "approved" ? t("approved") : hoveredLeave.status === "pending" ? t("pending") : hoveredLeave.status === "rejected" ? t("rejected") : t("cancelled")}
                </Badge>
                {hoveredLeave.reason && <p className="text-xs text-muted-foreground italic">"{hoveredLeave.reason}"</p>}
              </div>
            )}

            {/* Recent leaves list */}
            <div className="bg-card border border-card-border rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold">{t("leave_requests")}</p>
              {isLoading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
              ) : leaves?.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("no_leave_requests")}</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {[...(leaves ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate)).map(leave => (
                    <div key={leave.id} className="flex items-center gap-2 text-xs">
                      <Circle
                        className="w-2.5 h-2.5 flex-shrink-0"
                        style={{ fill: STATUS_COLORS[leave.status as LeaveStatus] ?? "#94a3b8", color: STATUS_COLORS[leave.status as LeaveStatus] ?? "#94a3b8" }}
                      />
                      <span className="font-medium truncate flex-1">{getTypeLabel(leave.type)}</span>
                      <span className="text-muted-foreground flex-shrink-0">{leave.startDate} → {leave.endDate}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

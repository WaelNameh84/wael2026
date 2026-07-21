import { useMemo } from "react";
import { useListAttendance, getListAttendanceQueryKey, useGetMe } from "@/lib/api-client/index";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subMonths, startOfWeek, addDays, eachDayOfInterval, startOfDay } from "date-fns";

const STATUS_COLOR: Record<string, string> = {
  present:     "bg-green-500",
  late:        "bg-yellow-400",
  early_leave: "bg-orange-400",
  on_leave:    "bg-blue-400",
  absent:      "bg-muted",
};

const STATUS_LABEL_AR: Record<string, string> = {
  present:     "حاضر",
  late:        "متأخر",
  early_leave: "انصراف مبكر",
  on_leave:    "إجازة",
  absent:      "غائب",
};

// px dimensions for a single cell — must match the rendered w/h in className
const CELL_PX = 11;
const GAP_PX  = 3;
const COL_W   = CELL_PX + GAP_PX; // 14 px per week-column

interface Props {
  isArabic?: boolean;
}

export default function AttendanceHeatmap({ isArabic }: Props) {
  const today     = new Date();
  const from      = format(subMonths(today, 5), "yyyy-MM-01");
  const to        = format(today, "yyyy-MM-dd");

  const { data: me } = useGetMe();

  // Always scope to the current user (admins would otherwise get all users)
  const { data: records, isLoading } = useListAttendance(
    me?.id ? { from, to, userId: me.id } : undefined,
    {
      query: {
        queryKey: getListAttendanceQueryKey({ from, to, userId: me?.id }),
        enabled: !!me?.id,
      },
    }
  );

  /* date → status map */
  const statusByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of records ?? []) map.set(r.date, r.status ?? "absent");
    return map;
  }, [records]);

  /* Build week columns (Sun … Sat) covering the range */
  const { weeks, monthMarkers } = useMemo(() => {
    const rangeStart = startOfWeek(new Date(from), { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: rangeStart, end: today });

    // chunk into weeks of 7
    const weeksArr: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeksArr.push(days.slice(i, i + 7));
    }

    // Month markers: first column where each calendar month appears
    const seen = new Set<number>();
    const markers: { label: string; col: number }[] = [];
    weeksArr.forEach((wk, col) => {
      for (const d of wk) {
        const m = d.getMonth();
        if (!seen.has(m)) {
          seen.add(m);
          markers.push({ label: format(d, "MMM"), col });
          break;
        }
      }
    });

    return { weeks: weeksArr, monthMarkers: markers };
  }, [from]);

  const todayStr = format(today, "yyyy-MM-dd");

  const DAY_LABELS = ["أحد", "اثن", "ثلا", "أرب", "خمس", "جمع", "سبت"];

  if (isLoading || !me) {
    return (
      <div className="bg-card border border-card-border rounded-2xl p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-28 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-card-border rounded-2xl p-5" dir="ltr">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4" dir={isArabic ? "rtl" : "ltr"}>
        <div className="w-7 h-7 rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        </div>
        <h2 className="font-semibold text-sm">
          {isArabic ? "خريطة الحضور — آخر 6 أشهر" : "Attendance Heatmap — Last 6 Months"}
        </h2>
      </div>

      {/* Month labels — positioned by pixel offset */}
      <div className="relative h-4 ms-[28px] mb-1 overflow-hidden">
        {monthMarkers.map(({ label, col }) => (
          <span
            key={`${label}-${col}`}
            className="absolute text-[10px] text-muted-foreground select-none"
            style={{ left: `${col * COL_W}px` }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div className="flex gap-[3px]" dir="ltr">
        {/* Day labels (show odd rows only to avoid clutter) */}
        <div className="flex flex-col gap-[3px] me-1 flex-shrink-0">
          {DAY_LABELS.map((d, i) => (
            <div
              key={i}
              className="h-[11px] w-[22px] text-[9px] text-muted-foreground flex items-center justify-end pe-0.5 leading-none select-none"
            >
              {i % 2 === 1 ? d : ""}
            </div>
          ))}
        </div>

        {/* Week columns — horizontally scrollable on small screens */}
        <div className="flex gap-[3px] overflow-x-auto pb-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }).map((_, di) => {
                const day = week[di];
                if (!day) return <div key={di} className="w-[11px] h-[11px]" />;

                const dateStr  = format(day, "yyyy-MM-dd");
                const status   = statusByDate.get(dateStr);
                const isToday  = dateStr === todayStr;
                const isFuture = startOfDay(day) > startOfDay(today);
                const isWeekend = day.getDay() === 5 || day.getDay() === 6;

                let cellColor = "bg-muted/40";
                if (isFuture)      cellColor = "bg-transparent";
                else if (status)   cellColor = STATUS_COLOR[status] ?? "bg-muted";
                else if (isWeekend) cellColor = "bg-muted/30";
                else               cellColor = "bg-muted/50";

                const tooltip = `${dateStr}${
                  status        ? " — " + (STATUS_LABEL_AR[status] ?? status)
                  : isWeekend  ? " — عطلة"
                  : isFuture   ? ""
                  :              " — لا بيانات"
                }`;

                return (
                  <div
                    key={di}
                    title={tooltip}
                    className={`w-[11px] h-[11px] rounded-[2px] transition-opacity hover:opacity-70 cursor-default flex-shrink-0
                      ${cellColor}
                      ${isToday ? "ring-1 ring-primary ring-offset-1 ring-offset-card" : ""}
                    `}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 flex-wrap" dir={isArabic ? "rtl" : "ltr"}>
        {[
          { label: isArabic ? "حاضر"    : "Present",  color: "bg-green-500"  },
          { label: isArabic ? "متأخر"   : "Late",     color: "bg-yellow-400" },
          { label: isArabic ? "إجازة"   : "On Leave", color: "bg-blue-400"   },
          { label: isArabic ? "غائب"    : "Absent",   color: "bg-muted"      },
          { label: isArabic ? "عطلة"    : "Weekend",  color: "bg-muted/30 border border-border" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className={`w-[10px] h-[10px] rounded-[2px] inline-block flex-shrink-0 ${color}`} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

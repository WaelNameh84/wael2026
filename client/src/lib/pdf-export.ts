export interface PdfRecord {
  date: string;
  employee?: string;
  checkIn: string;
  checkOut: string;
  normalHours: string;
  overtime: string;
  status: string;
  lateMinutes?: number;
}

export interface PdfSummary {
  workingDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  lateDays?: number;
  totalHours: number;
  normalHours: number;
  overtime: number;
  expectedHours: number;
}

export interface PdfPayroll {
  baseSalary: number;
  overtimeBonus: number;
  latePenalty: number;
  unpaidLeaveDeduction: number;
  absentDeduction: number;
  totalDeductions: number;
  netSalary: number;
  dailyRate: number;
  hourlyRate: number;
  totalOvertimeHours: number;
  totalLateMinutes: number;
  period: string;
}

export interface PdfReportOptions {
  appName: string;
  appLogo?: string;
  isArabic: boolean;
  from: string;
  to: string;
  employeeName?: string;
  summary: PdfSummary;
  records: PdfRecord[];
  payroll?: PdfPayroll | null;
  payrollError?: string | null;
  isAdmin: boolean;
}

function fmt2(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtHours(h: number, isArabic: boolean) {
  if (h <= 0) return "—";
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  if (isArabic) return hh > 0 && mm > 0 ? `${hh}س ${mm}د` : hh > 0 ? `${hh}س` : `${mm}د`;
  return hh > 0 && mm > 0 ? `${hh}h ${mm}m` : hh > 0 ? `${hh}h` : `${mm}m`;
}

function statusLabel(status: string, isArabic: boolean) {
  const ar: Record<string, string> = {
    present: "حاضر", late: "متأخر", absent: "غائب", on_leave: "إجازة", early_leave: "خروج مبكر",
  };
  const en: Record<string, string> = {
    present: "Present", late: "Late", absent: "Absent", on_leave: "On Leave", early_leave: "Early Leave",
  };
  return isArabic ? (ar[status] ?? status) : (en[status] ?? status);
}

function statusColor(status: string) {
  if (status === "absent") return "#dc2626";
  if (status === "late" || status === "early_leave") return "#d97706";
  if (status === "on_leave") return "#2563eb";
  return "#16a34a";
}

function buildReportHTML(opts: PdfReportOptions): string {
  const { isArabic, appName, summary, records, payroll, payrollError, from, to, employeeName, appLogo } = opts;
  const dir = isArabic ? "rtl" : "ltr";
  const L = (ar: string, en: string) => isArabic ? ar : en;
  const align = isArabic ? "right" : "left";
  const alignOpp = isArabic ? "left" : "right";

  const logoHtml = appLogo
    ? `<img src="${appLogo}" style="width:48px;height:48px;object-fit:contain;border-radius:8px;" />`
    : `<div style="width:48px;height:48px;border-radius:8px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#fff;">${(appName || "A").charAt(0).toUpperCase()}</div>`;

  const kpiCards = [
    { label: L("أيام الحضور",  "Present Days"), value: summary.presentDays,                       color: "#16a34a" },
    { label: L("أيام الغياب",  "Absent Days"),  value: summary.absentDays,                        color: "#dc2626" },
    { label: L("ساعات العمل",  "Work Hours"),   value: fmtHours(summary.normalHours, isArabic),   color: "#4f46e5" },
    { label: L("ساعات إضافية", "Overtime"),     value: fmtHours(summary.overtime, isArabic),      color: "#d97706" },
  ].map(c => `
    <div style="flex:1;min-width:110px;background:#fff;border-radius:10px;padding:14px 10px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.1);border-top:3px solid ${c.color};">
      <div style="font-size:22px;font-weight:900;color:${c.color};margin-bottom:4px;">${c.value}</div>
      <div style="font-size:11px;color:#6b7280;">${c.label}</div>
    </div>
  `).join("");

  const summaryItems = [
    [L("من تاريخ","From"),                    from],
    [L("إلى تاريخ","To"),                      to],
    [L("أيام العمل المتوقعة","Working Days"),  summary.workingDays],
    [L("الساعات المتوقعة","Expected Hours"),    fmtHours(summary.expectedHours, isArabic)],
    [L("أيام الحضور","Present Days"),          summary.presentDays],
    [L("أيام الغياب","Absent Days"),           summary.absentDays],
    [L("أيام الإجازة","Leave Days"),           summary.leaveDays],
    [L("أيام التأخر","Late Days"),             summary.lateDays ?? 0],
    [L("صافي ساعات العمل","Net Work Hours"),   fmtHours(summary.normalHours, isArabic)],
    [L("ساعات الإضافي","Overtime Hours"),      fmtHours(summary.overtime, isArabic)],
  ];

  const summaryRows = summaryItems.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? "#f9fafb" : "#fff"};">
      <td style="padding:7px 14px;color:#6b7280;font-size:12px;">${r[0]}</td>
      <td style="padding:7px 14px;font-weight:700;font-size:12px;text-align:${alignOpp};">${r[1]}</td>
    </tr>`).join("");

  /* ── Payroll section ── */
  let payrollSection = "";
  if (payrollError) {
    payrollSection = `
      <div style="margin-top:24px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px 20px;">
        <div style="font-weight:700;color:#c2410c;font-size:13px;margin-bottom:4px;">
          ⚠️ ${L("تنبيه: قسم الراتب","Notice: Salary Section")}
        </div>
        <div style="font-size:12px;color:#92400e;">${payrollError}</div>
      </div>`;
  } else if (!payroll) {
    payrollSection = `
      <div style="margin-top:24px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px 20px;">
        <div style="font-size:12px;color:#0369a1;">
          ℹ️ ${L("لم يتم ربط بيانات الراتب بهذا التقرير. لعرض الراتب، اختر موظفاً محدداً وتأكد من إعداد راتبه.",
                  "Payroll data was not linked to this report. To include salary, select a specific employee with a configured salary.")}
        </div>
      </div>`;
  } else {
    const payRows: [string, string, string, string][] = [
      [L("الراتب الأساسي","Base Salary"),
       `${fmt2(payroll.dailyRate)} / ${L("يوم","day")} · ${fmt2(payroll.hourlyRate)} / ${L("ساعة","hr")}`,
       fmt2(payroll.baseSalary), "#111827"],
      [L("مكافأة الإضافي","Overtime Bonus"),
       `${payroll.totalOvertimeHours} ${L("ساعة","h")} × ${fmt2(payroll.hourlyRate)} × 1.5`,
       `+${fmt2(payroll.overtimeBonus)}`, "#16a34a"],
      [L("خصم التأخر","Late Penalty"),
       `${payroll.totalLateMinutes} ${L("دقيقة","min")}`,
       `−${fmt2(payroll.latePenalty)}`, "#dc2626"],
      [L("خصم الإجازة غير المدفوعة","Unpaid Leave Deduction"),
       "", `−${fmt2(payroll.unpaidLeaveDeduction)}`, "#dc2626"],
      [L("خصم الغياب","Absence Deduction"),
       "", `−${fmt2(payroll.absentDeduction ?? 0)}`, "#dc2626"],
    ];

    const payTableRows = payRows.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? "#f9fafb" : "#fff"};">
        <td style="padding:9px 14px;font-size:12px;font-weight:700;">${r[0]}</td>
        <td style="padding:9px 14px;font-size:11px;color:#6b7280;">${r[1]}</td>
        <td style="padding:9px 14px;font-size:13px;font-weight:800;color:${r[3]};text-align:${alignOpp};">${r[2]}</td>
      </tr>`).join("");

    const netBg  = payroll.netSalary >= payroll.baseSalary ? "#dcfce7" : "#fef3c7";
    const netClr = payroll.netSalary >= payroll.baseSalary ? "#16a34a" : "#d97706";

    payrollSection = `
      <div style="margin-top:24px;page-break-inside:avoid;">
        <div style="background:#4f46e5;color:#fff;padding:11px 16px;border-radius:10px 10px 0 0;font-weight:800;font-size:13px;display:flex;justify-content:space-between;align-items:center;">
          <span>💰 ${L("تفاصيل الراتب","Salary Breakdown")}</span>
          <span style="font-weight:500;font-size:11px;opacity:.85;">${payroll.period}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;background:#fff;">
          <thead>
            <tr style="background:#ede9fe;">
              <th style="padding:8px 14px;font-size:11px;color:#4f46e5;text-align:${align};font-weight:700;">${L("البند","Item")}</th>
              <th style="padding:8px 14px;font-size:11px;color:#4f46e5;text-align:${align};font-weight:700;">${L("التفاصيل","Details")}</th>
              <th style="padding:8px 14px;font-size:11px;color:#4f46e5;text-align:${alignOpp};font-weight:700;">${L("المبلغ","Amount")}</th>
            </tr>
          </thead>
          <tbody>${payTableRows}</tbody>
          <tfoot>
            <tr style="background:${netBg};">
              <td colspan="2" style="padding:12px 14px;font-size:14px;font-weight:900;">${L("✅ صافي الراتب","✅ Net Salary")}</td>
              <td style="padding:12px 14px;font-size:20px;font-weight:900;color:${netClr};text-align:${alignOpp};">${fmt2(payroll.netSalary)}</td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }

  /* ── Attendance table ── */
  const tableHeader = opts.isAdmin
    ? [L("التاريخ","Date"), L("الموظف","Employee"), L("دخول","In"), L("خروج","Out"), L("العمل","Work"), L("إضافي","OT"), L("الحالة","Status")]
    : [L("التاريخ","Date"), L("دخول","In"), L("خروج","Out"), L("العمل","Work"), L("إضافي","OT"), L("الحالة","Status")];

  const tableRows = records.map((r, i) => {
    const sc = statusColor(r.status);
    const cells = opts.isAdmin
      ? [r.date, r.employee ?? "—", r.checkIn, r.checkOut, r.normalHours, r.overtime,
         `<span style="color:${sc};font-weight:700;">${statusLabel(r.status, isArabic)}</span>`]
      : [r.date, r.checkIn, r.checkOut, r.normalHours, r.overtime,
         `<span style="color:${sc};font-weight:700;">${statusLabel(r.status, isArabic)}</span>`];
    return `<tr style="background:${i % 2 === 0 ? "#f9fafb" : "#fff"};">
      ${cells.map(c => `<td style="padding:6px 10px;font-size:11px;border-bottom:1px solid #f0f0f0;">${c}</td>`).join("")}
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="${isArabic ? "ar" : "en"}" dir="${dir}">
<head>
<meta charset="UTF-8" />
<title>${appName} — ${L("تقرير الحضور","Attendance Report")}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700;800;900&family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ${isArabic ? "'Noto Sans Arabic','Tahoma','Arial',sans-serif" : "'Inter','Arial',sans-serif"};
    background: #f3f4f6;
    color: #111827;
    direction: ${dir};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { max-width: 900px; margin: 0 auto; padding: 24px; }
  .no-print { display: block; }
  @media print {
    body { background: #fff; }
    .page { padding: 0; max-width: 100%; }
    .no-print { display: none !important; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
  }
  table { border-collapse: collapse; width: 100%; }
  th { font-weight: 700; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:12px;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;gap:16px;flex-wrap:wrap;">
    <div style="display:flex;align-items:center;gap:14px;">
      ${logoHtml}
      <div>
        <div style="font-size:20px;font-weight:900;">${appName}</div>
        <div style="font-size:11px;opacity:.8;margin-top:2px;">${L("تقرير الحضور والرواتب","Attendance &amp; Payroll Report")}</div>
      </div>
    </div>
    <div style="text-align:${alignOpp};">
      ${employeeName ? `<div style="font-size:15px;font-weight:800;margin-bottom:4px;">${employeeName}</div>` : ""}
      <div style="font-size:12px;opacity:.85;">${from} → ${to}</div>
      <div style="font-size:10px;opacity:.65;margin-top:3px;">${L("تاريخ الإصدار","Generated")}: ${new Date().toLocaleString()}</div>
    </div>
  </div>

  <!-- KPI Cards -->
  <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">${kpiCards}</div>

  <!-- Summary -->
  <div style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:20px;">
    <div style="background:#1e293b;color:#fff;padding:10px 16px;font-weight:800;font-size:13px;">
      📊 ${L("ملخص الفترة","Period Summary")}
    </div>
    <table>${summaryRows}</table>
  </div>

  <!-- Payroll -->
  ${payrollSection}

  <!-- Attendance Log -->
  <div style="margin-top:24px;">
    <div style="background:#111827;color:#fff;padding:11px 16px;border-radius:10px 10px 0 0;font-weight:800;font-size:13px;display:flex;justify-content:space-between;align-items:center;">
      <span>📋 ${L("سجل الحضور التفصيلي","Detailed Attendance Log")}</span>
      <span style="font-weight:400;font-size:11px;opacity:.7;">${records.length} ${L("سجل","records")}</span>
    </div>
    <div style="overflow:auto;background:#fff;border-radius:0 0 10px 10px;box-shadow:0 1px 3px rgba(0,0,0,.08);">
      <table>
        <thead>
          <tr style="background:#f3f4f6;">
            ${tableHeader.map(h => `<th style="padding:9px 10px;font-size:11px;text-align:${align};border-bottom:2px solid #e5e7eb;white-space:nowrap;">${h}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${tableRows || `<tr><td colspan="${tableHeader.length}" style="text-align:center;padding:20px;color:#9ca3af;font-size:12px;">${L("لا توجد سجلات","No records")}</td></tr>`}</tbody>
      </table>
    </div>
  </div>

  <!-- Footer -->
  <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;font-size:10px;color:#9ca3af;">
    <span>${appName} · ${L("نظام إدارة الحضور","Attendance Management System")}</span>
    <span>${L("سري — للاستخدام الداخلي فقط","Confidential — Internal Use Only")}</span>
  </div>

</div>
</body>
</html>`;
}

/* ─── Core: inject iframe + print (no popup blocker) ──────────────── */

function printViaIframe(html: string): void {
  // Remove any previous iframe
  const old = document.getElementById("__pdf_print_frame__");
  if (old) old.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "__pdf_print_frame__";
  iframe.style.cssText = "position:fixed;top:-10000px;left:-10000px;width:1px;height:1px;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for fonts & images to load before printing
  const doPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      /* ignore */
    }
    // Clean up after a delay (print dialog keeps a reference until closed)
    setTimeout(() => iframe.remove(), 60_000);
  };

  if (doc.readyState === "complete") {
    setTimeout(doPrint, 500);
  } else {
    iframe.onload = () => setTimeout(doPrint, 500);
  }
}

/* ─── Public API ──────────────────────────────────────────────────── */

/** Opens report in a new tab for review + manual save-as-PDF */
export function exportProfessionalPDF(opts: PdfReportOptions): void {
  const html = buildReportHTML(opts);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href   = url;
  a.target = "_blank";
  a.rel    = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Triggers the browser's print dialog (Save as PDF) — works on mobile, no popup blocker */
export function shareOrSavePDF(opts: PdfReportOptions): void {
  const html = buildReportHTML(opts);
  printViaIframe(html);
}

export function emailReport(subject: string, body: string): void {
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const a = document.createElement("a");
  a.href = mailto;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Legacy shims
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export async function sharePDF(_b: Blob, _f: string, _s: string): Promise<"shared" | "fallback"> {
  return "fallback";
}

import * as XLSX from "xlsx";

export interface ExportRecord {
  date: string;
  employee?: string;
  location?: string;
  checkIn: string;
  checkOut: string;
  normalHours: string;
  overtime: string;
  status: string;
}

export interface ExportSummary {
  from: string;
  to: string;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  totalHours: number;
  normalHours: number;
  overtime: number;
  expectedHours: number;
}

function buildFilename(from: string, to: string, ext: string) {
  return `attendance_report_${from}_to_${to}.${ext}`;
}

export function exportCSV(
  records: ExportRecord[],
  summary: ExportSummary,
  isAdmin: boolean,
  labels: {
    date: string; employee: string; location: string; checkIn: string; checkOut: string;
    normalHours: string; overtime: string; status: string;
    summaryTitle: string; from: string; to: string; workingDays: string;
    presentDays: string; absentDays: string; leaveDays: string; totalHours: string;
    normalHoursLabel: string; overtimeLabel: string; expectedHours: string;
  }
) {
  const header = isAdmin
    ? [labels.date, labels.employee, labels.location, labels.checkIn, labels.checkOut, labels.normalHours, labels.overtime, labels.status]
    : [labels.date, labels.location, labels.checkIn, labels.checkOut, labels.normalHours, labels.overtime, labels.status];

  const rows = records.map(r => isAdmin
    ? [r.date, r.employee ?? "", r.location ?? "", r.checkIn, r.checkOut, r.normalHours, r.overtime, r.status]
    : [r.date, r.location ?? "", r.checkIn, r.checkOut, r.normalHours, r.overtime, r.status]
  );

  const summaryRows = [
    [],
    [labels.summaryTitle],
    [labels.from, summary.from],
    [labels.to, summary.to],
    [labels.workingDays, summary.workingDays],
    [labels.presentDays, summary.presentDays],
    [labels.absentDays, summary.absentDays],
    [labels.leaveDays, summary.leaveDays],
    [labels.totalHours, summary.totalHours],
    [labels.normalHoursLabel, summary.normalHours],
    [labels.overtimeLabel, summary.overtime],
    [labels.expectedHours, summary.expectedHours],
  ];

  const allRows = [header, ...rows, ...summaryRows];
  const csv = allRows
    .map(row =>
      row.map(cell => {
        const s = String(cell ?? "");
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      }).join(",")
    )
    .join("\n");

  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, buildFilename(summary.from, summary.to, "csv"));
}

export function exportExcel(
  records: ExportRecord[],
  summary: ExportSummary,
  isAdmin: boolean,
  labels: {
    date: string; employee: string; location: string; checkIn: string; checkOut: string;
    normalHours: string; overtime: string; status: string;
    summaryTitle: string; from: string; to: string; workingDays: string;
    presentDays: string; absentDays: string; leaveDays: string; totalHours: string;
    normalHoursLabel: string; overtimeLabel: string; expectedHours: string;
    recordsSheet: string; summarySheet: string;
  }
) {
  const wb = XLSX.utils.book_new();

  const header = isAdmin
    ? [labels.date, labels.employee, labels.location, labels.checkIn, labels.checkOut, labels.normalHours, labels.overtime, labels.status]
    : [labels.date, labels.location, labels.checkIn, labels.checkOut, labels.normalHours, labels.overtime, labels.status];

  const rows = records.map(r => isAdmin
    ? [r.date, r.employee ?? "", r.location ?? "", r.checkIn, r.checkOut, r.normalHours, r.overtime, r.status]
    : [r.date, r.location ?? "", r.checkIn, r.checkOut, r.normalHours, r.overtime, r.status]
  );

  const recordsWs = XLSX.utils.aoa_to_sheet([header, ...rows]);
  XLSX.utils.book_append_sheet(wb, recordsWs, labels.recordsSheet);

  const summaryData = [
    [labels.summaryTitle],
    [],
    [labels.from, summary.from],
    [labels.to, summary.to],
    [labels.workingDays, summary.workingDays],
    [labels.presentDays, summary.presentDays],
    [labels.absentDays, summary.absentDays],
    [labels.leaveDays, summary.leaveDays],
    [labels.totalHours, summary.totalHours],
    [labels.normalHoursLabel, summary.normalHours],
    [labels.overtimeLabel, summary.overtime],
    [labels.expectedHours, summary.expectedHours],
  ];

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, labels.summarySheet);

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  triggerDownload(blob, buildFilename(summary.from, summary.to, "xlsx"));
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

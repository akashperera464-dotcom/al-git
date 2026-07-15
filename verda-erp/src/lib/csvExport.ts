/**
 * CSV Export Utility — one-click CSV download from any data array.
 * Works in browser (Blob + download attribute).
 */
export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const csv = [
    headers.join(","),
    ...rows.map(r => r.map(cell => {
      const s = String(cell ?? "");
      // Escape quotes and wrap in quotes if contains comma/quote/newline
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Helper: convert an array of objects to CSV. */
export function exportObjectsToCSV(filename: string, data: Record<string, unknown>[], columns?: { key: string; header: string }[]): void {
  if (data.length === 0) {
    exportToCSV(filename, ["No Data"], []);
    return;
  }
  const cols = columns ?? Object.keys(data[0]).map(k => ({ key: k, header: k }));
  const headers = cols.map(c => c.header);
  const rows = data.map(item => cols.map(c => item[c.key] as string | number ?? ""));
  exportToCSV(filename, headers, rows);
}

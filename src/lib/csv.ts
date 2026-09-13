/**
 * CSV building and download, shared by every export in the app.
 *
 * Column shapes match the production app's exports (`accExportCashBook` and
 * friends) so a file from either app opens the same way for the accountant.
 */

/** Quote a field only when it needs it, doubling any embedded quotes. */
export function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",") + "\n"
}

export function buildCsv(header: unknown[], rows: unknown[][]): string {
  return csvRow(header) + rows.map(csvRow).join("")
}

/** Money as a bare 2dp number — no `$`, no thousands separators, for a spreadsheet. */
export function csvAmount(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : value
  return (Number.isFinite(n) ? (n as number) : 0).toFixed(2)
}

/** Trigger a download of `content` as `filename`. Browser only. */
export function downloadCsv(content: string, filename: string): void {
  // A BOM so Excel reads the file as UTF-8; without it, names with accents or
  // the $ sign in some locales come through mangled.
  const blob = new Blob(["﻿", content], {
    type: "text/csv;charset=utf-8",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

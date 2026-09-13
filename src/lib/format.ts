/**
 * Formatting helpers.
 *
 * The business is Australian (Falaax Group Pty Ltd, Melbourne) and every
 * figure in the database is AUD, so the template's `en-US`/USD formatters are
 * wrong everywhere they appear. Dates from Supabase are ISO `YYYY-MM-DD`
 * strings, not timestamps — parsed as local, not UTC, so a date never shifts
 * by a day.
 */

const aud = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const audCompact = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
})

/** `$1,234.56`. Non-numeric input formats as `$0.00` rather than `NaN`. */
export function formatAud(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : value
  return aud.format(Number.isFinite(n) ? (n as number) : 0)
}

/** `$1,235` — for headline figures where cents are noise. */
export function formatAudCompact(
  value: number | string | null | undefined,
): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : value
  return audCompact.format(Number.isFinite(n) ? (n as number) : 0)
}

/**
 * A Supabase `date` column as a local Date.
 *
 * `new Date("2026-07-01")` parses as UTC midnight, which renders as 30 June in
 * Melbourne. Splitting the parts avoids that.
 */
export function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/** `1 Jul 2026`. Returns `—` for a missing or unparseable date. */
export function formatDate(iso: string | null | undefined): string {
  const date = parseIsoDate(iso)
  if (!date) return "—"
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

/** `Jul 2026`, from a `YYYY-MM` key. */
export function formatMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number)
  if (!y || !m) return key
  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1, 1))
}

/** The `YYYY-MM` a `YYYY-MM-DD` belongs to, or null if it isn't a date. */
export function monthKeyOf(iso: string | null | undefined): string | null {
  const key = String(iso ?? "").slice(0, 7)
  return /^\d{4}-\d{2}$/.test(key) ? key : null
}

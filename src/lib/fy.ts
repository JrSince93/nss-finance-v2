/**
 * Australian financial-year periods.
 *
 * Ported from `accPeriodRange` / `accFYOfDate` in the production app, which is
 * what the Accountant and Tax & BAS pages are scoped by. The FY runs 1 Jul to
 * 30 Jun, and its quarters are Q1 Jul-Sep, Q2 Oct-Dec, Q3 Jan-Mar, Q4 Apr-Jun.
 *
 * Deliberately unrelated to the participant-plan-anchored NDIS quarters used
 * for budget tracking (`buildNDISQuartersForPlan` in the production app). Those
 * start on a participant's own plan date; these start on 1 July. Don't merge
 * the two.
 *
 * Pure and client-safe — the period picker is a client component.
 */

import { melbourneToday } from "@/lib/pay-periods"

/** Quarters 1-4, or 0 for the whole financial year. */
export type Quarter = 0 | 1 | 2 | 3 | 4

export type Period = {
  /** The calendar year the FY starts in: FY2026-27 is `2026`. */
  fy: number
  quarter: Quarter
  /** Inclusive ISO bounds, `YYYY-MM-DD`. */
  start: string
  end: string
  label: string
  /** Filename-safe identifier, e.g. `FY2026-27_Q1`. */
  slug: string
}

export const QUARTER_OPTIONS: { value: Quarter; label: string }[] = [
  { value: 1, label: "Q1 — Jul to Sep" },
  { value: 2, label: "Q2 — Oct to Dec" },
  { value: 3, label: "Q3 — Jan to Mar" },
  { value: 4, label: "Q4 — Apr to Jun" },
  { value: 0, label: "Full year" },
]

/** The FY a date falls in. July onwards belongs to the FY starting that year. */
export function fyOfDate(date: Date): number {
  return date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1
}

/** The FY an ISO `YYYY-MM-DD` falls in. */
export function fyOfIso(iso: string | null | undefined): number | null {
  if (!iso) return null
  const [y, m] = iso.slice(0, 10).split("-").map(Number)
  if (!y || !m) return null
  return m >= 7 ? y : y - 1
}

export function fyLabel(fy: number): string {
  return `FY${fy}-${String((fy + 1) % 100).padStart(2, "0")}`
}

function iso(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** `[startYear, startMonthIndex, endYear, endMonthIndex]` per quarter. */
const SPANS: Record<Quarter, [number, number, number, number]> = {
  1: [0, 6, 0, 8],
  2: [0, 9, 0, 11],
  3: [1, 0, 1, 2],
  4: [1, 3, 1, 5],
  0: [0, 6, 1, 5],
}

export function periodFor(fy: number, quarter: Quarter): Period {
  const [sOff, sMonth, eOff, eMonth] = SPANS[quarter] ?? SPANS[0]
  const startYear = fy + sOff
  const endYear = fy + eOff
  // Day 0 of the following month is the last day of this one.
  const lastDay = new Date(endYear, eMonth + 1, 0).getDate()

  return {
    fy,
    quarter,
    start: iso(startYear, sMonth, 1),
    end: iso(endYear, eMonth, lastDay),
    label: `${quarter ? `Q${quarter}` : "Full year"} ${fyLabel(fy)}`,
    slug: `${fyLabel(fy)}_${quarter ? `Q${quarter}` : "FullYear"}`,
  }
}

/** FY quarter by calendar month index: Jan-Mar Q3, Jul-Sep Q1, and so on. */
const QUARTER_BY_MONTH = [3, 3, 3, 4, 4, 4, 1, 1, 1, 2, 2, 2] as const

/** The FY quarter a calendar month falls in: Jan-Mar Q3, Jul-Sep Q1, and so on. */
export function quarterOfDate(date: Date): Quarter {
  return QUARTER_BY_MONTH[date.getMonth()]
}

/**
 * The period containing today in Melbourne — the default when nothing is
 * selected.
 *
 * Deliberately not the host's local date. The server runs in UTC, ten or eleven
 * hours behind Melbourne, so for the first hours of 1 Jan, 1 Apr, 1 Jul and
 * 1 Oct its own month is still the previous quarter's — and on 1 July, the
 * previous financial year.
 */
export function currentPeriod(now: Date = new Date()): Period {
  const today = melbourneToday(now)
  const [year, month] = today.split("-").map(Number)
  return periodFor(month >= 7 ? year : year - 1, QUARTER_BY_MONTH[month - 1])
}

/**
 * The financial year containing today in Melbourne.
 *
 * Use this rather than `fyOfDate(new Date())`, which reads the host's local
 * date: on the UTC server that is still 30 June until 10am on 1 July in
 * Melbourne, so it names the previous financial year.
 */
export function currentFy(now: Date = new Date()): number {
  return currentPeriod(now).fy
}

/** Inclusive ISO range test. Safe on null and on empty strings. */
export function isInPeriod(
  isoDate: string | null | undefined,
  period: Period,
): boolean {
  if (!isoDate) return false
  const d = isoDate.slice(0, 10)
  return d >= period.start && d <= period.end
}

/** Calendar months the period spans, oldest first. */
export function monthsInPeriod(period: Period): string[] {
  const out: string[] = []
  const last = period.end.slice(0, 7)
  const cursor = new Date(
    Number(period.start.slice(0, 4)),
    Number(period.start.slice(5, 7)) - 1,
    1,
  )

  for (;;) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
    out.push(key)
    if (key >= last) break
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return out
}

/**
 * Resolve a period from URL search params, falling back to the current one.
 *
 * Anything unparseable falls back rather than throwing — these come straight
 * from the query string, so a hand-edited URL must not 500 the page.
 */
export function periodFromParams(params: {
  fy?: string | string[]
  q?: string | string[]
}): Period {
  const fallback = currentPeriod()
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v

  const fy = Number.parseInt(first(params.fy) ?? "", 10)
  const q = Number.parseInt(first(params.q) ?? "", 10)

  return periodFor(
    Number.isFinite(fy) && fy >= 2000 && fy <= 2100 ? fy : fallback.fy,
    (q >= 0 && q <= 4 ? q : fallback.quarter) as Quarter,
  )
}

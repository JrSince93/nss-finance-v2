/**
 * Fortnightly pay periods.
 *
 * Ported from `getPayPeriodForDate` / `getPayPeriodStartEnd` in the production
 * app: fourteen-day periods running Monday to Sunday, counted from an anchor
 * Monday of 6 January 2025. The bank payment files are scoped by these, so the
 * boundaries must land on exactly the same days as the production app's
 * calendar — otherwise the two apps would disagree about which pay runs a file
 * for "this fortnight" contains.
 *
 * The arithmetic is done in whole days on `YYYY-MM-DD` strings rather than by
 * subtracting local `Date` objects, as the production app does. Subtracting
 * local midnights happens to floor to whole days in Melbourne because both
 * daylight-saving shifts fall the harmless way relative to a January anchor;
 * counting calendar days doesn't depend on the timezone at all.
 *
 * Pure and client-safe.
 */

/** Period 0 starts on this Monday. Verbatim from the production app. */
export const PAY_PERIOD_ANCHOR = "2025-01-06"

/**
 * Period indexes accepted from outside, either side of the anchor. Twenty years
 * of fortnights — only here so a Server Action can reject nonsense input.
 */
export const MAX_PERIOD_INDEX = 26 * 20

const DAY_MS = 86_400_000
const PERIOD_DAYS = 14

export type PayPeriod = {
  /** 0 is the fortnight starting on the anchor; negative is before it. */
  index: number
  /** Monday, inclusive. `YYYY-MM-DD`. */
  start: string
  /** Sunday, inclusive. `YYYY-MM-DD`. */
  end: string
}

/** Whole days since the Unix epoch for a `YYYY-MM-DD` date. */
function toDayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number)
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS)
}

function fromDayNumber(dayNumber: number): string {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10)
}

const ANCHOR_DAY = toDayNumber(PAY_PERIOD_ANCHOR)

/** The index of the pay period a `YYYY-MM-DD` date falls in. */
export function payPeriodIndexForDate(isoDate: string): number {
  return Math.floor((toDayNumber(isoDate) - ANCHOR_DAY) / PERIOD_DAYS)
}

export function payPeriodAt(index: number): PayPeriod {
  const startDay = ANCHOR_DAY + index * PERIOD_DAYS
  return {
    index,
    start: fromDayNumber(startDay),
    end: fromDayNumber(startDay + PERIOD_DAYS - 1),
  }
}

/** The `count` most recent periods, newest first, starting with today's. */
export function recentPayPeriods(today: string, count: number): PayPeriod[] {
  const current = payPeriodIndexForDate(today)
  return Array.from({ length: Math.max(0, count) }, (_, offset) =>
    payPeriodAt(current - offset),
  )
}

/**
 * The fortnight that most recently finished — the one being paid next, and the
 * production app's default (`getPayPeriodForDate(today) - 1`).
 */
export function lastCompletedPayPeriod(today: string): PayPeriod {
  return payPeriodAt(payPeriodIndexForDate(today) - 1)
}

/**
 * Today's date in Melbourne, as `YYYY-MM-DD`.
 *
 * The server runs in UTC, ten or eleven hours behind Melbourne, so on a Monday
 * morning its own date is still Sunday — which is the previous pay period.
 * Working the date out once, in the business's timezone, on the server, and
 * passing the string down also keeps the server and client renders identical.
 */
export function melbourneToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

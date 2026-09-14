/**
 * Checks on the pure logic behind the period-scoped pages: FY quarters, the
 * payroll classification the Expenses/Accountant split depends on, and the
 * aggregations. Run with tsx; nothing here touches Supabase.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  fyOfDate,
  fyOfIso,
  fyLabel,
  periodFor,
  currentPeriod,
  currentFy,
  quarterOfDate,
  isInPeriod,
  monthsInPeriod,
  periodFromParams,
} from "@/lib/fy"
import {
  isPayroll,
  isExpense,
  isTrackableExpense,
  cleanDescription,
  type TransactionRow,
} from "@/lib/data/types"
import {
  monthlyTotals,
  expensesByDescription,
  withOtherBucket,
  payrollTotals,
  payRunDate,
  gstEstimate,
} from "@/lib/data/reporting"
import { parseIsoDate, monthKeyOf } from "@/lib/format"
import { melbourneToday } from "@/lib/pay-periods"

const tx = (over: Partial<TransactionRow>): TransactionRow => ({
  id: "x",
  date: "2026-07-01",
  month: "July",
  description: null,
  payment_type: "EFT",
  reference: null,
  amount_in: null,
  amount_out: null,
  allocated_to: null,
  participant_id: null,
  note: null,
  attachment_path: null,
  ...over,
})

test("FY boundary: July starts the new FY, June ends the old one", () => {
  assert.equal(fyOfDate(new Date(2026, 5, 30)), 2025) // 30 Jun 2026
  assert.equal(fyOfDate(new Date(2026, 6, 1)), 2026) // 1 Jul 2026
  assert.equal(fyOfIso("2026-06-30"), 2025)
  assert.equal(fyOfIso("2026-07-01"), 2026)
  assert.equal(fyLabel(2026), "FY2026-27")
  assert.equal(fyLabel(2099), "FY2099-00")
})

test("quarter ranges are inclusive and cover the FY with no gap or overlap", () => {
  assert.deepEqual(
    [periodFor(2026, 1).start, periodFor(2026, 1).end],
    ["2026-07-01", "2026-09-30"],
  )
  assert.deepEqual(
    [periodFor(2026, 2).start, periodFor(2026, 2).end],
    ["2026-10-01", "2026-12-31"],
  )
  assert.deepEqual(
    [periodFor(2026, 3).start, periodFor(2026, 3).end],
    ["2027-01-01", "2027-03-31"],
  )
  assert.deepEqual(
    [periodFor(2026, 4).start, periodFor(2026, 4).end],
    ["2027-04-01", "2027-06-30"],
  )
  assert.deepEqual(
    [periodFor(2026, 0).start, periodFor(2026, 0).end],
    ["2026-07-01", "2027-06-30"],
  )

  // Each quarter's end is the day before the next quarter's start.
  for (const q of [1, 2, 3] as const) {
    const end = new Date(periodFor(2026, q).end)
    const nextStart = new Date(periodFor(2026, (q + 1) as 2 | 3 | 4).start)
    assert.equal(nextStart.getTime() - end.getTime(), 86_400_000)
  }
})

test("February end date respects leap years", () => {
  assert.equal(periodFor(2023, 3).end, "2024-03-31")
  // Q3 spans Jan-Mar, so pick up Feb via monthsInPeriod instead.
  assert.deepEqual(monthsInPeriod(periodFor(2023, 3)), [
    "2024-01",
    "2024-02",
    "2024-03",
  ])
})

test("quarterOfDate maps calendar months to FY quarters", () => {
  assert.equal(quarterOfDate(new Date(2026, 0, 15)), 3) // Jan
  assert.equal(quarterOfDate(new Date(2026, 3, 15)), 4) // Apr
  assert.equal(quarterOfDate(new Date(2026, 6, 15)), 1) // Jul
  assert.equal(quarterOfDate(new Date(2026, 9, 15)), 2) // Oct
})

test("currentPeriod uses Melbourne's date, not the host's", () => {
  // The server runs in UTC. Pinned instants keep this independent of the
  // timezone of whichever machine runs the suite.

  // 30 Jun 23:30 in Melbourne (AEST, UTC+10): still the old quarter and FY.
  assert.equal(currentPeriod(new Date("2026-06-30T13:30:00Z")).label, "Q4 FY2025-26")
  // 1 Jul 01:30 in Melbourne, still 30 Jun in UTC. Reading the host's local
  // date put this in Q4 FY2025-26 on the server.
  assert.equal(currentPeriod(new Date("2026-06-30T15:30:00Z")).label, "Q1 FY2026-27")
  // 1 Jan 00:30 in Melbourne during summer time (AEDT, UTC+11).
  assert.equal(currentPeriod(new Date("2025-12-31T13:30:00Z")).label, "Q3 FY2025-26")

  // Unpinned, the default contains today's Melbourne date.
  const period = currentPeriod()
  const today = melbourneToday()
  assert.ok(isInPeriod(today, period), `${today} not in ${period.label}`)
})

test("currentFy uses Melbourne's date, not the host's", () => {
  // Only the 1 July rollover can move the FY; the other quarter boundaries
  // fall mid-year. Pinned instants keep this independent of the host timezone.

  // 30 Jun 23:30 in Melbourne (AEST, UTC+10): still FY2025-26.
  assert.equal(currentFy(new Date("2026-06-30T13:30:00Z")), 2025)
  // 1 Jul 01:30 in Melbourne, still 30 Jun in UTC. `fyOfDate(new Date())` on
  // the UTC server returned 2025 here.
  assert.equal(currentFy(new Date("2026-06-30T15:30:00Z")), 2026)
  // 1 Jul 09:59:59 in Melbourne: the last second UTC is still in June, so the
  // far edge of the window a host-local `getMonth() >= 6` got wrong.
  assert.equal(currentFy(new Date("2026-06-30T23:59:59Z")), 2026)
  // 1 Jan 00:30 in Melbourne during summer time (AEDT, UTC+11): the calendar
  // year ticks over but the FY must not.
  assert.equal(currentFy(new Date("2025-12-31T13:30:00Z")), 2025)
})

test("isInPeriod is inclusive at both ends and false for null", () => {
  const p = periodFor(2026, 1)
  assert.equal(isInPeriod("2026-07-01", p), true)
  assert.equal(isInPeriod("2026-09-30", p), true)
  assert.equal(isInPeriod("2026-06-30", p), false)
  assert.equal(isInPeriod("2026-10-01", p), false)
  assert.equal(isInPeriod(null, p), false)
  assert.equal(isInPeriod("", p), false)
})

test("monthsInPeriod covers a full year in order", () => {
  const months = monthsInPeriod(periodFor(2026, 0))
  assert.equal(months.length, 12)
  assert.equal(months[0], "2026-07")
  assert.equal(months[11], "2027-06")
})

test("periodFromParams falls back instead of throwing on junk", () => {
  const fallback = currentPeriod()
  assert.equal(periodFromParams({}).slug, fallback.slug)
  assert.equal(periodFromParams({ fy: "abc", q: "9" }).slug, fallback.slug)
  assert.equal(periodFromParams({ fy: "1066", q: "1" }).fy, fallback.fy)
  assert.equal(periodFromParams({ fy: "2026", q: "0" }).slug, "FY2026-27_FullYear")
  // Array form, as Next hands over a repeated query param.
  assert.equal(periodFromParams({ fy: ["2026"], q: ["2"] }).slug, "FY2026-27_Q2")
})

test("payroll detection matches both routes, case-insensitively", () => {
  assert.equal(isPayroll(tx({ reference: "PAYROLL-1a2b3c4d" })), true)
  assert.equal(isPayroll(tx({ reference: "payroll-pending-1a2b3c4d" })), true)
  assert.equal(isPayroll(tx({ description: "Payroll - Jane Doe" })), true)
  assert.equal(isPayroll(tx({ description: "PAYROLL - JANE DOE" })), true)
  // Must not catch unrelated rows.
  assert.equal(isPayroll(tx({ description: "Payroll software subscription" })), false)
  assert.equal(isPayroll(tx({ reference: "PAY-015" })), false)
  assert.equal(isPayroll(tx({})), false)
})

test("trackable expenses exclude payroll and income", () => {
  const rent = tx({ description: "Rent", amount_out: 500 })
  const wages = tx({ description: "Payroll - Jane Doe", amount_out: 900 })
  const income = tx({ description: "NDIS Payment", amount_in: 2000 })

  assert.equal(isExpense(rent), true)
  assert.equal(isTrackableExpense(rent), true)
  assert.equal(isTrackableExpense(wages), false)
  assert.equal(isTrackableExpense(income), false)
})

test("descriptions group across inline status tags", () => {
  assert.equal(cleanDescription(tx({ description: "Rent [recurring]" })), "Rent")
  assert.equal(cleanDescription(tx({ description: "Rent [pending]" })), "Rent")
  assert.equal(cleanDescription(tx({ description: "  " })), "(no description)")
  assert.equal(cleanDescription(tx({ description: null })), "(no description)")
})

test("monthly totals bucket by date and compute net", () => {
  const rows = monthlyTotals([
    tx({ date: "2026-07-05", amount_in: 1000 }),
    tx({ date: "2026-07-20", amount_out: 250 }),
    tx({ date: "2026-08-01", amount_out: 100 }),
    tx({ date: null, amount_in: 99_999 }), // undated rows are skipped
  ])

  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], {
    month: "2026-07",
    moneyIn: 1000,
    moneyOut: 250,
    net: 750,
  })
  assert.equal(rows[1].net, -100)
})

test("expenses group by description, payroll excluded, largest first", () => {
  const rows = expensesByDescription([
    tx({ description: "Rent", amount_out: 500 }),
    tx({ description: "Rent [recurring]", amount_out: 500 }),
    tx({ description: "Phone", amount_out: 80 }),
    tx({ description: "Payroll - Jane", amount_out: 5000 }),
  ])

  assert.deepEqual(rows, [
    { label: "Rent", amount: 1000, count: 2 },
    { label: "Phone", amount: 80, count: 1 },
  ])
})

test("withOtherBucket folds the tail and preserves the total", () => {
  const rows = [
    { label: "a", amount: 10, count: 1 },
    { label: "b", amount: 5, count: 1 },
    { label: "c", amount: 3, count: 1 },
    { label: "d", amount: 2, count: 1 },
  ]
  const folded = withOtherBucket(rows, 2)

  assert.equal(folded.length, 3)
  assert.equal(folded[2].label, "Other (2)")
  assert.equal(folded[2].amount, 5)
  assert.equal(
    folded.reduce((s, r) => s + r.amount, 0),
    rows.reduce((s, r) => s + r.amount, 0),
  )
  // Under the limit, nothing changes.
  assert.deepEqual(withOtherBucket(rows, 10), rows)
})

test("pay run anchors on paid_date, falling back to period_end", () => {
  assert.equal(
    payRunDate({ paid_date: "2026-07-10", period_end: "2026-07-05" } as never),
    "2026-07-10",
  )
  assert.equal(
    payRunDate({ paid_date: null, period_end: "2026-07-05" } as never),
    "2026-07-05",
  )
  assert.equal(payRunDate({ paid_date: null, period_end: null } as never), null)
})

test("payroll totals coerce numeric strings and nulls", () => {
  const totals = payrollTotals([
    {
      gross_pay: "1000" as never,
      tax_withheld: 200,
      super_amount: null,
      net_pay: 800,
    } as never,
    {
      gross_pay: 500,
      tax_withheld: null,
      super_amount: 60,
      net_pay: 440,
    } as never,
  ])

  assert.deepEqual(totals, {
    gross: 1500,
    tax: 200,
    super: 60,
    net: 1240,
    runs: 2,
  })
})

test("GST estimate is one eleventh", () => {
  assert.equal(gstEstimate(1100), 100)
  assert.equal(gstEstimate(0), 0)
})

test("ISO dates parse as local, not UTC", () => {
  const d = parseIsoDate("2026-07-01")!
  assert.equal(d.getFullYear(), 2026)
  assert.equal(d.getMonth(), 6)
  assert.equal(d.getDate(), 1) // would be 30 June if parsed as UTC in AEST
  assert.equal(parseIsoDate(null), null)
  assert.equal(parseIsoDate("nonsense"), null)
})

test("monthKeyOf rejects non-dates", () => {
  assert.equal(monthKeyOf("2026-07-01"), "2026-07")
  assert.equal(monthKeyOf(null), null)
  assert.equal(monthKeyOf("garbage"), null)
})

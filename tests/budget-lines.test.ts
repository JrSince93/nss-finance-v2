/**
 * Budget line reading, against the shape `collectBudgetLines()` in the
 * production app actually writes.
 *
 * These exist because the first version of this code guessed the field names
 * (label/type/funding/start/end — none of which exist) and every line rendered
 * as "Budget line — $0.00". The fixtures below are built from the real writer,
 * so a future rename has to break a test.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  isActiveLine,
  budgetLineLabel,
  budgetLineTypeLabel,
  budgetLineManagementLabel,
  budgetLineFunding,
  budgetLinesOf,
  activeBudgetLines,
  totalFunding,
  planWindow,
  fundingSchedule,
  scheduleTotal,
  labelDuplicatesType,
} from "@/lib/data/budget-lines"
import type { BudgetLine, ParticipantRow } from "@/lib/data/types"

/** Shaped exactly as collectBudgetLines() writes a line. */
function line(over: Partial<BudgetLine> = {}): BudgetLine {
  return {
    id: "bl-0",
    name: "Core Flexible",
    management: "plan",
    bill_to: { name: "", email: "" },
    rate_card: "core",
    rates: [{ code: "01_011_0107_1_1", desc: "Weekday", day_type: "weekday", rate: 70.23 }],
    travel: { enabled: true, km: 14, labour_min: 10, km_rate: 0.99, days: [1, 2] },
    funding_amount: 50000,
    plan_start: "2026-02-01",
    plan_end: "2027-02-01",
    funding_schedule: [],
    funding_opening_balance_override: null,
    active: true,
    ...over,
  } as BudgetLine
}

function participant(lines: BudgetLine[] | null): ParticipantRow {
  return {
    id: "p1",
    name: "Lita Lee McKenzie",
    ndis_number: "430926284",
    dob: null,
    phone: null,
    address: null,
    weekly_hours: null,
    notes: null,
    active: true,
    archived_at: null,
    assigned_workers: null,
    budget_lines: lines,
  }
}

// ── The bug this fixes ──────────────────────────────────────────────────────

test("REGRESSION: a real line renders its name and funding, not a placeholder", () => {
  const bl = line({ name: "SIL Stated", rate_card: "sil", funding_amount: 207947.82 })

  assert.equal(budgetLineLabel(bl), "SIL Stated")
  assert.notEqual(budgetLineLabel(bl), "Budget line")
  assert.equal(budgetLineFunding(bl), 207947.82)
  assert.notEqual(budgetLineFunding(bl), 0)
})

test("REGRESSION: the old guessed field names produce nothing useful", () => {
  // If someone reintroduces label/type/funding/start/end, these stay unread.
  const wrong = {
    label: "SIL Stated",
    type: "sil",
    funding: 207947.82,
    start: "2026-02-01",
    end: "2027-02-01",
  } as unknown as BudgetLine

  assert.equal(budgetLineFunding(wrong), 0)
  assert.equal(budgetLineLabel(wrong), "Budget line")
})

// ── Field reading ───────────────────────────────────────────────────────────

test("rate cards map to the production app's labels", () => {
  assert.equal(budgetLineTypeLabel(line({ rate_card: "core" })), "Core (0107)")
  assert.equal(
    budgetLineTypeLabel(line({ rate_card: "core_combined" })),
    "Core-CP/ASC (0125/0107)",
  )
  assert.equal(budgetLineTypeLabel(line({ rate_card: "sil" })), "SIL (0138)")
  assert.equal(
    budgetLineTypeLabel(line({ rate_card: "employment" })),
    "Employment (0102)",
  )
  assert.equal(
    budgetLineTypeLabel(line({ rate_card: "community" })),
    "Community (0125)",
  )
  // Unknown card falls back to the raw value rather than vanishing.
  assert.equal(budgetLineTypeLabel(line({ rate_card: "weird" })), "weird")
  assert.equal(budgetLineTypeLabel(line({ rate_card: undefined })), "Budget line")
})

test("management modes map to readable labels", () => {
  assert.equal(budgetLineManagementLabel(line({ management: "agency" })), "Agency-managed")
  assert.equal(budgetLineManagementLabel(line({ management: "plan" })), "Plan-managed")
  assert.equal(budgetLineManagementLabel(line({ management: "self" })), "Self-managed")
  assert.equal(budgetLineManagementLabel(line({ management: undefined })), null)
})

test("funding_amount is read as a number even when stored as a string", () => {
  assert.equal(budgetLineFunding(line({ funding_amount: "1234.56" })), 1234.56)
  assert.equal(budgetLineFunding(line({ funding_amount: null })), 0)
  assert.equal(budgetLineFunding(line({ funding_amount: undefined })), 0)
  assert.equal(budgetLineFunding(line({ funding_amount: "not a number" })), 0)
})

test("labelDuplicatesType catches the doubled-up case", () => {
  // "CORE-CP/ASC" + "Core-CP/ASC (0125/0107)" would read doubled-up.
  assert.equal(
    labelDuplicatesType(line({ name: "CORE-CP/ASC", rate_card: "core_combined" })),
    true,
  )
  assert.equal(
    labelDuplicatesType(line({ name: "Lita SIL", rate_card: "sil" })),
    false,
  )
})

// ── active is opt-out ───────────────────────────────────────────────────────

test("REGRESSION: a line with no `active` field is active", () => {
  // Testing truthiness would drop every legacy line that predates the field.
  const legacy = { id: "bl-legacy", name: "Core Flexible" } as BudgetLine
  assert.equal(isActiveLine(legacy), true)
  assert.equal(isActiveLine(line({ active: undefined })), true)
  assert.equal(isActiveLine(line({ active: true })), true)
  assert.equal(isActiveLine(line({ active: false })), false)
})

test("totals and filters count active lines only; the list keeps all", () => {
  const pt = participant([
    line({ id: "a", funding_amount: 10000 }),
    line({ id: "b", funding_amount: 5000, active: false }),
    line({ id: "c", funding_amount: 2500 }),
  ])

  assert.equal(budgetLinesOf(pt).length, 3, "the full list keeps inactive lines")
  assert.equal(activeBudgetLines(pt).length, 2)
  assert.equal(totalFunding(pt), 12500, "inactive funding must not be counted")
})

test("a participant with no budget_lines degrades to empty, not a throw", () => {
  assert.deepEqual(budgetLinesOf(participant(null)), [])
  assert.equal(totalFunding(participant(null)), 0)
  assert.deepEqual(planWindow(participant(null)), { start: null, end: null })
  // JSONB could hold anything; a non-array must not crash the page.
  const junk = { ...participant(null), budget_lines: "oops" } as unknown as ParticipantRow
  assert.deepEqual(budgetLinesOf(junk), [])
})

test("plan window spans the earliest start and latest end of active lines", () => {
  const pt = participant([
    line({ id: "a", plan_start: "2026-02-01", plan_end: "2027-02-01" }),
    line({ id: "b", plan_start: "2026-07-02", plan_end: "2028-03-05" }),
    // Inactive line with a wider window must not stretch it.
    line({ id: "c", plan_start: "2020-01-01", plan_end: "2030-01-01", active: false }),
  ])

  assert.deepEqual(planWindow(pt), { start: "2026-02-01", end: "2028-03-05" })
})

// ── Funding schedule ────────────────────────────────────────────────────────

test("funding schedule rows are filtered, sorted and summed", () => {
  const bl = line({
    funding_amount: 30000,
    funding_schedule: [
      { start: "2026-08-17", end: "2026-09-16", amount: 10000 },
      { start: "2026-07-17", end: "2026-08-16", amount: 20000 },
      // Incomplete rows are dropped rather than counted as zero.
      { start: "2026-09-17", end: "", amount: 999 },
      { start: "2026-10-17", end: "2026-11-16" },
    ],
  })

  const rows = fundingSchedule(bl)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].start, "2026-07-17", "oldest first")
  assert.equal(scheduleTotal(bl), 30000)
})

test("scheduleTotal is null when a line has no schedule", () => {
  assert.equal(scheduleTotal(line({ funding_schedule: [] })), null)
  assert.equal(scheduleTotal(line({ funding_schedule: undefined })), null)
})

test("funding_amount stays authoritative when the schedule disagrees", () => {
  // The production app warns on exactly this; it does not recompute the total.
  const bl = line({
    funding_amount: 207947.82,
    funding_schedule: [{ start: "2026-07-17", end: "2026-08-16", amount: 1000 }],
  })

  assert.equal(budgetLineFunding(bl), 207947.82)
  assert.equal(scheduleTotal(bl), 1000)
})

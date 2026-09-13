import type { BudgetLine, ParticipantRow } from "@/lib/data/types"

/**
 * Reading `participants.budget_lines`.
 *
 * It is a JSONB array written by the production app's `collectBudgetLines()`,
 * with no database-level shape guarantee: fields are optional, `funding_amount`
 * turns up as both a number and a numeric string, and rows written by
 * `migrateLegacyPlan` carry a different subset again. Everything here degrades
 * to a sensible default rather than throwing, because one malformed line must
 * not blank the whole page.
 *
 * Two things to know before changing any of this:
 *
 *   * **`active` is opt-out.** A line is active unless it explicitly carries
 *     `active: false`. A missing field means active, so never test truthiness.
 *   * **`funding_amount` is the total, even for schedule-funded lines.**
 *     `funding_schedule` is a breakdown of it — the production app raises a
 *     warning when the rows don't sum to `funding_amount`, which only makes
 *     sense if the latter is authoritative.
 */

/**
 * Rate card → display label, from `BL_CARD_LABELS` in the production app.
 *
 * The item-code suffixes are part of the label there and are kept: an operator
 * reading "Core (0107)" against "Community (0125)" is reading the NDIS
 * registration group, which is how they tell the lines apart.
 */
const RATE_CARD_LABELS: Record<string, string> = {
  core: "Core (0107)",
  core_combined: "Core-CP/ASC (0125/0107)",
  sil: "SIL (0138)",
  employment: "Employment (0102)",
  community: "Community (0125)",
  custom: "Custom",
}

/** `management` → display label. Stored as `agency` | `plan` | `self`. */
const MANAGEMENT_LABELS: Record<string, string> = {
  agency: "Agency-managed",
  plan: "Plan-managed",
  self: "Self-managed",
}

/** A line is active unless it explicitly says otherwise. */
export function isActiveLine(line: BudgetLine): boolean {
  return line.active !== false
}

export function budgetLineTypeLabel(line: BudgetLine): string {
  const card = (line.rate_card ?? "").toLowerCase()
  return RATE_CARD_LABELS[card] ?? (line.rate_card || "Budget line")
}

export function budgetLineManagementLabel(line: BudgetLine): string | null {
  const mode = (line.management ?? "").toLowerCase()
  if (!mode) return null
  return MANAGEMENT_LABELS[mode] ?? line.management ?? null
}

/**
 * A line's display name, falling back to its rate card.
 *
 * The production app's invoice picker dedupes these when the card label already
 * starts with the line's own name, so "CORE-CP/ASC" + "Core-CP/ASC (0125/0107)"
 * doesn't read doubled-up. Same rule here.
 */
export function budgetLineLabel(line: BudgetLine): string {
  const name = line.name?.trim()
  if (!name) return budgetLineTypeLabel(line)
  return name
}

/** True when the name and the rate-card label would read as a duplicate. */
export function labelDuplicatesType(line: BudgetLine): boolean {
  const name = line.name?.trim().toLowerCase()
  if (!name) return true
  return budgetLineTypeLabel(line).toLowerCase().startsWith(name)
}

/** A line's total funding as a number. Handles the numeric-string rows. */
export function budgetLineFunding(line: BudgetLine): number {
  const raw = line.funding_amount
  const value = typeof raw === "string" ? Number.parseFloat(raw) : raw
  return Number.isFinite(value) ? (value as number) : 0
}

/** The usable rows of a line's monthly funding schedule, oldest first. */
export function fundingSchedule(
  line: BudgetLine,
): { start: string; end: string; amount: number }[] {
  const rows = Array.isArray(line.funding_schedule) ? line.funding_schedule : []

  return rows
    .filter(
      (row): row is { start: string; end: string; amount: number } =>
        Boolean(row?.start && row?.end) && Number.isFinite(Number(row?.amount)),
    )
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start))
}

/**
 * What the schedule rows actually sum to, or null when there are none.
 *
 * Worth surfacing next to `funding_amount`: when they disagree, one of them is
 * wrong, and the production app shows a warning for exactly that case.
 */
export function scheduleTotal(line: BudgetLine): number | null {
  const rows = fundingSchedule(line)
  if (rows.length === 0) return null
  return rows.reduce((sum, row) => sum + Number(row.amount), 0)
}

/** Every line on a participant, active or not, always an array. */
export function budgetLinesOf(participant: ParticipantRow): BudgetLine[] {
  return Array.isArray(participant.budget_lines) ? participant.budget_lines : []
}

/** Only the active lines — what funding totals and filters should use. */
export function activeBudgetLines(participant: ParticipantRow): BudgetLine[] {
  return budgetLinesOf(participant).filter(isActiveLine)
}

/**
 * Total funding across a participant's **active** budget lines.
 *
 * Inactive lines are excluded: they are lines the operator has switched off,
 * and counting their funding would overstate the plan.
 */
export function totalFunding(participant: ParticipantRow): number {
  return activeBudgetLines(participant).reduce(
    (sum, line) => sum + budgetLineFunding(line),
    0,
  )
}

/**
 * The participant's plan window: the earliest line start and latest line end,
 * across active lines.
 *
 * Returns nulls when no line carries dates, which is common on older rows.
 */
export function planWindow(participant: ParticipantRow): {
  start: string | null
  end: string | null
} {
  const lines = activeBudgetLines(participant)
  const starts = lines
    .map((l) => l.plan_start)
    .filter((d): d is string => Boolean(d))
  const ends = lines
    .map((l) => l.plan_end)
    .filter((d): d is string => Boolean(d))

  return {
    start: starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : null,
    end: ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : null,
  }
}

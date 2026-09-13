import type { BudgetLine, ParticipantRow } from "@/lib/data/types"

/**
 * Reading `participants.budget_lines`.
 *
 * It is a JSONB array written by the production app, with no database-level
 * shape guarantee: fields are optional, `funding` turns up as both a number and
 * a numeric string, and older rows predate the multi-line model entirely.
 * Everything here degrades to a sensible default rather than throwing, because
 * one malformed line must not blank the whole Participants page.
 */

/** Labels for the budget line types the production app's rate cards define. */
const TYPE_LABELS: Record<string, string> = {
  core: "Core",
  sil: "SIL",
  community: "Community",
  employment: "Employment",
  custom: "Custom",
}

export function budgetLineTypeLabel(line: BudgetLine): string {
  const type = (line.type ?? "").toLowerCase()
  return TYPE_LABELS[type] ?? (line.type ? line.type : "Budget line")
}

/** A line's display name, falling back to its type. */
export function budgetLineLabel(line: BudgetLine): string {
  return line.label?.trim() || budgetLineTypeLabel(line)
}

/** A line's funding as a number. Handles the numeric-string rows. */
export function budgetLineFunding(line: BudgetLine): number {
  const value =
    typeof line.funding === "string"
      ? Number.parseFloat(line.funding)
      : line.funding
  return Number.isFinite(value) ? (value as number) : 0
}

/** The lines on a participant, always an array. */
export function budgetLinesOf(participant: ParticipantRow): BudgetLine[] {
  return Array.isArray(participant.budget_lines) ? participant.budget_lines : []
}

/** Total funding across a participant's budget lines. */
export function totalFunding(participant: ParticipantRow): number {
  return budgetLinesOf(participant).reduce(
    (sum, line) => sum + budgetLineFunding(line),
    0,
  )
}

/**
 * The participant's plan window: the earliest line start and latest line end.
 *
 * Returns nulls when no line carries dates, which is common on older rows.
 */
export function planWindow(participant: ParticipantRow): {
  start: string | null
  end: string | null
} {
  const lines = budgetLinesOf(participant)
  const starts = lines.map((l) => l.start).filter((d): d is string => Boolean(d))
  const ends = lines.map((l) => l.end).filter((d): d is string => Boolean(d))

  return {
    start: starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : null,
    end: ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : null,
  }
}

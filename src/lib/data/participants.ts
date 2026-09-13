import { formatDate } from "@/lib/format"
import { stripInvisibles, stripToNull } from "@/lib/text"
import type { ParticipantRow } from "@/lib/data/types"

/**
 * Pure participant helpers.
 *
 * Kept out of `queries.ts` so client components can use them — that file is
 * `server-only` and pulls in `next/headers`.
 */

/** A participant is archived when `archived_at` carries a timestamp. */
export function isArchived(participant: ParticipantRow): boolean {
  return Boolean(participant.archived_at)
}

/**
 * Split participants into the active roster and the archived list.
 *
 * Both come from the same query — archived participants must stay reachable so
 * they can be listed and restored, so the split happens here rather than in the
 * `where` clause.
 */
export function partitionByArchived(participants: ParticipantRow[]): {
  active: ParticipantRow[]
  archived: ParticipantRow[]
} {
  const active: ParticipantRow[] = []
  const archived: ParticipantRow[] = []

  for (const participant of participants) {
    if (isArchived(participant)) archived.push(participant)
    else active.push(participant)
  }

  return { active, archived }
}

/**
 * "Archived 12 Sep 2026", or null when the participant is active.
 *
 * `archived_at` is a timestamptz, not a date column, so it is sliced to its
 * date part before formatting — `formatDate` parses `YYYY-MM-DD` as local, and
 * handing it a full ISO timestamp would make it parse as UTC and shift a day
 * backwards in Melbourne.
 */
export function archivedLabel(participant: ParticipantRow): string | null {
  if (!participant.archived_at) return null
  return `Archived ${formatDate(participant.archived_at.slice(0, 10))}`
}

export function participantName(participant: ParticipantRow): string {
  return participant.name?.trim() || "Unnamed participant"
}

// ── Detail form ─────────────────────────────────────────────────────────────

/**
 * The participant fields this app edits.
 *
 * **Deliberately excludes `budget_lines` and `ndis_plan`.** Both are JSONB
 * carrying the plan's funding, rate cards and quarter overrides, and both feed
 * invoice generation. Sending either in an update would overwrite the whole
 * structure with whatever this form happened to know — so they are not in the
 * payload at all, which leaves them untouched. Editing them belongs with the
 * invoicing work, where the maths can be tested alongside.
 *
 * `active` is excluded for the same reason it is on the employee form: the
 * production app hardcodes `active: true` on save, so editing a phone number
 * silently reactivates the record.
 */
export type ParticipantFormValues = {
  name: string
  ndis_number: string | null
  dob: string | null
  phone: string | null
  address: string | null
  weekly_hours: number | null
  notes: string | null
  assigned_workers: string[]
}

export type ParticipantFieldErrors = Partial<
  Record<keyof ParticipantFormValues, string>
>

export type ParticipantParseResult =
  | {
      ok: true
      values: ParticipantFormValues
      cleanedFields: string[]
    }
  | { ok: false; errors: ParticipantFieldErrors }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function readField(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === "string" ? value : ""
}

/**
 * Parse and validate the participant detail form.
 *
 * Every free-text field goes through `stripInvisibles` — NDIS numbers pasted
 * out of a plan PDF routinely carry zero-width spaces, and an NDIS number that
 * looks right but doesn't match is the kind of thing that surfaces as a
 * rejected claim weeks later.
 */
export function parseParticipantForm(form: FormData): ParticipantParseResult {
  const errors: ParticipantFieldErrors = {}
  const cleanedFields: string[] = []

  const text = (name: string, label: string) => {
    const raw = readField(form, name)
    const clean = stripInvisibles(raw)
    if (clean !== raw.trim()) cleanedFields.push(label)
    return clean
  }

  const name = text("name", "Name")
  if (!name) errors.name = "A name is required."

  const dob = stripInvisibles(readField(form, "dob")) || null
  if (dob && !ISO_DATE.test(dob)) errors.dob = "Enter a valid date."

  const hoursText = stripInvisibles(readField(form, "weekly_hours"))
  let weeklyHours: number | null = null
  if (hoursText) {
    const parsed = Number.parseFloat(hoursText)
    if (!Number.isFinite(parsed) || parsed < 0) {
      errors.weekly_hours = "Enter a number of hours, or leave blank."
    } else {
      weeklyHours = Math.round(parsed * 100) / 100
    }
  }

  // Checkbox group: one entry per ticked employee.
  const assignedWorkers = form
    .getAll("assigned_workers")
    .filter((v): v is string => typeof v === "string" && v.length > 0)

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    cleanedFields,
    values: {
      name,
      ndis_number: stripToNull(text("ndis_number", "NDIS number")),
      dob,
      phone: stripToNull(text("phone", "Phone")),
      address: stripToNull(text("address", "Address")),
      weekly_hours: weeklyHours,
      notes: stripToNull(text("notes", "Notes")),
      assigned_workers: assignedWorkers,
    },
  }
}

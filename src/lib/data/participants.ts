import { formatDate } from "@/lib/format"
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

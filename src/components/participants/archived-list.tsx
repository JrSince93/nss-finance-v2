"use client"

import { formatAud } from "@/lib/format"
import { archivedLabel, participantName } from "@/lib/data/participants"
import { totalFunding } from "@/lib/data/budget-lines"
import type { ParticipantRow } from "@/lib/data/types"
import { ArchiveButton } from "@/components/participants/archive-button"

/**
 * The archived participants, collapsed below the active roster.
 *
 * Dimmed and compact on purpose — this is history, not the working list, and
 * the only action on it is restoring. Matches the production app's treatment.
 */
export function ArchivedList({
  participants,
  canWrite,
}: {
  participants: ParticipantRow[]
  canWrite: boolean
}) {
  if (participants.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Archived ({participants.length})
      </h2>

      <ul className="flex flex-col gap-2">
        {participants.map((participant) => {
          const name = participantName(participant)

          return (
            <li
              key={participant.id}
              className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-3 opacity-70 ring-1 ring-foreground/10 transition-opacity hover:opacity-100"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {archivedLabel(participant)}
                  {" · "}
                  {formatAud(totalFunding(participant))} plan funding
                  {participant.ndis_number
                    ? ` · ${participant.ndis_number}`
                    : ""}
                </p>
              </div>

              {canWrite && (
                <ArchiveButton id={participant.id} name={name} archived />
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

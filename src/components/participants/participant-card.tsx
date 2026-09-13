"use client"

import { CalendarIcon, ClockIcon, IdCardIcon } from "lucide-react"
import { motion } from "motion/react"

import { formatAud, formatDate } from "@/lib/format"
import {
  budgetLineFunding,
  budgetLineLabel,
  budgetLinesOf,
  planWindow,
  totalFunding,
} from "@/lib/data/budget-lines"
import { participantName } from "@/lib/data/participants"
import type { ParticipantRow } from "@/lib/data/types"
import { ArchiveButton } from "@/components/participants/archive-button"
import { Badge } from "@/components/ui/badge"

/**
 * One participant.
 *
 * The template card showed an institution logo, a balance and a period change —
 * a bank account. A participant has none of those. What it does have is an NDIS
 * number, a plan window, and one or more funded budget lines, so those are the
 * card.
 */
export function ParticipantCard({
  participant,
  index,
  canWrite,
}: {
  participant: ParticipantRow
  index: number
  /** Whether this role may archive. Server-checked too — this only hides UI. */
  canWrite: boolean
}) {
  const lines = budgetLinesOf(participant)
  const plan = planWindow(participant)
  const funding = totalFunding(participant)
  const name = participantName(participant)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 10) * 0.05 }}
      className="flex flex-col overflow-hidden rounded-xl bg-card p-4 ring-1 ring-foreground/10"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="mt-0.5 flex items-center gap-1 font-mono text-xs text-muted-foreground">
            <IdCardIcon className="size-3 shrink-0" />
            {participant.ndis_number || "No NDIS number"}
          </p>
        </div>
        {participant.active === false && (
          <Badge variant="outline" className="shrink-0">
            Inactive
          </Badge>
        )}
      </div>

      <p className="mt-3 tabular-nums text-xl font-bold tracking-tight">
        {formatAud(funding)}
      </p>
      <p className="text-xs text-muted-foreground">
        Plan funding across {lines.length} budget line
        {lines.length === 1 ? "" : "s"}
      </p>

      {lines.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 border-t pt-3">
          {lines.map((line, i) => (
            <li
              key={line.id ?? `${budgetLineLabel(line)}-${i}`}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate">{budgetLineLabel(line)}</span>
                {line.management && (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {line.management}
                  </Badge>
                )}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatAud(budgetLineFunding(line))}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        {(plan.start || plan.end) && (
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="size-3 shrink-0" />
            {formatDate(plan.start)} – {formatDate(plan.end)}
          </span>
        )}
        {participant.weekly_hours ? (
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="size-3 shrink-0" />
            {Number(participant.weekly_hours).toLocaleString("en-AU")} hrs/week
          </span>
        ) : null}

        {canWrite && (
          <span className="ml-auto">
            <ArchiveButton
              id={participant.id}
              name={name}
              archived={false}
            />
          </span>
        )}
      </div>
    </motion.div>
  )
}

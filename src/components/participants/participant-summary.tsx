import { LayersIcon, UsersIcon, WalletIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatAud } from "@/lib/format"
import { budgetLinesOf, totalFunding } from "@/lib/data/budget-lines"
import type { ParticipantRow } from "@/lib/data/types"

/**
 * Participants, budget lines and total plan funding.
 *
 * Replaces the template's Total Balance / Total Change / Linked Accounts, none
 * of which have an equivalent: a participant has no balance and no period
 * change, and plan funding is a total, not a running figure.
 */
export function ParticipantSummary({
  participants,
}: {
  participants: ParticipantRow[]
}) {
  const funding = participants.reduce(
    (sum, participant) => sum + totalFunding(participant),
    0,
  )
  const lineCount = participants.reduce(
    (sum, participant) => sum + budgetLinesOf(participant).length,
    0,
  )

  const cards = [
    {
      label: "Plan funding",
      value: formatAud(funding),
      icon: WalletIcon,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Participants",
      value: participants.length.toLocaleString("en-AU"),
      icon: UsersIcon,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Budget lines",
      value: lineCount.toLocaleString("en-AU"),
      icon: LayersIcon,
      color: "text-muted-foreground",
      bg: "bg-muted",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
        >
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full",
              card.bg,
            )}
          >
            <card.icon className={cn("size-4", card.color)} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="truncate tabular-nums text-base font-semibold tracking-tight">
              {card.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

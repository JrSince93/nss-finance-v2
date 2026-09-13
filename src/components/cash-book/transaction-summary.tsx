import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  HashIcon,
  ScaleIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { formatAud } from "@/lib/format"
import type { TransactionRow } from "@/lib/data/types"

interface TransactionSummaryProps {
  transactions: TransactionRow[]
}

/**
 * Money in, money out and the net for the rows currently in view.
 *
 * The template's fourth card was "Largest", derived from a single signed
 * amount. The cash book keeps money in and money out in separate columns, so
 * net is the figure that actually needs stating — and it's what reconciles
 * against the bank.
 */
export function TransactionSummary({ transactions }: TransactionSummaryProps) {
  const totalIn = transactions.reduce((sum, t) => sum + (t.amount_in ?? 0), 0)
  const totalOut = transactions.reduce((sum, t) => sum + (t.amount_out ?? 0), 0)
  const net = totalIn - totalOut

  const cards = [
    {
      label: "Money in",
      value: formatAud(totalIn),
      icon: ArrowDownLeftIcon,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Money out",
      value: formatAud(totalOut),
      icon: ArrowUpRightIcon,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
    },
    {
      label: "Net",
      value: formatAud(net),
      icon: ScaleIcon,
      color: net < 0 ? "text-rose-500" : "text-primary",
      bg: net < 0 ? "bg-rose-500/10" : "bg-primary/10",
    },
    {
      label: "Entries",
      value: transactions.length.toLocaleString("en-AU"),
      icon: HashIcon,
      color: "text-muted-foreground",
      bg: "bg-muted",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

import {
  BanknoteIcon,
  LandmarkIcon,
  PiggyBankIcon,
  WalletIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { formatAud } from "@/lib/format"
import type { PayRunRow } from "@/lib/data/types"

/**
 * The four figures that define a pay run.
 *
 * These replace the template's Sent / Received / Scheduled cards, which
 * described a peer-to-peer transfer. A pay run is gross pay, less PAYG
 * withheld, plus employer superannuation, netting to what is actually
 * transferred.
 *
 * The totals are role-dependent by design: an office manager's set omits the
 * two payroll-restricted employees' runs because RLS never returns them, so
 * their totals are legitimately lower than an admin's.
 */
export function PayrollStats({ payRuns }: { payRuns: PayRunRow[] }) {
  const sum = (field: keyof PayRunRow) =>
    payRuns.reduce((total, run) => total + (Number(run[field]) || 0), 0)

  const cards = [
    {
      label: "Gross",
      value: formatAud(sum("gross_pay")),
      icon: BanknoteIcon,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "PAYG withheld",
      value: formatAud(sum("tax_withheld")),
      icon: LandmarkIcon,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
    },
    {
      label: "Super",
      value: formatAud(sum("super_amount")),
      icon: PiggyBankIcon,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      label: "Net paid",
      value: formatAud(sum("net_pay")),
      icon: WalletIcon,
      color: "text-primary",
      bg: "bg-primary/10",
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

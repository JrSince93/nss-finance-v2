import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  FileClockIcon,
  ScaleIcon,
  UsersIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { formatAud } from "@/lib/format"
import type { DashboardData } from "@/lib/data/dashboard"

/**
 * The five figures the production app's dashboard leads with.
 *
 * Replaces the template's wallet-balance and account cards. There is no
 * account-balance table in this schema and no cards at all, so those widgets
 * had nothing to read — money in, money out, net, headcount and outstanding
 * invoices are what the business actually tracks.
 */
export function KpiCards({ data }: { data: DashboardData }) {
  const cards = [
    {
      label: "Money in",
      value: formatAud(data.moneyIn),
      icon: ArrowDownLeftIcon,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Money out",
      value: formatAud(data.moneyOut),
      icon: ArrowUpRightIcon,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
    },
    {
      label: "Net",
      value: formatAud(data.net),
      icon: ScaleIcon,
      color: data.net < 0 ? "text-rose-500" : "text-primary",
      bg: data.net < 0 ? "bg-rose-500/10" : "bg-primary/10",
    },
    {
      label: "Active employees",
      value: data.activeEmployees.toLocaleString("en-AU"),
      icon: UsersIcon,
      color: "text-muted-foreground",
      bg: "bg-muted",
    },
    {
      label: "Invoices outstanding",
      value: formatAud(data.invoicesOutstanding),
      icon: FileClockIcon,
      color:
        data.invoicesOutstanding > 0 ? "text-amber-500" : "text-emerald-500",
      bg: data.invoicesOutstanding > 0 ? "bg-amber-500/10" : "bg-emerald-500/10",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
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

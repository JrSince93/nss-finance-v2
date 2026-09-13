"use client"

import { AnimatePresence, motion } from "motion/react"

import { cn } from "@/lib/utils"
import { formatAud, formatDate } from "@/lib/format"
import type { PayRunRow } from "@/lib/data/types"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"

/** Initials for the avatar circle — there are no employee photos in the schema. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

function WiseStatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case "paid":
    case "outgoing_payment_sent":
      return <Badge variant="default">Paid</Badge>
    case "pending":
      return (
        <Badge variant="outline" className="text-amber-500 dark:text-amber-400">
          Pending transfer
        </Badge>
      )
    case null:
    case undefined:
      return <Badge variant="outline">Unknown</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export function PayRunList({ payRuns }: { payRuns: PayRunRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <div className="divide-y">
        <AnimatePresence mode="popLayout" initial={false}>
          {payRuns.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                variant="transfers"
                title="No pay runs"
                description="Nothing matches the current filter."
                className="py-10"
              />
            </motion.div>
          )}

          {payRuns.map((run, i) => {
            // `employee_name` is denormalised onto the pay run precisely so this
            // renders for the accountant role, which cannot read `employees`.
            const name = run.employee_name?.trim() || "Unknown employee"

            return (
              <motion.div
                key={run.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{
                  duration: 0.2,
                  delay: Math.min(i, 10) * 0.03,
                  layout: { duration: 0.2 },
                }}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {initials(name) || "?"}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(run.period_start)} – {formatDate(run.period_end)}
                    {run.hours_worked
                      ? ` · ${Number(run.hours_worked).toLocaleString("en-AU")} hrs`
                      : ""}
                  </p>
                </div>

                <dl className="hidden shrink-0 gap-4 text-right md:flex">
                  <Figure label="Gross" value={run.gross_pay} />
                  <Figure label="PAYG" value={run.tax_withheld} />
                  <Figure label="Super" value={run.super_amount} />
                </dl>

                <div className="shrink-0 text-right">
                  <p className="tabular-nums text-sm font-semibold">
                    {formatAud(run.net_pay)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {run.paid_date ? formatDate(run.paid_date) : "Not yet paid"}
                  </p>
                </div>

                <div className="hidden shrink-0 sm:block">
                  <WiseStatusBadge status={run.wise_status} />
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Figure({
  label,
  value,
}: {
  label: string
  value: number | null
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("tabular-nums text-xs font-medium")}>
        {formatAud(value)}
      </dd>
    </div>
  )
}

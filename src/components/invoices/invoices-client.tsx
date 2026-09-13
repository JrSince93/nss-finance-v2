"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { formatAud, formatDate } from "@/lib/format"
import type { InvoiceRow } from "@/lib/data/types"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/empty-state"

/**
 * The NDIS invoice ledger.
 *
 * Participant names come from `invoice_ledger.participant_name`, which is
 * denormalised at insert. That is deliberate and load-bearing: the accountant
 * role can read this table but has no access to `participants` at all, so a
 * join would blank every name for them.
 *
 * Read-only. Invoice generation — PDF line items per budget line and rate card,
 * and the NDIA myplace bulk-payment CSV — stays in the production app.
 */

function statusLabel(status: string | null): string {
  switch (status) {
    case "awaiting_payment":
      return "Awaiting payment"
    case "paid":
      return "Paid"
    case "partial":
      return "Part paid"
    default:
      return status || "Unknown"
  }
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "paid") return <Badge variant="default">Paid</Badge>
  if (status === "partial")
    return (
      <Badge variant="outline" className="text-amber-500 dark:text-amber-400">
        Part paid
      </Badge>
    )
  return <Badge variant="outline">{statusLabel(status)}</Badge>
}

type TabKey = "all" | "outstanding" | "paid"

const tabs: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "outstanding", label: "Outstanding" },
  { key: "paid", label: "Paid" },
]

export function InvoicesClient({ invoices }: { invoices: InvoiceRow[] }) {
  const [activeTab, setActiveTab] = useState<TabKey>("all")

  const filtered = useMemo(() => {
    if (activeTab === "paid") return invoices.filter((i) => i.status === "paid")
    if (activeTab === "outstanding")
      return invoices.filter((i) => i.status !== "paid")
    return invoices
  }, [activeTab, invoices])

  const totals = useMemo(() => {
    const invoiced = filtered.reduce((sum, i) => sum + (i.amount ?? 0), 0)
    const received = filtered.reduce(
      (sum, i) => sum + (i.payment_amount ?? 0),
      0,
    )
    return { invoiced, received, outstanding: invoiced - received }
  }, [filtered])

  const stats = [
    { label: "Invoiced", value: formatAud(totals.invoiced), tone: "" },
    {
      label: "Received",
      value: formatAud(totals.received),
      tone: "text-emerald-500",
    },
    {
      label: "Outstanding",
      value: formatAud(totals.outstanding),
      tone: totals.outstanding > 0 ? "text-amber-500" : "",
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-card p-3 ring-1 ring-foreground/10"
          >
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p
              className={cn(
                "truncate tabular-nums text-base font-semibold tracking-tight",
                stat.tone,
              )}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Participant</TableHead>
                <TableHead className="hidden md:table-cell">
                  Invoice date
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  Service period
                </TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      variant="transactions"
                      title="No invoices"
                      description={
                        invoices.length === 0
                          ? "The invoice ledger is empty for your role."
                          : "Nothing matches this filter."
                      }
                      className="py-12"
                    />
                  </TableCell>
                </TableRow>
              )}

              {filtered.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <span className="font-mono text-xs">
                      {invoice.invoice_ref || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="truncate text-sm">
                      {invoice.participant_name || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(invoice.invoice_date)}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {invoice.period_start || invoice.period_end
                        ? `${formatDate(invoice.period_start)} – ${formatDate(invoice.period_end)}`
                        : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="tabular-nums text-sm font-semibold">
                      {formatAud(invoice.amount)}
                    </span>
                    {invoice.status === "partial" && (
                      <span className="block text-[10px] tabular-nums text-muted-foreground">
                        {formatAud(invoice.payment_amount)} received
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <StatusBadge status={invoice.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

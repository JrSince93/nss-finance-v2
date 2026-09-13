"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import type { PayRunRow } from "@/lib/data/types"
import { PayrollStats } from "@/components/payroll/payroll-stats"
import { PayRunList } from "@/components/payroll/pay-run-list"

/**
 * Payroll.
 *
 * The template's Sent / Received / Scheduled tabs described transfers between
 * people. Pay runs have a real lifecycle instead: they are written with
 * `wise_status: 'pending'` and advance to paid when the outgoing Wise transfer
 * settles, so the tabs follow that.
 *
 * Read-only. Creating pay runs involves SCHADS sleepover rules, PAYG tax
 * tables and superannuation, which live in the production app and are out of
 * scope here — so the template's QuickSend was removed rather than rewired to
 * a write it cannot correctly perform.
 */
type TabKey = "all" | "pending" | "paid"

const tabs: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending transfer" },
  { key: "paid", label: "Paid" },
]

function isPaid(run: PayRunRow): boolean {
  return run.wise_status !== "pending"
}

export function PayrollClient({ payRuns }: { payRuns: PayRunRow[] }) {
  const [activeTab, setActiveTab] = useState<TabKey>("all")

  const filtered = useMemo(() => {
    if (activeTab === "all") return payRuns
    if (activeTab === "paid") return payRuns.filter(isPaid)
    return payRuns.filter((run) => !isPaid(run))
  }, [activeTab, payRuns])

  return (
    <div className="flex flex-col gap-4">
      {/* Totals follow the filter, so a tab's figures match its list. */}
      <PayrollStats payRuns={filtered} />

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

      <PayRunList payRuns={filtered} />
    </div>
  )
}

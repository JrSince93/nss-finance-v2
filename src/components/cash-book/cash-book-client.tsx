"use client"

import { useMemo, useState } from "react"

import { buildCsv, csvAmount, downloadCsv } from "@/lib/csv"
import type { TransactionRow } from "@/lib/data/types"
import type { ReferenceRow } from "@/lib/data/references"
import { ReferenceGuide } from "@/components/cash-book/reference-guide"
import { TransactionSummary } from "@/components/cash-book/transaction-summary"
import {
  TransactionFilters,
  type DirectionFilter,
} from "@/components/cash-book/transaction-filters"
import { TransactionTable } from "@/components/cash-book/transaction-table"
import { TransactionActions } from "@/components/cash-book/transaction-actions"

/**
 * The Cash Book page's interactive shell.
 *
 * Rows arrive already filtered by RLS — an office manager's set has the
 * restricted employees' payroll rows missing before it reaches the browser.
 * Nothing here re-filters by role.
 */
export function CashBookClient({
  transactions,
  referenceRows,
}: {
  transactions: TransactionRow[]
  referenceRows: ReferenceRow[]
}) {
  const [search, setSearch] = useState("")
  const [direction, setDirection] = useState<DirectionFilter>("all")
  const [paymentType, setPaymentType] = useState("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const paymentTypes = useMemo(
    () =>
      Array.from(
        new Set(
          transactions
            .map((t) => t.payment_type)
            .filter((t): t is string => Boolean(t)),
        ),
      ).sort(),
    [transactions],
  )

  const filtered = useMemo(() => {
    let rows = transactions

    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (t) =>
          (t.description ?? "").toLowerCase().includes(q) ||
          (t.reference ?? "").toLowerCase().includes(q),
      )
    }

    if (direction === "in") rows = rows.filter((t) => (t.amount_in ?? 0) > 0)
    if (direction === "out") rows = rows.filter((t) => (t.amount_out ?? 0) > 0)

    if (paymentType !== "all") {
      rows = rows.filter((t) => t.payment_type === paymentType)
    }

    // Newest first for reading, while the query orders oldest-first so running
    // balances elsewhere stay chronological.
    return [...rows].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
  }, [transactions, search, direction, paymentType])

  function handleExport() {
    const selected = filtered.filter((t) => selectedIds.has(t.id))
    const csv = buildCsv(
      ["Date", "Description", "Type", "Reference", "Amount In", "Amount Out"],
      selected.map((t) => [
        t.date ?? "",
        t.description ?? "",
        t.payment_type ?? "",
        t.reference ?? "",
        csvAmount(t.amount_in),
        csvAmount(t.amount_out),
      ]),
    )
    downloadCsv(csv, "cash-book.csv")
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Cash Book</h1>
        <ReferenceGuide rows={referenceRows} />
      </div>

      <TransactionSummary transactions={filtered} />

      <TransactionFilters
        search={search}
        setSearch={setSearch}
        direction={direction}
        setDirection={setDirection}
        paymentType={paymentType}
        setPaymentType={setPaymentType}
        paymentTypes={paymentTypes}
      />

      <TransactionTable
        transactions={filtered}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        expandedId={expandedId}
        setExpandedId={setExpandedId}
      />

      <TransactionActions
        selectedCount={selectedIds.size}
        onExport={handleExport}
        onClear={() => setSelectedIds(new Set())}
      />
    </div>
  )
}

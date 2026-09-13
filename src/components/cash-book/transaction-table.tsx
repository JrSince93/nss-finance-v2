"use client"

import { AnimatePresence, motion } from "motion/react"
import {
  PaperclipIcon,
  StickyNoteIcon,
  UserIcon,
  BuildingIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { formatAud, formatDate } from "@/lib/format"
import { isPayroll, type TransactionRow } from "@/lib/data/types"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface TransactionTableProps {
  transactions: TransactionRow[]
  selectedIds: Set<string>
  setSelectedIds: (ids: Set<string>) => void
  expandedId: string | null
  setExpandedId: (id: string | null) => void
}

const COLUMN_COUNT = 6

export function TransactionTable({
  transactions,
  selectedIds,
  setSelectedIds,
  expandedId,
  setExpandedId,
}: TransactionTableProps) {
  const allSelected =
    transactions.length > 0 && transactions.every((t) => selectedIds.has(t.id))
  const someSelected =
    transactions.some((t) => selectedIds.has(t.id)) && !allSelected

  function toggleAll() {
    setSelectedIds(
      allSelected ? new Set() : new Set(transactions.map((t) => t.id)),
    )
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected
                  }}
                  onChange={toggleAll}
                  aria-label="Select all transactions"
                  className="size-4 cursor-pointer rounded accent-primary"
                />
              </TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="hidden sm:table-cell">Reference</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="text-right">In</TableHead>
              <TableHead className="text-right">Out</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT}>
                  <EmptyState
                    variant="transactions"
                    title="No cash book entries"
                    description="Nothing matches the current filters."
                    className="py-12"
                  />
                </TableCell>
              </TableRow>
            )}

            {transactions.map((tx) => (
              <CashBookRow
                key={tx.id}
                tx={tx}
                isSelected={selectedIds.has(tx.id)}
                isExpanded={expandedId === tx.id}
                onToggleSelect={() => toggleOne(tx.id)}
                onToggleExpand={() =>
                  setExpandedId(expandedId === tx.id ? null : tx.id)
                }
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function CashBookRow({
  tx,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
}: {
  tx: TransactionRow
  isSelected: boolean
  isExpanded: boolean
  onToggleSelect: () => void
  onToggleExpand: () => void
}) {
  const amountIn = tx.amount_in ?? 0
  const amountOut = tx.amount_out ?? 0
  const payroll = isPayroll(tx)
  // A payroll row sits in the cash book at 0/0 until the Wise transfer settles
  // and the production app reconciles it. Worth showing as pending rather than
  // as a real zero-dollar movement.
  const pending = payroll && amountIn === 0 && amountOut === 0
  const hasDetail = Boolean(tx.note || tx.attachment_path || tx.allocated_to)

  return (
    <>
      <TableRow
        className={cn(
          "group",
          hasDetail && "cursor-pointer",
          isSelected && "bg-muted/50",
          isExpanded && "border-b-0",
        )}
        onClick={hasDetail ? onToggleExpand : undefined}
      >
        <TableCell className="pl-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${tx.description ?? "transaction"}`}
            className="size-4 cursor-pointer rounded accent-primary"
          />
        </TableCell>

        <TableCell>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">
              {tx.description || "(no description)"}
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {payroll && (
                <Badge variant="secondary" className="text-[10px]">
                  Payroll
                </Badge>
              )}
              {pending && (
                <Badge
                  variant="outline"
                  className="text-[10px] text-amber-500 dark:text-amber-400"
                >
                  Awaiting transfer
                </Badge>
              )}
              {tx.payment_type && (
                <span className="text-[10px] text-muted-foreground">
                  {tx.payment_type}
                </span>
              )}
            </div>
          </div>
        </TableCell>

        <TableCell className="hidden sm:table-cell">
          <span className="font-mono text-xs text-muted-foreground">
            {tx.reference || "—"}
          </span>
        </TableCell>

        <TableCell className="hidden md:table-cell">
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {formatDate(tx.date)}
          </span>
        </TableCell>

        <TableCell className="text-right">
          <span
            className={cn(
              "tabular-nums text-sm",
              amountIn > 0
                ? "font-semibold text-emerald-500"
                : "text-muted-foreground",
            )}
          >
            {amountIn > 0 ? formatAud(amountIn) : "—"}
          </span>
        </TableCell>

        <TableCell className="text-right">
          <span
            className={cn(
              "tabular-nums text-sm",
              amountOut > 0 ? "font-semibold" : "text-muted-foreground",
            )}
          >
            {amountOut > 0 ? formatAud(amountOut) : "—"}
          </span>
        </TableCell>
      </TableRow>

      <AnimatePresence initial={false}>
        {isExpanded && hasDetail && (
          <tr>
            <td colSpan={COLUMN_COUNT} className="p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-4 border-b bg-muted/30 px-4 py-3 pl-12 text-sm">
                  {tx.allocated_to === "participant" && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <UserIcon className="size-3.5 shrink-0" />
                      <span>Allocated to a participant</span>
                    </div>
                  )}
                  {tx.allocated_to === "company" && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <BuildingIcon className="size-3.5 shrink-0" />
                      <span>Allocated to the company</span>
                    </div>
                  )}
                  {tx.note && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <StickyNoteIcon className="mt-0.5 size-3.5 shrink-0" />
                      <span>{tx.note}</span>
                    </div>
                  )}
                  {tx.attachment_path && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <PaperclipIcon className="size-3.5 shrink-0" />
                      <span>Receipt attached</span>
                    </div>
                  )}
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  )
}

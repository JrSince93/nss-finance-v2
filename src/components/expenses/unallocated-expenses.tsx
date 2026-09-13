import { formatAud, formatDate, formatMonthKey } from "@/lib/format"
import { isTrackableExpense, type TransactionRow } from "@/lib/data/types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyState } from "@/components/empty-state"

/**
 * This month's expenses with no participant or company allocation.
 *
 * The third section of the production app's Expenses tab, and the one that
 * drives actual work: an unallocated expense is one nobody has yet attributed.
 * Allocation itself is a write and stays in the production app, so this is the
 * worklist, not the tool.
 */
export function UnallocatedExpenses({
  transactions,
  month,
}: {
  transactions: TransactionRow[]
  /** `YYYY-MM`. */
  month: string
}) {
  const rows = transactions
    .filter(
      (tx) =>
        isTrackableExpense(tx) &&
        !tx.allocated_to &&
        (tx.date ?? "").startsWith(month),
    )
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))

  const total = rows.reduce((sum, tx) => sum + (tx.amount_out ?? 0), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unallocated expenses</CardTitle>
        <CardDescription>
          {rows.length > 0 ? (
            <>
              <span className="font-medium tabular-nums text-foreground">
                {formatAud(total)}
              </span>{" "}
              across {rows.length} expense{rows.length === 1 ? "" : "s"} in{" "}
              {formatMonthKey(month)} with no participant or company allocation.
            </>
          ) : (
            `Everything in ${formatMonthKey(month)} is allocated.`
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            variant="budgets"
            title="Nothing unallocated"
            description="Every expense this month is attributed to a participant or the company."
            className="py-10"
          />
        ) : (
          <ul className="flex flex-col divide-y">
            {rows.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {tx.description || "(no description)"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(tx.date)}
                    {tx.reference ? ` · ${tx.reference}` : ""}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums text-sm font-semibold">
                  {formatAud(tx.amount_out)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

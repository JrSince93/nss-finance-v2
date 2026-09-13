import { CheckCircle2Icon, CircleDashedIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatAud, formatMonthKey } from "@/lib/format"
import type {
  RecurringExpenseRow,
  RecurringInstanceRow,
} from "@/lib/data/types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/empty-state"

/** How many months of history to show per expense. */
const HISTORY_MONTHS = 6

/**
 * Recurring monthly expenses and whether each has been paid.
 *
 * Replaces the template's "recurring charges" detector, which cycled a
 * wanted/review/unset flag in local state that went nowhere. The real model is
 * a `recurring_expenses` definition plus one `recurring_expense_instances` row
 * per month carrying paid or pending — so this reports that instead of
 * inventing a triage state.
 *
 * Read-only: marking an expense paid, matching it to a cash book row and
 * accepting a suggested recurring expense are all writes that belong with the
 * production app's matching rules.
 */
export function RecurringExpenses({
  expenses,
  instances,
  months,
}: {
  expenses: RecurringExpenseRow[]
  instances: RecurringInstanceRow[]
  /** Recent `YYYY-MM` keys, oldest first. */
  months: string[]
}) {
  const window = months.slice(-HISTORY_MONTHS)
  const currentMonth = window.at(-1)

  const statusFor = (expenseId: string, month: string) =>
    instances.find(
      (instance) =>
        instance.recurring_expense_id === expenseId && instance.month === month,
    )?.status ?? null

  const expectedTotal = expenses.reduce(
    (sum, expense) => sum + (expense.expected_amount ?? 0),
    0,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recurring expenses</CardTitle>
        <CardDescription>
          {expenses.length > 0 ? (
            <>
              <span className="font-medium tabular-nums text-foreground">
                {formatAud(expectedTotal)}
              </span>{" "}
              expected each month across {expenses.length} expense
              {expenses.length === 1 ? "" : "s"}.
            </>
          ) : (
            "Rent, phone, internet and other monthly commitments."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {expenses.length === 0 ? (
          <EmptyState
            variant="budgets"
            title="No recurring expenses"
            description="None are set up in the production app yet."
            className="py-10"
          />
        ) : (
          <ul className="flex flex-col divide-y">
            {expenses.map((expense) => {
              const current = currentMonth
                ? statusFor(expense.id, currentMonth)
                : null

              return (
                <li
                  key={expense.id}
                  className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  {current === "paid" ? (
                    <CheckCircle2Icon className="size-4 shrink-0 text-emerald-500" />
                  ) : (
                    <CircleDashedIcon className="size-4 shrink-0 text-muted-foreground/50" />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {expense.label || "Untitled expense"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {expense.expected_day_of_month
                        ? `Due around day ${expense.expected_day_of_month}`
                        : "No expected date"}
                      {expense.default_allocated_to
                        ? ` · ${expense.default_allocated_to}`
                        : ""}
                    </p>
                  </div>

                  {/* History strip, oldest month on the left. */}
                  <div className="flex shrink-0 items-center gap-1">
                    {window.map((month) => {
                      const status = statusFor(expense.id, month)
                      return (
                        <span
                          key={month}
                          title={`${formatMonthKey(month)}: ${status ?? "no record"}`}
                          className={cn(
                            "size-2.5 rounded-full",
                            status === "paid" && "bg-emerald-500",
                            status === "pending" && "bg-amber-500",
                            !status && "bg-muted",
                          )}
                        />
                      )
                    })}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="tabular-nums text-sm font-semibold">
                      {expense.expected_amount
                        ? formatAud(expense.expected_amount)
                        : "—"}
                    </p>
                    {current && (
                      <Badge
                        variant={current === "paid" ? "default" : "outline"}
                        className={cn(
                          "mt-0.5 text-[10px]",
                          current === "pending" &&
                            "text-amber-500 dark:text-amber-400",
                        )}
                      >
                        {current === "paid" ? "Paid" : "Pending"}
                      </Badge>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

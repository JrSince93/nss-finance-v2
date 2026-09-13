import { RecurringExpenses } from "@/components/expenses/recurring-expenses"
import { SpendingCalendar } from "@/components/expenses/spending-calendar"
import { UnallocatedExpenses } from "@/components/expenses/unallocated-expenses"
import {
  getRecurringExpenses,
  getRecurringInstances,
  getTransactions,
} from "@/lib/data/queries"
import { monthlyTotals } from "@/lib/data/reporting"
import { requireStaff } from "@/lib/auth/dal"

/**
 * Expenses.
 *
 * Three sections mirroring the production app's Expenses tab: recurring
 * expenses with their per-month status, a daily heatmap of the month, and the
 * unallocated worklist. Payroll never appears in any of them — it is reported
 * on the Payroll page, and mixing it in here would double-count it.
 *
 * The template's budget rings and savings goals are gone: there is no
 * per-category budget and no savings goal anywhere in the schema, so both were
 * showing figures that existed only in the seed file.
 */
export default async function Page() {
  await requireStaff("expenses")

  const [transactions, recurringExpenses, recurringInstances] =
    await Promise.all([
      getTransactions(),
      getRecurringExpenses(),
      getRecurringInstances(),
    ])

  // Anchor on the most recent month that actually has activity, falling back to
  // the current one. A fixed "this month" renders an empty page for the first
  // days of a month, and on a dataset that ends earlier.
  const months = monthlyTotals(transactions).map((row) => row.month)
  const month = months.at(-1) ?? new Date().toISOString().slice(0, 7)

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <RecurringExpenses
        expenses={recurringExpenses}
        instances={recurringInstances}
        months={months.length > 0 ? months : [month]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <SpendingCalendar transactions={transactions} month={month} />
        <UnallocatedExpenses transactions={transactions} month={month} />
      </div>
    </div>
  )
}

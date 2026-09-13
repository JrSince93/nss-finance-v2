import { ExpenseBreakdown } from "@/components/reports/expense-breakdown"
import { MonthlyCashFlow } from "@/components/reports/monthly-cash-flow"
import { getTransactions } from "@/lib/data/queries"
import { requireStaff } from "@/lib/auth/dal"

export default async function Page() {
  await requireStaff("reports")
  const transactions = await getTransactions()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="grid gap-4 lg:grid-cols-2">
        <MonthlyCashFlow transactions={transactions} />
        <ExpenseBreakdown transactions={transactions} />
      </div>
    </div>
  )
}

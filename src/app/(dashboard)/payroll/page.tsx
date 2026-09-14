import { PayrollClient } from "@/components/payroll/payroll-client"
import { PayrollExports } from "@/components/payroll/payroll-exports"
import { payrollSummaryCsv } from "@/lib/data/payroll-exports"
import { getPayRuns } from "@/lib/data/queries"
import { melbourneToday } from "@/lib/pay-periods"
import { requireStaff } from "@/lib/auth/dal"

/**
 * Roles offered bank payment files: admin only, matching Wise sync. The Server
 * Action checks again — this only decides whether the buttons are drawn. The
 * summary CSV isn't gated; it carries no bank details.
 */
const CAN_EXPORT_PAYMENTS: string[] = ["admin"]

export default async function Page() {
  const staff = await requireStaff("payroll")

  // No role filtering here. The `pay_runs` policies drop the two
  // payroll-restricted employees' rows for an office manager server-side, so
  // this list is already correct for whoever is asking.
  const payRuns = await getPayRuns()
  const today = melbourneToday()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <PayrollExports
        today={today}
        canExportPayments={CAN_EXPORT_PAYMENTS.includes(staff.role)}
        summary={payrollSummaryCsv(payRuns, today)}
      />
      <PayrollClient payRuns={payRuns} />
    </div>
  )
}

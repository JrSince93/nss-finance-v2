import { PayrollClient } from "@/components/payroll/payroll-client"
import { getPayRuns } from "@/lib/data/queries"
import { requireStaff } from "@/lib/auth/dal"

export default async function Page() {
  await requireStaff("payroll")

  // No role filtering here. The `pay_runs` policies drop the two
  // payroll-restricted employees' rows for an office manager server-side, so
  // this list is already correct for whoever is asking.
  const payRuns = await getPayRuns()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <PayrollClient payRuns={payRuns} />
    </div>
  )
}

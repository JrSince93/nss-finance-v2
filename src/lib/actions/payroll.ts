"use server"

import { getStaff } from "@/lib/auth/dal"
import { formatDate } from "@/lib/format"
import { getEmployeesForPaymentFile, getPayRuns } from "@/lib/data/queries"
import {
  buildPaymentFile,
  isPaymentPlatform,
  type SkippedRun,
} from "@/lib/data/payroll-exports"
import { MAX_PERIOD_INDEX, payPeriodAt } from "@/lib/pay-periods"

/**
 * Generating a bank payment file.
 *
 * A read, not a write — but it is the one place bank account numbers leave the
 * server, which is why it is a Server Action rather than data rendered into the
 * payroll page. The page never receives account numbers. They are read here,
 * under the caller's RLS, only when someone asks for a file, and they leave
 * only inside that file. Nothing is logged.
 *
 * **Admin only** — the same trust level as Wise sync in the production app, and
 * for the same reason. An office manager's RLS hides the two payroll-restricted
 * employees' pay runs and bank details alike, so a file generated under that
 * role would leave those two people out of the fortnight's payments without
 * any sign of it: correct for what the role may see, wrong as a pay cycle. The
 * accountant has no policy on `employees` at all, so their files would be
 * empty.
 *
 * The payroll summary CSV is a separate export with no bank details, and stays
 * open to every role that can reach Payroll.
 */

const CAN_EXPORT = ["admin"] as const

export type PaymentFileResponse =
  | {
      ok: true
      csv: string
      filename: string
      total: number
      included: number
      skipped: SkippedRun[]
      alreadyPaid: number
    }
  | { ok: false; error: string; skipped?: SkippedRun[] }

export async function generatePaymentFile(
  platform: string,
  periodIndex: number,
): Promise<PaymentFileResponse> {
  const staff = await getStaff()
  if (!staff) {
    return { ok: false, error: "You need to be signed in to do that." }
  }
  if (!(CAN_EXPORT as readonly string[]).includes(staff.role)) {
    return { ok: false, error: "Your role can't export bank payment files." }
  }

  // Both arguments arrive from the browser — validate, don't trust.
  if (!isPaymentPlatform(platform)) {
    return { ok: false, error: "Unknown payment file type." }
  }
  if (!Number.isInteger(periodIndex) || Math.abs(periodIndex) > MAX_PERIOD_INDEX) {
    return { ok: false, error: "Choose a pay period." }
  }

  const period = payPeriodAt(periodIndex)
  const [runs, employees] = await Promise.all([
    getPayRuns(),
    getEmployeesForPaymentFile(),
  ])

  const file = buildPaymentFile(platform, period, runs, employees)
  const range = `${formatDate(period.start)} – ${formatDate(period.end)}`

  if (file.total === 0) {
    // The production app offers to export every pay run instead at this
    // point. For a file that goes to a bank, that pays every past run again.
    return {
      ok: false,
      error: `No pay runs in ${range}. Nothing was exported.`,
    }
  }

  if (file.included === 0) {
    return {
      ok: false,
      error: `None of the ${file.total} pay run${file.total === 1 ? "" : "s"} in ${range} could go in a payment file.`,
      skipped: file.skipped,
    }
  }

  return {
    ok: true,
    csv: file.csv,
    filename: file.filename,
    total: file.total,
    included: file.included,
    skipped: file.skipped,
    alreadyPaid: file.alreadyPaid,
  }
}

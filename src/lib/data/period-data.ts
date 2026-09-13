import "server-only"

import { fyOfDate, fyOfIso, isInPeriod, type Period } from "@/lib/fy"
import {
  getInvoices,
  getPayRuns,
  getTransactions,
} from "@/lib/data/queries"
import { payRunDate } from "@/lib/data/reporting"
import {
  isPayroll,
  isTrackableExpense,
  type InvoiceRow,
  type PayRunRow,
  type TransactionRow,
} from "@/lib/data/types"

/**
 * One period filter feeding every section of the Accountant and Tax & BAS
 * pages.
 *
 * The three tables are anchored on different dates, matching the production
 * app's `accData()` exactly so the two apps agree on what falls in a quarter:
 *
 *   * transactions by `date`
 *   * pay runs by `paid_date`, falling back to `period_end`
 *   * invoices by `invoice_date`
 *
 * Expenses exclude payroll, so the Expenses and Payroll sections never
 * double-count the same money.
 */
export type PeriodData = {
  period: Period
  transactions: TransactionRow[]
  /** Money out that isn't payroll. */
  expenses: TransactionRow[]
  /** Money out that is payroll — the cash book side, not the pay runs. */
  payrollTransactions: TransactionRow[]
  payRuns: PayRunRow[]
  invoices: InvoiceRow[]
  /** Financial years the underlying data touches, newest first. */
  availableFys: number[]
}

export async function getPeriodData(period: Period): Promise<PeriodData> {
  const [allTransactions, allPayRuns, allInvoices] = await Promise.all([
    getTransactions(),
    getPayRuns(),
    getInvoices(),
  ])

  const transactions = allTransactions.filter((tx) =>
    isInPeriod(tx.date, period),
  )

  return {
    period,
    transactions,
    expenses: transactions.filter(isTrackableExpense),
    payrollTransactions: transactions.filter(
      (tx) => (tx.amount_out ?? 0) > 0 && isPayroll(tx),
    ),
    payRuns: allPayRuns.filter((run) => isInPeriod(payRunDate(run), period)),
    invoices: allInvoices.filter((invoice) =>
      isInPeriod(invoice.invoice_date, period),
    ),
    availableFys: availableFys(allTransactions, allPayRuns, allInvoices),
  }
}

/**
 * Every FY the data touches, plus the current one so the picker is never empty.
 *
 * Built from the same anchors the filter uses, so a year can't be offered
 * without the rows that put it there.
 */
function availableFys(
  transactions: TransactionRow[],
  payRuns: PayRunRow[],
  invoices: InvoiceRow[],
): number[] {
  const years = new Set<number>([fyOfDate(new Date())])

  const add = (iso: string | null) => {
    const fy = fyOfIso(iso)
    if (fy !== null) years.add(fy)
  }

  for (const tx of transactions) add(tx.date)
  for (const run of payRuns) add(payRunDate(run))
  for (const invoice of invoices) add(invoice.invoice_date)

  return Array.from(years).sort((a, b) => b - a)
}

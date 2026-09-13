import "server-only"

import {
  getEmployees,
  getInvoices,
  getTransactions,
} from "@/lib/data/queries"
import { monthlyTotals, type MonthTotals } from "@/lib/data/reporting"
import type { TransactionRow } from "@/lib/data/types"

/**
 * The Dashboard's figures.
 *
 * These mirror the production app's `renderDash` KPIs — money in, money out,
 * net, active employees, invoices outstanding — rather than the template's
 * wallet balance and card widgets, which have nothing behind them: there is no
 * account-balance table in this schema, and no cards at all.
 */
export type DashboardData = {
  moneyIn: number
  moneyOut: number
  net: number
  activeEmployees: number
  invoicesOutstanding: number
  months: MonthTotals[]
  recent: TransactionRow[]
}

/** How many cash book rows the "recent" widget shows. */
const RECENT_LIMIT = 8

/**
 * A recurring entry dated in the future hasn't happened yet.
 *
 * The production app tags these `[recurring]` in the description and excludes
 * them from dashboard KPIs until their date arrives, so a rent entry booked for
 * next month doesn't inflate today's money out. Same rule here, or the two
 * dashboards would disagree.
 */
function hasOccurred(tx: TransactionRow, today: string): boolean {
  if (!tx.date) return true
  if (!(tx.description ?? "").includes("[recurring]")) return true
  return tx.date.slice(0, 10) <= today
}

export async function getDashboardData(): Promise<DashboardData> {
  const [transactions, employees, invoices] = await Promise.all([
    getTransactions(),
    getEmployees(),
    getInvoices(),
  ])

  const today = new Date().toISOString().slice(0, 10)
  const active = transactions.filter((tx) => hasOccurred(tx, today))

  const moneyIn = active.reduce((sum, tx) => sum + (tx.amount_in ?? 0), 0)
  const moneyOut = active.reduce((sum, tx) => sum + (tx.amount_out ?? 0), 0)

  // Outstanding is what has been invoiced but not yet received — the invoice
  // amount less anything already paid against it.
  const invoicesOutstanding = invoices
    .filter((invoice) => invoice.status !== "paid")
    .reduce(
      (sum, invoice) =>
        sum + ((invoice.amount ?? 0) - (invoice.payment_amount ?? 0)),
      0,
    )

  return {
    moneyIn,
    moneyOut,
    net: moneyIn - moneyOut,
    // An office manager's employee list is missing the two payroll-restricted
    // rows, so this count is role-dependent — correct for whoever is asking.
    activeEmployees: employees.filter((e) => e.active !== false).length,
    invoicesOutstanding,
    months: monthlyTotals(active),
    recent: [...active]
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      .slice(0, RECENT_LIMIT),
  }
}

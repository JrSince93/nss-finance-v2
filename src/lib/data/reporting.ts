import { monthKeyOf } from "@/lib/format"
import {
  cleanDescription,
  isTrackableExpense,
  type PayRunRow,
  type TransactionRow,
} from "@/lib/data/types"

/**
 * Aggregations shared by Reports, the Dashboard, Tax & BAS and the Accountant
 * page.
 *
 * Pure functions over rows that RLS has already filtered, so the same helper
 * gives an admin and an office manager each their own correct totals without
 * knowing anything about roles. Kept out of `queries.ts` so client components
 * can use them too.
 */

export type MonthTotals = {
  /** `YYYY-MM`. */
  month: string
  moneyIn: number
  moneyOut: number
  net: number
}

/** Money in and out per calendar month, oldest first. */
export function monthlyTotals(transactions: TransactionRow[]): MonthTotals[] {
  const byMonth = new Map<string, MonthTotals>()

  for (const tx of transactions) {
    const month = monthKeyOf(tx.date)
    if (!month) continue

    const entry = byMonth.get(month) ?? {
      month,
      moneyIn: 0,
      moneyOut: 0,
      net: 0,
    }
    entry.moneyIn += tx.amount_in ?? 0
    entry.moneyOut += tx.amount_out ?? 0
    entry.net = entry.moneyIn - entry.moneyOut
    byMonth.set(month, entry)
  }

  return Array.from(byMonth.values()).sort((a, b) =>
    a.month.localeCompare(b.month),
  )
}

export type LabelledTotal = { label: string; amount: number; count: number }

/**
 * Expenses grouped by description, largest first.
 *
 * Description is the only classifier the cash book carries — there is no
 * category column anywhere in the schema — and it is what the production app
 * groups by on its own Accountant page. Payroll is excluded via
 * `isTrackableExpense` so these never double-count against payroll figures.
 */
export function expensesByDescription(
  transactions: TransactionRow[],
): LabelledTotal[] {
  const byLabel = new Map<string, LabelledTotal>()

  for (const tx of transactions) {
    if (!isTrackableExpense(tx)) continue

    const label = cleanDescription(tx)
    const entry = byLabel.get(label) ?? { label, amount: 0, count: 0 }
    entry.amount += tx.amount_out ?? 0
    entry.count += 1
    byLabel.set(label, entry)
  }

  return Array.from(byLabel.values()).sort((a, b) => b.amount - a.amount)
}

/**
 * The longest tail folded into one "Other" row, so a chart stays readable when
 * there are hundreds of distinct descriptions.
 */
export function withOtherBucket(
  rows: LabelledTotal[],
  limit: number,
): LabelledTotal[] {
  if (rows.length <= limit) return rows

  const head = rows.slice(0, limit)
  const tail = rows.slice(limit)

  return [
    ...head,
    {
      label: `Other (${tail.length})`,
      amount: tail.reduce((sum, row) => sum + row.amount, 0),
      count: tail.reduce((sum, row) => sum + row.count, 0),
    },
  ]
}

export type PayrollTotals = {
  gross: number
  tax: number
  super: number
  net: number
  runs: number
}

export function payrollTotals(payRuns: PayRunRow[]): PayrollTotals {
  return payRuns.reduce<PayrollTotals>(
    (totals, run) => ({
      gross: totals.gross + (Number(run.gross_pay) || 0),
      tax: totals.tax + (Number(run.tax_withheld) || 0),
      super: totals.super + (Number(run.super_amount) || 0),
      net: totals.net + (Number(run.net_pay) || 0),
      runs: totals.runs + 1,
    }),
    { gross: 0, tax: 0, super: 0, net: 0, runs: 0 },
  )
}

/**
 * The date a pay run belongs to: when it was paid, falling back to the period
 * end. The same anchor the production app's tax export uses, so figures here
 * and there land in the same period.
 */
export function payRunDate(run: PayRunRow): string | null {
  return run.paid_date || run.period_end || null
}

/** Payroll grouped by employee, by name. */
export function payrollByEmployee(
  payRuns: PayRunRow[],
): (PayrollTotals & { name: string })[] {
  const byName = new Map<string, PayrollTotals & { name: string }>()

  for (const run of payRuns) {
    const name = run.employee_name?.trim() || "Unknown employee"
    const entry = byName.get(name) ?? {
      name,
      gross: 0,
      tax: 0,
      super: 0,
      net: 0,
      runs: 0,
    }
    entry.gross += Number(run.gross_pay) || 0
    entry.tax += Number(run.tax_withheld) || 0
    entry.super += Number(run.super_amount) || 0
    entry.net += Number(run.net_pay) || 0
    entry.runs += 1
    byName.set(name, entry)
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * GST on money in, as the ATO's 1/11 of a GST-inclusive amount.
 *
 * An estimate, and must be labelled as one wherever it appears: no GST amount
 * is stored per transaction, and this assumes every dollar in is a taxable
 * supply — which NDIS income generally is not. It exists to give the
 * accountant a starting figure, not a lodgeable one.
 */
export function gstEstimate(moneyIn: number): number {
  return moneyIn / 11
}

export function sumField(
  transactions: TransactionRow[],
  field: "amount_in" | "amount_out",
): number {
  return transactions.reduce((sum, tx) => sum + (tx[field] ?? 0), 0)
}

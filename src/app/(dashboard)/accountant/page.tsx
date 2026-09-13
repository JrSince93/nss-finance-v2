import { InfoIcon } from "lucide-react"

import { formatAud, formatDate, formatMonthKey } from "@/lib/format"
import { monthsInPeriod, periodFromParams } from "@/lib/fy"
import { csvAmount } from "@/lib/csv"
import { getPeriodData } from "@/lib/data/period-data"
import {
  expensesByDescription,
  gstEstimate,
  payrollByEmployee,
  payrollTotals,
  payRunDate,
  sumField,
} from "@/lib/data/reporting"
import { requireStaff } from "@/lib/auth/dal"
import { PeriodPicker } from "@/components/period-picker"
import { AccountantSection, Figure } from "@/components/accountant/section"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * The Accountant page.
 *
 * A read-only, period-scoped view of everything the external accountant needs,
 * with a CSV export per section. Only the accountant role has this page in its
 * sidebar — admin and office_manager have the full pages and don't need a
 * read-only summary of them.
 *
 * Two constraints hold here and must keep holding:
 *
 *   * **No write controls render, for any role.** Not create, not edit, not
 *     delete. The only control on the page is the per-section CSV export,
 *     which is a read of what is already on screen.
 *   * **Expenses exclude payroll.** Payroll has its own section, and counting a
 *     payroll payment in both would overstate money out.
 *
 * Everything is scoped by one period — Australian FY quarters, which are
 * unrelated to the participant-plan-anchored NDIS quarters used for budget
 * tracking.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string | string[]; q?: string | string[] }>
}) {
  await requireStaff("accountant")

  const period = periodFromParams(await searchParams)
  const data = await getPeriodData(period)

  const moneyIn = sumField(data.transactions, "amount_in")
  const moneyOut = sumField(data.transactions, "amount_out")
  const expenseTotal = sumField(data.expenses, "amount_out")
  const payrollCashTotal = sumField(data.payrollTransactions, "amount_out")

  const expenseRows = expensesByDescription(data.transactions)
  const payroll = payrollTotals(data.payRuns)
  const byEmployee = payrollByEmployee(data.payRuns)

  const invoiced = data.invoices.reduce((sum, i) => sum + (i.amount ?? 0), 0)
  const invoicePaid = data.invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + (i.amount ?? 0), 0)

  const months = monthsInPeriod(period)
  const taxRows = months.map((month) => {
    const runs = data.payRuns.filter((run) =>
      (payRunDate(run) ?? "").startsWith(month),
    )
    const monthIn = sumField(
      data.transactions.filter((tx) => (tx.date ?? "").startsWith(month)),
      "amount_in",
    )
    return {
      month,
      ...payrollTotals(runs),
      moneyIn: monthIn,
      gst: gstEstimate(monthIn),
    }
  })

  const file = (name: string) => `Accountant_${name}_${period.slug}.csv`

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <PeriodPicker period={period} availableFys={data.availableFys} />

      {/* ── 1. Cash Book ───────────────────────────────────────────────── */}
      <AccountantSection
        title="Cash Book"
        note={period.label}
        csv={{
          header: [
            "Date",
            "Description",
            "Type",
            "Reference",
            "Amount In",
            "Amount Out",
          ],
          filename: file("CashBook"),
          rows: [
            ...data.transactions.map((tx) => [
              tx.date ?? "",
              tx.description ?? "",
              tx.payment_type ?? "",
              tx.reference ?? "",
              csvAmount(tx.amount_in),
              csvAmount(tx.amount_out),
            ]),
            ["TOTAL", "", "", "", csvAmount(moneyIn), csvAmount(moneyOut)],
          ],
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Figure
            label="Money in"
            value={formatAud(moneyIn)}
            tone="text-emerald-500"
          />
          <Figure
            label="Money out"
            value={formatAud(moneyOut)}
            tone="text-rose-500"
          />
          <Figure
            label="Net"
            value={formatAud(moneyIn - moneyOut)}
            tone={moneyIn - moneyOut < 0 ? "text-rose-500" : undefined}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {data.transactions.length} transaction
          {data.transactions.length === 1 ? "" : "s"} in this period.
        </p>
      </AccountantSection>

      {/* ── 2. Expenses ────────────────────────────────────────────────── */}
      <AccountantSection
        title="Expenses"
        note="Money out, excluding payroll — payroll is listed separately below and in full under Payroll."
        csv={{
          header: [
            "Date",
            "Description",
            "Type",
            "Reference",
            "Amount Out",
            "Category",
          ],
          filename: file("Expenses"),
          rows: [
            ...data.expenses.map((tx) => [
              tx.date ?? "",
              tx.description ?? "",
              tx.payment_type ?? "",
              tx.reference ?? "",
              csvAmount(tx.amount_out),
              "Expense",
            ]),
            ...data.payrollTransactions.map((tx) => [
              tx.date ?? "",
              tx.description ?? "",
              tx.payment_type ?? "",
              tx.reference ?? "",
              csvAmount(tx.amount_out),
              "Payroll",
            ]),
            [
              "TOTAL",
              "",
              "",
              "",
              csvAmount(expenseTotal + payrollCashTotal),
              "",
            ],
          ],
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Figure
            label="Expenses (excl. payroll)"
            value={formatAud(expenseTotal)}
            sub={`${data.expenses.length} row${data.expenses.length === 1 ? "" : "s"}`}
          />
          <Figure
            label="Payroll paid"
            value={formatAud(payrollCashTotal)}
            sub={`${data.payrollTransactions.length} row${data.payrollTransactions.length === 1 ? "" : "s"}`}
          />
          <Figure
            label="Total money out"
            value={formatAud(expenseTotal + payrollCashTotal)}
          />
        </div>

        {expenseRows.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseRows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAud(row.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No expenses in this period.
          </p>
        )}
      </AccountantSection>

      {/* ── 3. Invoices ────────────────────────────────────────────────── */}
      <AccountantSection
        title="Invoices"
        note="From the invoice ledger, by invoice date."
        csv={{
          header: [
            "Invoice Ref",
            "Participant",
            "Invoice Date",
            "Period Start",
            "Period End",
            "Amount",
            "Status",
            "Payment Date",
            "Payment Amount",
          ],
          filename: file("Invoices"),
          rows: [
            ...data.invoices.map((invoice) => [
              invoice.invoice_ref ?? "",
              invoice.participant_name ?? "",
              invoice.invoice_date ?? "",
              invoice.period_start ?? "",
              invoice.period_end ?? "",
              csvAmount(invoice.amount),
              invoice.status ?? "",
              invoice.payment_date ?? "",
              csvAmount(invoice.payment_amount),
            ]),
            ["TOTAL", "", "", "", "", csvAmount(invoiced), "", "", ""],
          ],
        }}
      >
        {data.invoices.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Figure
                label="Invoiced"
                value={formatAud(invoiced)}
                sub={`${data.invoices.length} invoice${data.invoices.length === 1 ? "" : "s"}`}
              />
              <Figure
                label="Paid"
                value={formatAud(invoicePaid)}
                tone="text-emerald-500"
              />
            </div>
            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref</TableHead>
                    <TableHead>Participant</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Invoice date
                    </TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-xs">
                        {invoice.invoice_ref || "—"}
                      </TableCell>
                      <TableCell>{invoice.participant_name || "—"}</TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                        {formatDate(invoice.invoice_date)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatAud(invoice.amount)}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {invoice.status || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No invoices in this period.
          </p>
        )}
      </AccountantSection>

      {/* ── 4. Payroll ─────────────────────────────────────────────────── */}
      <AccountantSection
        title="Payroll"
        note={`All employees. ${data.payRuns.length} pay run${data.payRuns.length === 1 ? "" : "s"} paid in this period.`}
        csv={{
          header: [
            "Employee",
            "Period Start",
            "Period End",
            "Paid Date",
            "Hours",
            "Gross",
            "Tax",
            "Super",
            "Net",
          ],
          filename: file("Payroll"),
          rows: [
            ...data.payRuns.map((run) => [
              run.employee_name || "Unknown",
              run.period_start ?? "",
              run.period_end ?? "",
              run.paid_date ?? "",
              run.hours_worked ?? "",
              csvAmount(run.gross_pay),
              csvAmount(run.tax_withheld),
              csvAmount(run.super_amount),
              csvAmount(run.net_pay),
            ]),
            [
              "TOTAL",
              "",
              "",
              "",
              "",
              csvAmount(payroll.gross),
              csvAmount(payroll.tax),
              csvAmount(payroll.super),
              csvAmount(payroll.net),
            ],
          ],
        }}
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Figure
            label="Gross"
            value={formatAud(payroll.gross)}
            tone="text-emerald-500"
          />
          <Figure label="PAYG withheld" value={formatAud(payroll.tax)} />
          <Figure
            label="Super"
            value={formatAud(payroll.super)}
            tone="text-amber-500"
          />
          <Figure label="Net paid" value={formatAud(payroll.net)} />
        </div>

        {byEmployee.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Runs</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">PAYG</TableHead>
                  <TableHead className="text-right">Super</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byEmployee.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.runs}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAud(row.gross)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAud(row.tax)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAud(row.super)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatAud(row.net)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No pay runs in this period.
          </p>
        )}
      </AccountantSection>

      {/* ── 5. Tax & BAS ───────────────────────────────────────────────── */}
      <AccountantSection
        title="Tax & BAS"
        note="PAYG and super by month, from pay runs paid in the period."
        csv={{
          header: [
            "Month",
            "Gross",
            "PAYG",
            "Super",
            "Net",
            "Money In",
            "GST estimate (1/11 of money in)",
          ],
          filename: file("TaxBAS"),
          rows: [
            ...taxRows.map((row) => [
              formatMonthKey(row.month),
              csvAmount(row.gross),
              csvAmount(row.tax),
              csvAmount(row.super),
              csvAmount(row.net),
              csvAmount(row.moneyIn),
              csvAmount(row.gst),
            ]),
            [
              "TOTAL",
              csvAmount(payroll.gross),
              csvAmount(payroll.tax),
              csvAmount(payroll.super),
              csvAmount(payroll.net),
              csvAmount(moneyIn),
              csvAmount(gstEstimate(moneyIn)),
            ],
          ],
        }}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">PAYG</TableHead>
                <TableHead className="text-right">Super</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Money in</TableHead>
                <TableHead className="text-right">GST est.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxRows.map((row) => (
                <TableRow key={row.month}>
                  <TableCell className="whitespace-nowrap">
                    {formatMonthKey(row.month)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAud(row.gross)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAud(row.tax)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAud(row.super)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAud(row.net)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAud(row.moneyIn)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatAud(row.gst)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>
            GST is an estimate only — 1/11 of money in. No GST amount is stored
            per transaction, and this assumes every dollar received is a taxable
            supply, which NDIS income generally is not. Do not lodge from this
            figure.
          </span>
        </p>
      </AccountantSection>
    </div>
  )
}

import { InfoIcon } from "lucide-react"

import { formatAud, formatMonthKey } from "@/lib/format"
import { monthsInPeriod, periodFromParams } from "@/lib/fy"
import { csvAmount } from "@/lib/csv"
import { getPeriodData } from "@/lib/data/period-data"
import {
  gstEstimate,
  payrollTotals,
  payRunDate,
  sumField,
} from "@/lib/data/reporting"
import { requireStaff } from "@/lib/auth/dal"
import { PeriodPicker } from "@/components/period-picker"
import { ExportCsvButton } from "@/components/export-csv-button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const CSV_HEADER = [
  "Month",
  "Gross",
  "PAYG",
  "Super",
  "Net",
  "Money In",
  "GST estimate (1/11 of money in)",
]

/**
 * Tax & BAS.
 *
 * Quarterly BAS figures and PAYG withholding for the Australian financial
 * year. Pay runs are anchored on `paid_date` falling back to `period_end`, the
 * same anchor the production app's tax export uses, so a run lands in the same
 * quarter in both apps.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string | string[]; q?: string | string[] }>
}) {
  await requireStaff("tax")

  const period = periodFromParams(await searchParams)
  const data = await getPeriodData(period)

  const months = monthsInPeriod(period)
  const payroll = payrollTotals(data.payRuns)
  const moneyIn = sumField(data.transactions, "amount_in")
  const moneyOut = sumField(data.transactions, "amount_out")
  const gst = gstEstimate(moneyIn)

  const rows = months.map((month) => {
    const runs = data.payRuns.filter((run) =>
      (payRunDate(run) ?? "").startsWith(month),
    )
    const transactions = data.transactions.filter((tx) =>
      (tx.date ?? "").startsWith(month),
    )
    const totals = payrollTotals(runs)
    const monthIn = sumField(transactions, "amount_in")

    return { month, ...totals, moneyIn: monthIn, gst: gstEstimate(monthIn) }
  })

  const summary = [
    { label: "Money in", value: formatAud(moneyIn) },
    { label: "Money out", value: formatAud(moneyOut) },
    { label: "GST estimate", value: formatAud(gst), estimate: true },
    { label: "PAYG withheld", value: formatAud(payroll.tax) },
    { label: "Super", value: formatAud(payroll.super) },
  ]

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <PeriodPicker period={period} availableFys={data.availableFys} />

      <Card>
        <CardHeader>
          <CardTitle>BAS summary</CardTitle>
          <CardDescription>{period.label}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {summary.map((item) => (
              <div
                key={item.label}
                className="rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/5"
              >
                <dt className="text-xs text-muted-foreground">
                  {item.label}
                  {item.estimate && " *"}
                </dt>
                <dd className="truncate tabular-nums text-base font-semibold tracking-tight">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
            <span>
              * GST is an estimate only — 1/11 of money in. No GST amount is
              stored per transaction, and this assumes every dollar received is
              a taxable supply, which NDIS income generally is not. Do not lodge
              from this figure.
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>By month</CardTitle>
              <CardDescription>
                Pay runs by date paid, cash book by transaction date.
              </CardDescription>
            </div>
            <ExportCsvButton
              header={CSV_HEADER}
              filename={`Tax_BAS_${period.slug}.csv`}
              rows={[
                ...rows.map((row) => [
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
                  csvAmount(gst),
                ],
              ]}
            />
          </div>
        </CardHeader>
        <CardContent>
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
                {rows.map((row) => (
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

                <TableRow className="font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAud(payroll.gross)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAud(payroll.tax)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAud(payroll.super)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAud(payroll.net)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAud(moneyIn)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatAud(gst)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

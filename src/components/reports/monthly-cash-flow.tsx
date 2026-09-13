"use client"

import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { cn } from "@/lib/utils"
import { formatAud, formatAudCompact, formatMonthKey } from "@/lib/format"
import { monthlyTotals } from "@/lib/data/reporting"
import type { TransactionRow } from "@/lib/data/types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { EmptyState } from "@/components/empty-state"

const chartConfig = {
  moneyIn: { label: "Money in", color: "var(--color-chart-2)" },
  moneyOut: { label: "Money out", color: "var(--color-chart-1)" },
} satisfies ChartConfig

/** Months shown, most recent last. Enough for a year without crowding. */
const MONTH_LIMIT = 12

/**
 * Money in against money out, by month.
 *
 * Replaces the template's this-month-vs-last-month-by-category bars. Categories
 * don't exist, and the useful comparison for a cash book is the trend of what
 * came in against what went out.
 */
export function MonthlyCashFlow({
  transactions,
}: {
  transactions: TransactionRow[]
}) {
  const rows = useMemo(
    () => monthlyTotals(transactions).slice(-MONTH_LIMIT),
    [transactions],
  )

  const data = useMemo(
    () => rows.map((row) => ({ ...row, label: formatMonthKey(row.month) })),
    [rows],
  )

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          moneyIn: acc.moneyIn + row.moneyIn,
          moneyOut: acc.moneyOut + row.moneyOut,
        }),
        { moneyIn: 0, moneyOut: 0 },
      ),
    [rows],
  )

  const net = totals.moneyIn - totals.moneyOut

  return (
    <Card>
      <CardHeader>
        <CardTitle>Money in and out by month</CardTitle>
        <CardDescription>
          {rows.length > 0
            ? `Last ${rows.length} month${rows.length === 1 ? "" : "s"} of cash book activity.`
            : "Cash book activity by month."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            variant="analytics"
            title="No cash book activity"
            description="No transactions were returned for your role."
            className="py-10"
          />
        ) : (
          <>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <BarChart data={data} margin={{ top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value: string) => value.split(" ")[0]}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(value: number) => formatAudCompact(value)}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatAud(Number(value))}
                    />
                  }
                />
                <Bar
                  dataKey="moneyIn"
                  fill="var(--color-moneyIn)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="moneyOut"
                  fill="var(--color-moneyOut)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>

            <dl className="mt-4 grid grid-cols-3 gap-3 border-t pt-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Money in</dt>
                <dd className="tabular-nums font-semibold text-emerald-500">
                  {formatAud(totals.moneyIn)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Money out</dt>
                <dd className="tabular-nums font-semibold text-rose-500">
                  {formatAud(totals.moneyOut)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Net</dt>
                <dd
                  className={cn(
                    "tabular-nums font-semibold",
                    net < 0 && "text-rose-500",
                  )}
                >
                  {formatAud(net)}
                </dd>
              </div>
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  )
}

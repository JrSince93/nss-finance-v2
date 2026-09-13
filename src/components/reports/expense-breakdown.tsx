"use client"

import { useMemo } from "react"
import { Cell, Pie, PieChart } from "recharts"

import { formatAud, formatAudCompact } from "@/lib/format"
import {
  expensesByDescription,
  withOtherBucket,
} from "@/lib/data/reporting"
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

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
]

/** How many descriptions get their own slice before the rest become "Other". */
const SLICE_LIMIT = 8

/**
 * Expenses grouped by description.
 *
 * This replaces the template's category donut. There is no category column on
 * `transactions` — description is the real classifier, and it is what the
 * production app groups by. The drill-down is gone with it: a description has
 * no subcategories to drill into.
 */
export function ExpenseBreakdown({
  transactions,
}: {
  transactions: TransactionRow[]
}) {
  const rows = useMemo(
    () => withOtherBucket(expensesByDescription(transactions), SLICE_LIMIT),
    [transactions],
  )

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + row.amount, 0),
    [rows],
  )

  const data = useMemo(
    () =>
      rows.map((row, i) => ({
        name: row.label,
        value: row.amount,
        fill: COLORS[i % COLORS.length],
      })),
    [rows],
  )

  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {}
    for (const [i, row] of rows.entries()) {
      config[row.label] = {
        label: row.label,
        color: COLORS[i % COLORS.length],
      }
    }
    return config
  }, [rows])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expenses by description</CardTitle>
        <CardDescription>
          Money out, excluding payroll — payroll is reported on its own page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            variant="analytics"
            title="No expenses"
            description="No expense rows were returned for this period."
            className="py-10"
          />
        ) : (
          <>
            <ChartContainer
              config={chartConfig}
              className="mx-auto aspect-square h-[280px]"
            >
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatAud(Number(value))}
                    />
                  }
                />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={75}
                  outerRadius={110}
                  strokeWidth={2}
                  stroke="var(--color-card)"
                  paddingAngle={2}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <text
                  x="50%"
                  y="47%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground text-2xl font-bold tabular-nums"
                >
                  {formatAudCompact(total)}
                </text>
                <text
                  x="50%"
                  y="56%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-xs"
                >
                  total expenses
                </text>
              </PieChart>
            </ChartContainer>

            <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
              {data.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.fill }}
                  />
                  <span className="truncate text-muted-foreground">
                    {entry.name}
                  </span>
                  <span className="ml-auto shrink-0 font-medium tabular-nums">
                    {formatAudCompact(entry.value)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

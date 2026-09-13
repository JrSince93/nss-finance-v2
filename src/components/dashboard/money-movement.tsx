"use client"

import { useMemo, useState } from "react"
import { ArrowDownLeftIcon, ArrowUpRightIcon } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { formatAud, formatAudCompact, formatMonthKey } from "@/lib/format"
import type { MonthTotals } from "@/lib/data/reporting"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

/**
 * Money in against money out, over a selectable window.
 *
 * The template's 7d / 30d / 90d windows came from three hand-written seed
 * arrays. The cash book is a monthly ledger — `transactions.month` is a month
 * name, and entries land in monthly batches — so daily buckets would be mostly
 * empty. The windows are months instead.
 */
const WINDOWS = [
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
] as const

export function MoneyMovement({ months }: { months: MonthTotals[] }) {
  const [window, setWindow] = useState<string>("6")

  const data = useMemo(
    () =>
      months.slice(-Number(window)).map((month) => ({
        ...month,
        label: formatMonthKey(month.month),
      })),
    [months, window],
  )

  const totals = useMemo(
    () =>
      data.reduce(
        (acc, row) => ({
          in: acc.in + row.moneyIn,
          out: acc.out + row.moneyOut,
        }),
        { in: 0, out: 0 },
      ),
    [data],
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-semibold">
          Money movement
        </CardTitle>
        <Select value={window} onValueChange={(v) => v && setWindow(v)}>
          <SelectTrigger className="h-8 w-[120px] text-xs" aria-label="Window">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WINDOWS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState
            variant="analytics"
            title="No activity"
            description="No cash book entries to chart."
            className="py-8"
          />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <ArrowDownLeftIcon className="size-3.5 text-emerald-500" />
                In
                <span className="font-medium tabular-nums text-foreground">
                  {formatAud(totals.in)}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <ArrowUpRightIcon className="size-3.5 text-rose-500" />
                Out
                <span className="font-medium tabular-nums text-foreground">
                  {formatAud(totals.out)}
                </span>
              </span>
            </div>

            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={data} margin={{ top: 4, left: -12 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tickMargin={8}
                  tickFormatter={(value: string) => value.split(" ")[0]}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={60}
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
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="moneyOut"
                  fill="var(--color-moneyOut)"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </>
        )}
      </CardContent>
    </Card>
  )
}

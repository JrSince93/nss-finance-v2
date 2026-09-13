"use client"

import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { formatAud, formatAudCompact, formatMonthKey } from "@/lib/format"
import type { MonthTotals } from "@/lib/data/reporting"
import {
  Card,
  CardContent,
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
  position: { label: "Net activity", color: "var(--color-primary)" },
} satisfies ChartConfig

/**
 * Cumulative net activity — every month's money in less money out, running.
 *
 * The template compared this year against last year from a seed array. There is
 * no prior-year baseline in this data worth drawing; the running total is what
 * shows the shape of the business.
 *
 * **This is not a balance.** It starts from zero at the first row in the cash
 * book, so it says how much the ledger has moved since then, not what is in the
 * Wise account. There is no account balance anywhere in this schema, and the
 * naming here is deliberately blunt about that — a figure a reader mistakes for
 * a bank balance is worse than no figure.
 */
export function NetActivity({ months }: { months: MonthTotals[] }) {
  const data = useMemo(() => {
    const points: { month: string; position: number; net: number }[] = []
    let running = 0

    for (const month of months) {
      running += month.net
      points.push({
        month: formatMonthKey(month.month),
        position: running,
        net: month.net,
      })
    }

    return points
  }, [months])

  const latest = data.at(-1)?.position ?? 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Net activity (all-time)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Money in less money out across the whole cash book, accumulated —{" "}
          <span className="font-medium text-foreground">
            {formatAud(latest)}
          </span>
          . Not an account balance.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {data.length === 0 ? (
          <EmptyState
            variant="analytics"
            title="No cash book activity"
            description="Nothing to chart yet."
            className="py-10"
          />
        ) : (
          <ChartContainer config={chartConfig} className="h-[260px] w-full">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
            >
              <defs>
                <linearGradient id="fillPosition" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-primary)"
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-primary)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--color-border)"
                strokeOpacity={0.5}
              />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                fontSize={12}
                tickMargin={8}
                stroke="var(--color-muted-foreground)"
                tickFormatter={(value: string) => value.split(" ")[0]}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={12}
                tickMargin={8}
                width={64}
                stroke="var(--color-muted-foreground)"
                tickFormatter={(value: number) => formatAudCompact(value)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatAud(Number(value))}
                  />
                }
              />
              <Area
                dataKey="position"
                type="monotone"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill="url(#fillPosition)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

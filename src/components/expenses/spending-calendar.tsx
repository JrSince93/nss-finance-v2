"use client"

import { useMemo } from "react"

import { cn } from "@/lib/utils"
import { formatAud, formatAudCompact, formatMonthKey } from "@/lib/format"
import { isTrackableExpense, type TransactionRow } from "@/lib/data/types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

type Cell = { day: number | null; amount: number; date: string }

/**
 * Daily expense heatmap for one month.
 *
 * The template built this from a seed array that called `Math.random()` at
 * module scope — different on the server and the client, so it never agreed
 * with itself across a hydration. This sums real cash book rows for the month
 * instead, excluding payroll so it matches every other expense figure.
 */
export function SpendingCalendar({
  transactions,
  month,
}: {
  transactions: TransactionRow[]
  /** `YYYY-MM`. */
  month: string
}) {
  const { weeks, maxAmount, total } = useMemo(() => {
    const byDate = new Map<string, number>()
    let sum = 0

    for (const tx of transactions) {
      if (!isTrackableExpense(tx)) continue
      const date = (tx.date ?? "").slice(0, 10)
      if (!date.startsWith(month)) continue

      const amount = tx.amount_out ?? 0
      byDate.set(date, (byDate.get(date) ?? 0) + amount)
      sum += amount
    }

    const [year, monthNumber] = month.split("-").map(Number)
    const first = new Date(year, monthNumber - 1, 1)
    const daysInMonth = new Date(year, monthNumber, 0).getDate()

    const cells: Cell[] = Array.from({ length: first.getDay() }, () => ({
      day: null,
      amount: 0,
      date: "",
    }))

    let max = 0
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${month}-${String(day).padStart(2, "0")}`
      const amount = byDate.get(date) ?? 0
      if (amount > max) max = amount
      cells.push({ day, amount, date })
    }

    while (cells.length % 7 !== 0) {
      cells.push({ day: null, amount: 0, date: "" })
    }

    const grouped: Cell[][] = []
    for (let i = 0; i < cells.length; i += 7) {
      grouped.push(cells.slice(i, i + 7))
    }

    return { weeks: grouped, maxAmount: max, total: sum }
  }, [transactions, month])

  const todayIso = new Date().toISOString().slice(0, 10)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          {formatMonthKey(month)} expenses
        </CardTitle>
        <CardDescription>
          <span className="font-medium tabular-nums text-foreground">
            {formatAud(total)}
          </span>{" "}
          out this month, excluding payroll.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
          {DAYS.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>

        <div className="mt-1 grid gap-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((cell, cellIndex) => {
                if (cell.day === null) return <div key={cellIndex} />

                const intensity =
                  cell.amount === 0 || maxAmount === 0
                    ? 0
                    : Math.min(Math.ceil((cell.amount / maxAmount) * 4), 4)

                return (
                  <div
                    key={cellIndex}
                    title={
                      cell.amount > 0
                        ? `${cell.date}: ${formatAud(cell.amount)}`
                        : cell.date
                    }
                    className={cn(
                      "flex flex-col items-center justify-center rounded-lg py-1.5 text-center transition-colors",
                      intensity === 0 && "bg-transparent",
                      intensity === 1 && "bg-primary/10",
                      intensity === 2 && "bg-primary/20",
                      intensity === 3 && "bg-primary/35",
                      intensity === 4 && "bg-primary/50",
                      cell.date === todayIso &&
                        "ring-2 ring-primary ring-offset-1 ring-offset-background",
                    )}
                  >
                    <span className="text-[11px] font-medium">{cell.day}</span>
                    {cell.amount > 0 && (
                      <span className="hidden text-[9px] tabular-nums text-muted-foreground sm:inline">
                        {formatAudCompact(cell.amount)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

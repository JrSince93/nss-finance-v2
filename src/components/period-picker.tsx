"use client"

import { usePathname, useRouter } from "next/navigation"

import { formatDate } from "@/lib/format"
import { fyLabel, QUARTER_OPTIONS, type Period, type Quarter } from "@/lib/fy"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * Australian FY quarter picker, shared by Tax & BAS and the Accountant page.
 *
 * The selection lives in the URL (`?fy=2026&q=1`) rather than component state,
 * so the server component re-runs and every section on the page is scoped by
 * the same period — one filter feeding all of them, as on the production app's
 * Accountant page.
 *
 * It takes the current period as a prop rather than calling `useSearchParams`,
 * which would drag a Suspense boundary requirement into every page that uses
 * it for no benefit — the server already parsed these params.
 */
export function PeriodPicker({
  period,
  availableFys,
}: {
  period: Period
  /** Financial years the data touches, newest first. */
  availableFys: number[]
}) {
  const router = useRouter()
  const pathname = usePathname()

  function go(fy: number, quarter: Quarter) {
    router.replace(`${pathname}?fy=${fy}&q=${quarter}`, { scroll: false })
  }

  const years = availableFys.includes(period.fy)
    ? availableFys
    : [period.fy, ...availableFys].sort((a, b) => b - a)

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        Period
      </span>

      <Select
        value={String(period.fy)}
        onValueChange={(value) => value && go(Number(value), period.quarter)}
      >
        <SelectTrigger className="min-w-[130px]" aria-label="Financial year">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((fy) => (
            <SelectItem key={fy} value={String(fy)}>
              {fyLabel(fy)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(period.quarter)}
        onValueChange={(value) =>
          value && go(period.fy, Number(value) as Quarter)
        }
      >
        <SelectTrigger className="min-w-[170px]" aria-label="Quarter">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {QUARTER_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={String(option.value)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-xs text-muted-foreground">
        {formatDate(period.start)} to {formatDate(period.end)}
      </span>
    </div>
  )
}

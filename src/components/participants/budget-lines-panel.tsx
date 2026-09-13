import { AlertTriangleIcon, LockIcon } from "lucide-react"

import { formatAud, formatDate } from "@/lib/format"
import {
  budgetLineFunding,
  budgetLineLabel,
  budgetLineManagementLabel,
  budgetLinesOf,
  budgetLineTypeLabel,
  fundingSchedule,
  isActiveLine,
  labelDuplicatesType,
  scheduleTotal,
  totalFunding,
} from "@/lib/data/budget-lines"
import type { BudgetLine, ParticipantRow } from "@/lib/data/types"
import { Badge } from "@/components/ui/badge"
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

/**
 * A participant's NDIS budget lines — read-only.
 *
 * Shows **every** line, active or not, unlike the card and the funding totals
 * which count active ones only. An inactive line is still part of the record
 * and hiding it here would make a participant's plan look different depending
 * on which screen you were on.
 *
 * Editing is deliberately not built: `budget_lines` drives invoice pricing, and
 * that maths is Tier 3. The form alongside omits the column from its update
 * payload entirely, so saving contact details cannot disturb any of this.
 */
export function BudgetLinesPanel({
  participant,
}: {
  participant: ParticipantRow
}) {
  const lines = budgetLinesOf(participant)
  const activeCount = lines.filter(isActiveLine).length
  const inactiveCount = lines.length - activeCount

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Budget lines</CardTitle>
            <CardDescription>
              {lines.length > 0 ? (
                <>
                  {formatAud(totalFunding(participant))} across {activeCount}{" "}
                  active line{activeCount === 1 ? "" : "s"}
                  {inactiveCount > 0 &&
                    `, plus ${inactiveCount} inactive (not counted)`}
                  .
                </>
              ) : (
                "No budget lines on this participant's plan."
              )}
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <LockIcon className="size-3" />
            Read-only
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {lines.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line</TableHead>
                  <TableHead>Rate card</TableHead>
                  <TableHead>Management</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Plan period
                  </TableHead>
                  <TableHead className="text-right">Funding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, i) => (
                  <LineRow
                    key={line.id ?? `${budgetLineLabel(line)}-${i}`}
                    line={line}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          Budget lines drive invoice pricing, so they are edited in the
          production app until the invoicing maths is ported and tested here.
          Saving this page never changes them.
        </p>
      </CardContent>
    </Card>
  )
}

function LineRow({ line }: { line: BudgetLine }) {
  const active = isActiveLine(line)
  const management = budgetLineManagementLabel(line)
  const schedule = fundingSchedule(line)
  const scheduled = scheduleTotal(line)
  const funding = budgetLineFunding(line)

  // The production app raises this same warning: funding_amount is the
  // authoritative total, so schedule rows that don't sum to it mean one of the
  // two has been mistyped.
  const mismatch =
    scheduled !== null && Math.abs(scheduled - funding) > 0.005

  return (
    <TableRow className={active ? undefined : "opacity-60"}>
      <TableCell>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            {budgetLineLabel(line)}
            {!active && (
              <Badge variant="outline" className="text-[10px]">
                Inactive
              </Badge>
            )}
          </span>
          {schedule.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              Monthly funding schedule · {schedule.length} period
              {schedule.length === 1 ? "" : "s"} totalling{" "}
              {formatAud(scheduled ?? 0)}
            </span>
          )}
        </span>
      </TableCell>

      <TableCell>
        {/* Skip the badge when it would just repeat the name. */}
        {labelDuplicatesType(line) && line.name?.trim() ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <Badge variant="secondary" className="text-[10px]">
            {budgetLineTypeLabel(line)}
          </Badge>
        )}
      </TableCell>

      <TableCell className="text-sm text-muted-foreground">
        {management ?? "—"}
      </TableCell>

      <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground md:table-cell">
        {line.plan_start || line.plan_end
          ? `${formatDate(line.plan_start)} – ${formatDate(line.plan_end)}`
          : "—"}
      </TableCell>

      <TableCell className="text-right">
        <span className="tabular-nums text-sm">{formatAud(funding)}</span>
        {mismatch && (
          <span className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-amber-600 dark:text-amber-400">
            <AlertTriangleIcon className="size-3 shrink-0" />
            schedule sums to {formatAud(scheduled ?? 0)}
          </span>
        )}
      </TableCell>
    </TableRow>
  )
}

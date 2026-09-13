import { LockIcon } from "lucide-react"

import { formatAud, formatDate } from "@/lib/format"
import {
  budgetLineFunding,
  budgetLineLabel,
  budgetLinesOf,
  budgetLineTypeLabel,
  totalFunding,
} from "@/lib/data/budget-lines"
import type { ParticipantRow } from "@/lib/data/types"
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
 * Editing these is deliberately not built yet. `budget_lines` is the JSONB that
 * drives invoice generation: each line's type, management mode, funding and
 * rate-card overrides decide what gets billed and at what price. That maths is
 * Tier 3 work, and an editor shipped ahead of it would let someone change a
 * funding figure with nothing checking the result.
 *
 * The form alongside this deliberately omits `budget_lines` from its update
 * payload, so saving contact details cannot disturb any of it.
 */
export function BudgetLinesPanel({
  participant,
}: {
  participant: ParticipantRow
}) {
  const lines = budgetLinesOf(participant)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Budget lines</CardTitle>
            <CardDescription>
              {lines.length > 0
                ? `${formatAud(totalFunding(participant))} across ${lines.length} line${lines.length === 1 ? "" : "s"}.`
                : "No budget lines on this participant's plan."}
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
                  <TableHead>Type</TableHead>
                  <TableHead>Management</TableHead>
                  <TableHead className="hidden md:table-cell">Period</TableHead>
                  <TableHead className="text-right">Funding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, i) => (
                  <TableRow key={line.id ?? `${budgetLineLabel(line)}-${i}`}>
                    <TableCell className="text-sm font-medium">
                      {budgetLineLabel(line)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {budgetLineTypeLabel(line)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {line.management ?? "—"}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground md:table-cell">
                      {line.start || line.end
                        ? `${formatDate(line.start)} – ${formatDate(line.end)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatAud(budgetLineFunding(line))}
                    </TableCell>
                  </TableRow>
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

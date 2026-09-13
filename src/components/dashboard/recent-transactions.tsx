import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatAud, formatDate } from "@/lib/format"
import { isPayroll, type TransactionRow } from "@/lib/data/types"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"

/**
 * The most recent cash book entries.
 *
 * No merchant logos — the schema has no merchant, only a description typed by
 * whoever entered the row — and money in and out stay in their own columns
 * rather than collapsing to one signed amount.
 */
export function RecentTransactions({
  transactions,
}: {
  transactions: TransactionRow[]
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-semibold">
          Recent transactions
        </CardTitle>
        {/*
          A link, styled as a button — not a Button that navigates. Base UI's
          Button asserts it renders a real <button> (`nativeButton` defaults to
          true), and `nativeButton={false}` would silence that only by stamping
          `role="button"` onto the anchor, which costs the link its semantics.
          Applying `buttonVariants` to the Link keeps a genuine <a href>, so
          cmd-click and open-in-new-tab still work.
        */}
        <Link
          href="/cash-book"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-8 gap-1 text-xs",
          )}
        >
          See all
          <ChevronRightIcon className="size-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <EmptyState
            variant="transactions"
            title="No transactions"
            description="The cash book is empty for your role."
            className="py-8"
          />
        ) : (
          <ul className="divide-y">
            {transactions.map((tx) => {
              const amountIn = tx.amount_in ?? 0
              const amountOut = tx.amount_out ?? 0

              return (
                <li
                  key={tx.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {tx.description || "(no description)"}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isPayroll(tx) && (
                        <Badge variant="secondary" className="text-[10px]">
                          Payroll
                        </Badge>
                      )}
                      <span className="truncate font-mono text-[10px] text-muted-foreground">
                        {tx.reference || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "tabular-nums text-sm font-semibold",
                        amountIn > 0 && "text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      {amountIn > 0
                        ? `+${formatAud(amountIn)}`
                        : amountOut > 0
                          ? `−${formatAud(amountOut)}`
                          : formatAud(0)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(tx.date)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

"use client"

import { useState } from "react"
import { HashIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ReferenceRow } from "@/lib/data/references"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * The reference guide: which prefix each transaction category uses, how many
 * references are already issued, and what the next one would be.
 *
 * Read-only. Rows are computed on the server from the transactions this user
 * can see, so an office manager's counts exclude the restricted employees'
 * payroll rows — which is the right number for them, being what they would get
 * counting the cash book by hand.
 */
export function ReferenceGuide({ rows }: { rows: ReferenceRow[] }) {
  const [open, setOpen] = useState(false)
  const customCount = rows.filter((row) => !row.builtIn).length

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <HashIcon className="size-3.5" />
            Ref guide
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reference guide</DialogTitle>
          <DialogDescription>
            Every transaction category and its reference prefix.
            {customCount > 0 && (
              <>
                {" "}
                {customCount} {customCount === 1 ? "prefix is" : "prefixes are"}{" "}
                derived automatically from custom categories.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Prefix</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead className="text-right">Next</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.description}>
                  <TableCell>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm">
                        {row.description}
                      </span>
                      {!row.builtIn && (
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px]"
                        >
                          custom
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
                      {row.prefix}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums text-sm",
                      row.used === 0 && "text-muted-foreground",
                    )}
                  >
                    {row.used}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {row.next}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          &ldquo;Next&rdquo; is one past the highest number already issued, so a
          deleted reference is retired rather than reused. It is a preview, not
          a reservation — the number is claimed when the transaction is saved.
        </p>
      </DialogContent>
    </Dialog>
  )
}

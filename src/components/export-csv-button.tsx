"use client"

import { DownloadIcon } from "lucide-react"

import { buildCsv, downloadCsv } from "@/lib/csv"
import { Button } from "@/components/ui/button"

/**
 * Export a prepared table as CSV.
 *
 * Rows are built on the server and passed in already formatted, so the button
 * itself is the only client code — the tables it sits beside stay server
 * components. This is a read of data the page is already showing, not a write,
 * so it is safe on the Accountant page.
 */
export function ExportCsvButton({
  header,
  rows,
  filename,
  label = "Export CSV",
}: {
  header: string[]
  rows: (string | number)[][]
  filename: string
  label?: string
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={rows.length === 0}
      onClick={() => downloadCsv(buildCsv(header, rows), filename)}
    >
      <DownloadIcon className="size-3.5" />
      {label}
    </Button>
  )
}

import { ExportCsvButton } from "@/components/export-csv-button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/**
 * One section of the Accountant page: a title, a note, a period-scoped CSV
 * export, and a body.
 *
 * The export is the only control a section carries. No create, edit or delete
 * control renders anywhere on this page, for any role — keep it that way.
 */
export function AccountantSection({
  title,
  note,
  csv,
  children,
}: {
  title: string
  note: string
  csv: { header: string[]; rows: (string | number)[][]; filename: string }
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{note}</CardDescription>
          </div>
          <ExportCsvButton
            header={csv.header}
            rows={csv.rows}
            filename={csv.filename}
          />
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

/** A labelled figure. Used across the page's summary strips. */
export function Figure({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: string
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-3 ring-1 ring-foreground/5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`truncate tabular-nums text-base font-semibold tracking-tight ${tone ?? ""}`}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

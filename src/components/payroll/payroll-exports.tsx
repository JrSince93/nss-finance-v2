"use client"

import { useMemo, useState, useTransition } from "react"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  DownloadIcon,
  LoaderIcon,
} from "lucide-react"

import { downloadCsv } from "@/lib/csv"
import { formatDate } from "@/lib/format"
import { generatePaymentFile } from "@/lib/actions/payroll"
import {
  PAYMENT_PLATFORM_LABELS,
  PAYMENT_PLATFORMS,
  type PaymentPlatform,
  type SkippedRun,
  type SummaryCsv,
} from "@/lib/data/payroll-exports"
import {
  lastCompletedPayPeriod,
  payPeriodIndexForDate,
  recentPayPeriods,
} from "@/lib/pay-periods"
import { ExportCsvButton } from "@/components/export-csv-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

/** How many fortnights the period picker offers, counting back from today's. */
const PERIOD_CHOICES = 13

type Outcome =
  | {
      kind: "downloaded"
      platform: PaymentPlatform
      total: number
      included: number
      skipped: SkippedRun[]
      alreadyPaid: number
    }
  | { kind: "error"; message: string; skipped?: SkippedRun[] }

/**
 * Payroll exports.
 *
 * The summary CSV is built on the server from pay runs this page already shows,
 * and is offered to every role that can reach Payroll.
 *
 * Bank payment files are different: the account numbers they carry are not in
 * this page at all. Each button calls a Server Action that reads bank details
 * under the caller's RLS and returns the finished file, which goes straight to
 * a download rather than into component state.
 *
 * Collapsed by default. The pay-run list is what people open Payroll for, and
 * exports are occasional, so the card stays one line until it's wanted — a line
 * that names what's inside, so it can still be found the first time. Closing it
 * loses nothing: the chosen period and the last result live in this component,
 * not in the panel, which unmounts when closed.
 */
export function PayrollExports({
  today,
  canExportPayments,
  summary,
}: {
  /** Today in Melbourne, `YYYY-MM-DD`, worked out once on the server. */
  today: string
  /** Server-checked in the action too; this only decides what is drawn. */
  canExportPayments: boolean
  summary: SummaryCsv
}) {
  const periods = useMemo(() => recentPayPeriods(today, PERIOD_CHOICES), [today])
  const currentIndex = payPeriodIndexForDate(today)
  const lastCompletedIndex = lastCompletedPayPeriod(today).index

  const [periodIndex, setPeriodIndex] = useState(lastCompletedIndex)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [busy, setBusy] = useState<PaymentPlatform | null>(null)
  const [pending, startTransition] = useTransition()

  function exportPaymentFile(platform: PaymentPlatform) {
    setOutcome(null)
    setBusy(platform)

    startTransition(async () => {
      const result = await generatePaymentFile(platform, periodIndex)
      setBusy(null)

      if (!result.ok) {
        setOutcome({
          kind: "error",
          message: result.error,
          skipped: result.skipped,
        })
        return
      }

      // No byte order mark: a bank importer can read it as part of the first
      // header. The production app's payment files have never carried one.
      downloadCsv(result.csv, result.filename, { bom: false })

      setOutcome({
        kind: "downloaded",
        platform,
        total: result.total,
        included: result.included,
        skipped: result.skipped,
        alreadyPaid: result.alreadyPaid,
      })
    })
  }

  // Only promise bank files to a role that will actually see the buttons.
  const description = canExportPayments
    ? "Payroll summary, and bank payment files for Revolut, Wise or a generic CSV."
    : "Payroll summary as a spreadsheet."

  return (
    <Collapsible defaultOpen={false}>
      {/*
        `gap-0 py-0`: the space under the header lives inside the animated
        panel instead. With the Card's own gap, 16px would stay open for the
        whole closing animation and then snap shut when the panel unmounts.
      */}
      <Card className="gap-0 py-0">
        {/*
          The trigger renders its own native <button>; there is deliberately no
          `render` prop. Base UI's Collapsible.Trigger asserts `nativeButton`,
          and swapping in another element is what logged console errors on the
          Dashboard before. Spans rather than CardTitle/CardDescription, which
          are divs: a <button> may only contain phrasing content. The ring is
          inset because the Card clips its overflow.
        */}
        <CollapsibleTrigger className="group/exports flex w-full items-center justify-between gap-3 px-4 py-4 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50">
          <span className="flex min-w-0 flex-col gap-1">
            <span className="font-heading text-base leading-snug font-medium">
              Exports
            </span>
            <span className="text-sm text-muted-foreground">{description}</span>
          </span>
          <ChevronDownIcon
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[panel-open]/exports:rotate-180 motion-reduce:transition-none"
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none">
          <CardContent className="flex flex-col gap-4 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Payroll summary</p>
                <p className="text-xs text-muted-foreground">
                  Every pay run — hours, gross, PAYG, super and net. No bank
                  details.
                </p>
              </div>
              <ExportCsvButton
                header={summary.header}
                rows={summary.rows}
                filename={summary.filename}
              />
            </div>

            {canExportPayments && (
              <div className="flex flex-col gap-3 border-t pt-4">
                <div>
                  <p className="text-sm font-medium">Bank payment file</p>
                  <p className="text-xs text-muted-foreground">
                    One payment per pay run in the fortnight: net pay to the
                    employee&apos;s account. The file contains bank account
                    numbers — don&apos;t forward it.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="pay-period" className="text-sm">
                    Pay period
                  </label>
                  <select
                    id="pay-period"
                    value={periodIndex}
                    disabled={pending}
                    onChange={(e) => {
                      setPeriodIndex(Number(e.target.value))
                      // A result describes the period it was run for; don't
                      // leave it showing against a different one.
                      setOutcome(null)
                    }}
                    className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
                  >
                    {periods.map((period) => (
                      <option key={period.index} value={period.index}>
                        {formatDate(period.start)} – {formatDate(period.end)}
                        {period.index === currentIndex ? " (current)" : ""}
                        {period.index === lastCompletedIndex
                          ? " (last completed)"
                          : ""}
                      </option>
                    ))}
                  </select>

                  {PAYMENT_PLATFORMS.map((platform) => (
                    <Button
                      key={platform}
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => exportPaymentFile(platform)}
                    >
                      {busy === platform ? (
                        <LoaderIcon className="size-3.5 animate-spin" />
                      ) : (
                        <DownloadIcon className="size-3.5" />
                      )}
                      {PAYMENT_PLATFORM_LABELS[platform]}
                    </Button>
                  ))}
                </div>

                {outcome && <OutcomeNotice outcome={outcome} />}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function OutcomeNotice({ outcome }: { outcome: Outcome }) {
  if (outcome.kind === "error") {
    return (
      <div
        role="alert"
        className="flex flex-col gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        <p className="flex items-start gap-2">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          {outcome.message}
        </p>
        {outcome.skipped && outcome.skipped.length > 0 && (
          <SkippedList skipped={outcome.skipped} />
        )}
      </div>
    )
  }

  const runs = (n: number) => `${n} pay run${n === 1 ? "" : "s"}`

  return (
    <div role="status" className="flex flex-col gap-2">
      <p className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
        {PAYMENT_PLATFORM_LABELS[outcome.platform]} file downloaded:{" "}
        {outcome.included} of {runs(outcome.total)} in the period.
      </p>

      {outcome.alreadyPaid > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          {runs(outcome.alreadyPaid)} in this file{" "}
          {outcome.alreadyPaid === 1 ? "is" : "are"} already marked paid.
          Uploading it would pay {outcome.alreadyPaid === 1 ? "it" : "them"}{" "}
          again.
        </p>
      )}

      {outcome.skipped.length > 0 && (
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <SkippedList skipped={outcome.skipped} />
        </div>
      )}
    </div>
  )
}

function SkippedList({ skipped }: { skipped: SkippedRun[] }) {
  return (
    <div className="flex flex-col gap-0.5 text-foreground">
      <p className="text-xs font-medium">Not in the file:</p>
      <ul className="list-disc pl-5 text-xs text-muted-foreground">
        {skipped.map((run, i) => (
          <li key={`${run.name}-${i}`}>
            {run.name} — {run.reason}
          </li>
        ))}
      </ul>
    </div>
  )
}

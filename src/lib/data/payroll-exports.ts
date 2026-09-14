import { csvAmount, csvCell } from "@/lib/csv"
import { payRunDate } from "@/lib/data/reporting"
import { stripInvisibles } from "@/lib/text"
import type { EmployeeBankRow, PayRunRow } from "@/lib/data/types"
import type { PayPeriod } from "@/lib/pay-periods"

/**
 * Payroll exports: the payroll summary CSV, and bank payment files for a pay
 * period — Revolut, Wise, and a generic CSV.
 *
 * Pure — no Supabase, no DOM — so file contents can be tested byte for byte.
 * Bank details reach `buildPaymentFile` only through the Server Action in
 * `src/lib/actions/payroll.ts`; the payroll page itself never receives them.
 */

// ── Payroll summary ─────────────────────────────────────────────────────────

export type SummaryCsv = {
  header: string[]
  rows: (string | number)[][]
  filename: string
}

/**
 * One row per pay run the caller can see, with the production app's
 * `exportPayroll` columns. There are no bank details in it, so every role that
 * can reach Payroll may have it, the accountant included.
 */
export function payrollSummaryCsv(runs: PayRunRow[], today: string): SummaryCsv {
  return {
    header: [
      "Employee",
      "Period Start",
      "Period End",
      "Hours",
      "Gross",
      "Tax",
      "Super",
      "Net",
    ],
    rows: runs.map((run) => [
      // `employee_name`, not an employees lookup: the accountant can't read
      // `employees`, and this export is theirs too.
      run.employee_name?.trim() || "Unknown",
      run.period_start ?? "",
      run.period_end ?? "",
      run.hours_worked ?? "",
      csvAmount(run.gross_pay),
      csvAmount(run.tax_withheld),
      csvAmount(run.super_amount),
      csvAmount(run.net_pay),
    ]),
    filename: `Payroll_summary_${today}.csv`,
  }
}

// ── Bank payment files ──────────────────────────────────────────────────────
//
// Ported from `doExportPaymentFile` in the production app. These files are
// uploaded to a bank and move real money, so headers, column order, quoting and
// line endings match the production app byte for byte on clean data: an
// importer that accepts today's files has to accept these.
//
// The deliberate differences are each a way the production app can produce a
// file that pays the wrong amount, to the wrong account, or twice:
//
//   * No "export every pay run instead" fallback. For a period with no pay runs
//     the production app offers to export all of them; uploading that pays every
//     historic run again. An empty period is an error here.
//   * Pay runs without a positive net pay are skipped and reported, not written
//     as a $0.00 (or negative) payment line.
//   * Every skipped run is reported with a reason. The production app silently
//     dropped runs whose employee record it couldn't find, so a file could be a
//     person short without saying so.
//   * Account numbers and BSBs are cleaned on every platform: hidden formatting
//     characters removed, and whitespace. The production app only did it for
//     Wise.
//   * Quoted cells escape quotes inside them. The production app wrapped Revolut
//     and generic cells in quotes without doing so, so a name like `Jo "JJ" Li`
//     split the row.

export const PAYMENT_PLATFORMS = ["revolut", "wise", "generic"] as const

export type PaymentPlatform = (typeof PAYMENT_PLATFORMS)[number]

export const PAYMENT_PLATFORM_LABELS: Record<PaymentPlatform, string> = {
  revolut: "Revolut",
  wise: "Wise",
  generic: "Generic CSV",
}

/** The filename prefix the production app uses. */
const FILENAME_PREFIX: Record<PaymentPlatform, string> = {
  revolut: "Revolut",
  wise: "Wise",
  generic: "Generic",
}

const HEADERS: Record<PaymentPlatform, string> = {
  revolut:
    "Name,Recipient type,Account number,Sort code (BSB),Currency,Amount,Payment reference",
  wise: "name,recipientEmail,paymentReference,receiverType,amountCurrency,amount,sourceCurrency,targetCurrency,accountNumber,bsbCode",
  generic:
    "Employee Name,Bank BSB,Account Number,Amount (AUD),Currency,Payment Reference,Period Start,Period End,Employment Type,Hourly Rate,Hours Worked,Gross Pay,PAYG Withheld,Super,Net Pay",
}

/** The Wise file gets CRLF, as the production app sends it; the others LF. */
const LINE_ENDING: Record<PaymentPlatform, string> = {
  revolut: "\n",
  wise: "\r\n",
  generic: "\n",
}

/**
 * The longest payment reference the production app sends Wise.
 *
 * "Wages 2026-08-31 to 2026-09-13" is 30 characters, so what lands on payees'
 * bank statements is cut mid-date: "Wages 2026-08-31 to 2". Kept identical
 * rather than reformatted, because it is the text people already see.
 */
const WISE_REFERENCE_MAX = 21

export type SkippedRun = { name: string; reason: string }

export type PaymentFile = {
  platform: PaymentPlatform
  csv: string
  filename: string
  /** Pay runs dated inside the period. */
  total: number
  /** Payment lines written. */
  included: number
  skipped: SkippedRun[]
  /**
   * Included pay runs already marked paid. The file still contains them — the
   * status can lag the bank — but uploading it would pay them a second time,
   * so the caller should say so.
   */
  alreadyPaid: number
}

export function isPaymentPlatform(value: unknown): value is PaymentPlatform {
  return (
    typeof value === "string" &&
    (PAYMENT_PLATFORMS as readonly string[]).includes(value)
  )
}

/**
 * Pay runs belonging to a period: dated by `paid_date`, falling back to
 * `period_end`, inclusive at both ends. The same anchor the production app's
 * exporter and tax export use.
 */
export function payRunsInPeriod(
  runs: PayRunRow[],
  period: PayPeriod,
): PayRunRow[] {
  return runs.filter((run) => {
    const date = (payRunDate(run) ?? "").slice(0, 10)
    return date !== "" && date >= period.start && date <= period.end
  })
}

/** Always quoted, embedded quotes doubled: the production app's style, made safe. */
function quoted(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function cleanAccount(value: string | null): string {
  return stripInvisibles(value).replace(/\s+/g, "")
}

function cleanBsb(value: string | null): string {
  return stripInvisibles(value).replace(/\s+/g, "")
}

/** Wise's own sense of "paid" — anything past `pending`. */
function isMarkedPaid(run: PayRunRow): boolean {
  return Boolean(run.wise_status) && run.wise_status !== "pending"
}

type LineInput = {
  name: string
  account: string
  bsb: string
  amount: string
  reference: string
  period: PayPeriod
  run: PayRunRow
  employee: EmployeeBankRow
}

function paymentLine(platform: PaymentPlatform, input: LineInput): string {
  const { name, account, bsb, amount, reference, period, run, employee } = input

  switch (platform) {
    case "revolut":
      return [
        quoted(name),
        "INDIVIDUAL",
        csvCell(account),
        csvCell(bsb.replace(/-/g, "")),
        "AUD",
        amount,
        quoted(reference),
      ].join(",")

    case "wise":
      return [
        csvCell(name),
        "",
        csvCell(reference.slice(0, WISE_REFERENCE_MAX)),
        "PERSON",
        "target",
        amount,
        "AUD",
        "AUD",
        csvCell(account),
        csvCell(bsb.replace(/-/g, "")),
      ].join(",")

    case "generic":
      return [
        quoted(name),
        quoted(bsb),
        quoted(account),
        amount,
        "AUD",
        quoted(reference),
        period.start,
        period.end,
        quoted(stripInvisibles(employee.employment_type)),
        // Labelled "Hourly Rate" as in the production app, but it is simply
        // `pay_rate` — an annual figure for a salaried employee.
        csvAmount(employee.pay_rate),
        run.hours_worked || 0,
        csvAmount(run.gross_pay),
        csvAmount(run.tax_withheld),
        csvAmount(run.super_amount),
        amount,
      ].join(",")
  }
}

/**
 * Build a bank payment file: one line per pay run in the period, paying its net
 * pay to the employee's account.
 *
 * `runs` and `employees` must be what the caller's RLS returned. Under any role
 * that can't see the two payroll-restricted employees, both lists would be
 * missing them and the file would be an incomplete pay cycle with nothing to
 * show it — which is why the Server Action only builds these for admin.
 */
export function buildPaymentFile(
  platform: PaymentPlatform,
  period: PayPeriod,
  runs: PayRunRow[],
  employees: EmployeeBankRow[],
): PaymentFile {
  const inPeriod = payRunsInPeriod(runs, period)
  const employeesById = new Map(employees.map((e) => [e.id, e]))
  const reference = `Wages ${period.start} to ${period.end}`

  const lines: string[] = []
  const skipped: SkippedRun[] = []
  let alreadyPaid = 0

  for (const run of inPeriod) {
    const employee = run.employee_id
      ? employeesById.get(run.employee_id)
      : undefined
    const name =
      stripInvisibles(employee?.name ?? run.employee_name) || "Unknown employee"

    if (!employee) {
      skipped.push({ name, reason: "employee record not found" })
      continue
    }

    const account = cleanAccount(employee.bank_account)
    const bsb = cleanBsb(employee.bank_bsb)
    if (!account || !bsb) {
      skipped.push({ name, reason: "no bank details" })
      continue
    }

    const net = Number(run.net_pay)
    if (!Number.isFinite(net) || net <= 0) {
      skipped.push({ name, reason: "no net pay to send" })
      continue
    }

    if (isMarkedPaid(run)) alreadyPaid++

    lines.push(
      paymentLine(platform, {
        name,
        account,
        bsb,
        amount: net.toFixed(2),
        reference,
        period,
        run,
        employee,
      }),
    )
  }

  const eol = LINE_ENDING[platform]

  return {
    platform,
    csv: [HEADERS[platform], ...lines].map((line) => line + eol).join(""),
    filename: `${FILENAME_PREFIX[platform]}_Payroll_${period.start}_to_${period.end}.csv`,
    total: inPeriod.length,
    included: lines.length,
    skipped,
    alreadyPaid,
  }
}

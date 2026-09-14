/**
 * Row shapes for the Supabase tables this app reads.
 *
 * Verified against the live schema (project `bhqjsqwbsbhjuhjwxwcp`) by probing
 * `?select=<column>` per column, with invented control names alongside to
 * confirm the probe discriminates. These are the columns that exist — not the
 * columns the production app's source implies, which is how
 * `participants.pending_invoice` was caught: the production app writes it, and
 * it has never existed.
 *
 * Numeric columns are `numeric` in Postgres, which PostgREST returns as a JSON
 * number, but historical rows and nulls both turn up. Everything money-shaped
 * is therefore `number | null` and goes through `formatAud`, which coerces.
 *
 * Every table here is under RLS. What a query returns depends on the caller's
 * `staff.role` — see `src/lib/auth/roles.ts` and
 * `migrations/2026-09-11-staff-roles.sql` in the production repo.
 */

/** Cash book. */
export type TransactionRow = {
  id: string
  date: string | null
  month: string | null
  description: string | null
  payment_type: string | null
  reference: string | null
  amount_in: number | null
  amount_out: number | null
  allocated_to: "participant" | "company" | null
  participant_id: string | null
  note: string | null
  attachment_path: string | null
}

export type EmployeeRow = {
  id: string
  name: string | null
  role: string | null
  email: string | null
  phone: string | null
  employment_type: string | null
  pay_type: string | null
  pay_rate: number | null
  start_date: string | null
  active: boolean | null
  super_fund: string | null
  bank_bsb: string | null
  sat_rate: number | null
  sun_rate: number | null
  ph_rate: number | null
  sleepover_flat_rate: number | null
}

/**
 * What a bank payment file needs from an employee, and nothing more.
 *
 * Read through `getEmployeesForPaymentFile` only. No tax file number and no
 * ABN: no payment file uses them.
 */
export type EmployeeBankRow = {
  id: string
  name: string | null
  employment_type: string | null
  pay_rate: number | null
  bank_bsb: string | null
  bank_account: string | null
}

/**
 * One employee with the sensitive columns included, for the edit form only.
 *
 * `EmployeeRow` deliberately omits these three so they don't travel with every
 * list render. Read this through `getEmployeeForEdit` and nowhere else.
 */
export type EmployeeEditRow = EmployeeRow & {
  tax_file_number: string | null
  bank_account: string | null
  abn: string | null
}

/**
 * A fortnightly pay run.
 *
 * `employee_name` is denormalised at insert. Read it rather than embedding
 * `employees` — the accountant role has no policy on that table, so an embed
 * returns null names for them silently rather than erroring.
 */
export type PayRunRow = {
  id: string
  employee_id: string | null
  employee_name: string | null
  period_start: string | null
  period_end: string | null
  paid_date: string | null
  hours_worked: number | null
  gross_pay: number | null
  tax_withheld: number | null
  super_amount: number | null
  net_pay: number | null
  status: string | null
  wise_status: string | null
}

/**
 * One NDIS budget line on a participant's plan.
 *
 * Field names taken from `collectBudgetLines()` in the production app, which is
 * what writes this JSONB — not guessed. The earlier version of this type used
 * `label`/`type`/`funding`/`start`/`end`, none of which exist, so every budget
 * line rendered as "Budget line — $0.00".
 *
 * Everything is optional because there is no schema behind JSONB: rows written
 * by `migrateLegacyPlan` carry a different subset from rows written by the
 * budget-line editor, and older rows predate several fields entirely.
 */
export type BudgetLine = {
  id?: string
  /** The operator's name for the line, e.g. "CORE-CP/ASC". */
  name?: string
  /** `agency` | `plan` | `self`. */
  management?: string
  /** Which rate table prices this line: core, core_combined, sil, employment, community, custom. */
  rate_card?: string
  /** Total funding for the line. Authoritative even when `funding_schedule` is set. */
  funding_amount?: number | string | null
  plan_start?: string
  plan_end?: string
  /** Absent means active; only an explicit `false` deactivates. */
  active?: boolean
  /**
   * Irregular monthly funding periods, for lines not funded in even quarters
   * (Lita's SIL line runs a 17th-to-16th cycle). A breakdown of
   * `funding_amount`, not a replacement for it — the production app warns when
   * these rows don't sum to it.
   */
  funding_schedule?: { start?: string; end?: string; amount?: number }[]
  bill_to?: { name?: string; email?: string }
  travel?: {
    enabled?: boolean
    km?: number
    labour_min?: number
    km_rate?: number
    days?: number[]
  }
  rates?: {
    code?: string
    desc?: string
    day_type?: string
    rate?: number
    group?: string
  }[]
}

export type ParticipantRow = {
  id: string
  name: string | null
  ndis_number: string | null
  dob: string | null
  phone: string | null
  address: string | null
  weekly_hours: number | null
  notes: string | null
  active: boolean | null
  archived_at: string | null
  assigned_workers: string[] | null
  budget_lines: BudgetLine[] | null
}

/**
 * The NDIS invoice ledger.
 *
 * `participant_name` is denormalised, which is what lets the accountant role
 * list invoices with no `participants` access at all.
 */
export type InvoiceRow = {
  id: string
  invoice_ref: string | null
  participant_id: string | null
  participant_name: string | null
  amount: number | null
  invoice_date: string | null
  period_start: string | null
  period_end: string | null
  status: string | null
  payment_amount: number | null
  payment_date: string | null
  payment_source: string | null
}

/**
 * An operator-managed dropdown value.
 *
 * `field` is which dropdown it belongs to — `description` (cash book
 * categories) and `type` (payment types) are the two the app uses.
 */
export type DropdownOptionRow = {
  id: string
  field: string | null
  value: string | null
  created_at: string | null
}

export type RecurringExpenseRow = {
  id: string
  label: string | null
  expected_amount: number | null
  expected_day_of_month: number | null
  default_allocated_to: "participant" | "company" | null
  active: boolean | null
}

export type RecurringInstanceRow = {
  id: string
  recurring_expense_id: string
  /** `YYYY-MM`. */
  month: string | null
  transaction_id: string | null
  status: "pending" | "paid" | null
}

// ── Cash book classification ────────────────────────────────────────────────
// Ported from `expIsExpense` / `expIsPayroll` / `expIsTrackable` in the
// production app. The production app's comment is explicit that these rules are
// shared on purpose and must change in one place or not at all, so they live
// here once and every page calls them.

/** Money left the account. */
export function isExpense(tx: TransactionRow): boolean {
  return (tx.amount_out ?? 0) > 0
}

/** Money arrived. */
export function isIncome(tx: TransactionRow): boolean {
  return (tx.amount_in ?? 0) > 0
}

/**
 * A payroll row in the cash book.
 *
 * Two routes because both exist in the data: a `PAYROLL-` reference (covering
 * both the `PAYROLL-PENDING-<runid>` placeholder and the reconciled
 * `PAYROLL-<runid>` row) and a `Payroll - <name>` description for
 * hand-entered rows. Matched case-insensitively.
 *
 * Note this is a *display* rule, not a security one. An office manager never
 * receives the restricted employees' payroll rows in the first place — RLS
 * drops them server-side via `is_restricted_payroll_tx`.
 */
export function isPayroll(tx: TransactionRow): boolean {
  const ref = (tx.reference ?? "").trim().toUpperCase()
  const description = (tx.description ?? "").trim().toUpperCase()
  return ref.startsWith("PAYROLL-") || description.startsWith("PAYROLL - ")
}

/**
 * The single gate for expense lists: an expense that isn't payroll.
 *
 * Payroll is reported on the Payroll page and in its own section of the
 * Accountant page, never mixed into expenses, so the two never double-count.
 */
export function isTrackableExpense(tx: TransactionRow): boolean {
  return isExpense(tx) && !isPayroll(tx)
}

/**
 * A transaction's description with the app's inline status tags removed, for
 * grouping. `Rent [recurring]` and `Rent` are the same expense.
 */
export function cleanDescription(tx: TransactionRow): string {
  const cleaned = (tx.description ?? "")
    .replace(/\s*\[(pending|recurring)\]\s*/gi, " ")
    .trim()
  return cleaned || "(no description)"
}

/** Net effect on the bank balance. Positive is money in. */
export function signedAmount(tx: TransactionRow): number {
  return (tx.amount_in ?? 0) - (tx.amount_out ?? 0)
}

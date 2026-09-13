import "server-only"

import { cache } from "react"

import { createClient } from "@/lib/supabase/server"
import type {
  DropdownOptionRow,
  EmployeeEditRow,
  EmployeeRow,
  InvoiceRow,
  ParticipantRow,
  PayRunRow,
  RecurringExpenseRow,
  RecurringInstanceRow,
  TransactionRow,
} from "@/lib/data/types"

/**
 * Every Supabase read in the app.
 *
 * Three things hold across all of it:
 *
 * 1. **RLS is the filter.** No query here narrows rows by role. An office
 *    manager's `pay_runs` and `employees` reads come back without the two
 *    payroll-restricted employees because the policies in
 *    `migrations/2026-09-11-staff-roles.sql` drop them server-side, and the
 *    accountant gets nothing at all from `employees` and `participants` for the
 *    same reason. Re-implementing any of that here would be a second copy of
 *    the rule, free to drift from the real one.
 *
 * 2. **Paginated, not truncated.** PostgREST caps a response at the project's
 *    max-rows setting and returns the first page with no error. The production
 *    app's `select('*')` calls inherit that cap silently; `selectAll` below
 *    pages until the source is exhausted instead.
 *
 * 3. **Per-request memoised, never cross-request cached.** `React.cache` scopes
 *    a result to one render pass. These must never move to `use cache` or any
 *    persisted cache: the rows returned depend on the caller's role, so a
 *    shared cache would serve one role's data to another.
 */

/** PostgREST rejects a range wider than the project's max-rows, so page under it. */
const PAGE_SIZE = 1000

type Query = {
  range: (from: number, to: number) => PromiseLike<{
    data: unknown[] | null
    error: { message: string } | null
  }>
}

/**
 * Read every row a query matches, a page at a time.
 *
 * Returns `[]` and logs on error rather than throwing: a page that renders with
 * one empty section beats a 500, and an RLS denial is a legitimate empty result
 * for some roles rather than a fault.
 */
async function selectAll<T>(label: string, query: Query): Promise<T[]> {
  const rows: T[] = []

  for (let page = 0; ; page++) {
    const from = page * PAGE_SIZE
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error(`[nss] ${label} query failed:`, error.message)
      return rows
    }

    const batch = (data ?? []) as T[]
    rows.push(...batch)

    if (batch.length < PAGE_SIZE) return rows
  }
}

/** Cash book, oldest first. */
export const getTransactions = cache(async (): Promise<TransactionRow[]> => {
  const supabase = await createClient()
  return selectAll<TransactionRow>(
    "transactions",
    supabase
      .from("transactions")
      .select(
        "id, date, month, description, payment_type, reference, amount_in, amount_out, allocated_to, participant_id, note, attachment_path",
      )
      .order("date", { ascending: true }),
  )
})

/**
 * Employees, by name.
 *
 * Deliberately omits `tax_file_number`, `bank_account` and `abn`. RLS decides
 * who may read the row at all, but a TFN and a full account number have no use
 * on any screen this app renders, and not selecting them keeps them out of the
 * server render and off the wire.
 */
export const getEmployees = cache(async (): Promise<EmployeeRow[]> => {
  const supabase = await createClient()
  return selectAll<EmployeeRow>(
    "employees",
    supabase
      .from("employees")
      .select(
        "id, name, role, email, phone, employment_type, pay_type, pay_rate, start_date, active, super_fund, bank_bsb, sat_rate, sun_rate, ph_rate, sleepover_flat_rate",
      )
      .order("name", { ascending: true }),
  )
})

/**
 * Pay runs, most recent period first.
 *
 * `employee_name` rather than an `employees` embed — see `PayRunRow`.
 */
export const getPayRuns = cache(async (): Promise<PayRunRow[]> => {
  const supabase = await createClient()
  return selectAll<PayRunRow>(
    "pay_runs",
    supabase
      .from("pay_runs")
      .select(
        "id, employee_id, employee_name, period_start, period_end, paid_date, hours_worked, gross_pay, tax_withheld, super_amount, net_pay, status, wise_status",
      )
      .order("period_start", { ascending: false }),
  )
})

/**
 * Participants, by name — archived ones included.
 *
 * `archived_at` is the production app's soft delete: an archived participant
 * drops out of the active roster and the budget tracker, but keeps their
 * invoice history. This returns both, and callers split them, because the page
 * needs the archived list to show it and to restore from it. Filtering here
 * (as this did before archiving was built) makes archived participants
 * unreachable rather than tidy.
 */
export const getParticipants = cache(async (): Promise<ParticipantRow[]> => {
  const supabase = await createClient()
  return selectAll<ParticipantRow>(
    "participants",
    supabase
      .from("participants")
      .select(
        "id, name, ndis_number, dob, phone, address, weekly_hours, notes, active, archived_at, assigned_workers, budget_lines",
      )
      .order("name", { ascending: true }),
  )
})

/**
 * One participant by id, or null if it doesn't exist or RLS hides it.
 *
 * The two cases are indistinguishable from here, deliberately — see
 * `getEmployeeForEdit`.
 */
export const getParticipantById = cache(
  async (id: string): Promise<ParticipantRow | null> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("participants")
      .select(
        "id, name, ndis_number, dob, phone, address, weekly_hours, notes, active, archived_at, assigned_workers, budget_lines",
      )
      .eq("id", id)
      .maybeSingle()

    if (error) {
      console.error("[nss] participant lookup failed:", error.message)
      return null
    }

    return (data as ParticipantRow | null) ?? null
  },
)

/** Invoice ledger, newest invoice first. */
export const getInvoices = cache(async (): Promise<InvoiceRow[]> => {
  const supabase = await createClient()
  return selectAll<InvoiceRow>(
    "invoice_ledger",
    supabase
      .from("invoice_ledger")
      .select(
        "id, invoice_ref, participant_id, participant_name, amount, invoice_date, period_start, period_end, status, payment_amount, payment_date, payment_source",
      )
      .order("invoice_date", { ascending: false }),
  )
})

/**
 * Every column of one employee, for the edit form.
 *
 * Deliberately separate from `getEmployees`, which omits `tax_file_number`,
 * `bank_account` and `abn` because no list screen needs them. This is the one
 * place those three are read, for the one row being edited — so they reach a
 * server render only when someone has actually opened that employee's form,
 * rather than travelling with every employee on every page that lists them.
 *
 * Returns null when the row doesn't exist *or* RLS hides it — an office
 * manager asking for one of the two payroll-restricted employees gets null
 * here, exactly as if the id were made up. The caller must not distinguish the
 * two cases to the user; doing so would confirm the row exists.
 */
export const getEmployeeForEdit = cache(
  async (id: string): Promise<EmployeeEditRow | null> => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("employees")
      .select(
        "id, name, role, email, phone, employment_type, pay_type, pay_rate, start_date, active, super_fund, bank_bsb, sat_rate, sun_rate, ph_rate, sleepover_flat_rate, tax_file_number, bank_account, abn",
      )
      .eq("id", id)
      .maybeSingle()

    if (error) {
      console.error("[nss] employee lookup failed:", error.message)
      return null
    }

    return (data as EmployeeEditRow | null) ?? null
  },
)

/**
 * The operator-managed dropdown values, oldest first.
 *
 * **The order is load-bearing, not cosmetic.** Custom transaction categories
 * get an auto-derived reference prefix, and deriving one depends on which
 * prefixes are already taken — so feeding the same categories in a different
 * order can assign different prefixes. `created_at` ascending is the order the
 * production app has always used, and therefore the order under which every
 * reference in the database was generated. Do not reorder this.
 */
export const getDropdownOptions = cache(
  async (): Promise<DropdownOptionRow[]> => {
    const supabase = await createClient()
    return selectAll<DropdownOptionRow>(
      "dropdown_options",
      supabase
        .from("dropdown_options")
        .select("id, field, value, created_at")
        .order("created_at", { ascending: true }),
    )
  },
)

/** Active recurring-expense definitions. */
export const getRecurringExpenses = cache(
  async (): Promise<RecurringExpenseRow[]> => {
    const supabase = await createClient()
    return selectAll<RecurringExpenseRow>(
      "recurring_expenses",
      supabase
        .from("recurring_expenses")
        .select(
          "id, label, expected_amount, expected_day_of_month, default_allocated_to, active",
        )
        .eq("active", true)
        .order("label", { ascending: true }),
    )
  },
)

/** Per-month paid/pending status for recurring expenses, newest month first. */
export const getRecurringInstances = cache(
  async (): Promise<RecurringInstanceRow[]> => {
    const supabase = await createClient()
    return selectAll<RecurringInstanceRow>(
      "recurring_expense_instances",
      supabase
        .from("recurring_expense_instances")
        .select("id, recurring_expense_id, month, transaction_id, status")
        .order("month", { ascending: false }),
    )
  },
)

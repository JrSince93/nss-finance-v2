import { stripInvisibles, stripToNull } from "@/lib/text"

/**
 * Parsing and validating the employee edit form.
 *
 * Pure — no Supabase, no React — so the rate semantics below can be tested
 * directly. They are the part of this feature most able to cost money if they
 * are wrong.
 *
 * ## Blank is not zero
 *
 * `sat_rate`, `sun_rate`, `ph_rate` and `sleepover_flat_rate` are all nullable,
 * and **null means "work it out at pay time from the SCHADS multipliers"**, not
 * "this employee is paid nothing on a Sunday". Every consumer in the production
 * app reads them with a truthy check:
 *
 *     var satRate = emp && emp.sat_rate ? parseFloat(emp.sat_rate) : (baseRate * 1.5)
 *     if (dayType === 'holiday') return parseFloat(emp.ph_rate) || +(base * 2.25).toFixed(2)
 *
 * So a stored `0` is read as "auto" for those three and the employee is paid
 * the multiplier anyway — a typed zero would silently do nothing.
 * `resolveSleepoverFlatRate` is the exception: it checks for null/undefined/''
 * explicitly, so a stored `0` there *is* honoured and would zero out the
 * sleepover allowance.
 *
 * That inconsistency is why a typed `0` is rejected here rather than stored:
 * in three fields it would be silently ignored, and in the fourth it would
 * silently cost someone their allowance. Blank means auto; if you mean a rate,
 * type a rate.
 */

/** SCHADS multipliers applied when a penalty rate is left blank. */
export const RATE_MULTIPLIERS = {
  saturday: 1.5,
  sunday: 2,
  publicHoliday: 2.25,
} as const

/** Employment types offered, matching the production app's list exactly. */
export const EMPLOYMENT_TYPES = [
  "Casual",
  "Part-time",
  "Full-time",
  "Contractor",
  "Employee-Director",
] as const

export const PAY_TYPES = ["hourly", "salary"] as const

export type PayType = (typeof PAY_TYPES)[number]

export type EmployeeFormValues = {
  name: string
  role: string | null
  email: string | null
  phone: string | null
  employment_type: string
  pay_type: PayType
  pay_rate: number
  start_date: string | null
  sat_rate: number | null
  sun_rate: number | null
  ph_rate: number | null
  sleepover_flat_rate: number | null
  tax_file_number: string | null
  super_fund: string | null
  bank_bsb: string | null
  bank_account: string | null
  abn: string | null
}

export type FieldErrors = Partial<Record<keyof EmployeeFormValues, string>>

export type ParseResult =
  | { ok: true; values: EmployeeFormValues; cleanedFields: string[] }
  | { ok: false; errors: FieldErrors }

/**
 * A nullable rate: blank stays blank, anything else must be a number above
 * zero.
 *
 * Returns `undefined` for invalid input so the caller can distinguish "not
 * provided" (null, valid) from "provided but wrong" (undefined, an error).
 */
function parseOptionalRate(raw: string): number | null | undefined {
  const text = stripInvisibles(raw)
  if (!text) return null

  const value = Number.parseFloat(text)
  if (!Number.isFinite(value) || value <= 0) return undefined

  return roundMoney(value)
}

/** Two decimal places, avoiding the usual float drift. */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

const RATE_FIELDS = [
  ["sat_rate", "Saturday rate"],
  ["sun_rate", "Sunday rate"],
  ["ph_rate", "Public holiday rate"],
  ["sleepover_flat_rate", "Sleepover flat rate"],
] as const

const BLANK_OR_POSITIVE =
  "Leave blank to auto-calculate at pay time, or enter an amount above 0."

/** Read a field from FormData as a string. */
function field(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === "string" ? value : ""
}

/**
 * Parse and validate the edit form.
 *
 * Free text is passed through `stripInvisibles` on the way in, and the names
 * of any fields that actually changed are reported back so the operator can be
 * told rather than having their input quietly rewritten.
 */
export function parseEmployeeForm(form: FormData): ParseResult {
  const errors: FieldErrors = {}
  const cleanedFields: string[] = []

  const text = (name: keyof EmployeeFormValues, label: string) => {
    const raw = field(form, name)
    const clean = stripInvisibles(raw)
    if (clean !== raw.trim()) cleanedFields.push(label)
    return clean
  }

  const name = text("name", "Name")
  if (!name) errors.name = "A name is required."

  // The basis for every derived rate and every pay run. The production app
  // defaults a blank to 0, which silently produces $0 pay runs; this requires
  // it instead. Deliberate divergence.
  const payRateText = stripInvisibles(field(form, "pay_rate"))
  const payRate = Number.parseFloat(payRateText)
  if (!payRateText) {
    errors.pay_rate = "A pay rate is required."
  } else if (!Number.isFinite(payRate) || payRate <= 0) {
    errors.pay_rate = "Enter an amount above 0."
  }

  const payType: PayType = field(form, "pay_type") === "salary" ? "salary" : "hourly"

  const employmentType = field(form, "employment_type")
  if (!(EMPLOYMENT_TYPES as readonly string[]).includes(employmentType)) {
    errors.employment_type = "Choose an employment type."
  }

  const startDate = stripInvisibles(field(form, "start_date")) || null
  if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    errors.start_date = "Enter a valid date."
  }

  const rates: Record<string, number | null> = {}
  for (const [key, label] of RATE_FIELDS) {
    // Penalty rates don't apply to a salaried employee — the production app
    // nulls them on save, and calcPay's salary path never reads them.
    // Sleepover is not a penalty rate and applies to both.
    if (payType === "salary" && key !== "sleepover_flat_rate") {
      rates[key] = null
      continue
    }

    const parsed = parseOptionalRate(field(form, key))
    if (parsed === undefined) {
      errors[key] = `${label}: ${BLANK_OR_POSITIVE}`
    } else {
      rates[key] = parsed
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    cleanedFields,
    values: {
      name,
      role: text("role", "Role") || null,
      email: text("email", "Email") || null,
      phone: text("phone", "Phone") || null,
      employment_type: employmentType,
      pay_type: payType,
      pay_rate: roundMoney(payRate),
      start_date: startDate,
      sat_rate: rates.sat_rate,
      sun_rate: rates.sun_rate,
      ph_rate: rates.ph_rate,
      sleepover_flat_rate: rates.sleepover_flat_rate,
      tax_file_number: stripToNull(field(form, "tax_file_number")),
      super_fund: stripToNull(field(form, "super_fund")),
      bank_bsb: stripToNull(field(form, "bank_bsb")),
      bank_account: stripToNull(field(form, "bank_account")),
      abn: stripToNull(field(form, "abn")),
    },
  }
}

/**
 * What a blank penalty rate will actually resolve to at pay time, for showing
 * as the input's placeholder.
 *
 * The production app's `autoFillRates` does exactly this — it sets the
 * *placeholder*, never the value, so leaving the field alone stores null and
 * the multiplier is applied later. Writing the computed number into the field
 * would freeze it, and a later change to the base rate would then silently stop
 * flowing through to weekends.
 */
export function autoRatePlaceholders(payRate: number | null): {
  sat: string
  sun: string
  ph: string
} {
  const base = Number(payRate) || 0
  if (base <= 0) return { sat: "auto", sun: "auto", ph: "auto" }

  const show = (multiplier: number) =>
    `auto ${(base * multiplier).toFixed(2)}`

  return {
    sat: show(RATE_MULTIPLIERS.saturday),
    sun: show(RATE_MULTIPLIERS.sunday),
    ph: show(RATE_MULTIPLIERS.publicHoliday),
  }
}

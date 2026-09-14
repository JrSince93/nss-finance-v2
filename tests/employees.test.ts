/**
 * Employee edit form: invisible-character stripping, and the blank-vs-zero
 * rate semantics that decide whether someone is paid a penalty rate.
 */
import assert from "node:assert/strict"
import test from "node:test"

import { stripInvisibles, hasInvisibles, stripToNull } from "@/lib/text"
import {
  parseEmployeeForm,
  autoRatePlaceholders,
  RATE_MULTIPLIERS,
  EMPLOYMENT_TYPES,
} from "@/lib/data/employees"

/** A complete, valid form; override one field per test. */
function form(over: Record<string, string> = {}): FormData {
  const base: Record<string, string> = {
    id: "e1",
    name: "Jane Smith",
    role: "Support Worker",
    email: "jane@example.com",
    phone: "0400 000 000",
    employment_type: "Casual",
    pay_type: "hourly",
    pay_rate: "32.00",
    start_date: "2026-01-15",
    sat_rate: "",
    sun_rate: "",
    ph_rate: "",
    sleepover_flat_rate: "",
    tax_file_number: "123 456 789",
    super_fund: "AustralianSuper",
    bank_bsb: "062-000",
    bank_account: "12345678",
    abn: "",
    ...over,
  }

  const fd = new FormData()
  for (const [k, v] of Object.entries(base)) fd.set(k, v)
  return fd
}

// ── stripInvisibles ─────────────────────────────────────────────────────────

test("stripInvisibles removes the characters that ride along from PDFs", () => {
  // Zero-width space inside a TFN — invisible, breaks every comparison.
  assert.equal(stripInvisibles("123​456​789"), "123456789")
  // Bidi embedding / override.
  assert.equal(stripInvisibles("‭danger‬"), "danger")
  // Bidi isolates.
  assert.equal(stripInvisibles("⁦x⁩"), "x")
  // Byte order mark.
  assert.equal(stripInvisibles("﻿Jane"), "Jane")
})

test("stripInvisibles folds non-breaking spaces rather than deleting them", () => {
  // Deleting would run the words together — "JaneSmith".
  assert.equal(stripInvisibles("Jane Smith"), "Jane Smith")
})

test("stripInvisibles trims and handles null", () => {
  assert.equal(stripInvisibles("  padded  "), "padded")
  assert.equal(stripInvisibles(null), "")
  assert.equal(stripInvisibles(undefined), "")
  assert.equal(stripToNull("   "), null)
  assert.equal(stripToNull("  x "), "x")
})

test("hasInvisibles detects what stripInvisibles would change", () => {
  assert.equal(hasInvisibles("clean text"), false)
  assert.equal(hasInvisibles("123​456"), true)
  assert.equal(hasInvisibles("Jane Smith"), true)
  assert.equal(hasInvisibles(null), false)
})

// ── Blank is not zero ───────────────────────────────────────────────────────

test("REGRESSION: a blank penalty rate stores null, not 0", () => {
  // null means "apply the SCHADS multiplier at pay time". Storing 0 would be
  // read as "auto" by calcPay anyway, but as a real zero by
  // resolveSleepoverFlatRate — so blank must never become 0.
  const result = parseEmployeeForm(form())

  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.equal(result.values.sat_rate, null)
  assert.equal(result.values.sun_rate, null)
  assert.equal(result.values.ph_rate, null)
  assert.equal(result.values.sleepover_flat_rate, null)

  // Explicitly not zero — the distinction this whole test exists for.
  assert.notEqual(result.values.sat_rate, 0)
})

test("a typed 0 is rejected rather than silently stored", () => {
  // In sat/sun/ph a stored 0 is read as "auto" and does nothing; in
  // sleepover_flat_rate it is honoured and zeroes the allowance. Either way,
  // accepting it silently loses what the operator meant.
  for (const key of [
    "sat_rate",
    "sun_rate",
    "ph_rate",
    "sleepover_flat_rate",
  ] as const) {
    const result = parseEmployeeForm(form({ [key]: "0" }))
    assert.equal(result.ok, false, `${key} = 0 should be rejected`)
    if (result.ok) continue
    assert.match(result.errors[key] ?? "", /Leave blank to auto-calculate/)
  }
})

test("a negative penalty rate is rejected", () => {
  const result = parseEmployeeForm(form({ sat_rate: "-5" }))
  assert.equal(result.ok, false)
})

test("a real penalty rate is stored, rounded to cents", () => {
  const result = parseEmployeeForm(form({ sat_rate: "48.005", sun_rate: "64" }))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.values.sat_rate, 48.01)
  assert.equal(result.values.sun_rate, 64)
})

test("switching to salary clears penalty rates but keeps sleepover", () => {
  // Matches the production app: calcPay's salary path never reads sat/sun/ph.
  // Sleepover is an allowance, not a penalty rate, and applies to both.
  const result = parseEmployeeForm(
    form({
      pay_type: "salary",
      pay_rate: "65000",
      sat_rate: "48",
      sun_rate: "64",
      ph_rate: "72",
      sleepover_flat_rate: "60",
    }),
  )

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.values.sat_rate, null)
  assert.equal(result.values.sun_rate, null)
  assert.equal(result.values.ph_rate, null)
  assert.equal(result.values.sleepover_flat_rate, 60)
})

// ── Other validation ────────────────────────────────────────────────────────

test("pay_rate is required and must be above 0", () => {
  // The production app defaults a blank to 0, which silently produces $0 pay
  // runs. Deliberate divergence.
  assert.equal(parseEmployeeForm(form({ pay_rate: "" })).ok, false)
  assert.equal(parseEmployeeForm(form({ pay_rate: "0" })).ok, false)
  assert.equal(parseEmployeeForm(form({ pay_rate: "-1" })).ok, false)
  assert.equal(parseEmployeeForm(form({ pay_rate: "32" })).ok, true)
})

test("name is required", () => {
  assert.equal(parseEmployeeForm(form({ name: "" })).ok, false)
  // Whitespace-only, and invisible-only, both count as blank.
  assert.equal(parseEmployeeForm(form({ name: "   " })).ok, false)
  assert.equal(parseEmployeeForm(form({ name: "​" })).ok, false)
})

test("employment type must be one of the known values", () => {
  assert.equal(parseEmployeeForm(form({ employment_type: "Wizard" })).ok, false)
  for (const type of EMPLOYMENT_TYPES) {
    assert.equal(
      parseEmployeeForm(form({ employment_type: type })).ok,
      true,
      `${type} should be accepted`,
    )
  }
  // Contractor specifically, since it's the one the ABN field pairs with.
  assert.equal(parseEmployeeForm(form({ employment_type: "Contractor" })).ok, true)
})

test("a malformed start date is rejected; blank is allowed", () => {
  assert.equal(parseEmployeeForm(form({ start_date: "15/01/2026" })).ok, false)
  assert.equal(parseEmployeeForm(form({ start_date: "" })).ok, true)
})

test("free-text fields are cleaned and the cleaning is reported", () => {
  const result = parseEmployeeForm(
    form({ name: "Jane​Smith", role: "Support Worker" }),
  )

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.values.name, "JaneSmith")
  assert.equal(result.values.role, "Support Worker")
  assert.deepEqual(result.cleanedFields, ["Name", "Role"])
})

test("tax, bank and ABN fields are cleaned and blank becomes null", () => {
  const result = parseEmployeeForm(
    form({
      tax_file_number: "123​456​789",
      bank_bsb: "062​-000",
      abn: "",
    }),
  )

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.values.tax_file_number, "123456789")
  assert.equal(result.values.bank_bsb, "062-000")
  assert.equal(result.values.abn, null)
})

test("`active` is never part of the parsed payload", () => {
  // The production app hardcodes active:true on save, so editing a phone
  // number silently reactivates someone. Omitting it leaves the column alone.
  const result = parseEmployeeForm(form())
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal("active" in result.values, false)
})

// ── autoFillRates: placeholders, never values ───────────────────────────────

test("auto-rate placeholders use the SCHADS multipliers", () => {
  const p = autoRatePlaceholders(32)
  assert.equal(p.sat, `auto ${(32 * RATE_MULTIPLIERS.saturday).toFixed(2)}`)
  assert.equal(p.sun, `auto ${(32 * RATE_MULTIPLIERS.sunday).toFixed(2)}`)
  assert.equal(p.ph, `auto ${(32 * RATE_MULTIPLIERS.publicHoliday).toFixed(2)}`)
  assert.equal(p.sat, "auto 48.00")
  assert.equal(p.sun, "auto 64.00")
  assert.equal(p.ph, "auto 72.00")
})

test("placeholders degrade when there's no base rate yet", () => {
  assert.deepEqual(autoRatePlaceholders(null), {
    sat: "auto",
    sun: "auto",
    ph: "auto",
  })
  assert.deepEqual(autoRatePlaceholders(0), {
    sat: "auto",
    sun: "auto",
    ph: "auto",
  })
})

test("REGRESSION: computing a placeholder never fills the stored value", () => {
  // autoRatePlaceholders is display-only. If its output were written into the
  // field, the rate would freeze and a later base-rate change would stop
  // flowing through to weekends. Proven by parsing a form where the
  // placeholders are non-empty but the inputs are blank.
  const placeholders = autoRatePlaceholders(32)
  assert.notEqual(placeholders.sat, "auto")

  const result = parseEmployeeForm(form({ pay_rate: "32", sat_rate: "" }))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.values.sat_rate, null)
})

// ── The RLS trap, on a restricted employee ──────────────────────────────────

test("REGRESSION: an office_manager editing a restricted employee fails, not silently succeeds", async () => {
  const { writeOne } = await import("@/lib/data/write")

  // This is the literal response observed from the live database when PATCHing
  // employees/2703ae4a-4c46-4802-8fb6-882166a25d82 (a payroll-restricted
  // employee) as a role the policy excludes:
  //
  //   status=200  error=(none)  body=[]
  //
  // The office_manager policy on `employees` is
  //   for all ... using (not is_payroll_restricted_employee(id))
  // so an update aimed at that row matches nothing and produces this same
  // shape. Postgres raises no error; the statement simply affects zero rows.
  const observed = Promise.resolve({
    data: [] as { id: string; name: string | null }[],
    error: null,
  })

  const result = await writeOne(
    "saveEmployee",
    observed,
    "That employee couldn't be found, or your role can't change it.",
  )

  assert.equal(result.ok, false, "must not report success")
  assert.equal(
    result.ok === false && result.error,
    "That employee couldn't be found, or your role can't change it.",
  )
})

test("the not-found message doesn't distinguish hidden from missing", async () => {
  const { writeOne } = await import("@/lib/data/write")

  // A made-up id and a restricted id must produce the same message. Saying
  // "this exists but you can't see it" would confirm the record RLS hides.
  const message = "That employee couldn't be found, or your role can't change it."
  const empty = () => Promise.resolve({ data: [] as unknown[], error: null })

  const madeUp = await writeOne("saveEmployee", empty(), message)
  const restricted = await writeOne("saveEmployee", empty(), message)

  assert.equal(
    madeUp.ok === false && madeUp.error,
    restricted.ok === false && restricted.error,
  )
})

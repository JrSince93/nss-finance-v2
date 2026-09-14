/**
 * Pay periods and payroll exports. The payment files go to a bank, so the
 * expected output is written out byte for byte rather than checked loosely.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  PAY_PERIOD_ANCHOR,
  lastCompletedPayPeriod,
  melbourneToday,
  payPeriodAt,
  payPeriodIndexForDate,
  recentPayPeriods,
} from "@/lib/pay-periods"
import {
  buildPaymentFile,
  isPaymentPlatform,
  payRunsInPeriod,
  payrollSummaryCsv,
} from "@/lib/data/payroll-exports"
import type { EmployeeBankRow, PayRunRow } from "@/lib/data/types"

const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay() // 0 Sun, 1 Mon

// ── Pay periods ─────────────────────────────────────────────────────────────

test("period 0 is the production anchor fortnight, Monday to Sunday", () => {
  assert.equal(PAY_PERIOD_ANCHOR, "2025-01-06")
  assert.deepEqual(payPeriodAt(0), { index: 0, start: "2025-01-06", end: "2025-01-19" })
  assert.equal(weekday("2025-01-06"), 1)
  assert.equal(weekday("2025-01-19"), 0)
})

test("every period starts on a Monday, ends on a Sunday, and they tile", () => {
  for (let i = -30; i <= 80; i++) {
    const p = payPeriodAt(i)
    assert.equal(weekday(p.start), 1, `period ${i} start`)
    assert.equal(weekday(p.end), 0, `period ${i} end`)
    const next = payPeriodAt(i + 1)
    const gap = (Date.parse(next.start) - Date.parse(p.end)) / 86_400_000
    assert.equal(gap, 1, `period ${i} → ${i + 1} must be contiguous`)
  }
})

test("date → period is inclusive at both ends", () => {
  assert.equal(payPeriodIndexForDate("2025-01-06"), 0)
  assert.equal(payPeriodIndexForDate("2025-01-19"), 0)
  assert.equal(payPeriodIndexForDate("2025-01-20"), 1)
})

test("dates before the anchor land in the right negative period", () => {
  // The production app's `if(diff < 0) diff -= 13` is off by one on exact
  // multiples; plain floor division isn't.
  assert.equal(payPeriodIndexForDate("2025-01-05"), -1)
  assert.equal(payPeriodIndexForDate("2024-12-23"), -1)
  assert.equal(payPeriodIndexForDate("2024-12-22"), -2)
  assert.deepEqual(payPeriodAt(-1), { index: -1, start: "2024-12-23", end: "2025-01-05" })
})

test("boundaries hold across both Melbourne daylight-saving changes", () => {
  // Clocks back 6 Apr 2025, forward 5 Oct 2025.
  assert.equal(payPeriodAt(payPeriodIndexForDate("2025-04-07")).start, "2025-03-31")
  assert.equal(payPeriodAt(7).start, "2025-04-14")
  assert.equal(payPeriodIndexForDate("2025-10-13"), 20)
  assert.equal(payPeriodAt(20).start, "2025-10-13")
})

test("recent periods are newest first; last completed is the one before today's", () => {
  // 2026-09-14 is a Monday that begins period 44.
  assert.equal(payPeriodIndexForDate("2026-09-14"), 44)
  assert.deepEqual(
    recentPayPeriods("2026-09-14", 3).map((p) => p.index),
    [44, 43, 42],
  )
  assert.deepEqual(lastCompletedPayPeriod("2026-09-14"), {
    index: 43,
    start: "2026-08-31",
    end: "2026-09-13",
  })
  assert.deepEqual(recentPayPeriods("2026-09-14", 0), [])
})

test("melbourneToday uses Melbourne's date, not the server's UTC date", () => {
  // 01:30 Monday in Melbourne (AEST, UTC+10) is still Sunday in UTC.
  assert.equal(melbourneToday(new Date("2026-09-13T15:30:00Z")), "2026-09-14")
  assert.equal(melbourneToday(new Date("2026-09-13T13:30:00Z")), "2026-09-13")
  // Summer time, UTC+11.
  assert.equal(melbourneToday(new Date("2026-01-05T13:30:00Z")), "2026-01-06")
})

// ── Fixtures ────────────────────────────────────────────────────────────────

const PERIOD = payPeriodAt(43) // 2026-08-31 – 2026-09-13

function run(over: Partial<PayRunRow>): PayRunRow {
  return {
    id: "r",
    employee_id: "e1",
    employee_name: "Jane Smith",
    period_start: "2026-08-31",
    period_end: "2026-09-13",
    paid_date: "2026-09-11",
    hours_worked: 76,
    gross_pay: 2432,
    tax_withheld: 400,
    super_amount: 279.68,
    net_pay: 2032,
    status: "processed",
    wise_status: "pending",
    ...over,
  }
}

const EMPLOYEES: EmployeeBankRow[] = [
  { id: "e1", name: "Jane Smith", employment_type: "Casual", pay_rate: 32, bank_bsb: "062-000", bank_account: "12345678" },
  { id: "e2", name: "Sam O'Neil", employment_type: "Part-time", pay_rate: 34.5, bank_bsb: "063-001", bank_account: "87654321" },
  { id: "e3", name: "No Bank", employment_type: "Casual", pay_rate: 30, bank_bsb: null, bank_account: null },
]

const RUNS: PayRunRow[] = [
  run({ id: "r1" }),
  run({ id: "r2", employee_id: "e2", employee_name: "Sam O'Neil", paid_date: null, net_pay: 1500.5, gross_pay: 1800, tax_withheld: 299.5, super_amount: 207, hours_worked: 52.5, wise_status: "paid" }),
  run({ id: "r3", employee_id: "e3", employee_name: "No Bank", net_pay: 900 }),
  run({ id: "r4", paid_date: "2026-09-18", net_pay: 999 }), // outside the period
  run({ id: "r5", employee_id: "ghost", employee_name: "Former Worker", net_pay: 100 }),
  run({ id: "r6", net_pay: 0 }),
]

// ── Period filtering ────────────────────────────────────────────────────────

test("runs are placed by paid_date, falling back to period_end, inclusively", () => {
  const inside = payRunsInPeriod(RUNS, PERIOD).map((r) => r.id)
  assert.deepEqual(inside, ["r1", "r2", "r3", "r5", "r6"])

  // paid_date wins even when period_end is inside the period.
  const paidLater = run({ paid_date: "2026-09-14", period_end: "2026-09-13" })
  assert.equal(payRunsInPeriod([paidLater], PERIOD).length, 0)

  // Boundaries are inclusive.
  assert.equal(payRunsInPeriod([run({ paid_date: "2026-08-31" })], PERIOD).length, 1)
  assert.equal(payRunsInPeriod([run({ paid_date: "2026-09-13" })], PERIOD).length, 1)
  assert.equal(payRunsInPeriod([run({ paid_date: null, period_end: null })], PERIOD).length, 0)
})

// ── Revolut ─────────────────────────────────────────────────────────────────

test("Revolut file matches the production layout byte for byte", () => {
  const file = buildPaymentFile("revolut", PERIOD, RUNS, EMPLOYEES)

  assert.equal(
    file.csv,
    "Name,Recipient type,Account number,Sort code (BSB),Currency,Amount,Payment reference\n" +
      '"Jane Smith",INDIVIDUAL,12345678,062000,AUD,2032.00,"Wages 2026-08-31 to 2026-09-13"\n' +
      "\"Sam O'Neil\",INDIVIDUAL,87654321,063001,AUD,1500.50,\"Wages 2026-08-31 to 2026-09-13\"\n",
  )
  assert.equal(file.filename, "Revolut_Payroll_2026-08-31_to_2026-09-13.csv")
})

// ── Wise ────────────────────────────────────────────────────────────────────

test("Wise file uses CRLF and the production 21-character reference", () => {
  const file = buildPaymentFile("wise", PERIOD, RUNS, EMPLOYEES)

  assert.equal(
    file.csv,
    "name,recipientEmail,paymentReference,receiverType,amountCurrency,amount,sourceCurrency,targetCurrency,accountNumber,bsbCode\r\n" +
      "Jane Smith,,Wages 2026-08-31 to 2,PERSON,target,2032.00,AUD,AUD,12345678,062000\r\n" +
      "Sam O'Neil,,Wages 2026-08-31 to 2,PERSON,target,1500.50,AUD,AUD,87654321,063001\r\n",
  )
  assert.equal(file.filename, "Wise_Payroll_2026-08-31_to_2026-09-13.csv")
})

// ── Generic ─────────────────────────────────────────────────────────────────

test("generic file carries the full pay breakdown with the BSB dash kept", () => {
  const file = buildPaymentFile("generic", PERIOD, RUNS, EMPLOYEES)
  const lines = file.csv.split("\n")

  assert.equal(
    lines[0],
    "Employee Name,Bank BSB,Account Number,Amount (AUD),Currency,Payment Reference,Period Start,Period End,Employment Type,Hourly Rate,Hours Worked,Gross Pay,PAYG Withheld,Super,Net Pay",
  )
  assert.equal(
    lines[1],
    '"Jane Smith","062-000","12345678",2032.00,AUD,"Wages 2026-08-31 to 2026-09-13",2026-08-31,2026-09-13,"Casual",32.00,76,2432.00,400.00,279.68,2032.00',
  )
  assert.equal(
    lines[2],
    "\"Sam O'Neil\",\"063-001\",\"87654321\",1500.50,AUD,\"Wages 2026-08-31 to 2026-09-13\",2026-08-31,2026-09-13,\"Part-time\",34.50,52.5,1800.00,299.50,207.00,1500.50",
  )
  assert.equal(lines.length, 4, "header, two rows, trailing newline")
  assert.equal(file.filename, "Generic_Payroll_2026-08-31_to_2026-09-13.csv")
})

// ── What's left out, and why ────────────────────────────────────────────────

test("every excluded run is reported with its reason", () => {
  const file = buildPaymentFile("wise", PERIOD, RUNS, EMPLOYEES)

  assert.equal(file.total, 5)
  assert.equal(file.included, 2)
  assert.deepEqual(file.skipped, [
    { name: "No Bank", reason: "no bank details" },
    // The production app dropped this one without saying so.
    { name: "Former Worker", reason: "employee record not found" },
    // …and wrote this one as a $0.00 payment line.
    { name: "Jane Smith", reason: "no net pay to send" },
  ])
})

test("negative or missing net pay is never written as a payment", () => {
  for (const net of [0, -50, null]) {
    const file = buildPaymentFile("revolut", PERIOD, [run({ net_pay: net })], EMPLOYEES)
    assert.equal(file.included, 0, `net_pay ${net}`)
  }
})

test("an empty period produces no lines, not every pay run", () => {
  // The production app's fallback here was "export all pay runs instead".
  const file = buildPaymentFile("wise", payPeriodAt(10), RUNS, EMPLOYEES)
  assert.equal(file.total, 0)
  assert.equal(file.included, 0)
  assert.equal(file.csv.split("\r\n").filter(Boolean).length, 1, "header only")
})

test("runs already marked paid are counted so the user can be warned", () => {
  const file = buildPaymentFile("revolut", PERIOD, RUNS, EMPLOYEES)
  assert.equal(file.alreadyPaid, 1) // r2, wise_status 'paid'
  const noStatus = buildPaymentFile("revolut", PERIOD, [run({ wise_status: null })], EMPLOYEES)
  assert.equal(noStatus.alreadyPaid, 0, "no status is not proof of payment")
})

// ── Cleaning and escaping ───────────────────────────────────────────────────

test("quotes inside a name are escaped instead of splitting the row", () => {
  const employees: EmployeeBankRow[] = [{ ...EMPLOYEES[0], name: 'Jo "JJ" Li' }]
  const revolut = buildPaymentFile("revolut", PERIOD, [run({})], employees)
  const wise = buildPaymentFile("wise", PERIOD, [run({})], employees)

  assert.match(revolut.csv.split("\n")[1], /^"Jo ""JJ"" Li",INDIVIDUAL,/)
  assert.match(wise.csv.split("\r\n")[1], /^"Jo ""JJ"" Li",,/)
})

test("hidden characters and spaces are removed from account and BSB", () => {
  const employees: EmployeeBankRow[] = [
    { ...EMPLOYEES[0], bank_account: "1234​ 5678", bank_bsb: "062​-000 " },
  ]
  const revolut = buildPaymentFile("revolut", PERIOD, [run({})], employees)
  const generic = buildPaymentFile("generic", PERIOD, [run({})], employees)

  assert.match(revolut.csv, /,12345678,062000,/)
  assert.match(generic.csv, /"062-000","12345678"/)
})

test("an account of only hidden characters counts as missing", () => {
  const employees: EmployeeBankRow[] = [{ ...EMPLOYEES[0], bank_account: "​﻿" }]
  const file = buildPaymentFile("wise", PERIOD, [run({})], employees)
  assert.equal(file.included, 0)
  assert.equal(file.skipped[0].reason, "no bank details")
})

test("payment files never start with a byte order mark", () => {
  for (const platform of ["revolut", "wise", "generic"] as const) {
    const file = buildPaymentFile(platform, PERIOD, RUNS, EMPLOYEES)
    assert.notEqual(file.csv.charCodeAt(0), 0xfeff, platform)
  }
})

test("isPaymentPlatform accepts only the three platforms", () => {
  assert.equal(isPaymentPlatform("wise"), true)
  assert.equal(isPaymentPlatform("revolut"), true)
  assert.equal(isPaymentPlatform("generic"), true)
  assert.equal(isPaymentPlatform("WISE"), false)
  assert.equal(isPaymentPlatform("bank"), false)
  assert.equal(isPaymentPlatform(undefined), false)
})

// ── Summary ─────────────────────────────────────────────────────────────────

test("payroll summary has the production columns and no bank details", () => {
  const summary = payrollSummaryCsv(RUNS.slice(0, 2), "2026-09-14")

  assert.deepEqual(summary.header, [
    "Employee", "Period Start", "Period End", "Hours", "Gross", "Tax", "Super", "Net",
  ])
  assert.deepEqual(summary.rows[0], [
    "Jane Smith", "2026-08-31", "2026-09-13", 76, "2432.00", "400.00", "279.68", "2032.00",
  ])
  assert.equal(summary.filename, "Payroll_summary_2026-09-14.csv")

  const flat = JSON.stringify(summary)
  assert.ok(!flat.includes("12345678") && !flat.includes("062-000"), "no bank data")
})

"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  InfoIcon,
  LoaderIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { saveEmployee, type SaveEmployeeState } from "@/lib/actions/employees"
import {
  autoRatePlaceholders,
  EMPLOYMENT_TYPES,
  type EmployeeFormValues,
} from "@/lib/data/employees"
import type { EmployeeEditRow } from "@/lib/data/types"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const INITIAL: SaveEmployeeState = { status: "idle" }

/** A rate column renders blank when null — blank is what means "auto". */
function rateValue(value: number | null): string {
  return value === null || value === undefined ? "" : String(value)
}

export function EmployeeForm({ employee }: { employee: EmployeeEditRow }) {
  const [state, formAction, pending] = useActionState(saveEmployee, INITIAL)

  // Mirrors just enough of the form to drive the two things that react to
  // typing: the auto-rate placeholders, and hiding penalty rates for salary.
  const [payRate, setPayRate] = useState(
    employee.pay_rate === null ? "" : String(employee.pay_rate),
  )
  const [payType, setPayType] = useState(
    employee.pay_type === "salary" ? "salary" : "hourly",
  )

  const isSalary = payType === "salary"
  const placeholders = autoRatePlaceholders(Number.parseFloat(payRate) || null)
  const error = (field: keyof EmployeeFormValues) => state.errors?.[field]

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={employee.id} />

      {state.status === "error" && state.message && (
        <p className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      )}

      {state.status === "saved" && (
        <div className="flex flex-col gap-1 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          <p className="flex items-center gap-2">
            <CheckCircle2Icon className="size-4 shrink-0" />
            {state.message}
          </p>
          {state.cleaned && (
            // Say so rather than rewriting their input silently — invisible
            // characters are invisible, so the change would be undetectable.
            <p className="pl-6 text-xs">
              Removed hidden formatting characters from:{" "}
              {state.cleaned.join(", ")}.
            </p>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" name="name" error={error("name")} required>
            <Input
              id="name"
              name="name"
              defaultValue={employee.name ?? ""}
              autoComplete="off"
            />
          </Field>

          <Field label="Role" name="role" error={error("role")}>
            <Input
              id="role"
              name="role"
              defaultValue={employee.role ?? ""}
              placeholder="Support Worker"
              autoComplete="off"
            />
          </Field>

          <Field label="Email" name="email" error={error("email")}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={employee.email ?? ""}
              autoComplete="off"
            />
          </Field>

          <Field label="Phone" name="phone" error={error("phone")}>
            <Input
              id="phone"
              name="phone"
              defaultValue={employee.phone ?? ""}
              placeholder="04xx xxx xxx"
              autoComplete="off"
            />
          </Field>

          <Field
            label="Employment type"
            name="employment_type"
            error={error("employment_type")}
            required
          >
            <select
              id="employment_type"
              name="employment_type"
              defaultValue={employee.employment_type ?? "Casual"}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            >
              {EMPLOYMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Pay type" name="pay_type" error={error("pay_type")}>
            <select
              id="pay_type"
              name="pay_type"
              value={payType}
              onChange={(e) => setPayType(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="hourly">Hourly</option>
              <option value="salary">Salary</option>
            </select>
          </Field>

          <Field
            label={isSalary ? "Annual salary ($)" : "Weekday rate ($/hr)"}
            name="pay_rate"
            error={error("pay_rate")}
            required
          >
            <Input
              id="pay_rate"
              name="pay_rate"
              type="number"
              step="0.01"
              min="0"
              value={payRate}
              onChange={(e) => setPayRate(e.target.value)}
              placeholder={isSalary ? "65000" : "32.00"}
            />
          </Field>

          <Field label="Start date" name="start_date" error={error("start_date")}>
            <Input
              id="start_date"
              name="start_date"
              type="date"
              defaultValue={employee.start_date ?? ""}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Penalty rates</CardTitle>
          <CardDescription>
            {isSalary
              ? "Salaried employees don't carry penalty rates — these are cleared on save."
              : "Leave blank to auto-calculate from the weekday rate at pay time (SCHADS Award)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {!isSalary && (
            <>
              <Field
                label="Saturday ($/hr)"
                name="sat_rate"
                error={error("sat_rate")}
              >
                <Input
                  id="sat_rate"
                  name="sat_rate"
                  type="number"
                  step="0.01"
                  defaultValue={rateValue(employee.sat_rate)}
                  placeholder={placeholders.sat}
                />
              </Field>

              <Field
                label="Sunday ($/hr)"
                name="sun_rate"
                error={error("sun_rate")}
              >
                <Input
                  id="sun_rate"
                  name="sun_rate"
                  type="number"
                  step="0.01"
                  defaultValue={rateValue(employee.sun_rate)}
                  placeholder={placeholders.sun}
                />
              </Field>

              <Field
                label="Public holiday ($/hr)"
                name="ph_rate"
                error={error("ph_rate")}
              >
                <Input
                  id="ph_rate"
                  name="ph_rate"
                  type="number"
                  step="0.01"
                  defaultValue={rateValue(employee.ph_rate)}
                  placeholder={placeholders.ph}
                />
              </Field>
            </>
          )}

          <Field
            label="Sleepover flat ($/shift)"
            name="sleepover_flat_rate"
            error={error("sleepover_flat_rate")}
          >
            <Input
              id="sleepover_flat_rate"
              name="sleepover_flat_rate"
              type="number"
              step="0.01"
              defaultValue={rateValue(employee.sleepover_flat_rate)}
              placeholder="auto 58.69"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax, super and bank</CardTitle>
          <CardDescription>
            Used by payroll and the bank payment files. Pasted values are
            cleaned of hidden characters on save.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Tax file number" name="tax_file_number">
            <Input
              id="tax_file_number"
              name="tax_file_number"
              defaultValue={employee.tax_file_number ?? ""}
              placeholder="123 456 789"
              autoComplete="off"
            />
          </Field>

          <Field label="Super fund" name="super_fund">
            <Input
              id="super_fund"
              name="super_fund"
              defaultValue={employee.super_fund ?? ""}
              placeholder="AustralianSuper"
              autoComplete="off"
            />
          </Field>

          <Field label="BSB" name="bank_bsb">
            <Input
              id="bank_bsb"
              name="bank_bsb"
              defaultValue={employee.bank_bsb ?? ""}
              placeholder="062-000"
              autoComplete="off"
            />
          </Field>

          <Field label="Account number" name="bank_account">
            <Input
              id="bank_account"
              name="bank_account"
              defaultValue={employee.bank_account ?? ""}
              placeholder="12345678"
              autoComplete="off"
            />
          </Field>

          <Field label="ABN (if contractor)" name="abn">
            <Input
              id="abn"
              name="abn"
              defaultValue={employee.abn ?? ""}
              placeholder="12 345 678 901"
              autoComplete="off"
            />
          </Field>
        </CardContent>
      </Card>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
        Whether this employee is active isn&apos;t changed here — saving edits
        their details only.
      </p>

      <div className="flex items-center justify-end gap-2">
        <Link
          href="/employees"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Cancel
        </Link>
        <Button type="submit" disabled={pending}>
          {pending && <LoaderIcon className="size-4 animate-spin" />}
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  name,
  error,
  required,
  children,
}: {
  label: string
  name: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

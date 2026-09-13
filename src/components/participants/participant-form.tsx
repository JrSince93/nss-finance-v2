"use client"

import { useActionState } from "react"
import Link from "next/link"
import { AlertCircleIcon, LoaderIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  saveParticipant,
  type SaveParticipantState,
} from "@/lib/actions/participants"
import type { ParticipantFormValues } from "@/lib/data/participants"
import type { EmployeeRow, ParticipantRow } from "@/lib/data/types"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const INITIAL: SaveParticipantState = { status: "idle" }

export function ParticipantForm({
  participant,
  employees,
}: {
  participant: ParticipantRow
  /** Active employees, for the assigned-workers picker. */
  employees: EmployeeRow[]
}) {
  const [state, formAction, pending] = useActionState(saveParticipant, INITIAL)
  const error = (field: keyof ParticipantFormValues) => state.errors?.[field]
  const assigned = new Set(participant.assigned_workers ?? [])

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={participant.id} />

      {state.status === "error" && state.message && (
        <p className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            Pasted values are cleaned of hidden characters on save — NDIS
            numbers copied out of a plan PDF often carry them.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" name="name" error={error("name")} required>
            <Input
              id="name"
              name="name"
              defaultValue={participant.name ?? ""}
              autoComplete="off"
            />
          </Field>

          <Field
            label="NDIS number"
            name="ndis_number"
            error={error("ndis_number")}
          >
            <Input
              id="ndis_number"
              name="ndis_number"
              defaultValue={participant.ndis_number ?? ""}
              placeholder="431576794"
              autoComplete="off"
            />
          </Field>

          <Field label="Date of birth" name="dob" error={error("dob")}>
            <Input
              id="dob"
              name="dob"
              type="date"
              defaultValue={participant.dob ?? ""}
            />
          </Field>

          <Field label="Phone" name="phone" error={error("phone")}>
            <Input
              id="phone"
              name="phone"
              defaultValue={participant.phone ?? ""}
              placeholder="04xx xxx xxx"
              autoComplete="off"
            />
          </Field>

          <Field label="Address" name="address" error={error("address")}>
            <Input
              id="address"
              name="address"
              defaultValue={participant.address ?? ""}
              autoComplete="off"
            />
          </Field>

          <Field
            label="Weekly hours"
            name="weekly_hours"
            error={error("weekly_hours")}
          >
            <Input
              id="weekly_hours"
              name="weekly_hours"
              type="number"
              step="0.5"
              min="0"
              defaultValue={
                participant.weekly_hours === null ? "" : participant.weekly_hours
              }
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Notes" name="notes" error={error("notes")}>
              <Textarea
                id="notes"
                name="notes"
                rows={4}
                defaultValue={participant.notes ?? ""}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assigned workers</CardTitle>
          <CardDescription>
            {employees.length > 0
              ? "Who supports this participant."
              : "No active employees to assign."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {employees.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {employees.map((employee) => (
                <label
                  key={employee.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/50 has-checked:border-primary"
                >
                  <input
                    type="checkbox"
                    name="assigned_workers"
                    value={employee.id}
                    defaultChecked={assigned.has(employee.id)}
                    className="size-4 shrink-0 cursor-pointer rounded accent-primary"
                  />
                  <span className="truncate">{employee.name ?? "Unnamed"}</span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link
          href="/participants"
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

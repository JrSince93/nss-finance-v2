"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getStaff } from "@/lib/auth/dal"
import { writeOne } from "@/lib/data/write"
import { parseEmployeeForm, type FieldErrors } from "@/lib/data/employees"
import type { EmployeeEditRow } from "@/lib/data/types"

/**
 * Updating an employee record.
 *
 * Only `admin` and `office_manager` may write employees. The accountant role
 * has no policy on the table at all and no route to this form — this check is
 * belt to RLS's braces, because Server Actions are reachable by direct POST
 * and a hidden button authorises nothing.
 *
 * There is no create and no delete here. This feature is the edit
 * click-through; adding and removing employees is a separate decision, and
 * deleting one who has pay runs would orphan them.
 */

const CAN_WRITE = ["admin", "office_manager"] as const

/**
 * Shown when the update matches no rows.
 *
 * Deliberately ambiguous between "doesn't exist" and "you can't see it". For an
 * office manager attempting one of the two payroll-restricted employees, those
 * are the same event — RLS drops the row either way — and spelling out which
 * would confirm the existence of a record the policy exists to hide.
 */
const NOT_FOUND =
  "That employee couldn't be found, or your role can't change it. " +
  "Reload the page and try again."

export type SaveEmployeeState = {
  status: "idle" | "saved" | "error"
  message?: string
  /** Per-field validation messages, keyed by form field name. */
  errors?: FieldErrors
  /** Free-text fields that had invisible characters stripped on the way in. */
  cleaned?: string[]
}

export async function saveEmployee(
  _previous: SaveEmployeeState,
  formData: FormData,
): Promise<SaveEmployeeState> {
  const id = String(formData.get("id") ?? "")
  if (!id) {
    return { status: "error", message: "No employee was specified." }
  }

  const staff = await getStaff()
  if (!staff) {
    return { status: "error", message: "You need to be signed in to do that." }
  }
  if (!(CAN_WRITE as readonly string[]).includes(staff.role)) {
    return {
      status: "error",
      message: "Your role doesn't allow changing employees.",
    }
  }

  const parsed = parseEmployeeForm(formData)
  if (!parsed.ok) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      errors: parsed.errors,
    }
  }

  const supabase = await createClient()

  // `active` is deliberately not in this payload. The production app hardcodes
  // `active: true` on every save, so editing anyone's phone number silently
  // reactivates them. Omitting the column leaves whatever is there alone.
  const result = await writeOne<EmployeeEditRow>(
    "saveEmployee",
    supabase
      .from("employees")
      .update(parsed.values)
      .eq("id", id)
      // Required, not decorative: the returned row is the only proof the update
      // matched anything. An RLS-filtered update returns 200 with an empty
      // array and a null error — see `writeOne`.
      .select("id, name"),
    NOT_FOUND,
  )

  if (!result.ok) {
    return { status: "error", message: result.error }
  }

  // Back to the list on success. The outcome travels in the query string
  // because the redirect discards this action's return value — and the
  // "characters were cleaned" notice in particular must survive, since
  // invisible characters are by definition undetectable if nobody says so.
  //
  // `redirect` throws, so nothing after it runs, and it re-renders the target
  // route on the way — no separate `refresh()` needed.
  const params = new URLSearchParams({ saved: result.row.name ?? "Employee" })
  if (parsed.cleanedFields.length) {
    params.set("cleaned", parsed.cleanedFields.join(", "))
  }

  redirect(`/employees?${params}`)
}

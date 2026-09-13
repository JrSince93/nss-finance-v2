"use server"

import { refresh } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getStaff } from "@/lib/auth/dal"
import { writeOne, type WriteResult } from "@/lib/data/write"
import type { ParticipantRow } from "@/lib/data/types"

/**
 * Archiving and restoring participants.
 *
 * Archiving is the non-destructive alternative to deleting: it stamps
 * `archived_at` and nothing else. No transaction, invoice, budget line or
 * receipt is touched, and the participant's invoice history stays intact —
 * which is the whole reason it exists, since deleting a participant who has
 * been invoiced would orphan real money.
 *
 * There is deliberately no delete action here. The production app has one, but
 * a hard delete of an invoiced participant is not something this app should
 * make easy, and nothing has asked for it.
 */

/** Only these roles may write participants. The accountant has no policy at all. */
const CAN_WRITE = ["admin", "office_manager"] as const

const NOT_FOUND =
  "That participant couldn't be found, or your role can't change it."

/**
 * Authorise the caller.
 *
 * Server Actions are reachable by direct POST, not only through our buttons, so
 * hiding a control in the UI authorises nothing. RLS is still the real
 * boundary — this check exists so an unauthorised call fails clearly here
 * rather than as an empty result from the database.
 */
async function authorise(): Promise<{ ok: true } | { ok: false; error: string }> {
  const staff = await getStaff()

  if (!staff) {
    return { ok: false, error: "You need to be signed in to do that." }
  }

  if (!(CAN_WRITE as readonly string[]).includes(staff.role)) {
    return { ok: false, error: "Your role doesn't allow changing participants." }
  }

  return { ok: true }
}

async function setArchivedAt(
  id: string,
  archivedAt: string | null,
  label: string,
): Promise<WriteResult<ParticipantRow>> {
  if (!id) return { ok: false, error: "No participant was specified." }

  const auth = await authorise()
  if (!auth.ok) return auth

  const supabase = await createClient()

  return writeOne<ParticipantRow>(
    label,
    supabase
      .from("participants")
      .update({ archived_at: archivedAt })
      .eq("id", id)
      // `.select()` is not optional — the returned row is how `writeOne` knows
      // the update actually matched something rather than being filtered out.
      .select(
        "id, name, ndis_number, dob, phone, address, weekly_hours, notes, active, archived_at, assigned_workers, budget_lines",
      ),
    NOT_FOUND,
  )
}

export type ArchiveResult = { ok: boolean; error?: string; name?: string }

export async function archiveParticipant(id: string): Promise<ArchiveResult> {
  const result = await setArchivedAt(
    id,
    new Date().toISOString(),
    "archiveParticipant",
  )

  if (!result.ok) return { ok: false, error: result.error }

  refresh()
  return { ok: true, name: result.row.name ?? undefined }
}

export async function restoreParticipant(id: string): Promise<ArchiveResult> {
  const result = await setArchivedAt(id, null, "restoreParticipant")

  if (!result.ok) return { ok: false, error: result.error }

  refresh()
  return { ok: true, name: result.row.name ?? undefined }
}

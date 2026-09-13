import "server-only"

import type { Role } from "@/lib/auth/roles"

/**
 * Shared plumbing for every Supabase write in the app.
 *
 * ## The trap this exists to close
 *
 * When RLS filters a row out of an UPDATE or DELETE, Postgres does not raise an
 * error — the statement simply matches nothing. Supabase returns
 * `{ data: [], error: null }`. Code that checks only `error` will report
 * success for a write that never happened.
 *
 * This is reachable in normal use, not just in theory: an office manager cannot
 * see the two payroll-restricted employees, so an update aimed at one of those
 * rows affects nothing. Rows also get archived or deleted between a page render
 * and the click that acts on them.
 *
 * So every write goes through `writeOne` below, which requires the database to
 * hand back the row it claims to have changed. Do not call `.update()` or
 * `.delete()` directly from an action — if it doesn't return the row, we did
 * not write it.
 */

export type WriteResult<T> =
  | { ok: true; row: T }
  | { ok: false; error: string }

/** Roles permitted to perform a write, for the guard in each action. */
export type WriteRoles = readonly Role[]

/**
 * Postgres error codes worth translating into something a person can act on.
 * Anything else surfaces its own message.
 */
const FRIENDLY: Record<string, string> = {
  // insufficient_privilege — a policy rejected the WITH CHECK clause.
  "42501": "Your role doesn't allow that change.",
  // unique_violation
  "23505": "That value is already in use.",
  // foreign_key_violation
  "23503": "That change would break a link to another record.",
  // check_violation
  "23514": "That value isn't allowed for this field.",
}

type SupabaseError = { code?: string; message: string }

type Returning<T> = PromiseLike<{
  data: T[] | null
  error: SupabaseError | null
}>

/**
 * Run a write that is expected to affect exactly one row, and prove it did.
 *
 * `query` must end in `.select()` so the changed row comes back — that return
 * is the proof. An empty array means RLS filtered the row out, or it no longer
 * exists; both are failures, never silent successes.
 *
 * `notFoundMessage` is what the user sees in that case. Word it as "couldn't
 * find it or you can't change it", because from here the two are genuinely
 * indistinguishable — and deliberately so. Telling someone a row exists but is
 * hidden from them leaks the thing RLS is hiding.
 */
export async function writeOne<T>(
  label: string,
  query: Returning<T>,
  notFoundMessage: string,
): Promise<WriteResult<T>> {
  let data: T[] | null
  let error: SupabaseError | null

  try {
    ;({ data, error } = await query)
  } catch (cause) {
    console.error(`[nss] ${label} threw:`, cause)
    return { ok: false, error: "Something went wrong saving that." }
  }

  if (error) {
    console.error(`[nss] ${label} failed:`, error.code, error.message)
    return {
      ok: false,
      error: (error.code && FRIENDLY[error.code]) || error.message,
    }
  }

  const rows = data ?? []

  if (rows.length === 0) {
    // The write was accepted and changed nothing. See the note at the top.
    console.warn(`[nss] ${label} matched no rows — RLS filtered or row missing`)
    return { ok: false, error: notFoundMessage }
  }

  if (rows.length > 1) {
    // Writing several rows from an action that means to write one is a bug in
    // the filter, and a silent one. Surface it rather than returning rows[0].
    console.error(`[nss] ${label} matched ${rows.length} rows, expected 1`)
    return { ok: false, error: "That change matched more than one record." }
  }

  return { ok: true, row: rows[0] }
}

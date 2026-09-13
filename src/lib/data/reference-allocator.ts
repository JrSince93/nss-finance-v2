import { formatReference, nextSequence } from "@/lib/data/references"

/**
 * Claiming a transaction reference without two people getting the same one.
 *
 * ## The bug this exists to fix
 *
 * The production app builds a reference by reading the cash book and adding one
 * (`getNextRef`). Two people adding a transaction at the same moment both read
 * the same cash book, both compute `NDIS-006`, and both insert it. Nothing
 * rejects the second one, so the ledger quietly ends up with two rows sharing a
 * reference — and a reference is how invoice payments are attributed back to
 * budget lines (`attributeReceiptsToLines` matches on it), so a duplicate is
 * not cosmetic.
 *
 * ## Why the fix has to be half in the database
 *
 * No amount of application code can close this on its own. Two server instances
 * cannot see each other's in-flight inserts, so *any* read-then-write scheme
 * has a window. The only thing that can arbitrate is the database.
 *
 * So the fix is two halves:
 *
 *   1. **A unique index on `transactions.reference`** — see
 *      `migrations/2026-09-13-transaction-reference-unique.sql`. This is what
 *      actually makes a duplicate impossible. **It has not been run**, and it
 *      changes behaviour for the production app too, which shares this
 *      database. Read the migration's header before running it.
 *   2. **Retrying here when the database says no.** With the index in place a
 *      losing race surfaces as Postgres error 23505; we recompute from the new
 *      state and try again.
 *
 * Without step 1 this still narrows the window and fixes the far more common
 * delete-and-reuse case (see `nextSequence`), but it does not close the race.
 * Don't describe it as fixed until the migration has run.
 */

/** Postgres `unique_violation`. */
const UNIQUE_VIOLATION = "23505"

/**
 * How many times to retry a losing race before giving up.
 *
 * Each retry means another concurrent writer beat us. Three is generous for a
 * team of this size; the cap exists so a genuinely stuck state fails loudly
 * rather than spinning.
 */
const MAX_ATTEMPTS = 4

export type InsertResult = {
  error: { code?: string; message: string } | null
}

export type ClaimOutcome =
  | { ok: true; reference: string; attempts: number }
  | { ok: false; error: string; attempts: number }

export function isUniqueViolation(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false
  if (error.code === UNIQUE_VIOLATION) return true
  // PostgREST surfaces the code, but be tolerant of a wrapped message too.
  return /duplicate key value|already exists/i.test(error.message ?? "")
}

/**
 * Claim the next reference for `prefix` and perform `insert` with it, retrying
 * if another writer took the same number first.
 *
 * `readReferences` is re-run before every attempt — that is the point. Reusing
 * a stale list would retry with the same losing number forever.
 *
 * `insert` must be the real insert of the row carrying the reference, so the
 * claim and the write are the same operation. Anything that claims a reference
 * and inserts separately reopens the race it is trying to close.
 */
export async function claimReference(
  prefix: string,
  readReferences: () => Promise<(string | null)[]>,
  insert: (reference: string) => Promise<InsertResult>,
): Promise<ClaimOutcome> {
  let lastError = "Could not allocate a reference."

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const existing = await readReferences()
    const reference = formatReference(prefix, nextSequence(prefix, existing))

    const { error } = await insert(reference)

    if (!error) return { ok: true, reference, attempts: attempt }

    if (!isUniqueViolation(error)) {
      return { ok: false, error: error.message, attempts: attempt }
    }

    // Someone else took this number between our read and our write. Re-read and
    // try the next one.
    lastError = `Reference ${reference} was taken by another user.`
  }

  return {
    ok: false,
    error: `${lastError} Gave up after ${MAX_ATTEMPTS} attempts — try again.`,
    attempts: MAX_ATTEMPTS,
  }
}

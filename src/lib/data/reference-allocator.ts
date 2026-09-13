import { formatReference, nextSequence } from "@/lib/data/references"

/**
 * Claiming a transaction reference, retrying on a duplicate-key error.
 *
 * ## Status: dead code, kept for the reasoning
 *
 * Nothing imports this module, and as things stand the retry in it can never
 * do anything. It was written as one half of a two-part fix, and the other half
 * will never exist:
 *
 *   * The plan was a unique index on `transactions.reference`
 *     (`migrations/2026-09-13-transaction-reference-unique.sql`), which would
 *     have turned a lost race into Postgres error 23505 for this code to catch
 *     and retry.
 *   * **That index can't be built, and won't be.** The production app's
 *     `saveTx` deliberately writes every row of a recurring series with the
 *     same reference — a 12-month recurring entry is 13 rows sharing one. So
 *     duplicate references are legitimate data. No series happens to exist in
 *     live data yet (checked 2026-09-14), so the index would build today, then
 *     every later recurring add would fail.
 *
 * With no index, no insert ever fails on a reference collision, so
 * `isUniqueViolation` never matches one and `claimReference` always succeeds on
 * its first attempt with whatever number it computed. It's a plain
 * read-then-write with extra steps. Don't wire it into an insert believing it
 * adds safety.
 *
 * ## What is fixed, and what isn't
 *
 *   * **Fixed: deleted references being reused.** That fix is `nextSequence`
 *     in `references.ts` — `MAX + 1` instead of `COUNT + 1` — not this file,
 *     and it needs no database change.
 *   * **Not fixed: two people saving at the same moment.** Both read the same
 *     cash book, both compute the same next number, and both inserts succeed.
 *     Application code can't close this, since two server instances can't see
 *     each other's in-flight inserts, and the database-side fix is gone. This
 *     is a genuine open gap rather than a cosmetic one: invoice payments are
 *     attributed to budget lines by reference (`attributeReceiptsToLines`), so
 *     a collision can misattribute money. It is open and undecided: nobody has
 *     chosen either to accept the risk or to fix it.
 *
 * Closing it would take a database arbiter that tolerates recurring series:
 * either a partial unique index that excludes them (fragile — recurring rows
 * are marked only by `[recurring]` in the description) or a real `series_id`
 * column the index could be scoped by. Either is its own decision.
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

/**
 * Cash book transaction references.
 *
 * Every cash book row carries a human reference like `NDIS-004` — a prefix for
 * the transaction's description category, then a zero-padded sequence number.
 * This module owns the prefix registry and works out what the next reference
 * for a category should be.
 *
 * Ported from `REF_PREFIXES` / `generatePrefix` / `getPrefixForDesc` /
 * `getNextRef` in the production app, with two behaviour changes that are
 * deliberate — see `nextSequence` and `buildPrefixMap` below.
 *
 * Pure: no Supabase, no React. The allocator that actually claims a reference
 * at insert time lives in `reference-allocator.ts`, which has to touch the
 * database to be race-safe.
 */

/**
 * The built-in description → prefix map, verbatim from the production app.
 *
 * These are load-bearing: every historical reference in the database was built
 * from this table, so an entry can be added but none may be changed or removed
 * without orphaning the rows that used it.
 */
export const BUILTIN_PREFIXES: Readonly<Record<string, string>> = Object.freeze({
  "NDIS Payment": "NDIS",
  "Plan Management Fee": "PMF",
  "Support Worker Pay": "SWP",
  "Fuel Reimbursement": "FUEL",
  "Office Supplies": "OFF",
  "Admin Fee": "ADM",
  "Shareholder Distribution": "DIST",
  "Equipment Purchase": "EQP",
  "Vehicle Expense": "VEH",
  "Other Income": "INC",
  "Other Expense": "EXP",
  Payroll: "PAY",
})

/** How many digits the sequence number is padded to. `NDIS-004`, not `NDIS-4`. */
const SEQUENCE_PAD = 3

/**
 * Derive a prefix from a category name, avoiding anything in `taken`.
 *
 * One word: strip the vowels and take up to 4 characters, falling back to the
 * first 4 characters when that leaves too little (so "Uber" doesn't become "B").
 * Several words: initials, up to 4.
 *
 * On a clash, the first three characters plus an incrementing digit — matching
 * the production app exactly, because a different tie-break would produce a
 * different prefix for a category that already has references in the database.
 */
export function generatePrefix(name: string, taken: Iterable<string>): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  let prefix = ""

  if (words.length === 1) {
    prefix = words[0].replace(/[aeiou]/gi, "").slice(0, 4).toUpperCase()
    if (prefix.length < 2) prefix = words[0].slice(0, 4).toUpperCase()
  } else if (words.length > 1) {
    prefix = words
      .map((word) => word[0] ?? "")
      .join("")
      .slice(0, 4)
      .toUpperCase()
  }

  if (!prefix) prefix = name.slice(0, 4).toUpperCase()

  const used = new Set(taken)
  if (used.has(prefix)) {
    const stem = prefix.slice(0, 3)
    let n = 2
    while (used.has(stem + n)) n++
    prefix = stem + n
  }

  return prefix
}

/**
 * The full description → prefix map: the built-ins, plus a generated prefix for
 * every custom category.
 *
 * **Order matters and is not alphabetical.** Clash resolution depends on what
 * is already taken, so the same custom categories fed in a different order can
 * produce different prefixes. `customDescriptions` must therefore arrive in
 * `dropdown_options.created_at` ascending order — the same order the production
 * app loads them in, which is what every reference already in the database was
 * generated under. Sorting them would silently re-map live categories.
 *
 * The production app rebuilt this by mutating a module-level object as
 * descriptions were encountered, so its result depended on which screens the
 * user had visited that session. This is a pure function of the inputs instead.
 */
export function buildPrefixMap(
  customDescriptions: readonly string[],
): Map<string, string> {
  const map = new Map<string, string>(Object.entries(BUILTIN_PREFIXES))
  const taken = new Set(map.values())

  for (const description of customDescriptions) {
    const name = description.trim()
    if (!name || map.has(name)) continue

    const prefix = generatePrefix(name, taken)
    map.set(name, prefix)
    taken.add(prefix)
  }

  return map
}

/**
 * The prefix for a description, matching the production app's lookup order:
 * longest built-in prefix match first, then an exact custom match.
 *
 * The production app used `description.indexOf(key) === 0` over `Object.keys`
 * in insertion order, so "Payroll - Jane" matched "Payroll" → PAY. Matching the
 * longest key first makes that stable if a future category is a prefix of
 * another (e.g. "Admin Fee" and "Admin Fee - Late").
 */
export function prefixForDescription(
  description: string | null | undefined,
  prefixMap: ReadonlyMap<string, string>,
): string | null {
  const name = (description ?? "").trim()
  if (!name) return null

  const exact = prefixMap.get(name)
  if (exact) return exact

  let best: { key: string; prefix: string } | null = null
  for (const [key, prefix] of prefixMap) {
    if (!name.startsWith(key)) continue
    if (!best || key.length > best.key.length) best = { key, prefix }
  }

  return best?.prefix ?? null
}

/** Every reference already using this prefix, as their numeric suffixes. */
function suffixesFor(
  prefix: string,
  references: Iterable<string | null | undefined>,
): number[] {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`)
  const out: number[] = []

  for (const reference of references) {
    const match = pattern.exec((reference ?? "").trim())
    if (match) out.push(Number.parseInt(match[1], 10))
  }

  return out
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * How many references already exist for a prefix. Display only.
 *
 * This is a count of rows, which is what the production app's guide showed, and
 * it is deliberately NOT what `nextSequence` is built from.
 */
export function usageCount(
  prefix: string,
  references: Iterable<string | null | undefined>,
): number {
  return suffixesFor(prefix, references).length
}

/**
 * The next sequence number for a prefix: one past the highest already used.
 *
 * **This is a deliberate fix, not a port.** The production app returned
 * `count + 1`, counting the rows carrying the prefix. That reuses a reference
 * the moment one is deleted: with NDIS-001…NDIS-005 present the next is
 * NDIS-006, but delete any one of them and the count drops to 4, so the next
 * becomes NDIS-005 — a reference already on another row. Taking the maximum
 * means a deleted reference is retired rather than recycled.
 *
 * This still cannot stop two people claiming the same number at the same
 * instant; nothing computed in the app can. See `reference-allocator.ts`.
 */
export function nextSequence(
  prefix: string,
  references: Iterable<string | null | undefined>,
): number {
  const suffixes = suffixesFor(prefix, references)
  return suffixes.length === 0 ? 1 : Math.max(...suffixes) + 1
}

/** `NDIS-004` — a prefix and a sequence number, zero-padded. */
export function formatReference(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(SEQUENCE_PAD, "0")}`
}

/** The next reference for a prefix, or null if the prefix is unknown. */
export function nextReference(
  prefix: string,
  references: Iterable<string | null | undefined>,
): string {
  return formatReference(prefix, nextSequence(prefix, references))
}

export type ReferenceRow = {
  description: string
  prefix: string
  /** How many transactions already carry this prefix. */
  used: number
  /** What the next reference for this category would be. */
  next: string
  /** False for a prefix auto-derived from a custom dropdown category. */
  builtIn: boolean
}

/**
 * The reference guide table: one row per category, most-used first.
 *
 * `references` is every `transactions.reference` the caller can see — so an
 * office manager's counts legitimately exclude the restricted employees'
 * payroll rows, which RLS never returned. That is the correct number for them:
 * it is what they would see if they counted the cash book by hand.
 */
export function buildReferenceGuide(
  prefixMap: ReadonlyMap<string, string>,
  references: Iterable<string | null | undefined>,
): ReferenceRow[] {
  const all = Array.from(references)

  return Array.from(prefixMap, ([description, prefix]) => ({
    description,
    prefix,
    used: usageCount(prefix, all),
    next: nextReference(prefix, all),
    builtIn: Object.hasOwn(BUILTIN_PREFIXES, description),
  })).sort(
    (a, b) => b.used - a.used || a.description.localeCompare(b.description),
  )
}

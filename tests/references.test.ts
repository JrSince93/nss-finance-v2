/**
 * Cash book reference logic, including the two bugs this feature fixes:
 * deleted references being reused, and concurrent writers colliding.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  BUILTIN_PREFIXES,
  generatePrefix,
  buildPrefixMap,
  prefixForDescription,
  usageCount,
  nextSequence,
  nextReference,
  formatReference,
  buildReferenceGuide,
} from "@/lib/data/references"
import {
  claimReference,
  isUniqueViolation,
  type InsertResult,
} from "@/lib/data/reference-allocator"

// ── Prefix derivation ───────────────────────────────────────────────────────

test("built-in prefixes match the production app exactly", () => {
  // These generated every historical reference; changing one orphans rows.
  assert.equal(BUILTIN_PREFIXES["NDIS Payment"], "NDIS")
  assert.equal(BUILTIN_PREFIXES["Plan Management Fee"], "PMF")
  assert.equal(BUILTIN_PREFIXES["Support Worker Pay"], "SWP")
  assert.equal(BUILTIN_PREFIXES["Fuel Reimbursement"], "FUEL")
  assert.equal(BUILTIN_PREFIXES["Other Expense"], "EXP")
  assert.equal(BUILTIN_PREFIXES["Payroll"], "PAY")
  assert.equal(Object.keys(BUILTIN_PREFIXES).length, 12)
})

test("generatePrefix reproduces the production algorithm", () => {
  // Multi-word → initials, max 4.
  assert.equal(generatePrefix("Cleaning Supplies", []), "CS")
  assert.equal(generatePrefix("Really Very Long Category Name", []), "RVLC")
  // Single word → consonants, max 4.
  assert.equal(generatePrefix("Insurance", []), "NSRN")
  // Single word that loses too much to vowel-stripping falls back to a slice.
  assert.equal(generatePrefix("Aeon", []), "AEON")
})

test("generatePrefix resolves clashes with a numbered stem", () => {
  assert.equal(generatePrefix("Cleaning Supplies", ["CS"]), "CS2")
  assert.equal(generatePrefix("Cleaning Supplies", ["CS", "CS2"]), "CS3")
  // Stem is the first three characters, per the production app.
  assert.equal(generatePrefix("Alpha Beta Cat Dog", ["ABCD"]), "ABC2")
})

test("buildPrefixMap keeps built-ins and never reuses a taken prefix", () => {
  const map = buildPrefixMap(["Cleaning Supplies", "Courier Service"])

  assert.equal(map.get("NDIS Payment"), "NDIS")
  assert.equal(map.get("Cleaning Supplies"), "CS")
  assert.equal(map.get("Courier Service"), "CS2")

  const prefixes = Array.from(map.values())
  assert.equal(new Set(prefixes).size, prefixes.length, "prefixes must be unique")
})

test("buildPrefixMap is order-dependent — the reason created_at order matters", () => {
  const forward = buildPrefixMap(["Cleaning Supplies", "Courier Service"])
  const reversed = buildPrefixMap(["Courier Service", "Cleaning Supplies"])

  // Same categories, different order, different prefixes. This is exactly why
  // the query must not be re-sorted.
  assert.equal(forward.get("Cleaning Supplies"), "CS")
  assert.equal(reversed.get("Cleaning Supplies"), "CS2")
})

test("buildPrefixMap ignores blanks and duplicates", () => {
  const map = buildPrefixMap(["", "   ", "Cleaning Supplies", "Cleaning Supplies"])
  assert.equal(map.get("Cleaning Supplies"), "CS")
  assert.equal(Array.from(map.keys()).filter((k) => k === "Cleaning Supplies").length, 1)
})

test("prefixForDescription matches the longest key, like the production lookup", () => {
  const map = buildPrefixMap([])
  // Exact.
  assert.equal(prefixForDescription("NDIS Payment", map), "NDIS")
  // Prefix match — "Payroll - Jane Doe" is a real description in the data.
  assert.equal(prefixForDescription("Payroll - Jane Doe", map), "PAY")
  // Unknown.
  assert.equal(prefixForDescription("Something Else Entirely", map), null)
  assert.equal(prefixForDescription("", map), null)
  assert.equal(prefixForDescription(null, map), null)
})

test("prefixForDescription prefers the longer of two overlapping keys", () => {
  const map = buildPrefixMap(["Admin Fee Late"])
  // "Admin Fee" is built in (ADM); "Admin Fee Late" is custom.
  assert.equal(prefixForDescription("Admin Fee Late", map), map.get("Admin Fee Late"))
  assert.notEqual(prefixForDescription("Admin Fee Late", map), "ADM")
})

// ── Sequence numbering ──────────────────────────────────────────────────────

test("nextSequence starts at 1 when nothing is issued", () => {
  assert.equal(nextSequence("NDIS", []), 1)
  assert.equal(nextReference("NDIS", []), "NDIS-001")
})

test("nextSequence is one past the highest, not the count", () => {
  const refs = ["NDIS-001", "NDIS-002", "NDIS-003"]
  assert.equal(nextSequence("NDIS", refs), 4)
})

test("REGRESSION: a deleted reference is retired, not reused", () => {
  // The production bug: getNextRef returns COUNT + 1, so deleting one row makes
  // the next reference collide with a live one.
  const afterDelete = ["NDIS-001", "NDIS-002", "NDIS-004", "NDIS-005"]

  assert.equal(usageCount("NDIS", afterDelete), 4, "count is 4 after the delete")
  // The production app would have produced NDIS-005 here — already in use.
  assert.equal(nextReference("NDIS", afterDelete), "NDIS-006")
  assert.ok(
    !afterDelete.includes(nextReference("NDIS", afterDelete)),
    "next reference must not already exist",
  )
})

test("sequence numbering only counts its own prefix", () => {
  const refs = ["NDIS-009", "PMF-001", "PMF-002", "PAY-100"]
  assert.equal(nextReference("PMF", refs), "PMF-003")
  assert.equal(nextReference("NDIS", refs), "NDIS-010")
  assert.equal(nextReference("PAY", refs), "PAY-101")
})

test("non-sequence references are ignored", () => {
  // Payroll and Wise rows carry references that aren't PREFIX-nnn.
  const refs = [
    "PAYROLL-1a2b3c4d",
    "PAYROLL-PENDING-1a2b3c4d",
    null,
    "",
    "   ",
    "PAY-002",
  ]
  assert.equal(nextReference("PAY", refs), "PAY-003")
  assert.equal(usageCount("PAY", refs), 1)
  // "PAYROLL-..." must not be read as prefix PAYROLL with a numeric suffix.
  assert.equal(usageCount("PAYROLL", refs), 0)
})

test("a prefix that is a regex metacharacter is escaped", () => {
  assert.equal(nextReference("A.B", ["AXB-005"]), "A.B-001")
})

test("sequence padding keeps three digits and grows past 999", () => {
  assert.equal(formatReference("NDIS", 7), "NDIS-007")
  assert.equal(formatReference("NDIS", 42), "NDIS-042")
  assert.equal(formatReference("NDIS", 999), "NDIS-999")
  assert.equal(formatReference("NDIS", 1000), "NDIS-1000")
  assert.equal(nextReference("NDIS", ["NDIS-999"]), "NDIS-1000")
})

// ── Guide assembly ──────────────────────────────────────────────────────────

test("guide rows are sorted by usage and flag custom categories", () => {
  const rows = buildReferenceGuide(buildPrefixMap(["Cleaning Supplies"]), [
    "PMF-001",
    "PMF-002",
    "NDIS-001",
  ])

  assert.equal(rows[0].description, "Plan Management Fee")
  assert.equal(rows[0].used, 2)
  assert.equal(rows[0].next, "PMF-003")
  assert.equal(rows[0].builtIn, true)

  const custom = rows.find((r) => r.description === "Cleaning Supplies")!
  assert.equal(custom.builtIn, false)
  assert.equal(custom.used, 0)
  assert.equal(custom.next, "CS-001")

  // Every category appears exactly once.
  assert.equal(rows.length, Object.keys(BUILTIN_PREFIXES).length + 1)
})

// ── Race handling ───────────────────────────────────────────────────────────

test("isUniqueViolation recognises the Postgres code and the message", () => {
  assert.equal(isUniqueViolation({ code: "23505", message: "x" }), true)
  assert.equal(
    isUniqueViolation({ message: 'duplicate key value violates unique constraint' }),
    true,
  )
  assert.equal(isUniqueViolation({ code: "23503", message: "fk" }), false)
  assert.equal(isUniqueViolation(null), false)
})

test("claimReference succeeds first time when nothing collides", async () => {
  const inserted: string[] = []
  const result = await claimReference(
    "NDIS",
    async () => ["NDIS-001"],
    async (reference) => {
      inserted.push(reference)
      return { error: null }
    },
  )

  assert.deepEqual(result, { ok: true, reference: "NDIS-002", attempts: 1 })
  assert.deepEqual(inserted, ["NDIS-002"])
})

test("REGRESSION: a losing race retries with the next number", async () => {
  // Simulates another writer taking NDIS-002 between our read and our write.
  const existing = ["NDIS-001"]
  const attempted: string[] = []

  const result = await claimReference(
    "NDIS",
    async () => [...existing],
    async (reference): Promise<InsertResult> => {
      attempted.push(reference)
      if (reference === "NDIS-002") {
        // The other writer's row is now visible to the next read.
        existing.push("NDIS-002")
        return { error: { code: "23505", message: "duplicate key value" } }
      }
      existing.push(reference)
      return { error: null }
    },
  )

  assert.equal(result.ok, true)
  assert.equal(result.ok && result.reference, "NDIS-003")
  assert.deepEqual(attempted, ["NDIS-002", "NDIS-003"], "must retry, not reuse")
})

test("claimReference gives up rather than spinning forever", async () => {
  let attempts = 0
  const result = await claimReference(
    "NDIS",
    async () => [],
    async () => {
      attempts++
      return { error: { code: "23505", message: "duplicate key value" } }
    },
  )

  assert.equal(result.ok, false)
  assert.equal(attempts, 4)
  assert.match(result.ok === false ? result.error : "", /Gave up after 4/)
})

test("a non-collision error is returned immediately, not retried", async () => {
  let attempts = 0
  const result = await claimReference(
    "NDIS",
    async () => [],
    async () => {
      attempts++
      return { error: { code: "42501", message: "permission denied" } }
    },
  )

  assert.equal(result.ok, false)
  assert.equal(attempts, 1, "an RLS denial must not be retried")
  assert.equal(result.ok === false && result.error, "permission denied")
})

test("claimReference re-reads before every attempt", async () => {
  let reads = 0
  await claimReference(
    "NDIS",
    async () => {
      reads++
      return []
    },
    async () =>
      reads < 3
        ? { error: { code: "23505", message: "duplicate key value" } }
        : { error: null },
  )

  assert.equal(reads, 3, "stale reads would retry the same losing number")
})

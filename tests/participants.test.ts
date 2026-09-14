/**
 * The archive feature's logic: the participant partition helpers, and the
 * write helper that closes the RLS silent-success trap.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  isArchived,
  partitionByArchived,
  archivedLabel,
  participantName,
} from "@/lib/data/participants"
import { writeOne } from "@/lib/data/write"
import type { ParticipantRow } from "@/lib/data/types"

const participant = (over: Partial<ParticipantRow>): ParticipantRow => ({
  id: "p1",
  name: "Jane Doe",
  ndis_number: null,
  dob: null,
  phone: null,
  address: null,
  weekly_hours: null,
  notes: null,
  active: true,
  archived_at: null,
  assigned_workers: null,
  budget_lines: null,
  ...over,
})

/** A stand-in for the thenable a Supabase query resolves to. */
const query = <T>(result: {
  data: T[] | null
  error: { code?: string; message: string } | null
}) => Promise.resolve(result)

// ── Partition helpers ───────────────────────────────────────────────────────

test("isArchived keys off archived_at, not the `active` column", () => {
  assert.equal(isArchived(participant({})), false)
  assert.equal(
    isArchived(participant({ archived_at: "2026-09-12T04:00:00Z" })),
    true,
  )
  // `active: false` is a different, unrelated flag — it must not read as archived.
  assert.equal(isArchived(participant({ active: false })), false)
})

test("partitionByArchived splits and preserves order", () => {
  const rows = [
    participant({ id: "a", name: "Abdi" }),
    participant({ id: "b", name: "Bob", archived_at: "2026-01-01T00:00:00Z" }),
    participant({ id: "c", name: "Cara" }),
    participant({ id: "d", name: "Dan", archived_at: "2026-02-01T00:00:00Z" }),
  ]

  const { active, archived } = partitionByArchived(rows)

  assert.deepEqual(active.map((p) => p.id), ["a", "c"])
  assert.deepEqual(archived.map((p) => p.id), ["b", "d"])
  assert.equal(active.length + archived.length, rows.length, "nothing dropped")
})

test("partitionByArchived handles empty input", () => {
  assert.deepEqual(partitionByArchived([]), { active: [], archived: [] })
})

test("archivedLabel formats the timestamp's date part, not UTC-shifted", () => {
  // A timestamptz early on the 12th UTC is still the 12th in Melbourne only if
  // we take the date part rather than parsing the whole instant.
  const row = participant({ archived_at: "2026-09-12T00:30:00Z" })
  assert.equal(archivedLabel(row), "Archived 12 Sept 2026")
  assert.equal(archivedLabel(participant({})), null)
})

test("participantName falls back for blank names", () => {
  assert.equal(participantName(participant({ name: "Jane Doe" })), "Jane Doe")
  assert.equal(participantName(participant({ name: "  " })), "Unnamed participant")
  assert.equal(participantName(participant({ name: null })), "Unnamed participant")
})

// ── writeOne: the RLS trap ──────────────────────────────────────────────────

test("writeOne returns the row on a successful single-row write", async () => {
  const row = participant({ archived_at: "2026-09-13T00:00:00Z" })
  const result = await writeOne("test", query({ data: [row], error: null }), "nope")

  assert.equal(result.ok, true)
  assert.equal(result.ok && result.row.id, "p1")
})

test("REGRESSION: an RLS-filtered write is a failure, not a silent success", async () => {
  // This is the trap. Postgres raises nothing when RLS filters the row out —
  // Supabase returns an empty array with a null error. Treating that as success
  // is how a UI says "Saved" for a write that never happened.
  const result = await writeOne(
    "test",
    query<ParticipantRow>({ data: [], error: null }),
    "Couldn't find that participant, or your role can't change it.",
  )

  assert.equal(result.ok, false)
  assert.equal(
    result.ok === false && result.error,
    "Couldn't find that participant, or your role can't change it.",
  )
})

test("writeOne treats a null data array as no rows", async () => {
  const result = await writeOne(
    "test",
    query<ParticipantRow>({ data: null, error: null }),
    "not found",
  )
  assert.equal(result.ok, false)
})

test("writeOne refuses a write that matched several rows", async () => {
  // An action meaning to write one row that writes three is a broken filter.
  // Returning rows[0] would hide it.
  const result = await writeOne(
    "test",
    query({
      data: [participant({ id: "a" }), participant({ id: "b" })],
      error: null,
    }),
    "not found",
  )

  assert.equal(result.ok, false)
  assert.match(result.ok === false ? result.error : "", /more than one/)
})

test("writeOne translates known Postgres codes into readable messages", async () => {
  const denied = await writeOne(
    "test",
    query<ParticipantRow>({
      data: null,
      error: { code: "42501", message: "new row violates row-level security" },
    }),
    "not found",
  )
  assert.equal(denied.ok, false)
  assert.equal(denied.ok === false && denied.error, "Your role doesn't allow that change.")

  const dup = await writeOne(
    "test",
    query<ParticipantRow>({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    }),
    "not found",
  )
  assert.equal(dup.ok === false && dup.error, "That value is already in use.")
})

test("writeOne passes through an unrecognised error message", async () => {
  const result = await writeOne(
    "test",
    query<ParticipantRow>({
      data: null,
      error: { code: "XX000", message: "connection reset" },
    }),
    "not found",
  )
  assert.equal(result.ok === false && result.error, "connection reset")
})

test("writeOne survives the query throwing", async () => {
  const result = await writeOne<ParticipantRow>(
    "test",
    Promise.reject(new Error("network down")),
    "not found",
  )

  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.error, "Something went wrong saving that.")
})

// ── Detail form parsing ─────────────────────────────────────────────────────

import { parseParticipantForm } from "@/lib/data/participants"

function ptForm(over: Record<string, string | string[]> = {}): FormData {
  const base: Record<string, string | string[]> = {
    id: "p1",
    name: "Abdi Hussein Siyad",
    ndis_number: "431576794",
    dob: "1990-04-02",
    phone: "0400 111 222",
    address: "12 Dimboola Rd, Broadmeadows VIC",
    weekly_hours: "38",
    notes: "Core Flexible, agency managed",
    assigned_workers: [],
    ...over,
  }

  const fd = new FormData()
  for (const [k, v] of Object.entries(base)) {
    if (Array.isArray(v)) v.forEach((item) => fd.append(k, item))
    else fd.set(k, v)
  }
  return fd
}

test("REGRESSION: the payload never includes budget_lines or ndis_plan", () => {
  // Both are JSONB driving invoice pricing. Sending either would overwrite the
  // whole structure with whatever this form knew about it — which is nothing.
  const result = parseParticipantForm(ptForm())

  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.equal("budget_lines" in result.values, false)
  assert.equal("ndis_plan" in result.values, false)
  assert.equal("active" in result.values, false)
  assert.equal("archived_at" in result.values, false)

  // Exactly the eight fields this form owns.
  assert.deepEqual(Object.keys(result.values).sort(), [
    "address",
    "assigned_workers",
    "dob",
    "name",
    "ndis_number",
    "notes",
    "phone",
    "weekly_hours",
  ])
})

test("NDIS numbers are stripped of invisible characters", () => {
  // Copying out of a plan PDF routinely brings a zero-width space along; the
  // number looks right and never matches.
  const result = parseParticipantForm(
    ptForm({ ndis_number: "431​576​794" }),
  )

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.values.ndis_number, "431576794")
  assert.ok(result.cleanedFields.includes("NDIS number"))
})

test("participant name is required", () => {
  assert.equal(parseParticipantForm(ptForm({ name: "" })).ok, false)
  assert.equal(parseParticipantForm(ptForm({ name: "  " })).ok, false)
})

test("blank optional fields become null, not empty strings", () => {
  const result = parseParticipantForm(
    ptForm({ ndis_number: "", phone: "", address: "", notes: "", dob: "" }),
  )

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.values.ndis_number, null)
  assert.equal(result.values.phone, null)
  assert.equal(result.values.address, null)
  assert.equal(result.values.notes, null)
  assert.equal(result.values.dob, null)
})

test("weekly hours: blank is null, negative is rejected, 0 is allowed", () => {
  const blank = parseParticipantForm(ptForm({ weekly_hours: "" }))
  assert.equal(blank.ok && blank.values.weekly_hours, null)

  assert.equal(parseParticipantForm(ptForm({ weekly_hours: "-1" })).ok, false)

  const zero = parseParticipantForm(ptForm({ weekly_hours: "0" }))
  assert.equal(zero.ok, true)
  assert.equal(zero.ok && zero.values.weekly_hours, 0)
})

test("a malformed date of birth is rejected", () => {
  assert.equal(parseParticipantForm(ptForm({ dob: "02/04/1990" })).ok, false)
})

test("assigned workers collect every ticked checkbox", () => {
  const result = parseParticipantForm(
    ptForm({ assigned_workers: ["emp-1", "emp-2", "emp-3"] }),
  )

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.values.assigned_workers, ["emp-1", "emp-2", "emp-3"])
})

test("no ticked workers is an empty array, not null", () => {
  // null would read as "not provided" and leave the column alone; an empty
  // array is how you actually unassign everyone.
  const result = parseParticipantForm(ptForm({ assigned_workers: [] }))
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.values.assigned_workers, [])
})

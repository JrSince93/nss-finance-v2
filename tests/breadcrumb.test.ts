/**
 * Breadcrumb segment resolution.
 *
 * The component itself is a client component tied to `usePathname`, so what's
 * tested here is the decision it makes: which segments to show, and what to
 * call them. The logic is duplicated from `dynamic-breadcrumb.tsx` because
 * extracting it would be the only reason to export it — if that file changes,
 * this must change with it.
 */
import assert from "node:assert/strict"
import test from "node:test"

const ID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const labelMap: Record<string, string> = {
  dashboard: "Dashboard",
  "cash-book": "Cash Book",
  employees: "Employees",
  participants: "Participants",
  tax: "Tax & BAS",
}

/** Mirrors DynamicBreadcrumb's segment selection and labelling. */
function crumbs(pathname: string, registeredTitle: string | null): string[] {
  const all = pathname.split("/").filter(Boolean)

  const segments = all.filter(
    (segment, index) =>
      !(
        ID_SEGMENT.test(segment) &&
        index === all.length - 1 &&
        !registeredTitle
      ),
  )

  return segments.map((segment, index) => {
    const isLast = index === segments.length - 1
    return isLast && ID_SEGMENT.test(segment) && registeredTitle
      ? registeredTitle
      : labelMap[segment] ||
          segment.charAt(0).toUpperCase() + segment.slice(1)
  })
}

const LITA = "9cc220cd-113c-44a7-b401-e04506155ff6"

test("REGRESSION: a raw UUID never reaches the breadcrumb", () => {
  // Before the fix this rendered "Participants › 9cc220cd-113c-...".
  const before = crumbs(`/participants/${LITA}`, null)
  assert.deepEqual(before, ["Participants"])
  assert.ok(
    !before.some((c) => ID_SEGMENT.test(c)),
    "no crumb may be a raw id",
  )
})

test("a registered title replaces the id segment", () => {
  assert.deepEqual(crumbs(`/participants/${LITA}`, "Lita Lee McKenzie"), [
    "Participants",
    "Lita Lee McKenzie",
  ])
  assert.deepEqual(crumbs(`/employees/${LITA}`, "Jane Smith"), [
    "Employees",
    "Jane Smith",
  ])
})

test("ordinary routes are unaffected", () => {
  assert.deepEqual(crumbs("/participants", null), ["Participants"])
  assert.deepEqual(crumbs("/cash-book", null), ["Cash Book"])
  assert.deepEqual(crumbs("/tax", null), ["Tax & BAS"])
  // A registered title must not hijack a non-id page.
  assert.deepEqual(crumbs("/participants", "Lita Lee McKenzie"), [
    "Participants",
  ])
})

test("an unmapped segment is title-cased rather than dropped", () => {
  assert.deepEqual(crumbs("/something-new", null), ["Something-new"])
})

test("uppercase UUIDs are recognised too", () => {
  assert.deepEqual(crumbs(`/participants/${LITA.toUpperCase()}`, null), [
    "Participants",
  ])
})

test("a non-id trailing segment is never dropped", () => {
  // Guards against the filter being too eager and eating a real page.
  assert.deepEqual(crumbs("/employees/new", null), ["Employees", "New"])
  assert.deepEqual(crumbs("/participants/12345", null), [
    "Participants",
    "12345",
  ])
})

test("an id in a non-final position is left alone", () => {
  // Nothing routes this way today, but dropping a middle segment would break
  // the parent links of anything that did.
  assert.deepEqual(crumbs(`/participants/${LITA}/notes`, null), [
    "Participants",
    LITA,
    "Notes",
  ])
})

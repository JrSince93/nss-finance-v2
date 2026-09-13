import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  canAccess,
  isRole,
  landingPageFor,
  type PageSlug,
  type Role,
} from "@/lib/auth/roles"

/**
 * Data access layer for auth.
 *
 * `proxy.ts` only does an optimistic cookie check — Next's own guidance is
 * that proxy must not be the authorization boundary, because it also runs for
 * prefetches and can be bypassed by refactors that move a server function to
 * another route. Every protected page therefore calls `requireStaff()` here,
 * which is where the real check lives.
 *
 * Wrapped in React's `cache` so one render pass hits Supabase once, no matter
 * how many components ask.
 */

export type Staff = {
  id: string
  name: string
  role: Role
  employeeId: string | null
  email: string
}

/**
 * The signed-in user, verified against the Auth server.
 *
 * Deliberately `getUser()` rather than `getSession()`: the session comes from
 * cookies and, per Supabase's own warning, its user object must not be
 * trusted server-side.
 */
export const getUser = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) return null
  return data.user
})

/**
 * The signed-in user's `staff` row, or null if there isn't one.
 *
 * Fails closed. A signed-in user with no staff row gets nothing — same as the
 * production app, which signs them out. There is deliberately no
 * "staff table missing ⇒ treat as admin" fallback: that existed in the
 * production app only to cover the window before
 * `migrations/2026-09-11-staff-roles.sql` was run, and that migration has now
 * been applied.
 */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const user = await getUser()
  if (!user) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("staff")
    .select("id, name, role, employee_id")
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    console.error("[nss] staff lookup failed:", error.message)
    return null
  }

  if (!data || !isRole(data.role)) return null

  return {
    id: data.id,
    name: data.name,
    role: data.role,
    employeeId: data.employee_id ?? null,
    email: user.email ?? "",
  }
})

/**
 * Require a signed-in user with a staff row, optionally with access to a
 * specific page. Redirects rather than throwing, so it can be called straight
 * from a layout or page.
 */
export async function requireStaff(slug?: PageSlug): Promise<Staff> {
  const user = await getUser()
  if (!user) redirect("/sign-in")

  const staff = await getStaff()

  // Authenticated, but not a staff member — or a role we don't recognise.
  // `/no-access` rather than `/sign-in`, because the session is still valid
  // and proxy would bounce them straight back here: it offers a sign-out.
  if (!staff) redirect("/no-access")

  // Send them to their own landing page, never a fixed one — a page this role
  // also can't reach would redirect forever.
  if (slug && !canAccess(staff.role, slug)) {
    redirect(landingPageFor(staff.role))
  }

  return staff
}

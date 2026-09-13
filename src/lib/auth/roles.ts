/**
 * Roles and per-role page access.
 *
 * This mirrors `ROLE_TABS` / `canAccess()` in the existing production app, and
 * the RLS policies from `migrations/2026-09-11-staff-roles.sql`. RLS in
 * Supabase is the real enforcement — this only decides what the app shows and
 * which routes it will render, so the two must be kept in step.
 *
 * Roles are set from the Supabase SQL editor. The `staff` table has no insert
 * or update policy, so nobody can change their own role from the app.
 */

export const ROLES = ["admin", "office_manager", "accountant"] as const

export type Role = (typeof ROLES)[number]

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value)
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  office_manager: "Office Manager",
  accountant: "Accountant",
}

/** Every page slug in the app. Slugs match the route directory names. */
export type PageSlug =
  | "dashboard"
  | "cash-book"
  | "employees"
  | "participants"
  | "payroll"
  | "invoices"
  | "tax"
  | "reports"
  | "expenses"
  | "accountant"
  | "settings"

type NavItem = {
  slug: PageSlug
  title: string
  href: string
}

/** Sidebar order, matching the production app's sidebar. */
export const NAV_ITEMS: NavItem[] = [
  { slug: "dashboard", title: "Dashboard", href: "/dashboard" },
  { slug: "cash-book", title: "Cash Book", href: "/cash-book" },
  { slug: "employees", title: "Employees", href: "/employees" },
  { slug: "participants", title: "Participants", href: "/participants" },
  { slug: "payroll", title: "Payroll", href: "/payroll" },
  { slug: "invoices", title: "Invoices", href: "/invoices" },
  { slug: "tax", title: "Tax & BAS", href: "/tax" },
  { slug: "reports", title: "Reports", href: "/reports" },
  { slug: "accountant", title: "Accountant", href: "/accountant" },
  { slug: "expenses", title: "Expenses", href: "/expenses" },
]

/**
 * Which pages each role may reach.
 *
 * `accountant` has read-only RLS on `pay_runs`, `transactions` and
 * `invoice_ledger`, and no access at all to `employees` or `participants` —
 * so those two pages are absent rather than empty. In exchange it gets the
 * Accountant page, which nobody else sees: admin and office_manager have the
 * full pages and don't need a read-only summary of them.
 */
export const ROLE_ACCESS: Record<Role, PageSlug[]> = {
  admin: [
    "dashboard",
    "cash-book",
    "employees",
    "participants",
    "payroll",
    "invoices",
    "tax",
    "reports",
    "expenses",
    "settings",
  ],
  office_manager: [
    "dashboard",
    "cash-book",
    "employees",
    "participants",
    "payroll",
    "invoices",
    "tax",
    "reports",
    "expenses",
    "settings",
  ],
  accountant: [
    "accountant",
    "dashboard",
    "cash-book",
    "payroll",
    "invoices",
    "tax",
    "reports",
    "expenses",
    "settings",
  ],
}

export function canAccess(role: Role, slug: PageSlug): boolean {
  return ROLE_ACCESS[role].includes(slug)
}

export function navItemsFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => canAccess(role, item.slug))
}

/**
 * Where to send each role after login.
 *
 * The accountant lands on their own page — it's the read-only summary built
 * for them, and it's what `ROLE_TABS` puts first for that role in the
 * production app. Stated explicitly rather than derived from `NAV_ITEMS`
 * order, so reordering the sidebar can't silently move someone's landing page.
 */
const ROLE_LANDING: Record<Role, string> = {
  admin: "/dashboard",
  office_manager: "/dashboard",
  accountant: "/accountant",
}

export function landingPageFor(role: Role): string {
  return ROLE_LANDING[role]
}

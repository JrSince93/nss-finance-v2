"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { useBreadcrumbTitle } from "@/components/breadcrumb-title"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const labelMap: Record<string, string> = {
  dashboard: "Dashboard",
  "cash-book": "Cash Book",
  employees: "Employees",
  participants: "Participants",
  payroll: "Payroll",
  invoices: "Invoices",
  tax: "Tax & BAS",
  reports: "Reports",
  expenses: "Expenses",
  accountant: "Accountant",
  settings: "Settings",
  "sign-in": "Sign In",
  "no-access": "No Access",
}

/**
 * A record id in the path, e.g. `/participants/9cc220cd-…`.
 *
 * Matched loosely rather than as a strict UUID: what matters is "this segment
 * is an identifier, not a page name", and a slightly different id format
 * shouldn't start leaking raw keys into the breadcrumb.
 */
const ID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function DynamicBreadcrumb() {
  const pathname = usePathname()
  // The title a detail page registered for itself, if any.
  const registeredTitle = useBreadcrumbTitle()

  const allSegments = pathname.split("/").filter(Boolean)

  // Drop an id segment we have no name for rather than printing the raw key.
  // The page below it carries the record's name as its heading, so the trail
  // stays meaningful at "Participants" until the title registers.
  const segments = allSegments.filter(
    (segment, index) =>
      !(
        ID_SEGMENT.test(segment) &&
        index === allSegments.length - 1 &&
        !registeredTitle
      ),
  )

  if (segments.length === 0) return null

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const href = "/" + segments.slice(0, index + 1).join("/")
          const isLast = index === segments.length - 1

          const label =
            isLast && ID_SEGMENT.test(segment) && registeredTitle
              ? registeredTitle
              : labelMap[segment] ||
                segment.charAt(0).toUpperCase() + segment.slice(1)

          return (
            <BreadcrumbItem key={href} className={index === 0 && segments.length > 1 ? "hidden md:block" : undefined}>
              {isLast ? (
                <BreadcrumbPage>{label}</BreadcrumbPage>
              ) : (
                <>
                  <BreadcrumbLink render={<Link href={href} />}>
                    {label}
                  </BreadcrumbLink>
                  <BreadcrumbSeparator className="hidden md:block" />
                </>
              )}
            </BreadcrumbItem>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

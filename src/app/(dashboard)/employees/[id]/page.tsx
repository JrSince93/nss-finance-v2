import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeftIcon } from "lucide-react"

import { EmployeeForm } from "@/components/employees/employee-form"
import { SetBreadcrumbTitle } from "@/components/breadcrumb-title"
import { getEmployeeForEdit } from "@/lib/data/queries"
import { requireStaff } from "@/lib/auth/dal"

/**
 * Edit one employee.
 *
 * `requireStaff("employees")` is the route gate. The accountant role has no
 * `employees` entry in `ROLE_ACCESS`, so it redirects them to their own landing
 * page before any query runs — they have no route here at all, read-only or
 * otherwise. Admin and office_manager both reach it.
 *
 * An office manager reaching this URL for one of the two payroll-restricted
 * employees gets a 404, because RLS returns nothing for that id and this cannot
 * tell "hidden" from "missing" — which is the point.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireStaff("employees")

  const { id } = await params
  const employee = await getEmployeeForEdit(id)

  if (!employee) notFound()

  const employeeTitle = employee.name || "Unnamed employee"

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* Names the breadcrumb, which otherwise only sees the id in the URL. */}
      <SetBreadcrumbTitle title={employeeTitle} />

      <div className="flex flex-col gap-1">
        <Link
          href="/employees"
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeftIcon className="size-3.5" />
          All employees
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">
          {employeeTitle}
        </h1>
      </div>

      <EmployeeForm employee={employee} />
    </div>
  )
}

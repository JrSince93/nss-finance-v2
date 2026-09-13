import { BriefcaseIcon, UserCheckIcon, UsersIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { EmployeeTable } from "@/components/employees/employee-table"
import { SaveNotice } from "@/components/save-notice"
import { getEmployees } from "@/lib/data/queries"
import { requireStaff } from "@/lib/auth/dal"

/**
 * Employees.
 *
 * The accountant role has no `employees` policy and no route here — it is
 * absent from their sidebar rather than empty.
 *
 * An office manager reaches this page, but the two payroll-restricted
 * employees' rows are dropped by RLS before the query returns. Nothing on this
 * page filters by role or counts on a fixed number of employees, so it reads
 * correctly with them missing.
 */
/** Roles that may edit. Mirrors the check in the Server Action. */
const CAN_WRITE: string[] = ["admin", "office_manager"]

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string | string[]; cleaned?: string | string[] }>
}) {
  const staff = await requireStaff("employees")
  const [employees, params] = await Promise.all([getEmployees(), searchParams])

  const active = employees.filter((e) => e.active !== false).length
  const casual = employees.filter(
    (e) => (e.employment_type ?? "").toLowerCase() === "casual",
  ).length

  const stats = [
    {
      label: "Employees",
      value: employees.length.toLocaleString("en-AU"),
      icon: UsersIcon,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Active",
      value: active.toLocaleString("en-AU"),
      icon: UserCheckIcon,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Casual",
      value: casual.toLocaleString("en-AU"),
      icon: BriefcaseIcon,
      color: "text-muted-foreground",
      bg: "bg-muted",
    },
  ]

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <SaveNotice saved={params.saved} cleaned={params.cleaned} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
          >
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                stat.bg,
              )}
            >
              <stat.icon className={cn("size-4", stat.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="tabular-nums text-base font-semibold tracking-tight">
                {stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <EmployeeTable
        employees={employees}
        canWrite={CAN_WRITE.includes(staff.role)}
      />
    </div>
  )
}

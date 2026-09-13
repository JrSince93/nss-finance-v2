import { formatAud, formatDate } from "@/lib/format"
import type { EmployeeRow } from "@/lib/data/types"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/empty-state"

/**
 * A pay rate reads differently depending on how the employee is paid: an
 * hourly rate is per hour, a salary is per year. Showing `$65,000.00/hr` would
 * be worse than showing nothing.
 */
function payRate(employee: EmployeeRow): string {
  if (!employee.pay_rate) return "—"
  return employee.pay_type === "salary"
    ? `${formatAud(employee.pay_rate)}/yr`
    : `${formatAud(employee.pay_rate)}/hr`
}

export function EmployeeTable({ employees }: { employees: EmployeeRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Role</TableHead>
              <TableHead className="hidden md:table-cell">Employment</TableHead>
              <TableHead className="text-right">Pay rate</TableHead>
              <TableHead className="hidden lg:table-cell">Started</TableHead>
              <TableHead className="hidden xl:table-cell">Super fund</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState
                    variant="accounts"
                    title="No employees"
                    description="No employee records were returned for your role."
                    className="py-12"
                  />
                </TableCell>
              </TableRow>
            )}

            {employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {employee.name || "Unnamed"}
                    </span>
                    {employee.email && (
                      <span className="truncate text-xs text-muted-foreground">
                        {employee.email}
                      </span>
                    )}
                  </div>
                </TableCell>

                <TableCell className="hidden sm:table-cell">
                  <span className="text-sm text-muted-foreground">
                    {employee.role || "—"}
                  </span>
                </TableCell>

                <TableCell className="hidden md:table-cell">
                  <div className="flex flex-wrap items-center gap-1">
                    {employee.employment_type && (
                      <Badge variant="secondary" className="text-[10px]">
                        {employee.employment_type}
                      </Badge>
                    )}
                    {employee.active === false && (
                      <Badge variant="outline" className="text-[10px]">
                        Inactive
                      </Badge>
                    )}
                  </div>
                </TableCell>

                <TableCell className="text-right">
                  <span className="whitespace-nowrap tabular-nums text-sm font-medium">
                    {payRate(employee)}
                  </span>
                </TableCell>

                <TableCell className="hidden lg:table-cell">
                  <span className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(employee.start_date)}
                  </span>
                </TableCell>

                <TableCell className="hidden xl:table-cell">
                  <span className="truncate text-sm text-muted-foreground">
                    {employee.super_fund || "—"}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

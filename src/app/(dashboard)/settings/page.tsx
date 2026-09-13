import { Suspense } from "react"

import { SettingsPageClient } from "@/components/settings/settings-page-client"
import { requireStaff } from "@/lib/auth/dal"
import { ROLE_LABELS } from "@/lib/auth/roles"

export default async function Page() {
  const staff = await requireStaff("settings")

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <Suspense>
        <SettingsPageClient
          staff={{
            name: staff.name,
            email: staff.email,
            roleLabel: ROLE_LABELS[staff.role],
            hasEmployeeRecord: staff.employeeId !== null,
          }}
        />
      </Suspense>
    </div>
  )
}

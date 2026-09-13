import { ParticipantsClient } from "@/components/participants/participants-client"
import { getParticipants } from "@/lib/data/queries"
import { requireStaff } from "@/lib/auth/dal"

/** Roles that may archive and restore. Mirrors the check in the Server Action. */
const CAN_WRITE: string[] = ["admin", "office_manager"]

export default async function Page() {
  // The accountant role has no `participants` policy at all, and no route
  // here either — `requireStaff` redirects them before the query runs.
  const staff = await requireStaff("participants")
  const participants = await getParticipants()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <ParticipantsClient
        participants={participants}
        canWrite={CAN_WRITE.includes(staff.role)}
      />
    </div>
  )
}

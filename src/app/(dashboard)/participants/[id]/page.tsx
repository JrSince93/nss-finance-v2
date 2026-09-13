import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeftIcon } from "lucide-react"

import { archivedLabel, participantName } from "@/lib/data/participants"
import { getEmployees, getParticipantById } from "@/lib/data/queries"
import { requireStaff } from "@/lib/auth/dal"
import { ParticipantForm } from "@/components/participants/participant-form"
import { BudgetLinesPanel } from "@/components/participants/budget-lines-panel"
import { ArchiveButton } from "@/components/participants/archive-button"
import { Badge } from "@/components/ui/badge"

/** Roles that may reach this page at all. Mirrors the Server Action's check. */
const CAN_WRITE: string[] = ["admin", "office_manager"]

/**
 * One participant's detail and edit view.
 *
 * A route rather than a modal: the production app's participant modal carries
 * contact details, budget lines, schedule blocks, shift types and invoice
 * files, which is far too much for a dialog, and a route gives deep links and
 * its own loading state.
 *
 * Two parts of that modal are deliberately absent:
 *
 *   * **Schedule blocks** — blocked until the two data fixes in the production
 *     repo have been run. There are known duplicate and near-duplicate blocks
 *     for at least one participant, plus a sleepover `flat_hours` correction;
 *     shipping an editor first would make it easier to create more of them.
 *   * **Invoice files** — the `invoices` storage bucket still grants plain
 *     `authenticated`, so until `2026-09-13-storage-bucket-roles.sql` runs, an
 *     accountant login can read and delete from it. Upload should not ship
 *     before that.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const staff = await requireStaff("participants")

  // `requireStaff` already excludes the accountant (no `participants` entry in
  // ROLE_ACCESS). This is the belt to that braces: a role that can read the
  // list but not write gets sent back rather than shown an editable form.
  if (!CAN_WRITE.includes(staff.role)) redirect("/participants")

  const { id } = await params
  const [participant, employees] = await Promise.all([
    getParticipantById(id),
    getEmployees(),
  ])

  if (!participant) notFound()

  const archived = archivedLabel(participant)

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link
            href="/participants"
            className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeftIcon className="size-3.5" />
            All participants
          </Link>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
            {participantName(participant)}
            {archived && <Badge variant="outline">{archived}</Badge>}
          </h1>
        </div>

        <ArchiveButton
          id={participant.id}
          name={participantName(participant)}
          archived={Boolean(participant.archived_at)}
        />
      </div>

      <ParticipantForm
        participant={participant}
        employees={employees.filter((e) => e.active !== false)}
      />

      <BudgetLinesPanel participant={participant} />
    </div>
  )
}

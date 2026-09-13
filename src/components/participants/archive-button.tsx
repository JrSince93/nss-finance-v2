"use client"

import { useState, useTransition } from "react"
import { ArchiveIcon, ArchiveRestoreIcon, LoaderIcon } from "lucide-react"

import {
  archiveParticipant,
  restoreParticipant,
} from "@/lib/actions/participants"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Archive or restore one participant.
 *
 * Archiving asks first — it removes someone from the active roster, and the
 * production app confirms too. Restoring doesn't: it is the undo, and putting a
 * dialog in front of undo just makes a mistake harder to fix.
 *
 * An error is shown inline rather than thrown. The most likely cause is the
 * row having been archived by someone else since this page rendered, which is
 * a thing to tell the user, not a crash.
 */
export function ArchiveButton({
  id,
  name,
  archived,
}: {
  id: string
  name: string
  archived: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  function run(action: typeof archiveParticipant) {
    setError(null)
    startTransition(async () => {
      const result = await action(id)
      if (result.ok) {
        setConfirming(false)
      } else {
        setError(result.error ?? "That didn't work.")
      }
    })
  }

  if (archived) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(restoreParticipant)}
        >
          {pending ? (
            <LoaderIcon className="size-3.5 animate-spin" />
          ) : (
            <ArchiveRestoreIcon className="size-3.5" />
          )}
          Restore
        </Button>
        {error && (
          <p className="max-w-[22ch] text-right text-[11px] text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => {
          setError(null)
          setConfirming(true)
        }}
      >
        <ArchiveIcon className="size-3.5" />
        Archive
      </Button>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive {name}?</DialogTitle>
            <DialogDescription>
              They stop appearing in the active roster and the budget tracker.
              Nothing is deleted — their invoices, transactions and budget lines
              stay exactly as they are, and you can restore them at any time.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" disabled={pending} />}
            >
              Cancel
            </DialogClose>
            <Button
              disabled={pending}
              onClick={() => run(archiveParticipant)}
            >
              {pending && <LoaderIcon className="size-4 animate-spin" />}
              {pending ? "Archiving…" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

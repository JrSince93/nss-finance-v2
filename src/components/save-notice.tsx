import { CheckCircle2Icon } from "lucide-react"

/**
 * The "saved" banner a redirect-after-save lands on.
 *
 * A redirect discards the Server Action's return value, so the outcome travels
 * in the query string instead. That means these strings are user-controllable —
 * anyone can type `?saved=<whatever>` into the URL. React escapes them on
 * render so there is no injection, but they are still truncated here so a
 * crafted URL can't push a wall of text into the page.
 */

/** Long enough for a full name or a list of field labels, short enough to trust. */
const MAX = 120

function clamp(value: string | undefined): string | null {
  if (!value) return null
  const text = value.trim()
  if (!text) return null
  return text.length > MAX ? `${text.slice(0, MAX)}…` : text
}

export function SaveNotice({
  saved,
  cleaned,
}: {
  saved?: string | string[]
  cleaned?: string | string[]
}) {
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v

  const name = clamp(first(saved))
  if (!name) return null

  const cleanedFields = clamp(first(cleaned))

  return (
    <div
      role="status"
      className="flex flex-col gap-1 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400"
    >
      <p className="flex items-center gap-2">
        <CheckCircle2Icon className="size-4 shrink-0" />
        Saved {name}.
      </p>
      {cleanedFields && (
        <p className="pl-6 text-xs">
          Removed hidden formatting characters from: {cleanedFields}.
        </p>
      )}
    </div>
  )
}

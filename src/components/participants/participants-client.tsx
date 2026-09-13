"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import {
  activeBudgetLines,
  budgetLineTypeLabel,
} from "@/lib/data/budget-lines"
import { partitionByArchived } from "@/lib/data/participants"
import type { ParticipantRow } from "@/lib/data/types"
import { EmptyState } from "@/components/empty-state"
import { ParticipantSummary } from "@/components/participants/participant-summary"
import { ParticipantCard } from "@/components/participants/participant-card"
import { ArchivedList } from "@/components/participants/archived-list"

/**
 * Participants.
 *
 * The template filtered by account type (checking, savings, crypto,
 * investment). Those tabs are replaced by the budget line types a participant
 * actually holds, derived from the data rather than hardcoded — the production
 * app's rate cards define core, sil, community, employment and custom, and a
 * fixed list would go stale the moment one is added.
 *
 * The template's "Add account" tile was removed: creating a participant means
 * NDIS numbers, plan dates and multi-line budgets, which is the production
 * app's job.
 */
export function ParticipantsClient({
  participants,
  canWrite,
}: {
  participants: ParticipantRow[]
  /**
   * Whether this role may archive and restore. The Server Action checks the
   * role again — this only decides whether a control is drawn.
   */
  canWrite: boolean
}) {
  const [selectedType, setSelectedType] = useState("all")
  const [showArchived, setShowArchived] = useState(false)

  const { active, archived } = useMemo(
    () => partitionByArchived(participants),
    [participants],
  )

  const types = useMemo(() => {
    const found = new Map<string, string>()
    // Types come from the active roster only — a budget line type that exists
    // solely on an archived participant shouldn't add a filter tab that
    // matches nothing.
    for (const participant of active) {
      for (const line of activeBudgetLines(participant)) {
        const key = (line.rate_card ?? "").toLowerCase()
        if (key) found.set(key, budgetLineTypeLabel(line))
      }
    }
    return Array.from(found, ([value, label]) => ({ value, label })).sort(
      (a, b) => a.label.localeCompare(b.label),
    )
  }, [active])

  // Filters apply to the active roster. The archived list is its own section
  // below, deliberately unfiltered — it is a short history list, not a view.
  const filtered = useMemo(() => {
    if (selectedType === "all") return active
    return active.filter((participant) =>
      activeBudgetLines(participant).some(
        (line) => (line.rate_card ?? "").toLowerCase() === selectedType,
      ),
    )
  }, [active, selectedType])

  return (
    <div className="flex flex-col gap-4">
      <ParticipantSummary participants={filtered} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {types.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {[{ value: "all", label: "All" }, ...types].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setSelectedType(tab.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  selectedType === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}

        {archived.length > 0 && (
          <button
            onClick={() => setShowArchived((shown) => !shown)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={showArchived}
          >
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          variant={active.length === 0 ? "accounts" : "filter"}
          title={
            active.length === 0
              ? archived.length > 0
                ? "Every participant is archived"
                : "No participants"
              : "No participants with this budget line"
          }
          description={
            active.length === 0
              ? archived.length > 0
                ? "Show the archived list below to restore one."
                : "No participant records were returned for your role."
              : "Try a different budget line type."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((participant, i) => (
            <ParticipantCard
              key={participant.id}
              participant={participant}
              index={i}
              canWrite={canWrite}
            />
          ))}
        </div>
      )}

      {showArchived && (
        <ArchivedList participants={archived} canWrite={canWrite} />
      )}
    </div>
  )
}

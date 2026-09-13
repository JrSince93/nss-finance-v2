"use client"

import { SearchIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** In or out — the only classification the cash book actually records. */
export type DirectionFilter = "all" | "in" | "out"

interface TransactionFiltersProps {
  search: string
  setSearch: (v: string) => void
  direction: DirectionFilter
  setDirection: (v: DirectionFilter) => void
  paymentType: string
  setPaymentType: (v: string) => void
  paymentTypes: string[]
}

const directionOptions: { value: DirectionFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in", label: "In" },
  { value: "out", label: "Out" },
]

/**
 * Search, payment type, and direction.
 *
 * The template also filtered by category and status. Neither exists on
 * `transactions` — there is no category column anywhere in the schema, and
 * status belongs to pay runs and invoices, not cash book rows. Both selects
 * were removed rather than backed with invented values. `payment_type` (EFT,
 * cash, card) is the one real classifier the table carries, so it takes their
 * place.
 */
export function TransactionFilters({
  search,
  setSearch,
  direction,
  setDirection,
  paymentType,
  setPaymentType,
  paymentTypes,
}: TransactionFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:min-w-[200px] sm:flex-1">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search description or reference..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {paymentTypes.length > 0 && (
        <Select
          value={paymentType}
          onValueChange={(v) => v && setPaymentType(v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Payment type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payment types</SelectItem>
            {paymentTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex items-center rounded-lg border border-border p-0.5">
        {directionOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setDirection(option.value)}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              direction === option.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

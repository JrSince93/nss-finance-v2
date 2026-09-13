import { CashBookClient } from "@/components/cash-book/cash-book-client"
import { getDropdownOptions, getTransactions } from "@/lib/data/queries"
import { buildPrefixMap, buildReferenceGuide } from "@/lib/data/references"
import { requireStaff } from "@/lib/auth/dal"

export default async function Page() {
  await requireStaff("cash-book")

  const [transactions, dropdownOptions] = await Promise.all([
    getTransactions(),
    getDropdownOptions(),
  ])

  // Custom categories stay in `created_at` order — `buildPrefixMap` derives
  // prefixes by clash-avoidance, so reordering them would reassign prefixes
  // that live transactions already use.
  const customDescriptions = dropdownOptions
    .filter((option) => option.field === "description")
    .map((option) => option.value ?? "")
    .filter(Boolean)

  const referenceRows = buildReferenceGuide(
    buildPrefixMap(customDescriptions),
    transactions.map((tx) => tx.reference),
  )

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <CashBookClient
        transactions={transactions}
        referenceRows={referenceRows}
      />
    </div>
  )
}

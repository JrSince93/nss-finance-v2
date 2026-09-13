import { InvoicesClient } from "@/components/invoices/invoices-client"
import { getInvoices } from "@/lib/data/queries"
import { requireStaff } from "@/lib/auth/dal"

export default async function Page() {
  await requireStaff("invoices")
  const invoices = await getInvoices()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <InvoicesClient invoices={invoices} />
    </div>
  )
}

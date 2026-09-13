import {
  DashboardCustomizer,
  type Block,
} from "@/components/dashboard/dashboard-customizer"
import { KpiCards } from "@/components/dashboard/kpi-cards"
import { NetActivity } from "@/components/dashboard/net-activity"
import { MoneyMovement } from "@/components/dashboard/money-movement"
import { RecentTransactions } from "@/components/dashboard/recent-transactions"
import { getDashboardData } from "@/lib/data/dashboard"
import { requireStaff } from "@/lib/auth/dal"

/**
 * Dashboard.
 *
 * Four widgets, all reading real data. The template's financial health score,
 * spending limit and quick transfer were removed rather than reskinned: the
 * health score was six invented advisory factors, the spending limit had no
 * limit stored anywhere, and quick transfer was a write with no destination.
 * Nothing in the schema backs any of them.
 *
 * Widgets are built here, on the server, and handed to the customizer as
 * elements — it reorders them and persists that order per browser, but never
 * fetches.
 */
export default async function Page() {
  await requireStaff("dashboard")
  const data = await getDashboardData()

  const blocks: Block[] = [
    {
      id: "kpis",
      label: "Key figures",
      size: "full",
      component: <KpiCards data={data} />,
    },
    {
      id: "net-activity",
      label: "Net activity",
      size: "lg",
      component: <NetActivity months={data.months} />,
    },
    {
      id: "money-movement",
      label: "Money movement",
      size: "sm",
      component: <MoneyMovement months={data.months} />,
    },
    {
      id: "recent-transactions",
      label: "Recent transactions",
      size: "full",
      component: <RecentTransactions transactions={data.recent} />,
    },
  ]

  return <DashboardCustomizer defaultBlocks={blocks} />
}

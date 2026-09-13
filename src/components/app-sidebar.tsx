"use client"

import * as React from "react"
import Link from "next/link"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { navItemsFor, type PageSlug, type Role } from "@/lib/auth/roles"
import {
  LayoutDashboardIcon,
  BookOpenIcon,
  UsersIcon,
  UserIcon,
  BanknoteIcon,
  FileTextIcon,
  ReceiptIcon,
  BarChart3Icon,
  CalculatorIcon,
  CreditCardIcon,
  SettingsIcon,
  StarIcon,
} from "lucide-react"

const icons: Record<PageSlug, React.ReactNode> = {
  dashboard: <LayoutDashboardIcon />,
  "cash-book": <BookOpenIcon />,
  employees: <UsersIcon />,
  participants: <UserIcon />,
  payroll: <BanknoteIcon />,
  invoices: <FileTextIcon />,
  tax: <ReceiptIcon />,
  reports: <BarChart3Icon />,
  expenses: <CreditCardIcon />,
  accountant: <CalculatorIcon />,
  settings: <SettingsIcon />,
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  staff: {
    name: string
    email: string
    role: Role
  }
}

export function AppSidebar({ staff, ...props }: AppSidebarProps) {
  // One flat group in the production sidebar's order, filtered by role —
  // an accountant has no Employees or Participants item at all.
  const items = navItemsFor(staff.role).map((item) => ({
    title: item.title,
    url: item.href,
    icon: icons[item.slug],
  }))

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <StarIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Northern Star</span>
                <span className="truncate text-xs text-muted-foreground">
                  Support Services
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} />
        <NavSecondary className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser staff={staff} />
      </SidebarFooter>
    </Sidebar>
  )
}

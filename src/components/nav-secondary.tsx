"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SettingsIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

/**
 * Settings sits below the main nav, away from the working pages.
 *
 * The template's notification popover lived here; there is no notifications
 * feature in this app, so it went with the page.
 */
export function NavSecondary({
  ...props
}: React.ComponentProps<typeof SidebarGroup>) {
  const pathname = usePathname()

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              isActive={pathname === "/settings"}
              tooltip="Settings"
              render={<Link href="/settings" />}
            >
              <SettingsIcon />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

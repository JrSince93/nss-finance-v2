import { AppSidebar } from "@/components/app-sidebar"
import { BreadcrumbTitleProvider } from "@/components/breadcrumb-title"
import { CommandPalette } from "@/components/command-palette"
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb"
import { ThemeToggle } from "@/components/theme-toggle"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { requireStaff } from "@/lib/auth/dal"
import { navItemsFor } from "@/lib/auth/roles"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The real gate. `proxy.ts` only does an optimistic cookie check; this is
  // what resolves the session against the Auth server and the `staff` row.
  const staff = await requireStaff()

  return (
    <SidebarProvider>
      {/*
        The provider wraps both the header and the page: a detail page renders
        `SetBreadcrumbTitle` to name itself, and the breadcrumb in the header
        reads it. Data can't flow upward from a page to its layout, so this is
        how `/participants/<uuid>` gets to say "Lita Lee McKenzie".
      */}
      <BreadcrumbTitleProvider>
        <AppSidebar
          staff={{ name: staff.name, email: staff.email, role: staff.role }}
        />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-vertical:h-4 data-vertical:self-auto"
              />
              <DynamicBreadcrumb />
            </div>
            <div className="ml-auto flex items-center gap-2 pr-4">
              <kbd className="pointer-events-none hidden h-6 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
              <ThemeToggle />
            </div>
          </header>
          <CommandPalette pages={navItemsFor(staff.role)} />
          <main className="flex flex-1 flex-col">{children}</main>
        </SidebarInset>
      </BreadcrumbTitleProvider>
    </SidebarProvider>
  )
}

"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  ArrowRightIcon,
  MoonIcon,
  SunIcon,
  MonitorIcon,
  SettingsIcon,
} from "lucide-react"
import { useTheme } from "next-themes"

type PageTarget = {
  title: string
  href: string
}

/**
 * ⌘K palette.
 *
 * Pages come from the caller so the palette can only offer what the signed-in
 * role may actually reach — otherwise it would be a way around the sidebar
 * filtering. The template's seed-data entries (recent transactions, contacts,
 * coins) are gone; real record search arrives with the Supabase queries.
 */
export function CommandPalette({ pages }: { pages: PageTarget[] }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { setTheme } = useTheme()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const run = useCallback((fn: () => void) => {
    setOpen(false)
    fn()
  }, [])

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Jump to a page or change the theme"
    >
      <Command>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Pages">
            {pages.map((page) => (
              <CommandItem
                key={page.href}
                onSelect={() => run(() => router.push(page.href))}
              >
                <ArrowRightIcon className="mr-2 size-4" />
                {page.title}
              </CommandItem>
            ))}
            <CommandItem onSelect={() => run(() => router.push("/settings"))}>
              <SettingsIcon className="mr-2 size-4" />
              Settings
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Theme">
            <CommandItem onSelect={() => run(() => setTheme("light"))}>
              <SunIcon className="mr-2 size-4" />
              Light Mode
            </CommandItem>
            <CommandItem onSelect={() => run(() => setTheme("dark"))}>
              <MoonIcon className="mr-2 size-4" />
              Dark Mode
            </CommandItem>
            <CommandItem onSelect={() => run(() => setTheme("system"))}>
              <MonitorIcon className="mr-2 size-4" />
              System Theme
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

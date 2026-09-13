"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

/**
 * Letting a detail page name itself in the breadcrumb.
 *
 * The breadcrumb is rendered by the dashboard layout, which sits above every
 * page and knows only the pathname — so on `/participants/<uuid>` it has no way
 * to reach the participant's name. Data can't flow upward from a page to its
 * own layout, so the page registers a title here and the layout reads it.
 *
 * The registration happens in an effect, which means it isn't there for the
 * first paint. Rather than showing a raw UUID and swapping it a frame later,
 * `DynamicBreadcrumb` omits an unresolved id segment entirely: the crumb reads
 * "Participants", then becomes "Participants › Lita Lee McKenzie". A page that
 * forgets to register simply keeps the shorter trail, which is correct rather
 * than broken.
 */

type BreadcrumbTitleContext = {
  title: string | null
  setTitle: (title: string | null) => void
}

const Context = createContext<BreadcrumbTitleContext | null>(null)

export function BreadcrumbTitleProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [title, setTitle] = useState<string | null>(null)
  const value = useMemo(() => ({ title, setTitle }), [title])

  return <Context value={value}>{children}</Context>
}

/** The registered title for the current page, or null. */
export function useBreadcrumbTitle(): string | null {
  return useContext(Context)?.title ?? null
}

/**
 * Register the current page's title. Renders nothing.
 *
 * Clears on unmount so navigating from one record to another can't leave the
 * previous name showing against the new id.
 */
export function SetBreadcrumbTitle({ title }: { title: string }) {
  const context = useContext(Context)
  const setTitle = context?.setTitle

  // `setTitle` comes from a memo keyed on `title`, so it changes whenever the
  // value does. Wrapping keeps the effect's dependency list honest.
  const register = useCallback(
    (value: string | null) => setTitle?.(value),
    [setTitle],
  )

  useEffect(() => {
    register(title)
    return () => register(null)
  }, [register, title])

  return null
}

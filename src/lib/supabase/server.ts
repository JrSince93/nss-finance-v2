import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env"

/**
 * Server-side Supabase client, scoped to one request.
 *
 * Never cache or share this between requests — it closes over that request's
 * cookies. `@supabase/ssr` requires `getAll`/`setAll`; the deprecated
 * `get`/`set`/`remove` trio mishandles refresh edge cases.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server components can't set cookies. `proxy.ts` refreshes the
          // session on every request, so a write that lands here is redundant
          // rather than lost.
        }
      },
    },
  })
}

"use client"

import { createBrowserClient } from "@supabase/ssr"

import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env"

/**
 * Browser-side Supabase client. Session lives in cookies (not localStorage) so
 * that server components and `proxy.ts` can read it on the same request.
 *
 * `createBrowserClient` is a singleton by default, so calling this repeatedly
 * is cheap and returns the same client.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey())
}

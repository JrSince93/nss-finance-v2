import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env"

/**
 * Session refresh + a coarse signed-in/signed-out redirect.
 *
 * Next 16 renamed `middleware.ts` to `proxy.ts` (the function must be named
 * `proxy`, or be the default export).
 *
 * This is deliberately NOT the authorization boundary. Next's own guidance is
 * that proxy runs for prefetches and can be skipped by refactors that move a
 * server function to another route, so the real per-role check lives in
 * `src/lib/auth/dal.ts` and runs in every protected layout. What proxy is
 * genuinely needed for is writing refreshed auth cookies back onto the
 * response — without a `getUser()`/`getClaims()` call here, tokens never
 * refresh and users get logged out mid-session.
 */

/**
 * Auth pages: reachable without a session, and a signed-in user is bounced
 * off them to the app.
 *
 * `/no-access` is deliberately absent: it needs a session (it's where the DAL
 * sends a signed-in user who has no `staff` row), and listing it here would
 * bounce that user to /dashboard, which sends them back — a loop.
 */
const AUTH_PATHS = ["/sign-in"]

/**
 * Always reachable, signed in or not, and never redirected. The health check
 * has to answer an uptime monitor that has no session.
 */
const OPEN_PATHS = ["/api/health"]

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }

        response = NextResponse.next({ request })

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }

        // Responses that set auth cookies must not be cached by a CDN, or one
        // user's token can be served to another. @supabase/ssr hands us the
        // required no-store headers alongside the cookies.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value)
        }
      },
    },
  })

  // Must run before the response is returned, or a refresh that completes
  // later can't be written back.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const matches = (paths: string[]) =>
    paths.some((path) => pathname === path || pathname.startsWith(`${path}/`))

  if (matches(OPEN_PATHS)) {
    return response
  }

  const isAuthPath = matches(AUTH_PATHS)

  if (!user && !isAuthPath) {
    const url = request.nextUrl.clone()
    url.pathname = "/sign-in"
    url.search = ""
    return NextResponse.redirect(url)
  }

  if (user && isAuthPath) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  /**
   * Everything except Next's internals and static assets. API routes are
   * included so a route handler can't be reached without a session.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$).*)",
  ],
}

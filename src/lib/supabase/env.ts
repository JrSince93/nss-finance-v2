/**
 * Supabase connection details, read from the environment only.
 *
 * The keys are never hardcoded here. The Supabase project this app talks to
 * (`bhqjsqwbsbhjuhjwxwcp`) is shared with the existing production app, and
 * embedding the key in source is how it ended up publicly readable there.
 */

function required(name: string): string {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill it in, ` +
        `or set it in the Netlify site's environment variables.`,
    )
  }

  return value
}

export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL")
}

export function supabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY")
}

"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { isRole, landingPageFor } from "@/lib/auth/roles"

export type SignInState = {
  error?: string
}

/**
 * Email/password sign-in against Supabase Auth, then route the user to the
 * first page their role can reach.
 *
 * There is no self-registration in this app: staff are created in the Supabase
 * dashboard and their role is set in the SQL editor (the `staff` table has no
 * insert or update policy). So there is no sign-up counterpart to this.
 */
export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    return { error: "Enter your email and password." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    // Deliberately not distinguishing "no such user" from "wrong password".
    return { error: "Those details didn't match an account." }
  }

  const { data: staff } = await supabase
    .from("staff")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle()

  if (!staff || !isRole(staff.role)) {
    redirect("/no-access")
  }

  redirect(landingPageFor(staff.role))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/sign-in")
}

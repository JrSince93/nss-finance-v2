import { ShieldOffIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { signOut } from "@/lib/auth/actions"
import { getUser } from "@/lib/auth/dal"

/**
 * Where a signed-in user with no `staff` row lands.
 *
 * The app fails closed: authenticating with Supabase proves who you are, but
 * a `staff` row is what grants access, and it can only be created from the
 * Supabase SQL editor. RLS enforces the same thing at the database, so this
 * page is the explanation rather than the barrier.
 */
export default async function NoAccessPage() {
  const user = await getUser()

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-muted">
            <ShieldOffIcon className="size-5 text-muted-foreground" />
          </div>
          <CardTitle>No access</CardTitle>
          <CardDescription>
            {user?.email ? (
              <>
                <span className="font-medium text-foreground">
                  {user.email}
                </span>{" "}
                signed in successfully, but has no staff record in this system.
              </>
            ) : (
              <>This account has no staff record in this system.</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            An administrator needs to add you to the staff table and set your
            role before you can use the app.
          </p>
          <form action={signOut}>
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

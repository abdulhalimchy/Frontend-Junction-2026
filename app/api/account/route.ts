import { cookies } from "next/headers";
import { AUTH_COOKIES } from "@/lib/auth";
import { deleteAccount } from "@/lib/backend/account";
import { ROLE_COOKIE } from "@/lib/session";
import { STARTUP_COOKIE } from "@/lib/startup-cookie";
import { fail } from "../startups/fail";

/** Every cookie Warmline sets in the browser. Deleting the account clears them all. */
// "wl_intro_from" is FROM_COOKIE in components/warmline/intro-form.tsx, a client module this route can't import.
const COOKIES = [...AUTH_COOKIES, ROLE_COOKIE, STARTUP_COOKIE, "wl_intro_from"];

/** Deletes the account: everything on the backend first, then the browser's cookies. */
export async function DELETE() {
  try {
    await deleteAccount();
  } catch (e) {
    return fail(e, "Could not delete your account.");
  }
  const store = await cookies();
  for (const name of COOKIES) store.delete(name);
  return new Response(null, { status: 204 });
}

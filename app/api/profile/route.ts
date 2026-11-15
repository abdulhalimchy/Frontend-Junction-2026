import { NextResponse } from "next/server";
import { ROLE_COOKIE, roleCookieOptions } from "@/lib/account";
import { updateProfile, type ProfilePatch } from "@/lib/backend/account";
import { fail } from "../startups/fail";

const GOAL_MAX = 20;

/** Saves the role, goals or onboarding state on the backend profile. A new role also goes into the role cookie. */
export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const patch: ProfilePatch = {};
  if (body?.role === "founder" || body?.role === "investor") patch.role = body.role;
  if (Array.isArray(body?.goals)) patch.goals = body.goals.filter((g): g is string => typeof g === "string").slice(0, GOAL_MAX);
  if (typeof body?.onboarding_completed === "boolean") patch.onboarding_completed = body.onboarding_completed;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });

  try {
    const profile = await updateProfile(patch);
    const res = NextResponse.json(profile);
    if (patch.role) res.cookies.set(ROLE_COOKIE, patch.role, roleCookieOptions);
    return res;
  } catch (e) {
    return fail(e, "Could not save your profile.");
  }
}

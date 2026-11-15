import "server-only";
import type { Role } from "@/lib/types";
import { backendError, backendFetch } from "./client";

export type BackendProfile = {
  role: Role | "";
  title: string;
  goals: string[];
  is_onboarded: boolean;
  onboarding_completed_at: string | null;
  show_in_event_directory: boolean;
  allow_alerts_email: boolean;
  created_at: string;
  updated_at: string;
};

export type Me = {
  id: string;
  email: string;
  full_name: string;
  date_joined: string;
  last_login: string | null;
  profile: BackendProfile;
};

/** The signed-in user with their profile (role, goals, onboarding state). */
export async function getMe(): Promise<Me> {
  const res = await backendFetch("/accounts/me/");
  if (!res.ok) throw await backendError(res);
  return res.json();
}

export type ProfilePatch = { role?: Role; goals?: string[]; onboarding_completed?: boolean };

export async function updateProfile(patch: ProfilePatch): Promise<BackendProfile> {
  const res = await backendFetch("/accounts/me/profile/", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw await backendError(res);
  return res.json();
}

/** Everything the backend stores about the user, as JSON (GDPR access and portability). */
export async function exportData(): Promise<unknown> {
  const res = await backendFetch("/accounts/me/export/");
  if (!res.ok) throw await backendError(res);
  return res.json();
}

/**
 * Permanently deletes the signed-in user's backend account and everything it owns (startups, deck checks and
 * their PDFs, portfolio, market history, watch list, alerts, RSVPs). Google accounts have no password, so none
 * is sent; the user confirms in the UI by typing "delete".
 */
export async function deleteAccount() {
  const res = await backendFetch("/accounts/me/delete/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw await backendError(res);
}

import { AuthForm } from "@/components/warmline/auth-form";

export const metadata = { title: "Sign in" };

// Mocked until real auth lands: see components/warmline/auth-form.tsx.
export default function SignInPage() {
  return <AuthForm mode="sign-in" />;
}

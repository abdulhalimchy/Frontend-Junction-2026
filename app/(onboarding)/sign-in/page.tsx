import { AuthForm } from "@/components/warmline/auth-form";

export const metadata = { title: "Sign in" };

// Google sign-in: see components/warmline/auth-form.tsx.
export default function SignInPage() {
  return <AuthForm mode="sign-in" />;
}

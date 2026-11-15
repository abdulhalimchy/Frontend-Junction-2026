import { AuthForm } from "@/components/warmline/auth-form";

export const metadata = { title: "Create your account" };

// Google sign-in: see components/warmline/auth-form.tsx.
export default function SignUpPage() {
  return <AuthForm mode="sign-up" />;
}

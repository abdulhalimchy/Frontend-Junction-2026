import { AuthForm } from "@/components/warmline/auth-form";

export const metadata = { title: "Create your account" };

// Mocked until real auth lands: see components/warmline/auth-form.tsx.
export default function SignUpPage() {
  return <AuthForm mode="sign-up" />;
}

import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSessionFromCookies } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getSessionFromCookies();

  if (session) {
    redirect("/");
  }

  return <LoginForm />;
}

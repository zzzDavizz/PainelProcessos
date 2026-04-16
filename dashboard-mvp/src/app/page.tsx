import { redirect } from "next/navigation";
import DashboardView from "@/components/dashboard/DashboardView";
import { getSessionFromCookies } from "@/lib/auth";

export default async function Home() {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  return <DashboardView />;
}

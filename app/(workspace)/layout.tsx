import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "../../components/app-shell";
import { createClient } from "../../lib/supabase/server";

export default async function WorkspaceLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    redirect("/login?error=configuration");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return <AppShell role={profile?.role ?? "viewer"} email={user.email ?? ""}>{children}</AppShell>;
}

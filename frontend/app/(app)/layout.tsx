
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { ResultsProvider } from "@/lib/results";
import { createClient } from "@/lib/supabase/server";

// Shared layout for application pages.
// Redirects unauthenticated visitors to Login.
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();

   if (error || !data?.claims) {
     redirect("/login");
  }

  return (
    <ResultsProvider>
      <AppHeader />
      {children}
    </ResultsProvider>
  );
}

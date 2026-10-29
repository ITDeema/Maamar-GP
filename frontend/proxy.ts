
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Runs before matching requests to keep Supabase
// authentication cookies synchronized and refreshed.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
